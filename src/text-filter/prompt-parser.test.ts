import { PromptParser } from './prompt-parser';
import { BOT_CONFIG } from '../config/constants';
import { UserError } from '../types/errors';

describe('PromptParser', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => { });
        jest.spyOn(console, 'log').mockImplementation(() => { });
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
        await expect(PromptParser.extractPrompts(message)).rejects.toThrow(UserError);
        await expect(PromptParser.extractPrompts(message)).rejects.toThrow(`Message must start with ${BOT_CONFIG.TRIGGER_WORD}`);
    });

    it('should support shortened modifiers and flexible formatting', async () => {
        // arrange
        const message = `${BOT_CONFIG.TRIGGER_WORD} a beautiful landscape -w 800 -h 600 -m test-model -n ugly, blurry -c 2 -s 12345`;

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

    it('should support mixed long and short modifiers with equals and spaces', async () => {
        // arrange
        const message = `${BOT_CONFIG.TRIGGER_WORD} a beautiful landscape --width 800 -h=600 --model test-model -n=ugly, blurry --count 2 -s=12345`;

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

    it('should correctly parse seed=0', async () => {
        // arrange
        const message = `${BOT_CONFIG.TRIGGER_WORD} a beautiful landscape --seed 0`;

        // act
        const result = await PromptParser.extractPrompts(message);

        // assert
        expect(result.seed).toBe(0);
    });
});
