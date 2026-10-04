import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';
import { COMFYUI_CONFIG } from '../config/constants';
import { logger } from '../config/logger';
import type { WorkflowData } from '../types';
import { type ErrorDetails, SystemError } from '../types/errors';

/** A message type known to arrive over the ComfyUI WebSocket. */
export type ComfyUIMessageType = 'executing' | 'status' | string;

export interface ComfyUIMessage {
    type: ComfyUIMessageType;
    /** Type-specific payload; only `executing` payloads are modeled. */
    data?: ComfyUIExecutingData;
}

export interface ComfyUIExecutingData {
    prompt_id: string;
    node: string | null;
}

/**
 * A client for interacting with the ComfyUI API and WebSocket server.
 * Handles prompt queueing and real-time image retrieval over the WebSocket.
 */
export class ComfyUIClient {
    private ws: WebSocket | null = null;
    /** The unique identifier for this client session. */
    public clientId: string;

    /**
     * Initializes a new client with a unique ID.
     */
    constructor() {
        this.clientId = uuidv4();
        logger.debug(`Created ComfyUI client with ID: ${this.clientId}`);
    }

    /**
     * Queues a prompt to the ComfyUI server for processing.
     * @param prompt The workflow data to be processed.
     * @returns The ComfyUI-assigned prompt ID.
     * @throws SystemError if the server address is missing or the request fails.
     */
    public async queuePrompt(prompt: WorkflowData): Promise<string> {
        if (!COMFYUI_CONFIG.ADDRESS) {
            logger.error('ComfyUI server address is not configured.');
            throw new SystemError('ComfyUI server address not configured.');
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
                throw new SystemError(`ComfyUI backend returned status ${response.status}`, {
                    status: response.status,
                    text: errorText,
                });
            }

            const result = await response.json();
            logger.info(`Prompt queued successfully with ID: ${result.prompt_id}`);
            return result.prompt_id;
        } catch (error) {
            if (error instanceof SystemError) throw error;
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Error queuing prompt:', error);
            // Preserve the network error code so callers can classify the failure
            // (e.g. ECONNREFUSED when ComfyUI is down).
            throw new SystemError(`Failed to queue prompt: ${message}`, ComfyUIClient.toErrorDetails(error));
        }
    }

    /**
     * Extracts network error details (e.g. ECONNREFUSED) from thrown values,
     * since DOMException/network failures are not part of the `Error` type.
     */
    private static toErrorDetails(error: unknown): ErrorDetails {
        const details: ErrorDetails = {};
        if (typeof error === 'object' && error !== null && typeof (error as { code?: unknown }).code === 'string') {
            details.code = (error as { code: string }).code;
        }
        return details;
    }

    /**
     * Connects to the ComfyUI WebSocket server for real-time updates.
     *
     * Unlike the pre-plan implementation, the promise always settles: a
     * connect timeout rejects a handshake that never completes, and a socket
     * that closes before `open` rejects instead of hanging (P0-1). Listeners
     * are removed on settle so a reused socket can't accumulate handlers.
     * @returns A promise that resolves to the connected WebSocket instance.
     * @throws SystemError if the connection fails or times out.
     */
    public connectWebSocket(): Promise<WebSocket> {
        let ws: WebSocket;
        try {
            ws = new WebSocket(`ws://${COMFYUI_CONFIG.ADDRESS}:${COMFYUI_CONFIG.PORT}/ws?clientId=${this.clientId}`);
        } catch (error) {
            logger.error('Error connecting to ComfyUI server:', error);
            return Promise.reject(
                new SystemError(
                    'Could not connect to ComfyUI server. Is it running?',
                    ComfyUIClient.toErrorDetails(error),
                ),
            );
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                cleanup();
                logger.error(`WebSocket connect timed out after ${COMFYUI_CONFIG.WS_CONNECT_TIMEOUT_MS}ms`);
                try {
                    ws.close();
                } catch {
                    // Socket may already be gone; nothing useful to do.
                }
                reject(
                    new SystemError(
                        `Could not connect to ComfyUI within ${COMFYUI_CONFIG.WS_CONNECT_TIMEOUT_MS}ms. Is it running?`,
                    ),
                );
            }, COMFYUI_CONFIG.WS_CONNECT_TIMEOUT_MS);

            const cleanup = () => {
                clearTimeout(timeout);
                if (typeof ws.off === 'function') {
                    ws.off('open', onOpen);
                    ws.off('error', onError);
                    ws.off('close', onClose);
                }
            };

            const onOpen = () => {
                cleanup();
                logger.info(`Connected to ComfyUI WebSocket at ${COMFYUI_CONFIG.ADDRESS}`);
                this.ws = ws;
                resolve(ws);
            };

            const onError = (error: Error) => {
                cleanup();
                logger.error('WebSocket connection error:', error);
                const code = ComfyUIClient.toErrorDetails(error).code;
                if (code === 'ECONNREFUSED') {
                    reject(new SystemError('Cannot connect to ComfyUI - server appears to be offline.', { code }));
                } else {
                    reject(
                        new SystemError(
                            `WebSocket connection error: ${error.message}`,
                            ComfyUIClient.toErrorDetails(error),
                        ),
                    );
                }
            };

            const onClose = () => {
                cleanup();
                logger.debug('WebSocket closed before the connection was established');
                reject(new SystemError('WebSocket connection closed before it was established.'));
            };

            ws.on('open', onOpen);
            ws.on('error', onError);
            ws.on('close', onClose);
        });
    }

    /**
     * Monitors the WebSocket for status updates and binary image data.
     *
     * Single `message` listener per call, removed on settle, so consecutive
     * generations on a reused socket don't accumulate handlers or double-count
     * frames (P0-1). A socket that closes mid-retrieval now rejects (before
     * the plan it hung until the 5-minute timeout) with a network-classified
     * `SystemError`.
     * @param promptId The ID of the prompt to wait for.
     * @returns A map of output keys to arrays of image buffers.
     * @throws SystemError if the WebSocket is not connected, the socket
     *         drops mid-job, or the job times out.
     */
    public getImagesFromWebSocket(promptId: string): Promise<Map<string, Buffer[]>> {
        if (!this.ws) {
            return Promise.reject(new SystemError('WebSocket not connected'));
        }

        const ws = this.ws;
        const outputImages = new Map<string, Buffer[]>();
        let currentNode = '';
        logger.debug(`Waiting for images from prompt ID: ${promptId}`);

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                logger.error(`WebSocket timeout while waiting for images (prompt ID: ${promptId})`);
                reject(new SystemError('WebSocket timeout while waiting for images.'));
            }, COMFYUI_CONFIG.WS_IMAGE_TIMEOUT_MS);

            const handleMessage = (data: Buffer) => {
                try {
                    const messageStr = data.toString();

                    if (messageStr.startsWith('{')) {
                        // JSON message
                        const message: ComfyUIMessage = JSON.parse(messageStr);
                        logger.debug(`Received WebSocket message type: ${message.type}`);

                        if (message.type === 'executing') {
                            const executingData: ComfyUIExecutingData | undefined = message.data;
                            if (!executingData) return;

                            if (executingData.prompt_id === promptId) {
                                if (executingData.node === null) {
                                    // Execution is done
                                    const imageCount = outputImages.get('SaveImageWebsocket')?.length || 0;
                                    logger.info(
                                        `Execution complete. Received ${imageCount} image(s) for prompt ${promptId}`,
                                    );
                                    cleanup();
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
                    logger.error('Error processing WebSocket message:', error);
                    cleanup();
                    const message = error instanceof Error ? error.message : String(error);
                    reject(
                        new SystemError(
                            `Error processing WebSocket message: ${message}`,
                            ComfyUIClient.toErrorDetails(error),
                        ),
                    );
                }
            };

            const handleError = (error: Error) => {
                logger.error('WebSocket error during image retrieval:', error);
                cleanup();
                reject(new SystemError(`WebSocket error: ${error.message}`, ComfyUIClient.toErrorDetails(error)));
            };

            // A socket close mid-retrieval used to leave the promise pending
            // until the timeout; reject immediately so the worker classifies it
            // as a failure instead of waiting 5 minutes (P0-1).
            const handleClose = () => {
                logger.debug('WebSocket connection closed during image retrieval');
                cleanup();
                reject(new SystemError('WebSocket connection closed while waiting for images.'));
            };

            const cleanup = () => {
                clearTimeout(timeout);
                if (typeof ws.off === 'function') {
                    ws.off('message', handleMessage);
                    ws.off('error', handleError);
                    ws.off('close', handleClose);
                }
            };

            ws.on('message', handleMessage);
            ws.on('error', handleError);
            ws.on('close', handleClose);
        });
    }

    /**
     * Closes the active WebSocket connection.
     */
    public close(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
