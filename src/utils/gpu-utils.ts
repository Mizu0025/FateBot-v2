import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../config/logger';

const execAsync = promisify(exec);

export interface MemoryInfo {
    used: number;
    total: number;
    percentage: number;
}

/**
 * Queries NVIDIA GPU memory usage using nvidia-smi.
 * Returns null if nvidia-smi is not available or fails.
 */
export async function getGpuMemoryInfo(): Promise<MemoryInfo | null> {
    try {
        const { stdout } = await execAsync('nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits');
        const [used, total] = stdout.trim().split(',').map(val => parseInt(val.trim(), 10));

        if (isNaN(used) || isNaN(total)) {
            return null;
        }

        return {
            used,
            total,
            percentage: Math.round((used / total) * 100)
        };
    } catch (error) {
        // Log at debug level because it's expected on dev machines without GPUs
        logger.debug('nvidia-smi check failed (likely no NVIDIA GPU or driver):', error);
        return null;
    }
}

/**
 * Formats memory info for logging/display.
 */
export function formatMemoryInfo(info: MemoryInfo): string {
    return `${info.used}MB / ${info.total}MB (${info.percentage}%)`;
}
