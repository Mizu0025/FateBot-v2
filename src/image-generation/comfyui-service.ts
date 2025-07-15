import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export enum ComfyUIServiceStatus {
    STOPPED,
    RUNNING,
    STARTING,
    STOPPING,
}

let serviceStatus: ComfyUIServiceStatus = ComfyUIServiceStatus.STOPPED;
let inactivityTimer: NodeJS.Timeout | null = null;

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes

async function executeCommand(command: string): Promise<string> {
    try {
        const { stdout, stderr } = await execAsync(command);
        if (stderr) {
            // sudo sends some messages to stderr, so we check for specific errors
            if (!stderr.includes('is not a tty')) {
                console.error(`Error executing command: ${command}`, stderr);
            }
        }
        return stdout.trim();
    } catch (error) {
        console.error(`Failed to execute command: ${command}`, error);
        throw error;
    }
}

export async function getServiceStatus(): Promise<ComfyUIServiceStatus> {
    try {
        const output = await executeCommand('systemctl is-active comfyui');
        if (output === 'active') {
            serviceStatus = ComfyUIServiceStatus.RUNNING;
        } else {
            serviceStatus = ComfyUIServiceStatus.STOPPED;
        }
    } catch (error) {
        // Command fails if the service is not active
        serviceStatus = ComfyUIServiceStatus.STOPPED;
    }
    return serviceStatus;
}

export async function startService(): Promise<void> {
    if (serviceStatus === ComfyUIServiceStatus.RUNNING || serviceStatus === ComfyUIServiceStatus.STARTING) {
        console.log('ComfyUI service is already running or starting.');
        return;
    }

    console.log('Starting ComfyUI service...');
    serviceStatus = ComfyUIServiceStatus.STARTING;
    try {
        await executeCommand('systemctl start comfyui');
        // Wait a moment for the service to stabilize
        await new Promise(resolve => setTimeout(resolve, 3000));
        const status = await getServiceStatus();
        if (status !== ComfyUIServiceStatus.RUNNING) {
            throw new Error('Service failed to start or is taking too long.');
        }
        console.log('ComfyUI service started successfully.');
    } catch (error) {
        console.error('Failed to start ComfyUI service:', error);
        serviceStatus = ComfyUIServiceStatus.STOPPED;
        throw error;
    }
}

export async function stopService(): Promise<void> {
    if (serviceStatus === ComfyUIServiceStatus.STOPPED || serviceStatus === ComfyUIServiceStatus.STOPPING) {
        console.log('ComfyUI service is already stopped or stopping.');
        return;
    }

    console.log('Stopping ComfyUI service...');
    serviceStatus = ComfyUIServiceStatus.STOPPING;
    try {
        await executeCommand('systemctl stop comfyui');
        serviceStatus = ComfyUIServiceStatus.STOPPED;
        console.log('ComfyUI service stopped successfully.');
    } catch (error) {
        console.error('Failed to stop ComfyUI service:', error);
        // Attempt to recover status
        await getServiceStatus();
        throw error;
    }
}

export function scheduleStop(): void {
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
    inactivityTimer = setTimeout(() => {
        console.log('ComfyUI service inactivity timeout reached. Stopping service.');
        stopService();
    }, INACTIVITY_TIMEOUT);
}

export function cancelStop(): void {
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
    }
}

export async function ensureServiceRunning(): Promise<void> {
    cancelStop(); // Cancel any pending stop requests
    const status = await getServiceStatus();
    if (status !== ComfyUIServiceStatus.RUNNING) {
        await startService();
    }
}
