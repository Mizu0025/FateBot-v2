import { FilteredPrompt } from '../types';
import { BOT_CONFIG, GENERATION_DEFAULTS } from '../config/constants';
import { logger } from '../config/logger';

/**
 * Parses user input message into structured image generation parameters.
 * Supports various flags (e.g., --width, --height, --model) and their short aliases.
 */
export class PromptParser {
    /**
     * Extracts variables from a raw IRC message.
     * @param message The full message including the trigger word.
     * @returns A promise resolving to a structured FilteredPrompt object.
     * @throws Error if the message does not start with the valid trigger word.
     */
    public static async extractPrompts(message: string): Promise<FilteredPrompt> {
        // if message doesn't begin with the bot trigger, raise an error
        if (!message.startsWith(BOT_CONFIG.TRIGGER_WORD)) {
            logger.error("Prompt trigger is missing or empty!");
            throw new Error("Prompt trigger is missing or empty!");
        }

        // Remove the trigger keyword and leading/trailing spaces
        const input = message.replace(BOT_CONFIG.TRIGGER_WORD, "").trim();
        const result = this.parseInput(input);

        logger.debug('Extracted prompt parameters', {
            width: result.width,
            height: result.height,
            model: result.model || 'default',
            count: result.count,
            seed: result.seed === -1 ? 'random' : result.seed
        });

        return result;
    }

    /**
     * Internal logic for splitting the message into a main prompt and various modifiers.
     * @param input The input string with the trigger word already removed.
     * @returns A populated FilteredPrompt object.
     */
    private static parseInput(input: string): FilteredPrompt {
        const result: FilteredPrompt = {
            prompt: "",
            width: GENERATION_DEFAULTS.WIDTH,
            height: GENERATION_DEFAULTS.HEIGHT,
            model: "",
            negative_prompt: "",
            count: GENERATION_DEFAULTS.COUNT,
            seed: -1
        };

        const modifierMatches = this.findModifierMatches(input);

        if (modifierMatches.length === 0) {
            result.prompt = input.trim();
            return result;
        }

        // Everything before the first modifier is the prompt
        result.prompt = input.substring(0, modifierMatches[0].index).trim();

        // Process each modifier
        for (let i = 0; i < modifierMatches.length; i++) {
            const current = modifierMatches[i];
            const next = modifierMatches[i + 1];

            const value = this.extractValue(input, current, next);
            this.applyModifier(result, current.flag, value);
        }

        return result;
    }

    /**
     * Uses regex to identify all registered modifier flags in the input string.
     * @param input The raw input string.
     * @returns An array of match objects containing the flag, its index and length.
     */
    private static findModifierMatches(input: string): { flag: string, index: number, length: number }[] {
        const allAliases = Object.values(this.MODIFIER_MAP).flat();
        const aliasRegex = new RegExp(`(?:^|\\s)(${allAliases.join('|')})(?=[\\s=]|$)`, 'g');

        const matches: { flag: string, index: number, length: number }[] = [];
        let match;
        while ((match = aliasRegex.exec(input)) !== null) {
            const flag = match[1];
            const flagIndex = input.indexOf(flag, match.index);
            matches.push({
                flag,
                index: flagIndex,
                length: flag.length
            });
        }
        return matches;
    }

    /**
     * Extracts the specific value string following a modifier.
     * Handles both space-separated and equals-sign formats.
     * @param input The raw input string.
     * @param current The current flag match details.
     * @param next The optional next flag match details (to determine the end of the current value).
     * @returns The extracted value string.
     */
    private static extractValue(input: string, current: { index: number, length: number }, next?: { index: number }): string {
        const start = current.index + current.length;
        const end = next ? next.index : input.length;
        let value = input.substring(start, end).trim();

        if (value.startsWith('=')) {
            value = value.substring(1).trim();
        }
        return value;
    }

    /**
     * Applies a specific flag/value pair to the corresponding field in the FilteredPrompt result.
     * @param result The FilteredPrompt object being built.
     * @param flag The modifier flag (e.g., "-w" or "--width").
     * @param value The value associated with the flag.
     */
    private static applyModifier(result: FilteredPrompt, flag: string, value: string): void {
        for (const [key, aliases] of Object.entries(this.MODIFIER_MAP)) {
            if (aliases.includes(flag)) {
                switch (key) {
                    case 'width': {
                        const val = parseInt(value);
                        if (!isNaN(val)) result.width = val;
                        break;
                    }
                    case 'height': {
                        const val = parseInt(value);
                        if (!isNaN(val)) result.height = val;
                        break;
                    }
                    case 'model':
                        result.model = value;
                        break;
                    case 'negative_prompt':
                        result.negative_prompt = value;
                        break;
                    case 'count': {
                        const val = parseInt(value);
                        if (!isNaN(val)) result.count = val;
                        break;
                    }
                    case 'seed': {
                        const val = parseInt(value);
                        if (!isNaN(val)) result.seed = val;
                        break;
                    }
                }
                break;
            }
        }
    }

    private static readonly MODIFIER_MAP: Record<string, string[]> = {
        width: ['--width', '-w'],
        height: ['--height', '-h'],
        model: ['--model', '-m'],
        negative_prompt: ['--no', '--negative', '-n'],
        count: ['--count', '-c'],
        seed: ['--seed', '-s']
    };
}
