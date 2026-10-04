import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BOT_CONFIG } from '../config/constants';
import { UserError } from '../types/errors';
import { PromptParser } from './prompt-parser';

describe('PromptParser', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'log').mockImplementation(() => {});
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
        await expect(PromptParser.extractPrompts(message)).rejects.toThrow(
            `Message must start with ${BOT_CONFIG.TRIGGER_WORD}`,
        );
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
        // Arrange
        const message = `${BOT_CONFIG.TRIGGER_WORD} a beautiful landscape --seed 0`;

        // Act
        const result = await PromptParser.extractPrompts(message);

        // Assert
        expect(result.seed).toBe(0);
    });

    describe('safety bounds (P0-6)', () => {
        it.each([
            ['--width', 'width'],
            ['--height', 'height'],
            ['--count', 'count'],
        ])('should reject values above the max for %s', async (flag, name) => {
            const tooBig = flag === '--count' ? '65' : '8193';
            const message = `${BOT_CONFIG.TRIGGER_WORD} a beautiful landscape ${flag}=${tooBig}`;

            await expect(PromptParser.extractPrompts(message)).rejects.toThrow(UserError);
            await expect(PromptParser.extractPrompts(message)).rejects.toThrow(new RegExp(`Invalid ${name}`));
        });

        it.each([
            ['--width', '31'],
            ['--width', '0'],
            ['--width', '-5'],
            ['--count', '0'],
        ])('should reject values below the min for %s=%s', async (flag, val) => {
            const message = `${BOT_CONFIG.TRIGGER_WORD} a beautiful landscape ${flag}=${val}`;

            await expect(PromptParser.extractPrompts(message)).rejects.toThrow(UserError);
        });

        it.each([
            ['--width', '32'],
            ['--width', '8192'],
            ['--count', '1'],
            ['--count', '64'],
        ])('should accept boundary values for %s=%s', async (flag, val) => {
            const message = `${BOT_CONFIG.TRIGGER_WORD} a beautiful landscape ${flag}=${val}`;

            const result = await PromptParser.extractPrompts(message);
            const field = flag === '--width' ? 'width' : 'count';
            expect(result[field as 'width' | 'count']).toBe(parseInt(val, 10));
        });

        it('should reject non-numeric dimension values', async () => {
            const message = `${BOT_CONFIG.TRIGGER_WORD} a beautiful landscape --width=wide`;

            await expect(PromptParser.extractPrompts(message)).rejects.toThrow(UserError);
            await expect(PromptParser.extractPrompts(message)).rejects.toThrow(/Invalid width/);
        });
    });

    describe('trigger-word strip (P2-5)', () => {
        it('keeps a mid-prompt occurrence of the trigger word intact', async () => {
            // Arrange — the prompt text itself contains the trigger word.
            // Only the leading trigger must be stripped; with an unanchored
            // replace the inner occurrence would be eaten and the prompt
            // corrupted into `a picture of the word `.
            const message = `${BOT_CONFIG.TRIGGER_WORD} a picture of the word ${BOT_CONFIG.TRIGGER_WORD}`;

            // Act
            const result = await PromptParser.extractPrompts(message);

            // Assert
            expect(result.prompt).toBe(`a picture of the word ${BOT_CONFIG.TRIGGER_WORD}`);
        });

        it('strips the trigger even when it is followed by no space', async () => {
            // Arrange
            const message = `${BOT_CONFIG.TRIGGER_WORD}a beautiful landscape`;

            // Act
            const result = await PromptParser.extractPrompts(message);

            // Assert
            expect(result.prompt).toBe('a beautiful landscape');
        });
    });
});
