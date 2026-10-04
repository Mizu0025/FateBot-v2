import 'dotenv/config';
import IRC from 'irc-framework';
import { BOT_CONFIG } from './config/constants';
import { logger } from './config/logger';
import { CommandHandler } from './handlers/command-handler';
import { MessageHandler } from './handlers/message-handler';
import { ComfyUiServiceManager } from './managers/comfyui-service-manager';
import { InactivityManager } from './managers/inactivity-manager';
import { PromptQueue } from './queue/queue';
import { GenerationWorker } from './queue/worker';
import type {
    IrcClient,
    IrcConnectOptions,
    IrcErrorEvent,
    IrcJoinEvent,
    IrcMessageEvent,
    IrcRawEvent,
} from './types/irc';

/**
 * Redacts credential-bearing IRC lines before they are written to the journal
 * (P1-2). The `raw` stream includes the SASL handshake — `AUTH` and
 * `CAP REQ ... account-token=…` — whose payloads are the password/token in
 * plaintext, plus any `PASS` line. We blank the value so a journal reader
 * still sees *that* authentication happened but not the secret.
 *
 * Anything else (plain chat, NICK, USER, PING) is passed through untouched.
 * Exported so the redaction logic can be unit-tested without a live IRC server.
 */
export function redactIrcLine(line: string): string {
    return (
        line
            // SASL: `AUTH <base64>` — drop the token.
            .replace(/^(\s*AUTH)\s+\S+/gm, '$1 <redacted>')
            // SASL: `CAP REQ ... account-token=<token>` — drop just the token value.
            .replace(/(account-token=)\S+/g, '$1<redacted>')
            // `PASS <password>` — drop the password value.
            .replace(/^(\s*PASS)\s+\S+/gm, '$1 <redacted>')
            // `WEBIRC <password> …` — first arg after the keyword.
            .replace(/^(\s*WEBIRC)\s+\S+/gm, '$1 <redacted>')
    );
}

/**
 * The main bot client class that orchestrates the IRC connection,
 * prompt queue, and message handling.
 */
export class FateBot {
    private bot: IrcClient;
    private queue: PromptQueue;
    private service: ComfyUiServiceManager;
    private inactivityManager: InactivityManager;
    private commandHandler: CommandHandler;
    private messageHandler: MessageHandler;
    private worker: GenerationWorker;

    /** Guards against duplicate shutdown calls (e.g. SIGINT then SIGTERM). */
    private shuttingDown = false;

    /**
     * Initializes all bot components and sets up event listeners.
     */
    constructor() {
        this.bot = new IRC.Client() as IrcClient;
        this.queue = new PromptQueue();
        this.service = new ComfyUiServiceManager();
        this.inactivityManager = new InactivityManager(this.queue, this.service);
        this.commandHandler = new CommandHandler(this.bot, this.queue, this.inactivityManager, this.service);
        this.messageHandler = new MessageHandler(this.commandHandler);
        this.worker = new GenerationWorker(this.queue, this.service, (channel, message) =>
            this.bot.say(channel, message),
        );

        this.setupEventListeners();
    }

    /**
     * Starts the background generation worker.
     */
    public startWorkers() {
        this.worker.start();
    }

    /**
     * Runs the graceful-shutdown path: stops the generation worker and the
     * inactivity timer (P0-3). Idempotent — the first call does the work,
     * later calls are no-ops.
     *
     * Called from the process signal + uncaught handlers in {@link bot.ts};
     * a subsequent `process.exit()` gives the in-flight request time to wind
     * down (the worker's in-flight item finishes first, as designed).
     */
    public async shutdown(signalName = 'signal'): Promise<void> {
        if (this.shuttingDown) {
            return;
        }
        this.shuttingDown = true;
        logger.info(`FateBot received ${signalName}, shutting down gracefully`);

        try {
            // Stop the worker — the loop exits after the in-flight item.
            this.worker.stop();
        } catch (error) {
            logger.error('Error stopping the generation worker during shutdown:', error);
        }

        try {
            // Stop the inactivity timer so its callback can't fire during teardown.
            this.inactivityManager.stop();
        } catch (error) {
            logger.error('Error stopping the inactivity manager during shutdown:', error);
        }

        // Disconnect the IRC socket gracefully: `quit` sends QUIT and ends
        // the connection (irc-framework has no `close`).
        try {
            this.bot.quit('FateBot is shutting down');
        } catch (error) {
            logger.debug('Ignoring error quitting the IRC connection during shutdown:', error);
        }

        logger.info('FateBot shutdown complete');
    }

