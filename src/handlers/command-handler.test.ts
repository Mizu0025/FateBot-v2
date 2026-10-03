import type { Mock, Mocked } from 'vitest';
import { BOT_CONFIG, COMFYUI_SERVICE_CONFIG } from '../config/constants';
import { ModelLoader } from '../config/model-loader';
import type { ComfyUiServiceManager } from '../managers/comfyui-service-manager';
import type { InactivityManager } from '../managers/inactivity-manager';
import type { PromptQueue } from '../queue/queue';
import { PromptParser } from '../text-filter/prompt-parser';
import { UserError } from '../types/errors';
import type { MessageSender } from '../types/irc';
import { deleteArtworkTarget } from '../utils/artwork-deleter';
import { CommandHandler } from './command-handler';

vi.mock('../config/logger');
vi.mock('../utils/artwork-deleter');
vi.mock('../config/model-loader');
vi.mock('../text-filter/prompt-parser');
vi.mock('../managers/comfyui-service-manager');

describe('CommandHandler', () => {
    let commandHandler: CommandHandler;
    let mockBot: Mocked<MessageSender>;
    let mockQueue: { addTask: Mock; length: number; isProcessing: Mock };
    let mockInactivityManager: Mocked<Pick<InactivityManager, 'clearTimer'>>;
    let mockService: Mocked<ComfyUiServiceManager>;

    beforeEach(() => {
        mockBot = {
            notice: vi.fn(),
            say: vi.fn(),
        };
        mockQueue = {
            addTask: vi.fn().mockReturnValue(1),
            length: 2,
            isProcessing: vi.fn().mockReturnValue(true),
        };
        mockInactivityManager = {
            clearTimer: vi.fn(),
        };
        mockService = {
            ensureRunning: vi.fn(),
            stop: vi.fn(),
            isRunning: vi.fn(),
        } as unknown as Mocked<ComfyUiServiceManager>;
        commandHandler = new CommandHandler(
            mockBot,
            mockQueue as unknown as Pick<PromptQueue, 'addTask' | 'length' | 'isProcessing'>,
            mockInactivityManager,
            mockService,
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('handleHelp', () => {
        it('should send help notices to the user', async () => {
            const nick = 'user123';

            await commandHandler.handleHelp(nick);

            expect(mockBot.notice).toHaveBeenCalledTimes(3);
            expect(mockBot.notice).toHaveBeenCalledWith(nick, expect.any(String));
        });
    });

    describe('handleListModels', () => {
        it('should send models list notice to the user', async () => {
            (ModelLoader.getModelsList as Mock).mockResolvedValue('model1, model2');

            await commandHandler.handleListModels('user123');

            expect(mockBot.notice).toHaveBeenCalledWith('user123', expect.stringContaining('model1, model2'));
        });

        it('should send error notice if model loading fails', async () => {
            (ModelLoader.getModelsList as Mock).mockRejectedValue(new Error('Failed'));

            await commandHandler.handleListModels('user123');

            expect(mockBot.notice).toHaveBeenCalledWith('user123', expect.stringContaining('Error getting models'));
        });
    });

    describe('handleStartComfyui', () => {
        it('should report startup with the idle duration when the service was started', async () => {
            COMFYUI_SERVICE_CONFIG.IDLE_MINUTES = 10;
            (mockService.ensureRunning as Mock).mockResolvedValue(true);

            await commandHandler.handleStartComfyui('user123');

            expect(mockService.ensureRunning).toHaveBeenCalled();
            expect(mockBot.notice).toHaveBeenCalledWith(
                'user123',
                'ComfyUI started. It will stay up until the queue has been idle for 10 minutes.',
            );
        });

        it('should report a no-op when ComfyUI was already running', async () => {
            (mockService.ensureRunning as Mock).mockResolvedValue(false);

            await commandHandler.handleStartComfyui('user123');

            expect(mockBot.notice).toHaveBeenCalledWith('user123', 'ComfyUI was already running.');
        });

        it('should report an error if the service fails to start', async () => {
            (mockService.ensureRunning as Mock).mockRejectedValue(new Error('systemctl exploded'));

            await commandHandler.handleStartComfyui('user123');

            expect(mockBot.notice).toHaveBeenCalledWith('user123', 'Error starting ComfyUI: systemctl exploded');
        });
    });

    describe('handleStopComfyui', () => {
        it('should stop the service and confirm', async () => {
            (mockService.stop as Mock).mockResolvedValue(undefined);

            await commandHandler.handleStopComfyui('user123');

            expect(mockService.stop).toHaveBeenCalled();
            expect(mockBot.notice).toHaveBeenCalledWith(
                'user123',
                'ComfyUI stopped. It will start automatically on the next image request.',
            );
        });

        it('should report an error if stopping fails', async () => {
            (mockService.stop as Mock).mockRejectedValue(new Error('session gone'));

            await commandHandler.handleStopComfyui('user123');

            expect(mockBot.notice).toHaveBeenCalledWith('user123', 'Error stopping ComfyUI: session gone');
        });
    });

    describe('handleComfyuiStatus', () => {
        it('should report running state including queue stats', async () => {
            (mockService.isRunning as Mock).mockResolvedValue(true);

            await commandHandler.handleComfyuiStatus('user123');

            expect(mockBot.notice).toHaveBeenCalledWith(
                'user123',
                'ComfyUI is running. Queue: 2 waiting, processing: yes.',
            );
        });

        it('should report idle queue stats when nothing is being processed', async () => {
            mockQueue.length = 0;
            (mockQueue.isProcessing as Mock).mockReturnValue(false);
            (mockService.isRunning as Mock).mockResolvedValue(true);

            await commandHandler.handleComfyuiStatus('user123');

            expect(mockBot.notice).toHaveBeenCalledWith(
                'user123',
                'ComfyUI is running. Queue: 0 waiting, processing: no.',
            );
        });

        it('should report that ComfyUI is not running', async () => {
            (mockService.isRunning as Mock).mockResolvedValue(false);

            await commandHandler.handleComfyuiStatus('user123');

            expect(mockBot.notice).toHaveBeenCalledWith(
                'user123',
                'ComfyUI is not running. It will start automatically on the next image request.',
            );
        });

        it('should report an error if the status check fails', async () => {
            (mockService.isRunning as Mock).mockRejectedValue(new Error('probe failed'));

            await commandHandler.handleComfyuiStatus('user123');

            expect(mockBot.notice).toHaveBeenCalledWith('user123', 'Error checking ComfyUI status: probe failed');
        });
    });

    describe('handleGenerateImage', () => {
        it('should parse prompt, clear timer and queue a request for the channel', async () => {
            const nick = 'user123';
            const channel = '#channel';
            const message = '!draw fluffy cat';
            const filteredPrompt = { prompt: 'fluffy cat', count: 1 } as { prompt: string; count: number };
            (PromptParser.extractPrompts as Mock).mockResolvedValue(filteredPrompt);

            await commandHandler.handleGenerateImage(nick, channel, message);

            expect(PromptParser.extractPrompts).toHaveBeenCalledWith(message);
            expect(mockInactivityManager.clearTimer).toHaveBeenCalled();
            expect(mockQueue.addTask).toHaveBeenCalledWith({
                prompt: filteredPrompt,
                nick,
                channel,
            });
            expect(mockBot.say).toHaveBeenCalledWith(channel, expect.stringContaining('You are #1 in the queue'));
        });

        it('should report prompt parsing errors to the channel', async () => {
            const channel = '#channel';
            (PromptParser.extractPrompts as Mock).mockRejectedValue(new UserError('Parse error'));

            await commandHandler.handleGenerateImage('user123', channel, 'invalid');

            expect(mockBot.say).toHaveBeenCalledWith('#channel', expect.stringContaining('Error parsing your request'));
            expect(mockQueue.addTask).not.toHaveBeenCalled();
        });

        it('should report unexpected errors generically to the channel', async () => {
            const channel = '#channel';
            (PromptParser.extractPrompts as Mock).mockRejectedValue(new Error('boom'));

            await commandHandler.handleGenerateImage('user123', channel, 'invalid');

            expect(mockBot.say).toHaveBeenCalledWith(
                '#channel',
                expect.stringContaining('An error occurred while processing your request.'),
            );
            expect(mockQueue.addTask).not.toHaveBeenCalled();
        });
    });

    describe('handleDeleteImages', () => {
        it('should delete a single batch by id and confirm the count', async () => {
            vi.mocked(deleteArtworkTarget).mockReturnValue({ deleted: ['x_0.webp', 'x_1.webp'], count: 2 });

            await commandHandler.handleDeleteImages(
                'user123',
                '#channel',
                '!fate --delete 8cc05ada-6698-4c4c-9262-adda0f0addb4',
            );

            expect(deleteArtworkTarget).toHaveBeenCalledWith('8cc05ada-6698-4c4c-9262-adda0f0addb4');
            expect(mockBot.say).toHaveBeenCalledWith(
                '#channel',
                'user123: Deleted 2 image(s) for "8cc05ada-6698-4c4c-9262-adda0f0addb4".',
            );
        });

        it('should clear the whole folder when passed "all"', async () => {
            vi.mocked(deleteArtworkTarget).mockReturnValue({ deleted: ['a.webp'], count: 30 });

            await commandHandler.handleDeleteImages('user123', '#channel', '!fate --delete all');

            expect(deleteArtworkTarget).toHaveBeenCalledWith('all');
            expect(mockBot.say).toHaveBeenCalledWith('#channel', 'user123: Deleted 30 image(s) from the art folder.');
        });

        it('should report that nothing matched the id', async () => {
            vi.mocked(deleteArtworkTarget).mockReturnValue({ deleted: [], count: 0 });

            await commandHandler.handleDeleteImages('user123', '#channel', '!fate --delete nope');

            expect(mockBot.say).toHaveBeenCalledWith('#channel', 'user123: No images matched "nope".');
        });

        it('should print usage when no argument is given', async () => {
            await commandHandler.handleDeleteImages('user123', '#channel', '!fate --delete');

            expect(deleteArtworkTarget).not.toHaveBeenCalled();
            expect(mockBot.say).toHaveBeenCalledWith(
                '#channel',
                `user123: Usage: ${BOT_CONFIG.TRIGGER_WORD} --delete <prompt_id> | ${BOT_CONFIG.TRIGGER_WORD} --delete all`,
            );
        });

        it('should report an error from the deleter', async () => {
            vi.mocked(deleteArtworkTarget).mockImplementation(() => {
                throw new Error('folder missing');
            });

            await commandHandler.handleDeleteImages('user123', '#channel', '!fate --delete abc');

            expect(mockBot.say).toHaveBeenCalledWith('#channel', 'user123: Error deleting images: folder missing');
        });
    });
});
