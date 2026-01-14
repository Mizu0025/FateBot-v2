import { exec } from 'child_process';
import { getGpuMemoryInfo, formatMemoryInfo } from './gpu-utils';
import { logger } from '../config/logger';

// Mock child_process.exec
jest.mock('child_process', () => ({
    exec: jest.fn()
}));

// Mock logger
jest.mock('../config/logger', () => ({
    logger: {
        debug: jest.fn(),
        error: jest.fn(),
        info: jest.fn()
    }
}));

const mockedExec = exec as unknown as jest.Mock;

describe('gpu-utils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getGpuMemoryInfo', () => {
        it('should return memory info when nvidia-smi returns valid data', async () => {
            // Arrange
            const stdout = '1000, 8000\n';
            mockedExec.mockImplementation((cmd, callback) => {
                callback(null, { stdout, stderr: '' });
            });

            // Act
            const result = await getGpuMemoryInfo();

            // Assert
            expect(result).toEqual({
                used: 1000,
                total: 8000,
                percentage: 13 // (1000/8000) * 100 = 12.5 -> rounded to 13
            });
            expect(mockedExec).toHaveBeenCalledWith('nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits', expect.any(Function));
        });

        it('should return null when nvidia-smi returns malformed data', async () => {
            // Arrange
            const stdout = 'invalid, data\n';
            mockedExec.mockImplementation((cmd, callback) => {
                callback(null, { stdout, stderr: '' });
            });

            // Act
            const result = await getGpuMemoryInfo();

            // Assert
            expect(result).toBeNull();
        });

        it('should return null and log debug message when nvidia-smi command fails', async () => {
            // Arrange
            const error = new Error('command not found');
            mockedExec.mockImplementation((cmd, callback) => {
                callback(error, { stdout: '', stderr: '' });
            });

            // Act
            const result = await getGpuMemoryInfo();

            // Assert
            expect(result).toBeNull();
            expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('nvidia-smi check failed'), error);
        });

        it('should return null when stdout is empty', async () => {
            // Arrange
            const stdout = '\n';
            mockedExec.mockImplementation((cmd, callback) => {
                callback(null, { stdout, stderr: '' });
            });

            // Act
            const result = await getGpuMemoryInfo();

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('formatMemoryInfo', () => {
        it('should format memory info correctly', () => {
            // Arrange
            const info = {
                used: 2048,
                total: 8192,
                percentage: 25
            };

            // Act
            const result = formatMemoryInfo(info);

            // Assert
            expect(result).toBe('2048MB / 8192MB (25%)');
        });
    });
});
