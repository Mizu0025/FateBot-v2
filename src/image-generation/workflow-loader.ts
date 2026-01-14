import { promises as fs } from 'fs';
import { join } from 'path';
import { WorkflowData } from '../types';
import { logger } from '../config/logger';

/**
 * Handles the loading of ComfyUI workflow definitions from JSON files stored on disk.
 */
export class WorkflowLoader {
    /**
     * Loads and parses a raw ComfyUI workflow JSON file from a specific absolute path.
     * @param workflowPath The absolute filesystem path to the workflow JSON file.
     * @returns A promise resolving to the parsed workflow data.
     * @throws Error if the file is missing or contains invalid JSON.
     */
    static async loadWorkflowData(workflowPath: string): Promise<WorkflowData | null> {
        try {
            logger.debug(`Loading workflow data from ${workflowPath}`);
            const data = await fs.readFile(workflowPath, 'utf8');
            const workflowData = JSON.parse(data);
            logger.info(`Workflow loaded successfully from ${workflowPath}`);
            return workflowData;
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                logger.error(`Error: ${workflowPath} not found.`);
                throw new Error(`${workflowPath} not found. Please ensure it exists in the current directory.`);
            } else if (error instanceof SyntaxError) {
                logger.error(`Error: Invalid JSON format in ${workflowPath}: ${error.message}`);
                throw new Error(`Invalid JSON format in ${workflowPath}. Please check the file for errors.`);
            } else {
                logger.error(`Error loading workflow data: ${error}`);
                throw error;
            }
        }
    }

    /**
     * Loads a named workflow from the predefined 'src/workflows' directory.
     * @param workflowName The filename of the workflow (without the .json extension).
     * @returns A promise resolving to the parsed workflow data.
     */
    static async loadWorkflowByName(workflowName: string): Promise<WorkflowData | null> {
        const workflowPath = join(__dirname, `../workflows/${workflowName}.json`);
        logger.info(`Loading workflow: ${workflowName}`);
        return this.loadWorkflowData(workflowPath);
    }
}
