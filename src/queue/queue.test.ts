import { PromptQueue } from './queue';

// Helper to create a mock task that resolves after a delay
const createMockTask = (id: number, callback: (id: number) => void): () => Promise<void> => {
  return () => new Promise(resolve => {
    setTimeout(() => {
      callback(id);
      resolve();
    }, 50);
  });
};

describe('PromptQueue', () => {
  it('should process tasks in FIFO order', async () => {
    const queue = new PromptQueue();
    const executionOrder: number[] = [];
    const taskCallback = (id: number) => executionOrder.push(id);

    queue.addTask(createMockTask(1, taskCallback));
    queue.addTask(createMockTask(2, taskCallback));
    queue.addTask(createMockTask(3, taskCallback));

    // Wait for all tasks to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(executionOrder).toEqual([1, 2, 3]);
  });

  it('should return the correct queue length', () => {
    const queue = new PromptQueue();
    const taskCallback = () => {};

    expect(queue.addTask(createMockTask(1, taskCallback))).toBe(1);
    expect(queue.addTask(createMockTask(2, taskCallback))).toBe(2);
  });

  it('should only run one task at a time', async () => {
    const queue = new PromptQueue();
    let runningTasks = 0;
    let maxConcurrentTasks = 0;

    const createTask = (): () => Promise<void> => {
      return async () => {
        runningTasks++;
        maxConcurrentTasks = Math.max(maxConcurrentTasks, runningTasks);
        await new Promise(resolve => setTimeout(resolve, 50));
        runningTasks--;
      };
    };

    queue.addTask(createTask());
    queue.addTask(createTask());

    await new Promise(resolve => setTimeout(resolve, 150));

    expect(maxConcurrentTasks).toBe(1);
  });

  it('should continue processing if a task fails', async () => {
    // Suppress console.error for this test
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const queue = new PromptQueue();
    const executionOrder: number[] = [];
    const taskCallback = (id: number) => executionOrder.push(id);

    const failingTask = () => new Promise<void>((_, reject) => reject('Task failed'));

    queue.addTask(createMockTask(1, taskCallback));
    queue.addTask(failingTask);
    queue.addTask(createMockTask(2, taskCallback));

    await new Promise(resolve => setTimeout(resolve, 200));

    expect(executionOrder).toEqual([1, 2]);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error processing task:', 'Task failed');

    consoleErrorSpy.mockRestore();
  });
});
