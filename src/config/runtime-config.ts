import { GENERATION_DEFAULTS } from './constants';
import { logger } from './logger';

/**
 * Holds global configuration state that can be modified at runtime.
 */
export class RuntimeConfig {
    private static _defaultModel: string = GENERATION_DEFAULTS.MODEL;

    /**
     * The name of the AI model to use when none is specified in the user's prompt.
     */
    static get defaultModel(): string {
        return this._defaultModel;
    }

    static set defaultModel(model: string) {
        const oldModel = this._defaultModel;
        this._defaultModel = model;
        logger.info(`Runtime default model changed from ${oldModel} to ${model}`);
    }
}
