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
 * Errors caused by system failures, backend issues, or environment problems.
 * These usually require admin attention and are reported generically to users.
 */
export class SystemError extends FateBotError {
    public details?: any;

    constructor(message: string, details?: any) {
        super(message);
        this.details = details;
    }
}
