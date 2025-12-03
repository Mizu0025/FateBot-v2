import { FilteredPrompt } from '../types';
import { BOT_CONFIG, GENERATION_DEFAULTS } from '../config/constants';
import { logger } from '../config/logger';
import yargs from 'yargs/yargs';

/**
 * Configuration for validation limits
 */
const VALIDATION_LIMITS = {
    MIN_WIDTH: 512,
    MAX_WIDTH: 2048,
    MIN_HEIGHT: 512,
    MAX_HEIGHT: 2048,
    MIN_COUNT: 1,
    MAX_COUNT: 16,
    MIN_SEED: 0,
    MAX_SEED: 2147483647, // Max 32-bit signed integer
} as const;

export class PromptParser {
    /**
     * Sanitizes prompt text by removing potentially harmful content
     * and trimming excessive whitespace
     */
    private static sanitizeText(text: string): string {
        return text
            .trim()
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .replace(/[<>]/g, ''); // Remove potential HTML/XML tags
    }

    /**
     * Validates that a number is within the specified range
     */
    private static validateRange(
        value: number,
        min: number,
        max: number,
        fieldName: string
    ): void {
        if (isNaN(value)) {
            throw new Error(`${fieldName} must be a valid number`);
        }
        if (value < min || value > max) {
            throw new Error(
                `${fieldName} must be between ${min} and ${max}, got ${value}`
            );
        }
    }

    /**
     * Validates that dimensions are valid multiples of 8 (required by most SD models)
     */
    private static validateDimension(value: number, fieldName: string): void {
        if (value % 8 !== 0) {
            throw new Error(
                `${fieldName} must be a multiple of 8, got ${value}`
            );
        }
    }

    /**
     * Extracts the prompt, width, height, model, negative prompt, count, and seed from the message.
     * Supports both long-form (--width) and short-form (-w) flags.
     * 
     * Format:
     *    !trigger <prompt_text> [options]
     * 
     * Options:
     *    -w, --width <number>      Image width (512-2048, multiple of 8)
     *    -h, --height <number>     Image height (512-2048, multiple of 8)
     *    -m, --model <string>      Model name
     *    -n, --neg <string>        Negative prompt
     *    -c, --count <number>      Number of images (1-16)
     *    -s, --seed <number>       Random seed (0-2147483647)
     */
    static extractPrompts(message: string): FilteredPrompt {
        // Validate message starts with trigger word
        if (!message.startsWith(BOT_CONFIG.TRIGGER_WORD)) {
            logger.error("Prompt trigger is missing or empty!");
            throw new Error("Prompt trigger is missing or empty!");
        }

        // Remove the trigger keyword and leading/trailing spaces
        const messageWithoutTrigger = message
            .replace(BOT_CONFIG.TRIGGER_WORD, "")
            .trim();

        // Split message into tokens for yargs parsing
        // We need to handle the prompt text (everything before the first --)
        // and the arguments separately
        const firstFlagIndex = messageWithoutTrigger.search(/\s+-/);

        let promptText = "";
        let argsString = "";

        if (firstFlagIndex === -1) {
            // No flags found, entire message is the prompt
            promptText = messageWithoutTrigger;
        } else {
            // Split at first flag
            promptText = messageWithoutTrigger.substring(0, firstFlagIndex).trim();
            argsString = messageWithoutTrigger.substring(firstFlagIndex).trim();
        }

        // Parse arguments using yargs
        const parser = yargs(argsString.split(/\s+/))
            .option('width', {
                alias: 'w',
                type: 'number',
                description: 'Image width',
                default: GENERATION_DEFAULTS.WIDTH,
            })
            .option('height', {
                alias: 'h',
                type: 'number',
                description: 'Image height',
                default: GENERATION_DEFAULTS.HEIGHT,
            })
            .option('model', {
                alias: 'm',
                type: 'string',
                description: 'Model name',
                default: '',
            })
            .option('neg', {
                alias: 'n',
                type: 'string',
                description: 'Negative prompt',
                default: '',
            })
            .option('count', {
                alias: 'c',
                type: 'number',
                description: 'Number of images to generate',
                default: GENERATION_DEFAULTS.COUNT,
            })
            .option('seed', {
                alias: 's',
                type: 'number',
                description: 'Random seed',
                default: -1,
            })
            .help(false) // Disable built-in help
            .version(false) // Disable version
            .strict(false) // Don't throw on unknown options
            .exitProcess(false); // Don't exit the process on error

        let parsedArgs;
        try {
            parsedArgs = parser.parseSync();
        } catch (error: any) {
            logger.error("Error parsing arguments:", error);
            throw new Error(`Invalid argument format: ${error.message}`);
        }

        // Extract and validate values
        const width = parsedArgs.width as number;
        const height = parsedArgs.height as number;
        const count = parsedArgs.count as number;
        const seed = parsedArgs.seed as number;

        // Validate dimensions
        this.validateRange(width, VALIDATION_LIMITS.MIN_WIDTH, VALIDATION_LIMITS.MAX_WIDTH, 'Width');
        this.validateRange(height, VALIDATION_LIMITS.MIN_HEIGHT, VALIDATION_LIMITS.MAX_HEIGHT, 'Height');
        this.validateDimension(width, 'Width');
        this.validateDimension(height, 'Height');

        // Validate count
        this.validateRange(count, VALIDATION_LIMITS.MIN_COUNT, VALIDATION_LIMITS.MAX_COUNT, 'Count');

        // Validate seed if provided
        if (seed !== -1) {
            this.validateRange(seed, VALIDATION_LIMITS.MIN_SEED, VALIDATION_LIMITS.MAX_SEED, 'Seed');
        }

        // Sanitize text inputs
        const sanitizedPrompt = this.sanitizeText(promptText);
        const sanitizedModel = this.sanitizeText(parsedArgs.model as string);
        const sanitizedNegativePrompt = this.sanitizeText(parsedArgs.neg as string);

        // Validate prompt is not empty
        if (!sanitizedPrompt) {
            throw new Error("Prompt text cannot be empty");
        }

        logger.debug('Extracted prompt parameters', {
            width,
            height,
            model: sanitizedModel || 'default',
            count,
            seed: seed === -1 ? 'random' : seed,
            promptLength: sanitizedPrompt.length,
            negativePromptLength: sanitizedNegativePrompt.length
        });

        return {
            prompt: sanitizedPrompt,
            width,
            height,
            model: sanitizedModel,
            negative_prompt: sanitizedNegativePrompt,
            count,
            seed
        };
    }
} 