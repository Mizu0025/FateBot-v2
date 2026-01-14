import { promises as fs } from 'fs';
import { WorkflowLoader } from './workflow-loader';
import { logger } from '../config/logger';

jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn(),
    },
}));

jest.mock('../config/logger', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
    },
}));

describe('WorkflowLoader', () => {
    const mockWorkflowPath = '/path/to/workflow.json';
    const mockWorkflowData = {
        Checkpoint: { inputs: { ckpt_name: 'test.ckpt' } }
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('loadWorkflowData', () => {
        it('should load workflow data successfully', async () => {
            // Arrange
            (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockWorkflowData));

            // Act
            const result = await WorkflowLoader.loadWorkflowData(mockWorkflowPath);

            // Assert
            expect(fs.readFile).toHaveBeenCalledWith(mockWorkflowPath, 'utf8');
            expect(result).toEqual(mockWorkflowData);
            expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Workflow loaded successfully'));
        });

        it('should throw error when file is not found', async () => {
            // Arrange
            const error = new Error('File not found') as any;
            error.code = 'ENOENT';
            (fs.readFile as jest.Mock).mockRejectedValue(error);

            // Act & Assert
            await expect(WorkflowLoader.loadWorkflowData(mockWorkflowPath)).rejects.toThrow(
                `${mockWorkflowPath} not found. Please ensure it exists in the current directory.`
            );
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('not found'));
        });

        it('should throw error when JSON is invalid', async () => {
            // Arrange
            (fs.readFile as jest.Mock).mockResolvedValue('invalid json');

            // Act & Assert
            await expect(WorkflowLoader.loadWorkflowData(mockWorkflowPath)).rejects.toThrow(
                `Invalid JSON format in ${mockWorkflowPath}. Please check the file for errors.`
            );
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid JSON format'));
        });

        it('should throw generic error when readFile fails', async () => {
            // Arrange
            const genericError = new Error('Generic error');
            (fs.readFile as jest.Mock).mockRejectedValue(genericError);

            // Act & Assert
            await expect(WorkflowLoader.loadWorkflowData(mockWorkflowPath)).rejects.toThrow(genericError);
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error loading workflow data'));
        });
    });

    describe('loadWorkflowByName', () => {
        it('should load workflow by name', async () => {
            // Arrange
            const workflowName = 'test-workflow';
            const spy = jest.spyOn(WorkflowLoader, 'loadWorkflowData').mockResolvedValue(mockWorkflowData as any);

            // Act
            const result = await WorkflowLoader.loadWorkflowByName(workflowName);

            // Assert
            expect(spy).toHaveBeenCalledWith(expect.stringContaining(`${workflowName}.json`));
            expect(result).toEqual(mockWorkflowData);

            spy.mockRestore();
        });
    });
});
