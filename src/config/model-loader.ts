import { readFileSync } from 'fs';
import { join } from 'path';
import { ModelConfiguration } from '../types';

export class ModelLoader {
    /**
     * Loads the configuration for a specific model.
     */
    static async loadModelConfiguration(modelName: string): Promise<ModelConfiguration | null> {
        try {
            const configPath = join(__dirname, '../../modelConfiguration.json');
            const configData = JSON.parse(readFileSync(configPath, 'utf8'));
            return configData[modelName] || null;
        } catch (error) {
            console.error('Error loading model configuration:', error);
            throw new Error('modelConfiguration.json not found. Please ensure it exists in the current directory.');
        }
    }

    /**
     * Returns a comma-separated list of available models.
     */
    static async getModelsList(): Promise<string> {
        try {
            const configPath = join(__dirname, '../../modelConfiguration.json');
            const data = JSON.parse(readFileSync(configPath, 'utf8'));
            return Object.keys(data).join(', ');
        } catch (error) {
            console.error('Error getting models:', error);
            throw new Error('modelConfiguration.json not found.');
        }
    }
} 