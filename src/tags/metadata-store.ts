/**
 * Manages a JSON-based tag metadata store for saved images on disk.
 * Each image has a `.tags.json` companion file with its extracted keywords.
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { logger } from '../config/logger';

const TAGS_FILE_EXT = '.tags.json';

export interface ImageTagData {
    prompt: string;
    negative_prompt: string;
    tags: string[];
    model: string;
    width: number;
    height: number;
    source: string;
    timestamp: string;
}

export class MetadataStore {
    private static instance: MetadataStore;

    public static getInstance(): MetadataStore {
        if (!MetadataStore.instance) {
            MetadataStore.instance = new MetadataStore();
        }
        return MetadataStore.instance;
    }

    /**
     * Constructs the path to the companion tags JSON file
     */
    private static tagsFilePath(imagePath: string): string {
        return join(imagePath, TAGS_FILE_EXT);
    }

    /**
     * Write tag data to the companion JSON file alongside the image
     */
    public static saveTags(imagePath: string, tagData: ImageTagData): boolean {
        const tagsPath = MetadataStore.tagsFilePath(imagePath);

        try {
            const json = JSON.stringify(tagData, null, 2);
            writeFileSync(tagsPath, json);
            logger.debug(`Saved tags for: ${imagePath}`);
            return true;
        } catch (error) {
            logger.error(`Error saving tags for ${imagePath}:`, error);
            return false;
        }
    }

    /**
     * Read tag data from the companion JSON file for an image
     * @returns Tag data object or null if not found
     */
    public static readTags(imagePath: string): ImageTagData | null {
        const tagsPath = MetadataStore.tagsFilePath(imagePath);

        try {
            const tagsPathStr = String(tagsPath);
            if (!existsSync(tagsPathStr)) {
                logger.debug(`Tags file does not exist for: ${imagePath}`);
                return null;
            }
            const json = readFileSync(tagsPathStr, 'utf-8');
            return JSON.parse(json);
        } catch (error) {
            logger.warn(`Error reading tags for ${imagePath}:`, error);
            return null;
        }
    }

    /**
     * Delete the companion tags JSON file for an image
     */
    public static deleteTags(imagePath: string): boolean {
        const tagsPath = MetadataStore.tagsFilePath(imagePath);

        try {
            const tagsPathStr = String(tagsPath);
            if (existsSync(tagsPathStr)) {
                unlinkSync(tagsPathStr);
                logger.debug(`Deleted tags for: ${imagePath}`);
                return true;
            }
            logger.debug(`No tags file found for: ${imagePath}`);
            return false;
        } catch (error) {
            logger.error(`Error deleting tags for ${imagePath}:`, error);
            return false;
        }
    }

    /**
     * Check if tags exist for an image
     */
    public static hasTags(imagePath: string): boolean {
        const tagsPath = MetadataStore.tagsFilePath(imagePath);
        try {
            return existsSync(String(tagsPath));
        } catch {
            return false;
        }
    }
}
