import { MessageHandler } from './message-handler';
import { CommandHandler } from './command-handler';
import { BOT_CONFIG } from '../config/constants';

jest.mock('../config/logger');

describe('MessageHandler', () => {
    let messageHandler: MessageHandler;
    let mockCommandHandler: jest.Mocked<CommandHandler>;

    beforeEach(() => {
        mockCommandHandler = {
            handleHelp: jest.fn(),
            handleListModels: jest.fn(),
            handleStartComfyui: jest.fn(),
            handleStopComfyui: jest.fn(),
            handleGenerateImage: jest.fn().mockResolvedValue(undefined),
        } as unknown as jest.Mocked<CommandHandler>;
        messageHandler = new MessageHandler(mockCommandHandler);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should ignore messages from different channels', async () => {
        // Arrange
        const event = {
            target: '#different-channel',
            nick: 'user123',
            message: `${BOT_CONFIG.TRIGGER_WORD} test`
        };

        // Act
        await messageHandler.handleMessage(event);

        // Assert
        expect(mockCommandHandler.handleGenerateImage).not.toHaveBeenCalled();
    });

    it('should ignore messages without trigger word', async () => {
        // Arrange
        const event = {
            target: BOT_CONFIG.CHANNEL,
            nick: 'user123',
            message: 'just chatting'
        };

        // Act
        await messageHandler.handleMessage(event);

        // Assert
        expect(mockCommandHandler.handleGenerateImage).not.toHaveBeenCalled();
    });

    it('should route --help to handleHelp', async () => {
        // Arrange
        const event = {
            target: BOT_CONFIG.CHANNEL,
            nick: 'user123',
            message: `${BOT_CONFIG.TRIGGER_WORD} --help`
        };

        // Act
        await messageHandler.handleMessage(event);

        // Assert
        expect(mockCommandHandler.handleHelp).toHaveBeenCalled();
        expect(mockCommandHandler.handleGenerateImage).not.toHaveBeenCalled();
    });

    it('should route --models to handleListModels', async () => {
        // Arrange
        const event = {
            target: BOT_CONFIG.CHANNEL,
            nick: 'user123',
            message: `${BOT_CONFIG.TRIGGER_WORD} --models`
        };

        // Act
        await messageHandler.handleMessage(event);

        // Assert
        expect(mockCommandHandler.handleListModels).toHaveBeenCalled();
    });

    it('should route --start-comfyui to handleStartComfyui', async () => {
        // Arrange
        const event = {
            target: BOT_CONFIG.CHANNEL,
            nick: 'user123',
            message: `${BOT_CONFIG.TRIGGER_WORD} --start-comfyui`
        };

        // Act
        await messageHandler.handleMessage(event);

        // Assert
        expect(mockCommandHandler.handleStartComfyui).toHaveBeenCalledWith('user123');
        expect(mockCommandHandler.handleGenerateImage).not.toHaveBeenCalled();
    });

    it('should route --stop-comfyui to handleStopComfyui', async () => {
        // Arrange
        const event = {
            target: BOT_CONFIG.CHANNEL,
            nick: 'user123',
            message: `${BOT_CONFIG.TRIGGER_WORD} --stop-comfyui`
        };

        // Act
        await messageHandler.handleMessage(event);

        // Assert
        expect(mockCommandHandler.handleStopComfyui).toHaveBeenCalledWith('user123');
        expect(mockCommandHandler.handleGenerateImage).not.toHaveBeenCalled();
    });

    it('should fall back to handleGenerateImage for unknown commands', async () => {
        // Arrange
        const event = {
            target: BOT_CONFIG.CHANNEL,
            nick: 'user123',
            message: `${BOT_CONFIG.TRIGGER_WORD} beautiful sunset`
        };

        // Act
        await messageHandler.handleMessage(event);

        // Assert
        expect(mockCommandHandler.handleGenerateImage).toHaveBeenCalledWith('user123', event.target, event.message);
    });
});
