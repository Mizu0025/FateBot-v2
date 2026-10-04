import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { ModelLoader } from './model-loader';

// `fs.promises.readFile` is now the single fs entry point (P1-1): mock it via
// an explicit factory so the test's vi.fn and the source's `import { promises
// as fs }` share one binding.
vi.mock('fs', () => ({
    promises: { readFile: vi.fn() },
}));

import { promises as fs } from 'node:fs';

const mockedReadFile = fs.readFile as unknown as Mock;

describe('ModelLoader', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('loadModelConfiguration', () => {
        it('should load model configuration for a valid model', async () => {
            // arrange
            const mockConfig = {
                paSanctuary: {
                    checkpointName: 'PaSanctuary_v5.safetensors',
                    vae: 'sdxl_vae.safetensors',
                },
            };
            mockedReadFile.mockResolvedValue(JSON.stringify(mockConfig));

            // act
            const modelConfig = await ModelLoader.loadModelConfiguration('paSanctuary');

            // assert
            expect(modelConfig).toEqual(mockConfig.paSanctuary);
        });

        it('should return null for an invalid model', async () => {
            // arrange
            const mockConfig = {
                paSanctuary: {
                    checkpointName: 'PaSanctuary_v5.safetensors',
                    vae: 'sdxl_vae.safetensors',
                },
            };
            mockedReadFile.mockResolvedValue(JSON.stringify(mockConfig));

            // act
            const modelConfig = await ModelLoader.loadModelConfiguration('invalidModel');

            // assert
            expect(modelConfig).toBeNull();
        });

        it('should throw an error if modelConfiguration.json is not found', async () => {
            // arrange
            mockedReadFile.mockImplementation(() => {
                throw new Error('File not found');
            });

            // act & assert
            await expect(ModelLoader.loadModelConfiguration('anyModel')).rejects.toThrow(
                'modelConfiguration.json not found. Please ensure it exists in the current directory.',
            );
        });
    });

    describe('getModelsList', () => {
        it('should return a comma-separated list of available models', async () => {
            // arrange
            const mockConfig = {
                paSanctuary: {},
                illustriousXL: {},
            };
            mockedReadFile.mockResolvedValue(JSON.stringify(mockConfig));

            // act
            const modelsList = await ModelLoader.getModelsList();

            // assert
            expect(modelsList).toBe('paSanctuary, illustriousXL');
        });

        it('should throw an error if modelConfiguration.json is not found', async () => {
            // arrange
            mockedReadFile.mockImplementation(() => {
                throw new Error('File not found');
            });

            // act & assert
            await expect(ModelLoader.getModelsList()).rejects.toThrow('modelConfiguration.json not found.');
        });
    });
});
