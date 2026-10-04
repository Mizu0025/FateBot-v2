import { afterEach, beforeEach, describe, expect, it, type Mocked, vi } from 'vitest';
import { BOT_CONFIG } from '../config/constants';
import type { CommandHandler } from './command-handler';
import { MessageHandler } from './message-handler';

vi.mock('../config/logger');

describe('MessageHandler', () => {
    let messageHandler: MessageHandler;
    let mockCommandHandler: Mocked<CommandHandler>;

    beforeEach(() => {
        mockCommandHandler = {
            handleHelp: vi.fn(),
            handleListModels: vi.fn(),
            handleStartComfyui: vi.fn(),
            handleStopComfyui: vi.fn(),
            handleGenerateImage: vi.fn().mockResolvedValue(undefined),
            handleDeleteImages: vi.fn().mockResolvedValue(undefined),
        } as unknown as Mocked<CommandHandler>;
        messageHandler = new MessageHandler(mockCommandHandler);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should ignore messages from different channels', async () => {
        // Arrange
        const event = {
            target: '#different-channel',
            nick: 'user123',
            message: `${BOT_CONFIG.TRIGGER_WORD} test`,
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
            message: 'just chatting',
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
            message: `${BOT_CONFIG.TRIGGER_WORD} --help`,
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
            message: `${BOT_CONFIG.TRIGGER_WORD} --models`,
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
            message: `${BOT_CONFIG.TRIGGER_WORD} --start-comfyui`,
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
            message: `${BOT_CONFIG.TRIGGER_WORD} --stop-comfyui`,
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
            message: `${BOT_CONFIG.TRIGGER_WORD} beautiful sunset`,
        };

        // Act
        await messageHandler.handleMessage(event);

        // Assert
        expect(mockCommandHandler.handleGenerateImage).toHaveBeenCalledWith('user123', event.target, event.message);
    });

    it('should route --delete to handleDeleteImages', async () => {
        // Arrange
        const event = {
            target: BOT_CONFIG.CHANNEL,
            nick: 'user123',
            message: `${BOT_CONFIG.TRIGGER_WORD} --delete all`,
        };

        // Act
        await messageHandler.handleMessage(event);

        // Assert
        expect(mockCommandHandler.handleDeleteImages).toHaveBeenCalledWith('user123', event.target, event.message);
        expect(mockCommandHandler.handleGenerateImage).not.toHaveBeenCalled();
    });

    describe('whole-token flag matching (P0-7)', () => {
        it('should NOT route a prompt that mentions --delete all as literal text', async () => {
            const event = {
                target: BOT_CONFIG.CHANNEL,
                nick: 'user123',
                message: `${BOT_CONFIG.TRIGGER_WORD} a banner that says "--delete all"`,
            };

            await messageHandler.handleMessage(event);

            expect(mockCommandHandler.handleDeleteImages).not.toHaveBeenCalled();
            expect(mockCommandHandler.handleGenerateImage).toHaveBeenCalled();
        });

        it('should route case-insensitively (--HELP → handleHelp)', async () => {
            const event = {
                target: BOT_CONFIG.CHANNEL,
                nick: 'user123',
                message: `${BOT_CONFIG.TRIGGER_WORD} --HELP`,
            };

            await messageHandler.handleMessage(event);

            expect(mockCommandHandler.handleHelp).toHaveBeenCalledWith('user123');
            expect(mockCommandHandler.handleGenerateImage).not.toHaveBeenCalled();
        });

        it('should route --START-COMFYUI regardless of case', async () => {
            const event = {
                target: BOT_CONFIG.CHANNEL,
                nick: 'user123',
                message: `${BOT_CONFIG.TRIGGER_WORD} --START-COMFYUI`,
            };

            await messageHandler.handleMessage(event);

            expect(mockCommandHandler.handleStartComfyui).toHaveBeenCalledWith('user123');
        });

        it('should NOT route a prompt with a word that merely contains "--helpful"', async () => {
            const event = {
                target: BOT_CONFIG.CHANNEL,
                nick: 'user123',
                message: `${BOT_CONFIG.TRIGGER_WORD} a very --helpful cat sitting on a fence`,
            };

            await messageHandler.handleMessage(event);

            expect(mockCommandHandler.handleHelp).not.toHaveBeenCalled();
            expect(mockCommandHandler.handleGenerateImage).toHaveBeenCalledWith('user123', event.target, event.message);
        });

        it('should route when the flag appears later in the message', async () => {
            const event = {
                target: BOT_CONFIG.CHANNEL,
                nick: 'user123',
                message: `${BOT_CONFIG.TRIGGER_WORD} a sunset with --models in the sky`,
            };

            await messageHandler.handleMessage(event);

            expect(mockCommandHandler.handleListModels).toHaveBeenCalledWith('user123');
        });

        it('should route --delete followed by a prompt id (not "all")', async () => {
            const event = {
                target: BOT_CONFIG.CHANNEL,
                nick: 'user123',
                message: `${BOT_CONFIG.TRIGGER_WORD} --delete a1b2c3d4-0000-0000-0000-000000000000`,
            };

            await messageHandler.handleMessage(event);

            expect(mockCommandHandler.handleDeleteImages).toHaveBeenCalledWith('user123', event.target, event.message);
        });
    });
});
