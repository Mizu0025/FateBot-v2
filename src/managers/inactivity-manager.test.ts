import { InactivityManager } from './inactivity-manager';
import { PromptQueue } from '../queue/queue';
import { ImageGenerator } from '../image-generation/image-generator';
import { getGpuMemoryInfo } from '../utils/gpu-utils';

jest.mock('../config/logger');
jest.mock('../image-generation/image-generator');
jest.mock('../utils/gpu-utils');

describe('InactivityManager', () => {
    let inactivityManager: InactivityManager;
    let mockQueue: jest.Mocked<PromptQueue>;

    beforeEach(() => {
        jest.useFakeTimers();
        mockQueue = {
            onIdle: null,
            isIdle: jest.fn().mockReturnValue(true)
        } as any;
        inactivityManager = new InactivityManager(mockQueue);
    });

    afterEach(() => {
        inactivityManager.stop();
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it('should set onIdle listener on initialization', () => {
        // Arrange & Act (done in beforeEach)

        // Assert
        expect(mockQueue.onIdle).toBeDefined();
    });

    it('should start timer when onIdle is triggered', async () => {
        // Arrange
        const unloadSpy = jest.spyOn(ImageGenerator, 'unloadModels');
        (getGpuMemoryInfo as jest.Mock).mockResolvedValue({ used: 100, total: 1000, free: 900 });

        // Act
        if (mockQueue.onIdle) mockQueue.onIdle();

        // Assert - should not have called yet
        expect(unloadSpy).not.toHaveBeenCalled();

        // Fast-forward 10 minutes
        jest.advanceTimersByTime(10 * 60 * 1000);

        // We need to wait for the promises in the timeout to resolve
        await Promise.resolve();
        await Promise.resolve();

        expect(unloadSpy).toHaveBeenCalled();
    });

    it('should not unload if queue is not idle after timer expires', async () => {
        // Arrange
        const unloadSpy = jest.spyOn(ImageGenerator, 'unloadModels');
        mockQueue.isIdle.mockReturnValue(false);

        // Act
        if (mockQueue.onIdle) mockQueue.onIdle();
        jest.advanceTimersByTime(10 * 60 * 1000);
        await Promise.resolve();

        // Assert
        expect(unloadSpy).not.toHaveBeenCalled();
    });

    it('should clear existing timer when clearTimer is called', () => {
        // Arrange
        const unloadSpy = jest.spyOn(ImageGenerator, 'unloadModels');
        if (mockQueue.onIdle) mockQueue.onIdle();

        // Act
        inactivityManager.clearTimer();
        jest.advanceTimersByTime(10 * 60 * 1000);

        // Assert
        expect(unloadSpy).not.toHaveBeenCalled();
    });
});
