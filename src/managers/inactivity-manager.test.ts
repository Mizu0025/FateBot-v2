import type { Mock } from 'vitest';
import { COMFYUI_SERVICE_CONFIG } from '../config/constants';
import type { PromptQueue } from '../queue/queue';
import type { ComfyUiServiceManager } from './comfyui-service-manager';
import { InactivityManager } from './inactivity-manager';

vi.mock('../config/logger');
vi.mock('./comfyui-service-manager');

describe('InactivityManager', () => {
    let inactivityManager: InactivityManager;
    let mockQueue: {
        onIdle: null | (() => void);
        isIdle: Mock;
    };
    let mockService: { stop: Mock };

    beforeEach(() => {
        vi.useFakeTimers();
        COMFYUI_SERVICE_CONFIG.IDLE_MINUTES = 10;
        mockQueue = {
            onIdle: null,
            isIdle: vi.fn().mockReturnValue(true),
        };
        mockService = {
            stop: vi.fn().mockResolvedValue(undefined),
        };
        inactivityManager = new InactivityManager(
            mockQueue as unknown as Pick<PromptQueue, 'onIdle' | 'isIdle'>,
            mockService as unknown as ComfyUiServiceManager,
        );
    });

    afterEach(() => {
        inactivityManager.stop();
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    // The timeout callback is async (it awaits service.stop()); after advancing
    // fake timers we must flush microtasks for the work to complete.
    const settle = () => Promise.resolve();

    it('should set onIdle listener on initialization', () => {
        expect(mockQueue.onIdle).toBeDefined();
    });

    it('should stop the service when the queue has been idle for the idle period', async () => {
        // Act
        if (mockQueue.onIdle) mockQueue.onIdle();

        // Assert - nothing happens before the timer expires
        expect(mockService.stop).not.toHaveBeenCalled();

        vi.advanceTimersByTime(10 * 60 * 1000);
        await settle();
        await settle();

        expect(mockService.stop).toHaveBeenCalledTimes(1);
    });

    it('should not stop the service if the queue is not idle when the timer expires', async () => {
        (mockQueue.isIdle as Mock).mockReturnValue(false);

        if (mockQueue.onIdle) mockQueue.onIdle();
        vi.advanceTimersByTime(10 * 60 * 1000);
        await settle();
        await settle();

        expect(mockService.stop).not.toHaveBeenCalled();
    });

    it('should clear existing timer when clearTimer is called', async () => {
        if (mockQueue.onIdle) mockQueue.onIdle();

        inactivityManager.clearTimer();
        vi.advanceTimersByTime(10 * 60 * 1000);
        await settle();
        await settle();

        expect(mockService.stop).not.toHaveBeenCalled();
    });

    it('should reset the countdown when new activity occurs during idleness', async () => {
        if (mockQueue.onIdle) mockQueue.onIdle();
        vi.advanceTimersByTime(9 * 60 * 1000);

        // A new request arrives: the timer resets, so the original 10-minute
        // countdown no longer expires.
        if (mockQueue.onIdle) mockQueue.onIdle();
        vi.advanceTimersByTime(9 * 60 * 1000);
        await settle();
        await settle();

        expect(mockService.stop).not.toHaveBeenCalled();

        // One more minute completes the fresh 10-minute window.
        vi.advanceTimersByTime(1 * 60 * 1000);
        await settle();
        await settle();

        expect(mockService.stop).toHaveBeenCalledTimes(1);
    });

    it('should not throw when stopping the service fails', async () => {
        (mockService.stop as Mock).mockRejectedValue(new Error('session gone'));

        if (mockQueue.onIdle) mockQueue.onIdle();
        vi.advanceTimersByTime(10 * 60 * 1000);
        await settle();
        await settle();

        expect(mockService.stop).toHaveBeenCalledTimes(1);
    });

    it('should stop any pending timer when stop() is called', async () => {
        if (mockQueue.onIdle) mockQueue.onIdle();

        inactivityManager.stop();
        vi.advanceTimersByTime(10 * 60 * 1000);
        await settle();
        await settle();

        expect(mockService.stop).not.toHaveBeenCalled();
    });
});
