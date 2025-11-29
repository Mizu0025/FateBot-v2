import { FilteredPrompt } from '../types';
import { BOT_CONFIG, GENERATION_DEFAULTS } from '../config/constants';

export class PromptParser {
    /**
     * Extracts the prompt, width, height, model, negative prompt, count, and seed from the message.
     * Assumes the format is:
     *    !trigger <prompt_text> --width=<width> --height=<height> --model=<model> --no <negative_prompt_text> --count=<count> --seed=<seed>
     */
    static async extractPrompts(message: string): Promise<FilteredPrompt> {
        // if message doesn't begin with the bot trigger, raise an error
        if (!message.startsWith(BOT_CONFIG.TRIGGER_WORD)) {
            console.error("Prompt trigger is missing or empty!");
            throw new Error("Prompt trigger is missing or empty!");
        }

        // Default values
        let prompt: string = "";
        let width: number = GENERATION_DEFAULTS.WIDTH;
        let height: number = GENERATION_DEFAULTS.HEIGHT;
        let model: string = "";
        let negative_prompt: string = "";
        let count: number = GENERATION_DEFAULTS.COUNT;
        let seed: number = -1;

        // Remove the trigger keyword and leading/trailing spaces
        message = message.replace(BOT_CONFIG.TRIGGER_WORD, "").trim();

        // Split the message into parts based on known keywords
        const parts = message.split("--");

        // The first part is the prompt
        prompt = parts[0].trim();

        // Process each part to extract width, height, model, and negative prompt
        for (const part of parts.slice(1)) {
            if (part.startsWith("width=")) {
                width = parseInt(part.substring("width=".length).trim());
            } else if (part.startsWith("height=")) {
                height = parseInt(part.substring("height=".length).trim());
            } else if (part.startsWith("model=")) {
                model = part.substring("model=".length).trim();
            } else if (part.startsWith("no")) {
                negative_prompt = part.substring("no".length).trim();
            } else if (part.startsWith("count=")) {
                count = parseInt(part.substring("count=".length).trim());
            } else if (part.startsWith("seed=")) {
                seed = parseInt(part.substring("seed=".length).trim());
            }
        }

        console.log("Extracted prompt data for image generation");
        return {
            prompt,
            width,
            height,
            model,
            negative_prompt,
            count,
            seed
        };
    }
} 