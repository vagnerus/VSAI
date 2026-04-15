import { v4 as uuidv4 } from 'uuid';
import { query } from './QueryEngine.js';

/**
 * Coordinator Class — Orchestrates Multi-Agent Swarms
 * Inspired by coordinator/coordinatorMode.ts
 */
export class Coordinator {
  constructor(engine) {
    this.engine = engine;
    this.workers = new Map(); // jobId -> worker instance info
  }

  /**
   * Spawn a new worker agent
   * Equivalent to AgentTool execution
   */
  async spawnWorker({ description, prompt, subagent_type = 'worker' }) {
    const jobId = `agent-${uuidv4().substring(0, 8)}`;
    
    // Workers start with ZERO context (Isolation by Design)
    const workerEngine = new engine.constructor({
      ...this.engine.config,
      sessionId: `${this.engine.sessionId}-${jobId}`,
      initialMessages: [], // Isolated context
    });

    const workerTask = {
      jobId,
      description,
      status: 'running',
      engine: workerEngine,
      promise: null
    };

    this.workers.set(jobId, workerTask);

    // Run the worker in the background (simplified for this implementation)
    workerTask.promise = (async () => {
      try {
        let finalResponse = '';
        for await (const event of workerEngine.submitMessage(prompt)) {
          if (event.type === 'result' && event.subtype === 'success') {
            finalResponse = event.text;
          }
        }
        return { status: 'completed', result: finalResponse };
      } catch (err) {
        return { status: 'failed', error: err.message };
      }
    })();

    return { jobId, status: 'spawned' };
  }

  /**
   * Send a message to an existing worker
   */
  async sendMessage(jobId, message) {
    const worker = this.workers.get(jobId);
    if (!worker) throw new Error(`Worker ${jobId} not found`);
    
    // Continue the worker's conversation
    return worker.engine.submitMessage(message);
  }

  /**
   * Stop a worker
   */
  async stopWorker(jobId) {
    const worker = this.workers.get(jobId);
    if (!worker) return;
    worker.engine.abort();
    worker.status = 'killed';
  }

  /**
   * Format worker result as XML Notification
   * as specified in architecture/03-coordinator.md
   */
  formatNotification(jobId, result) {
    return `
<task-notification>
  <task-id>${jobId}</task-id>
  <status>${result.status}</status>
  <summary>${result.status === 'completed' ? 'Task finished successfully' : 'Task failed'}</summary>
  <result>${result.result || result.error || ''}</result>
</task-notification>`.trim();
  }
}
