import { GENERATION_DEFAULTS } from './constants';
import { logger } from './logger';

export class RuntimeConfig {
    private static _defaultModel: string = GENERATION_DEFAULTS.MODEL;

    static get defaultModel(): string {
        return this._defaultModel;
    }

    static set defaultModel(model: string) {
        const oldModel = this._defaultModel;
        this._defaultModel = model;
        logger.info(`Runtime default model changed from ${oldModel} to ${model}`);
    }
}
