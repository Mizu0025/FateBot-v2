/**
 * Type definitions for the `irc-framework` client surface used by FateBot.
 *
 * `irc-framework` ships without TypeScript definitions, so this module
 * describes only the client methods and event payloads the bot consumes.
 */

/** Payload of the `raw` event (every IRC line sent or received). */
export interface IrcRawEvent {
    line: string;
    /** True if the line came from the server, false if it was sent by us. */
    from_server: boolean;
}

/** Payload of the `message` event (aggregated privmsg/notice/action events). */
export interface IrcMessageEvent {
    type?: string;
    nick: string;
    target: string;
    message: string;
}

/** Payload of the `irc error` event (server ERR_* / ERROR numerics). */
export interface IrcErrorEvent {
    error: string;
    reason?: string;
}

/** Payload of the `join` event. */
export interface IrcJoinEvent {
    nick: string;
    ident?: string;
    hostname?: string;
    channel?: string;
}

/** Options accepted by `Client.connect()`. */
export interface IrcConnectOptions {
    host: string;
    port: number;
    nick: string;
    username: string;
    gecos: string;
    tls: boolean;
    ssl: false | { rejectUnauthorized: boolean };
    rejectUnauthorized: boolean;
    auto_reconnect: boolean;
    account?: {
        account: string;
        password: string;
    };
}

/**
 * The minimal IRC client surface needed to send messages to users/channels.
 * Used by `CommandHandler` so it can be satisfied by a lightweight mock in tests
 * without the full {@link IrcClient}.
 */
export interface MessageSender {
    say(target: string, message: string): unknown;
    notice(target: string, message: string): unknown;
}

/**
 * The subset of an `irc-framework` Client instance FateBot interacts with.
 * The library's client is an EventEmitter; `on` is typed loosely because the
 * library is untyped, while the handlers themselves receive typed payloads.
 */
export interface IrcClient extends MessageSender {
    on(event: string, listener: (...args: never[]) => void): this;
    connect(options: IrcConnectOptions): void;
    join(channel: string): void;
}
