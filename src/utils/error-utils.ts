import { SystemError } from '../types/errors';

/**
 * Well-known error categories for generation failures.
 */
export type FailureCategory =
    | 'offline'       // ComfyUI is not reachable (down / port closed)
    | 'backend'       // ComfyUI is reachable but rejected the request (HTTP 4xx/5xx)
    | 'timeout'       // ComfyUI stopped responding mid-job
    | 'internal';     // anything else

export interface ClassifiedError {
    category: FailureCategory;
    /** Short, safe, high-level reason line built from the error's details. */
    detail: string;
    /** True when the failure is almost certainly transient (worth retrying). */
    retryable: boolean;
}

const NETWORK_CODE_MESSAGES: Record<string, string> = {
    ECONNREFUSED: 'ComfyUI is not accepting connections (is it running?)',
    ECONNRESET: 'ComfyUI dropped the connection (it may have just started or crashed)',
    ETIMEDOUT: 'Timed out trying to reach ComfyUI',
    EPIPE: 'Connection to ComfyUI was closed mid-request',
};

/**
 * Classifies a SystemError (or anything else) into a failure category and
 * builds a short, human-readable detail string suitable for IRC.
 * This is a LAN bot used by one operator, so details are shown as-is.
 */
export function classifyGenerationError(error: unknown): ClassifiedError {
    const info = (error as { message?: string; details?: any; code?: string }) || {};
    const details = (error instanceof SystemError)
        ? error.details
        : (info.details ?? (error instanceof Error ? error : undefined));

    // 1) Direct network / connection errors (WebSocket connect, fetch failures)
    const netCode = (details as any)?.code ?? (error instanceof Error ? (error as any).code : undefined);
    if (typeof netCode === 'string' && NETWORK_CODE_MESSAGES[netCode]) {
        return { category: 'offline', detail: NETWORK_CODE_MESSAGES[netCode], retryable: true };
    }

    // 2) HTTP-level backend errors
    if (typeof (details as any)?.status === 'number') {
        const status = (details as any).status as number;
        const body = typeof (details as any).text === 'string' ? (details as any).text : '';
        const snippet = body.split('\n')[0]?.slice(0, 120);
        return {
            category: 'backend',
            detail: `ComfyUI responded HTTP ${status}${snippet ? `: ${snippet}` : ''}`,
            retryable: status < 500,
        };
    }

    // 3) Timeouts
    const message = error instanceof Error ? error.message : String(error ?? '');
    if (/timeout/i.test(message)) {
        return { category: 'timeout', detail: 'ComfyUI timed out while processing the request', retryable: true };
    }

    // 4) Anything else: include the raw message, it's a private bot
    return { category: 'internal', detail: message.slice(0, 200), retryable: false };
}

/**
 * Formats the standard IRC error reply for a generation failure.
 * @param error The error to classify.
 * @param nick Optional nick prefix (e.g. "Mizu25-hayate") to include in the reply.
 * @param context Optional extra context (e.g. the model name).
 */
export function formatFailureMessage(error: unknown, nick?: string, context?: string): string {
    const { category, detail, retryable } = classifyGenerationError(error);
    const parts = [`Generation failed (${category})`];
    if (detail) parts.push(detail);
    if (retryable) parts.push('likely transient — try again');
    if (context) parts.push(context);
    const message = parts.join('. ');
    return nick ? `${nick}: ${message}` : message;
}
