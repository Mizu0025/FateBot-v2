import type { Mock } from 'vitest';

import WebSocket from 'ws';
import { COMFYUI_CONFIG } from '../config/constants';
import { logger } from '../config/logger';
import { minimalWorkflowData } from '../test-utils';
import { SystemError } from '../types/errors';
import { ComfyUIClient } from './comfyui-client';

// Mock dependencies
vi.mock('ws');
vi.mock('uuid', () => ({ v4: () => 'test-client-id' }));
vi.mock('../config/constants', () => ({
    COMFYUI_CONFIG: {
        ADDRESS: 'localhost',
        PORT: '8188',
    },
}));
vi.mock('../config/logger');

describe('ComfyUIClient', () => {
    let client: ComfyUIClient;
    let mockFetch: Mock;

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset COMFYUI_CONFIG.ADDRESS to a valid value before each test
        COMFYUI_CONFIG.ADDRESS = 'localhost';
        client = new ComfyUIClient();
        mockFetch = vi.fn();
        global.fetch = mockFetch as unknown as typeof fetch;
    });

    describe('queuePrompt', () => {
        it('should successfully queue a prompt and return prompt_id', async () => {
            // Arrange
            const mockPromptId = 'test-prompt-id';
            mockFetch.mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue({ prompt_id: mockPromptId }),
            });
            const prompt = minimalWorkflowData();

            // Act
            const result = await client.queuePrompt(prompt);

            // Assert
            expect(result).toBe(mockPromptId);
            expect(mockFetch).toHaveBeenCalledWith(
                `http://localhost:8188/prompt`,
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ prompt, client_id: 'test-client-id' }),
                }),
            );
            expect(logger.info).toHaveBeenCalledWith(`Prompt queued successfully with ID: ${mockPromptId}`);
        });

        it('should throw error if comfyui_config.address is invalid', async () => {
            // Arrange
            COMFYUI_CONFIG.ADDRESS = '';
            const prompt = minimalWorkflowData();

            // Act
            // Assert
            await expect(client.queuePrompt(prompt)).rejects.toThrow(SystemError);
            await expect(client.queuePrompt(prompt)).rejects.toThrow('ComfyUI server address not configured.');
            expect(logger.error).toHaveBeenCalledWith('ComfyUI server address is not configured.');
        });

        it('should throw error if response.ok is false', async () => {
            // Arrange
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                text: vi.fn().mockResolvedValue('Internal Server Error'),
            });
            const prompt = minimalWorkflowData();

            // Act
            // Assert
            await expect(client.queuePrompt(prompt)).rejects.toThrow(SystemError);
            await expect(client.queuePrompt(prompt)).rejects.toThrow('ComfyUI backend returned status 500');
            expect(logger.error).toHaveBeenCalledWith('ComfyUI Error (500): Internal Server Error');
        });

        it('should throw error if fetch throws (Network error)', async () => {
            // Arrange
            mockFetch.mockRejectedValue(new Error('Network error'));
            const prompt = minimalWorkflowData();

            // Act
            // Assert
            await expect(client.queuePrompt(prompt)).rejects.toThrow(SystemError);
            await expect(client.queuePrompt(prompt)).rejects.toThrow('Failed to queue prompt: Network error');
            expect(logger.error).toHaveBeenCalledWith('Error queuing prompt:', expect.any(Error));
        });

        it('should throw error if response.json() fails', async () => {
            // Arrange
            mockFetch.mockResolvedValue({
                ok: true,
                json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
            });
            const prompt = minimalWorkflowData();

            // Act
            // Assert
            await expect(client.queuePrompt(prompt)).rejects.toThrow(SystemError);
            await expect(client.queuePrompt(prompt)).rejects.toThrow('Failed to queue prompt: Invalid JSON');
            expect(logger.error).toHaveBeenCalledWith('Error queuing prompt:', expect.any(Error));
        });
    });

    describe('connectWebSocket', () => {
        it('should successfully connect to WebSocket', async () => {
            // Arrange
            const mockWs = {
                on: vi.fn((event, callback) => {
                    if (event === 'open') {
                        setImmediate(() => callback());
                    }
                }),
            };
            (WebSocket as unknown as Mock).mockImplementation(function () {
                return mockWs;
            });

            // Act
            const ws = await client.connectWebSocket();

            // Assert
            expect(ws).toBe(mockWs);
            expect(WebSocket).toHaveBeenCalledWith(`ws://localhost:8188/ws?clientId=test-client-id`);
            expect(logger.info).toHaveBeenCalledWith(`Connected to ComfyUI WebSocket at localhost`);
        });

        it('should throw error if WebSocket constructor fails', async () => {
            // Arrange
            (WebSocket as unknown as Mock).mockImplementation(function () {
                throw new Error('Constructor Failed');
            });

            // Act
            // Assert
            await expect(client.connectWebSocket()).rejects.toThrow(SystemError);
            await expect(client.connectWebSocket()).rejects.toThrow(
                'Could not connect to ComfyUI server. Is it running?',
            );
            expect(logger.error).toHaveBeenCalledWith('Error connecting to ComfyUI server:', expect.any(Error));
        });

        it('should throw error if WebSocket emits an error event during connection', async () => {
            // Arrange
            const mockWs = {
                on: vi.fn((event, callback) => {
                    if (event === 'error') {
                        // Simulate async error event
                        setImmediate(() => callback(new Error('Connection error')));
                    }
                }),
            };
            // Vitest: mockReturnValue is not constructible under `new` — use a
            // function implementation that returns the instance instead.
            (WebSocket as unknown as Mock).mockImplementation(function () {
                return mockWs;
            });

            // Act
            // Assert
            await expect(client.connectWebSocket()).rejects.toThrow(SystemError);
            await expect(client.connectWebSocket()).rejects.toThrow('WebSocket connection error: Connection error');
            expect(logger.error).toHaveBeenCalledWith('WebSocket connection error:', expect.any(Error));
        });
    });

    describe('getImagesFromWebSocket', () => {
        it('should successfully retrieve images from WebSocket', async () => {
            // Arrange
            const mockPromptId = 'test-id';
            const mockImageData = Buffer.from('fake-image-data');
            // ComfyUI binary format has an 8-byte header
            const mockBinaryMessage = Buffer.concat([Buffer.alloc(8), mockImageData]);

            const mockWs = {
                on: vi.fn((event, callback) => {
                    if (event === 'message') {
                        // 1. Start execution
                        setImmediate(() =>
                            callback(
                                Buffer.from(
                                    JSON.stringify({
                                        type: 'executing',
                                        data: { prompt_id: mockPromptId, node: 'SaveImageWebsocket' },
                                    }),
                                ),
                            ),
                        );

                        // 2. Send image data
                        setImmediate(() => callback(mockBinaryMessage));

                        // 3. Complete execution
                        setImmediate(() =>
                            callback(
                                Buffer.from(
                                    JSON.stringify({
                                        type: 'executing',
                                        data: { prompt_id: mockPromptId, node: null },
                                    }),
                                ),
                            ),
                        );
                    }
                }),
            };
            (client as unknown as { ws: WebSocket | null }).ws = mockWs as unknown as WebSocket;

            // Act
            const images = await client.getImagesFromWebSocket(mockPromptId);

            // Assert
            expect(images.has('SaveImageWebsocket')).toBe(true);
            const savedImages = images.get('SaveImageWebsocket');
            expect(savedImages).toHaveLength(1);
            expect(savedImages![0]).toEqual(mockImageData);
            expect(logger.info).toHaveBeenCalledWith(
                `Execution complete. Received 1 image(s) for prompt ${mockPromptId}`,
            );
        });

        it('should throw error if websocket nonexistant', async () => {
            // Arrange
            // Act
            // Assert
            await expect(client.getImagesFromWebSocket('test-id')).rejects.toThrow(SystemError);
            await expect(client.getImagesFromWebSocket('test-id')).rejects.toThrow('WebSocket not connected');
        });

        it('should throw error if message parsing fails (invalid JSON)', async () => {
            // Arrange
            const mockWs = {
                on: vi.fn((event, callback) => {
                    if (event === 'message') {
                        // Simulate async message event with invalid JSON
                        setImmediate(() => callback(Buffer.from('{invalid')));
                    }
                }),
            };
            (client as unknown as { ws: WebSocket | null }).ws = mockWs as unknown as WebSocket;

            // Assert
            await expect(client.getImagesFromWebSocket('test-id')).rejects.toThrow(SystemError);
            await expect(client.getImagesFromWebSocket('test-id')).rejects.toThrow(
                /Error processing WebSocket message:/,
            );
            expect(logger.error).toHaveBeenCalledWith('Error processing WebSocket message:', expect.any(Error));
        });

        it('should throw error if WebSocket emits an error event during image retrieval', async () => {
            // Arrange
            type MockWs = { on: (event: string, callback: (data: unknown) => void) => MockWs };
            let mockWs: MockWs;
            mockWs = {
                on: vi.fn((event: string, callback: (data: unknown) => void) => {
                    if (event === 'error') {
                        // Simulate async error event
                        setImmediate(() => callback(new Error('Retrieval error')));
                    }
                    return mockWs; // Usually .on returns the emitter
                }),
            };
            (client as unknown as { ws: WebSocket | null }).ws = mockWs as unknown as WebSocket;

            // Act
            // Assert
            await expect(client.getImagesFromWebSocket('test-id')).rejects.toThrow(SystemError);
            await expect(client.getImagesFromWebSocket('test-id')).rejects.toThrow('WebSocket error: Retrieval error');
            expect(logger.error).toHaveBeenCalledWith('WebSocket error during image retrieval:', expect.any(Error));
        });
    });

    // Note: the old `unloadModels` tests were removed along with the method —
    // VRAM is now freed by stopping the ComfyUI user service (see
    // comfyui-service-manager.test.ts).
});
