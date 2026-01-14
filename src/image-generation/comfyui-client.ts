import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { WorkflowData } from '../types';
import { COMFYUI_CONFIG } from '../config/constants';
import { logger } from '../config/logger';

export interface ComfyUIMessage {
    type: string;
    data?: any;
}

export interface ComfyUIExecutingData {
    prompt_id: string;
    node: string | null;
}

export class ComfyUIClient {
    private ws: WebSocket | null = null;
    public clientId: string;

    constructor() {
        this.clientId = uuidv4();
        logger.debug(`Created ComfyUI client with ID: ${this.clientId}`);
    }

    /**
     * Queues a prompt to the ComfyUI server.
     */
    public async queuePrompt(prompt: WorkflowData): Promise<string | null> {
        if (!COMFYUI_CONFIG.ADDRESS) {
            logger.error("ComfyUI server address is not configured.");
            throw new Error("ComfyUI server address not configured.");
        }

        try {
            const payload = { prompt, client_id: this.clientId };
            logger.debug(`Queueing prompt with client ID: ${this.clientId}`);
            const response = await fetch(`http://${COMFYUI_CONFIG.ADDRESS}:${COMFYUI_CONFIG.PORT}/prompt`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.error(`ComfyUI Error (${response.status}): ${errorText}`);
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            const result = await response.json();
            logger.info(`Prompt queued successfully with ID: ${result.prompt_id}`);
            return result.prompt_id;
        } catch (error) {
            logger.error("Error queuing prompt:", error);
            throw new Error(`Failed to queue prompt: ${error}`);
        }
    }

    /**
     * Connects to the ComfyUI websocket.
     */
    public async connectWebSocket(): Promise<WebSocket> {
        try {
            this.ws = new WebSocket(`ws://${COMFYUI_CONFIG.ADDRESS}:${COMFYUI_CONFIG.PORT}/ws?clientId=${this.clientId}`);

            return new Promise((resolve, reject) => {
                if (!this.ws) {
                    reject(new Error("Failed to create WebSocket"));
                    return;
                }

                this.ws.on('open', () => {
                    logger.info(`Connected to ComfyUI WebSocket at ${COMFYUI_CONFIG.ADDRESS}`);
                    resolve(this.ws!);
                });

                this.ws.on('error', (error) => {
                    logger.error("WebSocket connection error:", error);
                    reject(new Error(`WebSocket connection error: ${error.message}`));
                });

                this.ws.on('close', () => {
                    logger.debug("WebSocket connection closed");
                });
            });
        } catch (error) {
            logger.error("Error connecting to ComfyUI server:", error);
            throw new Error(`Could not connect to ComfyUI server at ${COMFYUI_CONFIG.ADDRESS}. Is the server running?`);
        }
    }

    /**
     * Retrieves generated images from the websocket connection.
     */
    public async getImagesFromWebSocket(promptId: string): Promise<Map<string, Buffer[]>> {
        if (!this.ws) {
            throw new Error("WebSocket not connected");
        }

        const outputImages = new Map<string, Buffer[]>();
        let currentNode = "";
        logger.debug(`Waiting for images from prompt ID: ${promptId}`);

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                logger.error(`WebSocket timeout while waiting for images (prompt ID: ${promptId})`);
                reject(new Error("WebSocket timeout while waiting for images."));
            }, 300000); // 5 minute timeout

            this.ws!.on('message', (data: Buffer) => {
                try {
                    // Check if it's a text message (JSON) or binary data (image)
                    const messageStr = data.toString();

                    if (messageStr.startsWith('{')) {
                        // JSON message
                        const message: ComfyUIMessage = JSON.parse(messageStr);
                        logger.debug(`Received WebSocket message type: ${message.type}`);

                        if (message.type === 'executing') {
                            const executingData: ComfyUIExecutingData = message.data;

                            if (executingData.prompt_id === promptId) {
                                if (executingData.node === null) {
                                    // Execution is done
                                    const imageCount = outputImages.get('SaveImageWebsocket')?.length || 0;
                                    logger.info(`Execution complete. Received ${imageCount} image(s) for prompt ${promptId}`);
                                    clearTimeout(timeout);
                                    resolve(outputImages);
                                } else {
                                    logger.info(`Executing node: ${executingData.node} (prompt: ${promptId})`);
                                    currentNode = executingData.node;
                                }
                            }
                        }
                    } else {
                        // Binary data (image)
                        if (currentNode === 'SaveImageWebsocket') {
                            const images = outputImages.get(currentNode) || [];
                            const imageSize = data.length - 8;
                            logger.debug(`Received binary image data: ${imageSize} bytes`);
                            // Remove the first 8 bytes (header) and add the image data
                            images.push(data.slice(8));
                            outputImages.set(currentNode, images);
                        }
                    }
                } catch (error) {
                    logger.error("Error processing WebSocket message:", error);
                    clearTimeout(timeout);
                    reject(new Error(`Error processing WebSocket message: ${error}`));
                }
            });

            this.ws!.on('error', (error) => {
                clearTimeout(timeout);
                logger.error("WebSocket error during image retrieval:", error);
                reject(new Error(`WebSocket error: ${error.message}`));
            });

            this.ws!.on('close', () => {
                clearTimeout(timeout);
                logger.debug("WebSocket connection closed during image retrieval");
            });
        });
    }

    /**
     * Closes the WebSocket connection.
     */
    public close(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    /**
     * Sends a request to unload models from VRAM.
     */
    public async unloadModels(): Promise<void> {
        if (!COMFYUI_CONFIG.ADDRESS) {
            logger.error("ComfyUI server address is not configured.");
            return;
        }

        try {
            logger.info("Requesting ComfyUI to unload models...");
            const response = await fetch(`http://${COMFYUI_CONFIG.ADDRESS}:${COMFYUI_CONFIG.PORT}/free`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    unload_models: true,
                    free_memory: true
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.error(`ComfyUI Unload Models Error (${response.status}): ${errorText}`);
            } else {
                logger.info("Successfully requested model unloading.");
            }
        } catch (error) {
            logger.error("Error requesting model unloading:", error);
        }
    }
} 