import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { WorkflowData } from '../types';
import { COMFYUI_CONFIG } from '../config/constants';
import { getImageFilename } from './filename-utils';

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
    }

    /**
     * Queues a prompt to the ComfyUI server.
     */
    async queuePrompt(prompt: WorkflowData): Promise<string | null> {
        if (!COMFYUI_CONFIG.ADDRESS) {
            console.error("ComfyUI server address is not configured.");
            throw new Error("ComfyUI server address not configured.");
        }

        try {
            const payload = { prompt, client_id: this.clientId };
            console.log(`Queueing prompt with client ID: ${this.clientId}`);
            const response = await fetch(`http://${COMFYUI_CONFIG.ADDRESS}/prompt`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log("Prompt queued successfully.");
            return result.prompt_id;
        } catch (error) {
            console.error("Error queuing prompt:", error);
            return null;
        }
    }

    /**
     * Connects to the ComfyUI websocket.
     */
    async connectWebSocket(): Promise<WebSocket> {
        try {
            this.ws = new WebSocket(`ws://${COMFYUI_CONFIG.ADDRESS}/ws?clientId=${this.clientId}`);
            
            return new Promise((resolve, reject) => {
                if (!this.ws) {
                    reject(new Error("Failed to create WebSocket"));
                    return;
                }

                this.ws.on('open', () => {
                    console.log(`Connected to ComfyUI server at ${COMFYUI_CONFIG.ADDRESS}`);
                    resolve(this.ws!);
                });

                this.ws.on('error', (error) => {
                    console.error("WebSocket connection error:", error);
                    reject(new Error(`WebSocket connection error: ${error.message}`));
                });

                this.ws.on('close', () => {
                    console.log("WebSocket connection closed");
                });
            });
        } catch (error) {
            console.error("Error connecting to ComfyUI server:", error);
            throw new Error(`Could not connect to ComfyUI server at ${COMFYUI_CONFIG.ADDRESS}. Is the server running?`);
        }
    }

    /**
     * Retrieves generated images from the websocket connection.
     */
    async getImagesFromWebSocket(promptId: string): Promise<Map<string, Buffer[]>> {
        if (!this.ws) {
            throw new Error("WebSocket not connected");
        }

        const outputImages = new Map<string, Buffer[]>();
        let currentNode = "";

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("WebSocket timeout while waiting for images."));
            }, 300000); // 5 minute timeout

            this.ws!.on('message', (data: Buffer) => {
                try {
                    // Check if it's a text message (JSON) or binary data (image)
                    const messageStr = data.toString();
                    
                    if (messageStr.startsWith('{')) {
                        // JSON message
                        const message: ComfyUIMessage = JSON.parse(messageStr);
                        
                        if (message.type === 'executing') {
                            const executingData: ComfyUIExecutingData = message.data;
                            
                            if (executingData.prompt_id === promptId) {
                                if (executingData.node === null) {
                                    // Execution is done
                                    clearTimeout(timeout);
                                    resolve(outputImages);
                                } else {
                                    currentNode = executingData.node;
                                }
                            }
                        }
                    } else {
                        // Binary data (image)
                        if (currentNode === 'SaveImageWebsocket') {
                            const images = outputImages.get(currentNode) || [];
                            // Remove the first 8 bytes (header) and add the image data
                            images.push(data.slice(8));
                            outputImages.set(currentNode, images);
                        }
                    }
                } catch (error) {
                    console.error("Error processing WebSocket message:", error);
                    clearTimeout(timeout);
                    reject(new Error(`Error processing WebSocket message: ${error}`));
                }
            });

            this.ws!.on('error', (error) => {
                clearTimeout(timeout);
                console.error("WebSocket error during image retrieval:", error);
                reject(new Error(`WebSocket error: ${error.message}`));
            });

            this.ws!.on('close', () => {
                clearTimeout(timeout);
                console.log("WebSocket connection closed during image retrieval");
            });
        });
    }

    /**
     * Closes the WebSocket connection.
     */
    close(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    /**
     * Checks if the WebSocket is connected.
     */
    isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }
} 