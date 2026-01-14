import { readFileSync } from 'fs';
import { join } from 'path';
import { ModelConfiguration } from '../types';
import { logger } from '../config/logger';

/**
 * Handles the loading and listing of model configurations 
 * from the external modelConfiguration.json file.
 */
export class ModelLoader {
    /**
     * Loads the configuration for a specific model from modelConfiguration.json.
     * @param modelName The unique identifier of the model to load.
     * @returns The model configuration if found, or null if it doesn't exist.
     * @throws Error if the configuration file cannot be read.
     */
    static async loadModelConfiguration(modelName: string): Promise<ModelConfiguration | null> {
        try {
            logger.info(`Loading model configuration: ${modelName}`);
            const configPath = join(__dirname, '../../modelConfiguration.json');
            const configData = JSON.parse(readFileSync(configPath, 'utf8'));
            const config = configData[modelName] || null;
            if (config) {
                logger.debug(`Model configuration found for ${modelName}`);
            } else {
                logger.warn(`Model configuration not found for ${modelName}`);
            }
            return config;
        } catch (error) {
            logger.error('Error loading model configuration:', error);
            throw new Error('modelConfiguration.json not found. Please ensure it exists in the current directory.');
        }
    }

    /**
     * Retrieves a list of all models defined in the configuration file.
     * @returns A comma-separated string containing the names of all available models.
     * @throws Error if the configuration file cannot be read.
     */
    static async getModelsList(): Promise<string> {
        try {
            logger.info('Retrieving available models list');
            const configPath = join(__dirname, '../../modelConfiguration.json');
            const data = JSON.parse(readFileSync(configPath, 'utf8'));
            return Object.keys(data).join(', ');
        } catch (error) {
            logger.error('Error getting models:', error);
            throw new Error('modelConfiguration.json not found.');
        }
    }
}
