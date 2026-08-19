/**
 * Base class for all FateBot-related errors.
 */
export class FateBotError extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/**
 * Errors caused by invalid user input or requests.
 * These should be reported back to the user with actionable details.
 */
export class UserError extends FateBotError {
    constructor(message: string) {
        super(message);
    }
}

/**
 * Known optional fields carried by `SystemError.details`.
 * Open-ended: backends and network errors can attach arbitrary structured data.
 */
export interface ErrorDetails {
    /** Network error code (e.g. ECONNREFUSED, ECONNRESET). */
    code?: string;
    /** HTTP status code returned by a backend. */
    status?: number;
    /** Response body text for HTTP-level failures. */
    text?: string;
    [key: string]: unknown;
}

/**
 * Errors caused by system failures, backend issues, or environment problems.
 * These usually require admin attention and are reported generically to users.
 */
export class SystemError extends FateBotError {
    public details?: ErrorDetails;

    constructor(message: string, details?: ErrorDetails) {
        super(message);
        this.details = details;
    }
}
