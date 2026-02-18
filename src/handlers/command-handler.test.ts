import { CommandHandler } from './command-handler';
import { PromptQueue } from '../queue/queue';
import { InactivityManager } from '../managers/inactivity-manager';
import { ModelLoader } from '../config/model-loader';
import { PromptParser } from '../text-filter/prompt-parser';
import { BOT_CONFIG } from '../config/constants';
import { UserError } from '../types/errors';

jest.mock('../config/logger');
jest.mock('../config/model-loader');
jest.mock('../image-generation/image-generator');
jest.mock('../text-filter/prompt-parser');
jest.mock('../utils/gpu-utils');

describe('CommandHandler', () => {
    let commandHandler: CommandHandler;
    let mockBot: any;
    let mockQueue: jest.Mocked<PromptQueue>;
    let mockInactivityManager: jest.Mocked<InactivityManager>;

    beforeEach(() => {
        mockBot = {
            notice: jest.fn(),
            say: jest.fn()
        };
        mockQueue = {
            addTask: jest.fn().mockReturnValue(1)
        } as any;
        mockInactivityManager = {
            clearTimer: jest.fn()
        } as any;
        commandHandler = new CommandHandler(mockBot, mockQueue, mockInactivityManager);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('handleHelp', () => {
        it('should send help notices to the user', async () => {
            // Arrange
            const nick = 'user123';

            // Act
            await commandHandler.handleHelp(nick);

            // Assert
            expect(mockBot.notice).toHaveBeenCalledTimes(3);
            expect(mockBot.notice).toHaveBeenCalledWith(nick, expect.any(String));
        });
    });

    describe('handleListModels', () => {
        it('should send models list notice to the user', async () => {
            // Arrange
            const nick = 'user123';
            (ModelLoader.getModelsList as jest.Mock).mockResolvedValue('model1, model2');

            // Act
            await commandHandler.handleListModels(nick);

            // Assert
            expect(mockBot.notice).toHaveBeenCalledWith(nick, expect.stringContaining('model1, model2'));
        });

        it('should send error notice if model loading fails', async () => {
            // Arrange
            const nick = 'user123';
            (ModelLoader.getModelsList as jest.Mock).mockRejectedValue(new Error('Failed'));

            // Act
            await commandHandler.handleListModels(nick);

            // Assert
            expect(mockBot.notice).toHaveBeenCalledWith(nick, expect.stringContaining('Error getting models'));
        });
    });

    describe('handleGenerateImage', () => {
        it('should parse prompt, clear timer and add task to queue', async () => {
            // Arrange
            const nick = 'user123';
            const message = '!draw fluffy cat';
            const filteredPrompt = { prompt: 'fluffy cat', count: 1 };
            (PromptParser.extractPrompts as jest.Mock).mockResolvedValue(filteredPrompt);

            // Act
            await commandHandler.handleGenerateImage(nick, message);

            // Assert
            expect(PromptParser.extractPrompts).toHaveBeenCalledWith(message);
            expect(mockInactivityManager.clearTimer).toHaveBeenCalled();
            expect(mockQueue.addTask).toHaveBeenCalled();
            expect(mockBot.say).toHaveBeenCalledWith(BOT_CONFIG.CHANNEL, expect.stringContaining('You are #1 in the queue'));
        });

        it('should handle prompt parsing errors', async () => {
            // Arrange
            const nick = 'user123';
            (PromptParser.extractPrompts as jest.Mock).mockRejectedValue(new UserError('Parse error'));

            // Act
            await commandHandler.handleGenerateImage(nick, 'invalid');

            // Assert
            expect(mockBot.say).toHaveBeenCalledWith(BOT_CONFIG.CHANNEL, expect.stringContaining('Error parsing your request'));
        });
    });
});
