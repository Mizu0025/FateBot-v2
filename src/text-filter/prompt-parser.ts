import { FilteredPrompt } from '../types';
import { BOT_CONFIG } from '../config/constants';

export class PromptParser {
    /**
     * Extracts the prompt, width, height, model, and negative prompt from the message.
     * Assumes the format is:
     *    !trigger <prompt_text> --width=<width> --height=<height> --model=<model> --no <negative_prompt_text>
     */
    static async extractPrompts(message: string): Promise<FilteredPrompt> {
        // if message doesn't begin with the bot trigger, raise an error
        if (!message.startsWith(BOT_CONFIG.TRIGGER_WORD)) {
            console.error("Prompt trigger is missing or empty!");
            throw new Error("Prompt trigger is missing or empty!");
        }

        // Default values
        let prompt = "";
        let width = 1024;
        let height = 1024;
        let model = "";
        let negative_prompt = "";

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
            }
        }

        console.log("Extracted prompt data for image generation");
        return {
            prompt,
            width,
            height,
            model,
            negative_prompt
        };
    }
} 