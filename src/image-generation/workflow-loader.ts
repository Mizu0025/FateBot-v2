import { promises as fs } from 'fs';
import { join } from 'path';
import { WorkflowData } from '../types';
import { logger } from '../config/logger';

export class WorkflowLoader {
    /**
     * Loads the ComfyUI workflow data from a JSON file asynchronously.
     * @param workflowPath Path to the workflow JSON file
     * @returns Parsed workflow data or throws an error
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
     * Loads a workflow by name from the workflows directory.
     * @param workflowName Name of the workflow (without .json extension)
     * @returns Parsed workflow data or throws an error
     */
    static async loadWorkflowByName(workflowName: string): Promise<WorkflowData | null> {
        const workflowPath = join(__dirname, `../workflows/${workflowName}.json`);
        logger.info(`Loading workflow: ${workflowName}`);
        return this.loadWorkflowData(workflowPath);
    }
} 