    /**
     * Sets up listeners for IRC events like 'registered', 'join', and 'message'.
     */
    private setupEventListeners() {
        // 1. Raw protocol traffic (every IRC line sent/received).
        //    Debug-gated AND redacted (P1-2): the raw stream carries the SASL
        //    `AUTH`/`CAP REQ ... account-token` handshake, so an unconditional
        //    `console.log` would dump credentials to the journal.
        this.bot.on('raw', (event: IrcRawEvent) => {
            logger.debug(`[RAW ${event.from_server ? '<<' : '>>'}] ${redactIrcLine(event.line)}`);
        });

        // 2. Socket-level errors (e.g. ECONNREFUSED, TLS handshake failure, timeout)
        this.bot.on('socket error', (err: Error) => {
            logger.error(`[SOCKET ERROR] ${err.message || err}`, { error: err });
        });

        // 3. Socket close / disconnects
        this.bot.on('socket close', () => {
            logger.warn('[SOCKET] Socket connection closed by remote host.');
        });

        this.bot.on('close', () => {
            logger.warn('[IRC] Connection closed.');
        });

        // 4. IRC-level errors (e.g. Nick in use, ERR_BADCHANNELKEY, banned, SASL fail)
        this.bot.on('irc error', (event: IrcErrorEvent) => {
            logger.error(`[IRC ERROR] ${event.error}: ${event.reason || ''}`, { event });
        });

        // Success listeners
        this.bot.on('registered', () => {
            logger.info(`Connected to IRC server: ${BOT_CONFIG.SERVER}`);
            this.bot.join(BOT_CONFIG.CHANNEL);
        });

        this.bot.on('join', (event: IrcJoinEvent) => {
            if (event.nick === BOT_CONFIG.NICK && event.channel === BOT_CONFIG.CHANNEL) {
                logger.info(`Joined channel: ${BOT_CONFIG.CHANNEL}`);
                this.bot.say(BOT_CONFIG.CHANNEL, `${BOT_CONFIG.NICK} has joined the channel!`);
            }
        });

        this.bot.on('message', async (event: IrcMessageEvent) => {
            await this.messageHandler.handleMessage(event);
        });
    }

    /**
     * Connects the bot to the configured IRC server.
     */
    public connect() {
        // TLS is an explicit env setting (P1-3) rather than inferred from the
        // port, so non-standard TLS ports work and plain ports can't be
        // misread as secure.
        const tls = BOT_CONFIG.TLS;

        const connectionOptions: IrcConnectOptions = {
            host: BOT_CONFIG.SERVER,
            port: Number(BOT_CONFIG.PORT),
            nick: BOT_CONFIG.NICK,
            username: BOT_CONFIG.NICK.toLowerCase(),
            gecos: 'FateBot Service',
            tls,
            ssl: tls ? { rejectUnauthorized: false } : false,
            rejectUnauthorized: false, // Prevent Node from aborting on self-signed LAN certs
            // Reconnect across server-side restarts (P1-4); state changes are
            // logged at warn so an offline bot is visible in the journal.
            auto_reconnect: true,
        };

        if (BOT_CONFIG.SASL_ACCOUNT && BOT_CONFIG.SASL_PASSWORD) {
            logger.info(`Using SASL authentication for account: ${BOT_CONFIG.SASL_ACCOUNT}`);
            connectionOptions.account = {
                account: BOT_CONFIG.SASL_ACCOUNT,
                password: BOT_CONFIG.SASL_PASSWORD,
            };
        }

        logger.info(
            `Attempting connection to ${connectionOptions.host}:${connectionOptions.port} (TLS: ${connectionOptions.tls})...`,
        );
        this.bot.connect(connectionOptions);
    }
}
