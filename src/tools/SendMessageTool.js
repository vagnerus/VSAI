import { buildTool } from './factory.js';

/**
 * SendMessageTool — Send a follow-up message to an existing worker.
 * Inspired by tools/SendMessageTool/SendMessageTool.ts
 */
export const SendMessageTool = buildTool({
  name: 'SendMessage',
  description: 'Send a follow-up message or new instructions to a running worker agent.',
  inputSchema: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'The message or new instructions for the worker' },
      to: { type: 'string', description: 'The ID of the worker agent (e.g., "agent-x7q")' },
    },
    required: ['message', 'to'],
  },
  async call(input, context) {
    const coordinator = context.engine.coordinator;
    if (!coordinator) return { error: 'Coordinator not initialized' };

    try {
      // Background execution of follow-up
      coordinator.sendMessage(input.to, input.message);
      return { status: 'sent', message: `Message dispatched to ${input.to}.` };
    } catch (e) {
      return { error: e.message };
    }
  },
});
