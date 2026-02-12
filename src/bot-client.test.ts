import { FateBot } from './bot-client';
import { BOT_CONFIG } from './config/constants';

// Mock IRC client
jest.mock('irc-framework', () => {
    return {
        Client: jest.fn().mockImplementation(() => ({
            on: jest.fn(),
            join: jest.fn(),
            say: jest.fn(),
            notice: jest.fn(),
            connect: jest.fn(),
        }))
    };
});

// Mock fetch
global.fetch = jest.fn() as jest.Mock;

describe('FateBot', () => {
    let fateBot: FateBot;
    let mockIrcClient: any;

    beforeEach(() => {
        jest.clearAllMocks();
        fateBot = new FateBot();
        mockIrcClient = (fateBot as any).bot;
    });

    it('should initialize with an IRC client', () => {
        expect(mockIrcClient).toBeDefined();
        expect(mockIrcClient.on).toHaveBeenCalled();
    });

    it('should connect with correct config', () => {
        fateBot.connect();
        expect(mockIrcClient.connect).toHaveBeenCalledWith({
            host: BOT_CONFIG.SERVER,
            port: BOT_CONFIG.PORT,
            nick: BOT_CONFIG.NICK,
        });
    });

    it('should handle --help command via notice', async () => {
        const messageEvent = {
            target: BOT_CONFIG.CHANNEL,
            nick: 'user123',
            message: `${BOT_CONFIG.TRIGGER_WORD} --help`
        };

        // Trigger the message listener
        const messageHandler = mockIrcClient.on.mock.calls.find((call: any) => call[0] === 'message')[1];
        await messageHandler(messageEvent);

        expect(mockIrcClient.notice).toHaveBeenCalledWith('user123', expect.any(String));
    });

    it('should handle --models command', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({ models: ['model1', 'model2'] })
        });

        const messageEvent = {
            target: BOT_CONFIG.CHANNEL,
            nick: 'user123',
            message: `${BOT_CONFIG.TRIGGER_WORD} --models`
        };

        const messageHandler = mockIrcClient.on.mock.calls.find((call: any) => call[0] === 'message')[1];
        await messageHandler(messageEvent);

        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/models'));
        expect(mockIrcClient.notice).toHaveBeenCalledWith('user123', expect.stringContaining('model1, model2'));
    });

    it('should handle image generation request', async () => {
        // Mock request and wait endpoints
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ job_id: '123', queue_position: 1 })
            })
            .mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({ status: 'completed', result: 'http://image.png' })
            });

        const messageEvent = {
            target: BOT_CONFIG.CHANNEL,
            nick: 'user123',
            message: `${BOT_CONFIG.TRIGGER_WORD} a cat`
        };

        const messageHandler = mockIrcClient.on.mock.calls.find((call: any) => call[0] === 'message')[1];
        await messageHandler(messageEvent);

        expect(mockIrcClient.say).toHaveBeenCalledWith(BOT_CONFIG.CHANNEL, expect.stringContaining('Starting image generation'));
        expect(mockIrcClient.say).toHaveBeenCalledWith(BOT_CONFIG.CHANNEL, expect.stringContaining('Your image is ready! http://image.png'));
    });
});
