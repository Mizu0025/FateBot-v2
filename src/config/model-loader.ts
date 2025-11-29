import { readFileSync } from 'fs';
import { join } from 'path';
import { ModelConfiguration } from '../types';
import { logger } from '../config/logger';

export class ModelLoader {
    /**
     * Loads the configuration for a specific model.
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
     * Returns a comma-separated list of available models.
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