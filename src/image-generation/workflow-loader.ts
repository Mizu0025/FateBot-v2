import { promises as fs } from 'fs';
import { WorkflowData } from '../types';

export class WorkflowLoader {
    /**
     * Loads the ComfyUI workflow data from a JSON file asynchronously.
     * @param workflowPath Path to the workflow JSON file
     * @returns Parsed workflow data or throws an error
     */
    static async loadWorkflowData(workflowPath: string): Promise<WorkflowData | null> {
        try {
            console.info(`Loading workflow data from ${workflowPath}`);
            const data = await fs.readFile(workflowPath, 'utf8');
            return JSON.parse(data);
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                console.error(`Error: ${workflowPath} not found.`);
                throw new Error(`${workflowPath} not found. Please ensure it exists in the current directory.`);
            } else if (error instanceof SyntaxError) {
                console.error(`Error: Invalid JSON format in ${workflowPath}: ${error.message}`);
                throw new Error(`Invalid JSON format in ${workflowPath}. Please check the file for errors.`);
            } else {
                console.error(`Error loading workflow data: ${error}`);
                throw error;
            }
        }
    }
} 