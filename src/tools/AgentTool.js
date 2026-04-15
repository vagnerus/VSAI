import { buildTool } from './factory.js';

/**
 * AgentTool — Spawn a sub-agent to perform an independent task in parallel.
 * Inspired by tools/AgentTool/AgentTool.ts
 */
export const AgentTool = buildTool({
  name: 'Agent',
  description: 'Spawn a new worker agent to perform a specific task. Workers are isolated and cannot see your conversation history.',
  inputSchema: {
    type: 'object',
    properties: {
      description: { type: 'string', description: 'Brief description of the agent\'s task' },
      prompt: { type: 'string', description: 'Self-contained instructions for the worker' },
      subagent_type: { type: 'string', enum: ['worker', 'researcher', 'implementer'], default: 'worker' },
    },
    required: ['prompt'],
  },
  async call(input, context) {
    const coordinator = context.engine.coordinator;
    if (!coordinator) return { error: 'Coordinator not initialized' };
    
    const result = await coordinator.spawnWorker(input);
    return {
      status: 'spawned',
      jobId: result.jobId,
      message: `Worker ${result.jobId} spawned. You will receive a <task-notification> once it finishes.`
    };
  },
});
