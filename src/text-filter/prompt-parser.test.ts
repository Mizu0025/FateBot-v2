import { PromptParser } from './prompt-parser';
import { BOT_CONFIG } from '../config/constants';

describe('PromptParser', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });
    it('should extract the prompt, width, height, model, negative prompt, count, and seed from the message', async () => {
        // arrange
        const message = `${BOT_CONFIG.TRIGGER_WORD} a beautiful landscape --width=800 --height=600 --model=test-model --no ugly, blurry --count=2 --seed=12345`;

        // act
        const result = await PromptParser.extractPrompts(message);

        // assert
        expect(result).toEqual({
            prompt: 'a beautiful landscape',
            width: 800,
            height: 600,
            model: 'test-model',
            negative_prompt: 'ugly, blurry',
            count: 2,
            seed: 12345,
        });
    });

    it('should use default values when optional parameters are not provided', async () => {
        // arrange
        const message = `${BOT_CONFIG.TRIGGER_WORD} a beautiful landscape`;

        // act
        const result = await PromptParser.extractPrompts(message);

        // assert
        expect(result).toEqual({
            prompt: 'a beautiful landscape',
            width: 1024,
            height: 1024,
            model: '',
            negative_prompt: '',
            count: 4,
            seed: -1,
        });
    });

    it('should handle different order of parameters', async () => {
        // arrange
        const message = `${BOT_CONFIG.TRIGGER_WORD} a beautiful landscape --model=test-model --height=600 --width=800 --seed=12345 --no ugly, blurry --count=2`;

        // act
        const result = await PromptParser.extractPrompts(message);

        // assert
        expect(result).toEqual({
            prompt: 'a beautiful landscape',
            width: 800,
            height: 600,
            model: 'test-model',
            negative_prompt: 'ugly, blurry',
            count: 2,
            seed: 12345,
        });
    });

    it('should throw an error if the trigger word is missing', async () => {
        // arrange
        const message = 'a beautiful landscape --width=800 --height=600';

        // act & assert
        await expect(PromptParser.extractPrompts(message)).rejects.toThrow('Prompt trigger is missing or empty!');
    });
});
