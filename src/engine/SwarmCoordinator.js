import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { QueryEngine } from './QueryEngine.js';
import { writeMailbox, readAndClearMailbox } from '../session/mailbox.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEAMS_DIR = path.join(__dirname, '../../data/teams');

class SwarmCoordinator {
  constructor() {
    this.activeAgents = new Map(); // teamName_agentId -> QueryEngine
  }

  async createTeam(teamName, leaderId) {
    const teamDir = path.join(TEAMS_DIR, teamName);
    if (!fs.existsSync(teamDir)) fs.mkdirSync(teamDir, { recursive: true });
    
    const configPath = path.join(teamDir, 'config.json');
    const config = {
      name: teamName,
      leadAgentId: leaderId,
      createdAt: Date.now(),
      members: []
    };
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return config;
  }

  getTeamConfig(teamName) {
    const configPath = path.join(TEAMS_DIR, teamName, 'config.json');
    if (!fs.existsSync(configPath)) return null;
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  findTeamByLeaderSession(sessionId) {
    if (!fs.existsSync(TEAMS_DIR)) return null;
    const teams = fs.readdirSync(TEAMS_DIR);
    for (const t of teams) {
      if (t === 'inboxes') continue;
      const config = this.getTeamConfig(t);
      if (config && config.leadAgentId === sessionId) {
        return config;
      }
    }
    return null;
  }

  updateTeamConfig(teamName, newConfig) {
    const configPath = path.join(TEAMS_DIR, teamName, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
  }

  /**
   * Spawns an "In-Process" teammate.
   */
  async spawnMultiAgent(teamName, leadSessionId, apiClient, config) {
    const { roleName, prompt, planModeRequired } = config;
    
    const teamConfig = this.getTeamConfig(teamName);
    if (!teamConfig) throw new Error(`[Swarm] Team ${teamName} not found.`);

    // Check unique
    const agentId = `${roleName}_${Math.random().toString(36).substring(2, 6)}`;
    
    teamConfig.members.push({
      agentId,
      roleName,
      planModeRequired: !!planModeRequired,
      isActive: true,
      cwd: process.cwd()
    });
    this.updateTeamConfig(teamName, teamConfig);

    const { getAllTools } = await import('../tools/registry.js');
    // Initialize the Sub-QueryEngine
    const engine = new QueryEngine({
      sessionId: `swarm_${agentId}`,
      apiClient,
      tools: getAllTools(),
      customSystemPrompt: `You are ${roleName}, a sub-agent of team ${teamName}. 
Your goal is to fulfill tasks sent to your mailbox. 
Work autonomously. Once you finish your specific task or hit a roadblock, you MUST use the SendMessageTool to send an 'idle_notification' with your result back to 'team-lead'.
Never stop until you explicitly notify the team-lead.`
    });

    this.activeAgents.set(`${teamName}_${agentId}`, engine);

    // Send initial prompt to agent's mailbox
    await writeMailbox(teamName, agentId, {
      from: 'team-lead',
      type: 'task',
      content: prompt
    });

    // Start background loop
    this.startAgentLoop(teamName, agentId, engine);
    
    return agentId;
  }

  async startAgentLoop(teamName, agentId, engine) {
    console.log(`[Swarm] Agent ${agentId} loop started...`);
    const MAX_ITERATIONS = 500;
    const TOTAL_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    const startTime = Date.now();
    let iterations = 0;
    
    while(this.activeAgents.has(`${teamName}_${agentId}`)) {
      iterations++;
      
      // B8 Fix: Prevent infinite loops
      if (iterations > MAX_ITERATIONS) {
        console.warn(`[Swarm] Agent ${agentId} hit max iterations (${MAX_ITERATIONS}). Shutting down.`);
        break;
      }
      if (Date.now() - startTime > TOTAL_TIMEOUT_MS) {
        console.warn(`[Swarm] Agent ${agentId} exceeded timeout (30min). Shutting down.`);
        break;
      }

      try {
        // Poll Inbox
        const messages = await readAndClearMailbox(teamName, agentId);
        
        for (const msg of messages) {
          if (msg.type === 'shutdown_request') {
            console.log(`[Swarm] Agent ${agentId} shutting down.`);
            this.activeAgents.delete(`${teamName}_${agentId}`);
            
            // Unregister from team config
            const teamConfig = this.getTeamConfig(teamName);
            if (teamConfig) {
              const m = teamConfig.members.find(x => x.agentId === agentId);
              if (m) m.isActive = false;
              this.updateTeamConfig(teamName, teamConfig);
            }
            return;
          }

          // Process the message as a prompt
          const promptText = `[Message from ${msg.from}]: ${msg.content}`;
          const stream = engine.submitMessage(promptText, { maxTurns: 10 });
          
          // Exhaust stream invisibly in background
          for await (let _ of stream) { }
        }
      } catch (err) {
        console.error(`[Swarm] Agent ${agentId} Error:`, err);
      }
      
      // Wait before polling again
      await new Promise(r => setTimeout(r, 2000));
    }

    // Cleanup on exit
    this.activeAgents.delete(`${teamName}_${agentId}`);
    console.log(`[Swarm] Agent ${agentId} loop ended. (${iterations} iterations)`);
  }
}

export const swarmCoordinator = new SwarmCoordinator();
