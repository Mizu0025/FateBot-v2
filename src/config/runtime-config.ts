import { GENERATION_DEFAULTS } from './constants';

export class RuntimeConfig {
    private static _defaultModel: string = GENERATION_DEFAULTS.MODEL;

    static get defaultModel(): string {
        return this._defaultModel;
    }

    static set defaultModel(model: string) {
        this._defaultModel = model;
    }
}
