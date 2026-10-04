import { BOT_CONFIG, GENERATION_DEFAULTS } from '../config/constants';
import { logger } from '../config/logger';
import type { FilteredPrompt } from '../types';
import { UserError } from '../types/errors';

/**
 * Hard safety bounds on user-supplied generation parameters.
 *
 * `--width 65536 --height 65536 --count 128` used to parse cleanly and ask
 * the GPU to allocate tens of gigabytes of VRAM. These bounds turn that into
 * a `UserError` the caller can echo back to the IRC channel.
 */
const GENERATION_LIMITS = {
    MIN_DIMENSION: 32,
    MAX_DIMENSION: 8192,
    MIN_COUNT: 1,
    MAX_COUNT: 64,
} as const;

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
            logger.error('Prompt trigger is missing or empty!');
            throw new UserError(`Message must start with ${BOT_CONFIG.TRIGGER_WORD}`);
        }

        // Remove only the *leading* trigger word (P2-5). The `startsWith`
        // check above has already anchored it to the message prefix, so we
        // strip that exact prefix rather than searching for the trigger word
        // anywhere in the string — a plain `.replace(trigger, '')` would drop
        // the first occurrence wherever it appears and could corrupt a prompt
        // that legitimately contains the trigger word mid-text.
        const input = message.slice(BOT_CONFIG.TRIGGER_WORD.length).trim();
        const result = PromptParser.parseInput(input);

        logger.debug('Extracted prompt parameters', {
            width: result.width,
            height: result.height,
            model: result.model || 'default',
            count: result.count,
            seed: result.seed === -1 ? 'random' : result.seed,
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
            prompt: '',
            width: GENERATION_DEFAULTS.WIDTH,
            height: GENERATION_DEFAULTS.HEIGHT,
            model: '',
            negative_prompt: '',
            count: GENERATION_DEFAULTS.COUNT,
            seed: -1,
        };

        const modifierMatches = PromptParser.findModifierMatches(input);

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

            const value = PromptParser.extractValue(input, current, next);
            PromptParser.applyModifier(result, current.flag, value);
        }

        return result;
    }

    /**
     * Uses regex to identify all registered modifier flags in the input string.
     * @param input The raw input string.
     * @returns An array of match objects containing the flag, its index and length.
     */
    private static findModifierMatches(input: string): { flag: string; index: number; length: number }[] {
        const allAliases = Object.values(PromptParser.MODIFIER_MAP).flat();
        const aliasRegex = new RegExp(`(?:^|\\s)(${allAliases.join('|')})(?=[\\s=]|$)`, 'g');

        const matches: { flag: string; index: number; length: number }[] = [];
        let match = aliasRegex.exec(input);
        while (match !== null) {
            const flag = match[1];
            const flagIndex = input.indexOf(flag, match.index);
            matches.push({
                flag,
                index: flagIndex,
                length: flag.length,
            });
            match = aliasRegex.exec(input);
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
    private static extractValue(
        input: string,
        current: { index: number; length: number },
        next?: { index: number },
    ): string {
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
     * @param result The prompt object being built.
     * @param flag The modifier flag (e.g., "--width" or "-w").
     * @param value The value string associated with the flag.
     */
    private static applyModifier(result: FilteredPrompt, flag: string, value: string): void {
        for (const [key, aliases] of Object.entries(PromptParser.MODIFIER_MAP)) {
            if (aliases.includes(flag)) {
                switch (key) {
                    case 'width':
                        result.width = PromptParser.parseBoundedInt(
                            value,
                            GENERATION_LIMITS.MIN_DIMENSION,
                            GENERATION_LIMITS.MAX_DIMENSION,
                            'width',
                        );
                        break;
                    case 'height':
                        result.height = PromptParser.parseBoundedInt(
                            value,
                            GENERATION_LIMITS.MIN_DIMENSION,
                            GENERATION_LIMITS.MAX_DIMENSION,
                            'height',
                        );
                        break;
                    case 'model':
                        result.model = value;
                        break;
                    case 'negative_prompt':
                        result.negative_prompt = value;
                        break;
                    case 'count':
                        result.count = PromptParser.parseBoundedInt(
                            value,
                            GENERATION_LIMITS.MIN_COUNT,
                            GENERATION_LIMITS.MAX_COUNT,
                            'count',
                        );
                        break;
                    case 'seed': {
                        const val = parseInt(value, 10);
                        if (!Number.isNaN(val)) result.seed = val;
                        break;
                    }
                }
                break;
            }
        }
    }

    /**
     * Parses a flag value as a positive integer in the range [lo, hi],
     * throwing a {@link UserError} describing the valid bounds otherwise.
     * Values that fail to parse (e.g. `--width wide`) are also rejected with
     * the bounds so the user gets a single, consistent error.
     */
    private static parseBoundedInt(value: string, lo: number, hi: number, name: string): number {
        const val = parseInt(value, 10);
        if (Number.isNaN(val) || val < lo || val > hi) {
            throw new UserError(`Invalid ${name} "${value}". Must be an integer between ${lo} and ${hi}.`);
        }
        return val;
    }

    private static readonly MODIFIER_MAP: Record<string, string[]> = {
        width: ['--width', '-w'],
        height: ['--height', '-h'],
        model: ['--model', '-m'],
        negative_prompt: ['--no', '--negative', '-n'],
        count: ['--count', '-c'],
        seed: ['--seed', '-s'],
    };
}
