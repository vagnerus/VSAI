import { swarmCoordinator } from '../engine/SwarmCoordinator.js';

export const TeamCreateTool = {
  name: 'TeamCreateTool',
  description: 'Initializes a new multi-agent team with you as the leader. Use this when you encounter a complex task that should be broken down into parallel concurrent tasks.',
  inputSchema: {
    type: 'object',
    properties: {
      teamName: { type: 'string', description: 'A unique slug for the team name (e.g. "auth-refactor-squad")' }
    },
    required: ['teamName']
  },
  async call(input, context) {
    try {
      const leaderId = context.sessionId;
      await swarmCoordinator.createTeam(input.teamName, leaderId);
      return `Team created successfully! Your agent ID in this team is: ${leaderId}. You can now use SendMessageTool to spawn teammates to assist you by sending a message to a new role like 'researcher@${input.teamName}'.\n\nYour task context is bound to this team name now.`;
    } catch (e) {
      return { error: e.message };
    }
  }
};
