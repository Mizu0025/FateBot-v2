import { ModelLoader } from './model-loader';
import { readFileSync } from 'fs';

// Mock the fs module
jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    readFileSync: jest.fn(),
}));

const mockedReadFileSync = readFileSync as jest.Mock;

describe('ModelLoader', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('loadModelConfiguration', () => {
        it('should load model configuration for a valid model', async () => {
            const mockConfig = {
                paSanctuary: {
                    checkpointName: 'PaSanctuary_v5.safetensors',
                    vae: 'sdxl_vae.safetensors',
                },
            };
            mockedReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

            const modelConfig = await ModelLoader.loadModelConfiguration('paSanctuary');
            expect(modelConfig).toEqual(mockConfig.paSanctuary);
        });

        it('should return null for an invalid model', async () => {
            const mockConfig = {
                paSanctuary: {
                    checkpointName: 'PaSanctuary_v5.safetensors',
                    vae: 'sdxl_vae.safetensors',
                },
            };
            mockedReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

            const modelConfig = await ModelLoader.loadModelConfiguration('invalidModel');
            expect(modelConfig).toBeNull();
        });

        it('should throw an error if modelConfiguration.json is not found', async () => {
            mockedReadFileSync.mockImplementation(() => {
                throw new Error('File not found');
            });

            await expect(ModelLoader.loadModelConfiguration('anyModel')).rejects.toThrow(
                'modelConfiguration.json not found. Please ensure it exists in the current directory.'
            );
        });
    });

    describe('getModelsList', () => {
        it('should return a comma-separated list of available models', async () => {
            const mockConfig = {
                paSanctuary: {},
                illustriousXL: {},
            };
            mockedReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

            const modelsList = await ModelLoader.getModelsList();
            expect(modelsList).toBe('paSanctuary, illustriousXL');
        });

        it('should throw an error if modelConfiguration.json is not found', async () => {
            mockedReadFileSync.mockImplementation(() => {
                throw new Error('File not found');
            });

            await expect(ModelLoader.getModelsList()).rejects.toThrow('modelConfiguration.json not found.');
        });
    });
});
