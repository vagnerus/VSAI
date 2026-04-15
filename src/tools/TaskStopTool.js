import { buildTool } from './factory.js';

/**
 * TaskStopTool — Kill a running worker agent.
 * Inspired by tools/TaskStopTool/TaskStopTool.ts
 */
export const TaskStopTool = buildTool({
  name: 'TaskStop',
  description: 'Terminate a running worker agent immediately. Useful if the worker is stuck or its task is no longer needed.',
  inputSchema: {
    type: 'object',
    properties: {
      task_id: { type: 'string', description: 'The ID of the worker agent to stop' }
    },
    required: ['task_id']
  },
  async call(input, context) {
    const coordinator = context.engine.coordinator;
    if (!coordinator) return { error: 'Coordinator not initialized' };

    await coordinator.stopWorker(input.task_id);
    return { status: 'killed', message: `Worker ${input.task_id} has been terminated.` };
  }
});
