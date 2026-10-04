import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { ModelLoader } from './model-loader';

// Vitest: mock `fs` via an explicit factory whose readFileSync is a vi.fn, and
// grab that same vi.fn through a named import (not require), so the source's
// `import { readFileSync }` and the test share one binding.
vi.mock('fs', () => ({ readFileSync: vi.fn() }));

import { readFileSync } from 'node:fs';

const mockedReadFileSync = readFileSync as Mock;

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
            mockedReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

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
            mockedReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

            // act
            const modelConfig = await ModelLoader.loadModelConfiguration('invalidModel');

            // assert
            expect(modelConfig).toBeNull();
        });

        it('should throw an error if modelConfiguration.json is not found', async () => {
            // arrange
            mockedReadFileSync.mockImplementation(() => {
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
            mockedReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

            // act
            const modelsList = await ModelLoader.getModelsList();

            // assert
            expect(modelsList).toBe('paSanctuary, illustriousXL');
        });

        it('should throw an error if modelConfiguration.json is not found', async () => {
            // arrange
            mockedReadFileSync.mockImplementation(() => {
                throw new Error('File not found');
            });

            // act & assert
            await expect(ModelLoader.getModelsList()).rejects.toThrow('modelConfiguration.json not found.');
        });
    });
});
