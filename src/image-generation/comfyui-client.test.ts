import WebSocket from 'ws';
import { ComfyUIClient } from './comfyui-client';
import { COMFYUI_CONFIG } from '../config/constants';
import { logger } from '../config/logger';
import { SystemError } from '../types/errors';

// Mock dependencies
jest.mock('ws');
jest.mock('uuid', () => ({ v4: () => 'test-client-id' }));
jest.mock('../config/constants', () => ({
    COMFYUI_CONFIG: {
        ADDRESS: 'localhost',
        PORT: '8188'
    }
}));
jest.mock('../config/logger');

describe('ComfyUIClient', () => {
    let client: ComfyUIClient;
    let mockFetch: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset COMFYUI_CONFIG.ADDRESS to a valid value before each test
        (COMFYUI_CONFIG as any).ADDRESS = 'localhost';
        client = new ComfyUIClient();
        mockFetch = jest.fn();
        global.fetch = mockFetch as any;
    });

    describe('queuePrompt', () => {
        it('should successfully queue a prompt and return prompt_id', async () => {
            // Arrange
            const mockPromptId = 'test-prompt-id';
            mockFetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ prompt_id: mockPromptId })
            });
            const prompt = { nodes: [] } as any;

            // Act
            const result = await client.queuePrompt(prompt);

            // Assert
            expect(result).toBe(mockPromptId);
            expect(mockFetch).toHaveBeenCalledWith(
                `http://localhost:8188/prompt`,
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ prompt, client_id: 'test-client-id' })
                })
            );
            expect(logger.info).toHaveBeenCalledWith(`Prompt queued successfully with ID: ${mockPromptId}`);
        });


        it('should throw error if comfyui_config.address is invalid', async () => {
            // Arrange
            (COMFYUI_CONFIG as any).ADDRESS = '';
            const prompt = {} as any;

            // Act 
            // Assert
            await expect(client.queuePrompt(prompt)).rejects.toThrow(SystemError);
            await expect(client.queuePrompt(prompt)).rejects.toThrow("ComfyUI server address not configured.");
            expect(logger.error).toHaveBeenCalledWith("ComfyUI server address is not configured.");
        });

        it('should throw error if response.ok is false', async () => {
            // Arrange
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                text: jest.fn().mockResolvedValue('Internal Server Error')
            });
            const prompt = {} as any;

            // Act
            // Assert
            await expect(client.queuePrompt(prompt)).rejects.toThrow(SystemError);
            await expect(client.queuePrompt(prompt)).rejects.toThrow("ComfyUI backend returned status 500");
            expect(logger.error).toHaveBeenCalledWith("ComfyUI Error (500): Internal Server Error");
        });

        it('should throw error if fetch throws (Network error)', async () => {
            // Arrange
            mockFetch.mockRejectedValue(new Error("Network error"));
            const prompt = {} as any;

            // Act
            // Assert
            await expect(client.queuePrompt(prompt)).rejects.toThrow(SystemError);
            await expect(client.queuePrompt(prompt)).rejects.toThrow("Failed to queue prompt: Network error");
            expect(logger.error).toHaveBeenCalledWith("Error queuing prompt:", expect.any(Error));
        });

        it('should throw error if response.json() fails', async () => {
            // Arrange
            mockFetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockRejectedValue(new Error("Invalid JSON"))
            });
            const prompt = {} as any;

            // Act
            // Assert
            await expect(client.queuePrompt(prompt)).rejects.toThrow(SystemError);
            await expect(client.queuePrompt(prompt)).rejects.toThrow("Failed to queue prompt: Invalid JSON");
            expect(logger.error).toHaveBeenCalledWith("Error queuing prompt:", expect.any(Error));
        });
    });

    describe('connectWebSocket', () => {
        it('should successfully connect to WebSocket', async () => {
            // Arrange
            const mockWs = {
                on: jest.fn((event, callback) => {
                    if (event === 'open') {
                        setImmediate(() => callback());
                    }
                })
            };
            (WebSocket as unknown as jest.Mock).mockReturnValue(mockWs);

            // Act
            const ws = await client.connectWebSocket();

            // Assert
            expect(ws).toBe(mockWs);
            expect(WebSocket).toHaveBeenCalledWith(`ws://localhost:8188/ws?clientId=test-client-id`);
            expect(logger.info).toHaveBeenCalledWith(`Connected to ComfyUI WebSocket at localhost`);
        });


        it('should throw error if WebSocket constructor fails', async () => {
            // Arrange
            (WebSocket as unknown as jest.Mock).mockImplementation(() => {
                throw new Error("Constructor Failed");
            });

            // Act
            // Assert
            await expect(client.connectWebSocket()).rejects.toThrow(SystemError);
            await expect(client.connectWebSocket()).rejects.toThrow("Could not connect to ComfyUI server at localhost. Is the server running?");
            expect(logger.error).toHaveBeenCalledWith("Error connecting to ComfyUI server:", expect.any(Error));
        });

        it('should throw error if WebSocket emits an error event during connection', async () => {
            // Arrange
            const mockWs = {
                on: jest.fn((event, callback) => {
                    if (event === 'error') {
                        // Simulate async error event
                        setImmediate(() => callback(new Error("Connection error")));
                    }
                })
            };
            (WebSocket as unknown as jest.Mock).mockReturnValue(mockWs);

            // Act
            // Assert
            await expect(client.connectWebSocket()).rejects.toThrow(SystemError);
            await expect(client.connectWebSocket()).rejects.toThrow("WebSocket connection error: Connection error");
            expect(logger.error).toHaveBeenCalledWith("WebSocket connection error:", expect.any(Error));
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
                on: jest.fn((event, callback) => {
                    if (event === 'message') {
                        // 1. Start execution
                        setImmediate(() => callback(Buffer.from(JSON.stringify({
                            type: 'executing',
                            data: { prompt_id: mockPromptId, node: 'SaveImageWebsocket' }
                        }))));

                        // 2. Send image data
                        setImmediate(() => callback(mockBinaryMessage));

                        // 3. Complete execution
                        setImmediate(() => callback(Buffer.from(JSON.stringify({
                            type: 'executing',
                            data: { prompt_id: mockPromptId, node: null }
                        }))));
                    }
                })
            };
            (client as any).ws = mockWs;

            // Act
            const images = await client.getImagesFromWebSocket(mockPromptId);

            // Assert
            expect(images.has('SaveImageWebsocket')).toBe(true);
            const savedImages = images.get('SaveImageWebsocket');
            expect(savedImages).toHaveLength(1);
            expect(savedImages![0]).toEqual(mockImageData);
            expect(logger.info).toHaveBeenCalledWith(`Execution complete. Received 1 image(s) for prompt ${mockPromptId}`);
        });


        it('should throw error if websocket nonexistant', async () => {
            // Arrange
            // Act
            // Assert
            await expect(client.getImagesFromWebSocket('test-id')).rejects.toThrow(SystemError);
            await expect(client.getImagesFromWebSocket('test-id')).rejects.toThrow("WebSocket not connected");
        });

        it('should throw error if message parsing fails (invalid JSON)', async () => {
            // Arrange
            const mockWs = {
                on: jest.fn((event, callback) => {
                    if (event === 'message') {
                        // Simulate async message event with invalid JSON
                        setImmediate(() => callback(Buffer.from('{invalid')));
                    }
                })
            };
            (client as any).ws = mockWs;

            // Assert
            await expect(client.getImagesFromWebSocket('test-id')).rejects.toThrow(SystemError);
            await expect(client.getImagesFromWebSocket('test-id')).rejects.toThrow(/Error processing WebSocket message:/);
            expect(logger.error).toHaveBeenCalledWith("Error processing WebSocket message:", expect.any(Error));
        });

        it('should throw error if WebSocket emits an error event during image retrieval', async () => {
            // Arrange
            const mockWs: any = {
                on: jest.fn((event, callback) => {
                    if (event === 'error') {
                        // Simulate async error event
                        setImmediate(() => callback(new Error("Retrieval error")));
                    }
                    return mockWs; // Usually .on returns the emitter
                })
            };
            (client as any).ws = mockWs;

            // Act
            // Assert
            await expect(client.getImagesFromWebSocket('test-id')).rejects.toThrow(SystemError);
            await expect(client.getImagesFromWebSocket('test-id')).rejects.toThrow("WebSocket error: Retrieval error");
            expect(logger.error).toHaveBeenCalledWith("WebSocket error during image retrieval:", expect.any(Error));
        });
    });

    describe('unloadModels', () => {
        it('should successfully request model unloading', async () => {
            // Arrange
            mockFetch.mockResolvedValue({
                ok: true
            });

            // Act
            await client.unloadModels();

            // Assert
            expect(mockFetch).toHaveBeenCalledWith(
                `http://localhost:8188/free`,
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({
                        unload_models: true,
                        free_memory: true
                    })
                })
            );
            expect(logger.info).toHaveBeenCalledWith("Successfully requested model unloading.");
        });

        it('should log error if unloadModels fails', async () => {
            // Arrange
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                text: jest.fn().mockResolvedValue('Unload Failed')
            });

            // Act
            await client.unloadModels();

            // Assert
            expect(logger.error).toHaveBeenCalledWith("ComfyUI Unload Models Error (500): Unload Failed");
        });

        it('should log error if unloadModels throws', async () => {
            // Arrange
            mockFetch.mockRejectedValue(new Error("Fetch error"));

            // Act
            await client.unloadModels();

            // Assert
            expect(logger.error).toHaveBeenCalledWith("Error requesting model unloading:", expect.any(Error));
        });
    });
});
