import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Coordinator } from './Coordinator.js';
import { globalHooks } from './HookSystem.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECTS_DIR = path.join(__dirname, '../../data/projects');

/**
 * FEATURE FLAGS (Compile-time simulation)
 */
const FLAGS = {
  HISTORY_SNIP: true,
  CONTEXT_COLLAPSE: false,
  CACHED_MICROCOMPACT: true,
  TOKEN_BUDGET: true
};

/**
 * Model context window sizes (in tokens) and cost rates.
 */
const MODEL_CONFIGS = {
  'gemini-2.5-flash': { contextWindow: 1000000, inputRate: 0.15 / 1e6, outputRate: 0.60 / 1e6 },
  'gemini-1.5-flash': { contextWindow: 1000000, inputRate: 0.075 / 1e6, outputRate: 0.30 / 1e6 },
  'gemini-1.5-pro': { contextWindow: 2000000, inputRate: 1.25 / 1e6, outputRate: 5.0 / 1e6 },
  'gemini-1.5-flash-8b': { contextWindow: 1000000, inputRate: 0.0375 / 1e6, outputRate: 0.15 / 1e6 },
  'claude-sonnet-4-20250514': { contextWindow: 200000, inputRate: 3.0 / 1e6, outputRate: 15.0 / 1e6 },
  'claude-3-opus-20240229': { contextWindow: 200000, inputRate: 15.0 / 1e6, outputRate: 75.0 / 1e6 },
  'claude-3-5-haiku-20241022': { contextWindow: 200000, inputRate: 0.25 / 1e6, outputRate: 1.25 / 1e6 },
  'gpt-4o': { contextWindow: 128000, inputRate: 5.0 / 1e6, outputRate: 15.0 / 1e6 },
  'gpt-4-turbo': { contextWindow: 128000, inputRate: 10.0 / 1e6, outputRate: 30.0 / 1e6 },
  'gpt-3.5-turbo': { contextWindow: 16385, inputRate: 0.5 / 1e6, outputRate: 1.5 / 1e6 },
  'llama3:8b': { contextWindow: 8192, inputRate: 0, outputRate: 0 },
  'default': { contextWindow: 32000, inputRate: 3.0 / 1e6, outputRate: 15.0 / 1e6 },
};

/**
 * QueryEngine — Per-Conversation Session Manager
 */
export class QueryEngine {
  constructor(config) {
    this.config = config;
    this.mutableMessages = config.initialMessages || [];
    this.abortController = new AbortController();
    this.totalUsage = { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 };
    this.sessionId = config.sessionId || uuidv4();
    this.tools = config.tools || [];
    this.hooks = config.hooks || {};
    this.permissionPipeline = config.permissionPipeline || null;
    this.sessionStorage = config.sessionStorage || null;
    this.costTracker = { totalCostUsd: 0 };
    this.turnCount = 0;
    this.isRunning = false;
    this.readFileState = new Map(); // LRU Cache for file content
    this.coordinator = new Coordinator(this);
  }

  async *submitMessage(prompt, options = {}) {
    this.isRunning = true;
    const promptUuid = options.uuid || uuidv4();

    try {
      // 1. Check for Worker Notifications first
      this.checkWorkerNotifications();

      // 2. Process User Input (Slash commands, normalization)
      const processed = await this.processUserInput(prompt, options);
      if (!processed.shouldQuery) {
        yield { type: 'result', subtype: 'local_command', text: processed.resultText };
        return;
      }

      // 3. Auto-Snip (Context Management) — model-aware
      const modelConfig = MODEL_CONFIGS[this.config.model] || MODEL_CONFIGS['default'];
      const estimatedTokens = this.estimateTokenCount(this.mutableMessages);
      const contextLimit = Math.floor(modelConfig.contextWindow * 0.75); // Keep 25% headroom
      if (estimatedTokens > contextLimit || this.mutableMessages.length > 50) {
        this.smartSnipHistory(contextLimit);
      }

      // 4. Message Normalization & Persistence
      const userMessage = {
        uuid: promptUuid,
        parentUuid: this.mutableMessages.length > 0 ? this.mutableMessages[this.mutableMessages.length - 1].uuid : null,
        type: 'user',
        role: 'user',
        content: processed.content,
        timestamp: Date.now(),
      };
      
      this.mutableMessages.push(userMessage);
      if (this.sessionStorage) await this.sessionStorage.appendEntry(this.sessionId, userMessage);
      
      yield { type: 'user_message', message: userMessage };

      // 5. Assemble Context (System Prompt + Environment)
      const systemPrompt = await this.assembleSystemPrompt(options);

      // 6. Start Query Loop (The "Turn" layer)
      for await (const message of query({
        engine: this,
        messages: [...this.mutableMessages],
        systemPrompt,
        tools: this.tools,
        maxTurns: options.maxTurns || 25,
        taskBudget: options.taskBudget || 5.0,
        abortSignal: this.abortController.signal
      })) {
        
        // Handle yielded messages from the turn loop
        if (message.type === 'assistant' || message.type === 'tool_result') {
          this.mutableMessages.push(message);
          if (this.sessionStorage) await this.sessionStorage.appendEntry(this.sessionId, message);
        }

        if (message.type === 'usage') {
          this.updateUsage(message);
          yield { type: 'usage', usage: this.totalUsage, cost: this.costTracker };
        } else {
        yield message;
        }
      }

      // 7. Final Result Extraction & Hook Execution
      const finalResult = this.mutableMessages.filter(m => m.role === 'assistant').pop();
      
      await globalHooks.execute('onSessionEnd', {
        engine: this,
        userId: this.config.userId,
        messages: this.mutableMessages,
        result: finalResult?.content
      });

      yield {
        type: 'result',
        subtype: 'success',
        text: finalResult?.content || '',
        usage: { ...this.totalUsage },
        cost: { ...this.costTracker },
        turnCount: this.turnCount
      };

    } catch (error) {
      yield { type: 'result', subtype: 'error', error: error.message || String(error) };
    } finally {
      this.isRunning = false;
    }
  }

  checkWorkerNotifications() {
    // Check which workers finished since last turn
    for (const [jobId, worker] of this.coordinator.workers.entries()) {
      if (worker.status === 'completed' || worker.status === 'failed') {
        // This worker just finished. In a real system, we'd have a queue.
        // For now, we simulate the notification injection.
        // coordinator.formatNotification will be used.
      }
    }
  }

  async processUserInput(prompt, options) {
    if (typeof prompt === 'string' && prompt.startsWith('/')) {
      const [cmd, ...args] = prompt.slice(1).split(' ');
      switch (cmd) {
        case 'clear':
          this.mutableMessages = [];
          return { shouldQuery: false, resultText: 'Conversation history cleared.' };
        case 'snip':
          // Manual trigger for history snip
          this.snipHistory();
          return { shouldQuery: false, resultText: 'History snipped to active window.' };
        case 'help':
          return { shouldQuery: false, resultText: 'Commands: /clear, /snip, /model, /help' };
      }
    }
    return { shouldQuery: true, content: prompt };
  }

  /**
   * Simple token estimation (approx 4 chars per token).
   */
  estimateTokenCount(messages) {
    let total = 0;
    for (const msg of messages) {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || '');
      total += Math.ceil(content.length / 4);
      if (msg.toolCalls) total += Math.ceil(JSON.stringify(msg.toolCalls).length / 4);
    }
    return total;
  }

  /**
   * Smart history snip — preserves first user message + last N messages.
   * More intelligent than simple slice: keeps context summary.
   */
  smartSnipHistory(contextLimit) {
    if (this.mutableMessages.length <= 6) return;

    // Always keep the first user message for context
    const firstUserMsg = this.mutableMessages.find(m => m.role === 'user');
    const keepCount = Math.min(10, this.mutableMessages.length - 1);
    const recentMessages = this.mutableMessages.slice(-keepCount);

    // Create a summary marker
    const droppedCount = this.mutableMessages.length - keepCount - (firstUserMsg ? 1 : 0);
    const summaryMsg = {
      uuid: 'context-summary',
      role: 'user',
      type: 'user',
      content: `[Sistema: ${droppedCount} mensagens anteriores foram resumidas para otimização de contexto. A conversa continua abaixo.]`,
      timestamp: Date.now(),
    };

    this.mutableMessages = [
      ...(firstUserMsg ? [firstUserMsg] : []),
      summaryMsg,
      ...recentMessages,
    ];

    console.log(`[QueryEngine] Smart snip: kept ${this.mutableMessages.length} messages, dropped ${droppedCount}`);
  }

  snipHistory() {
    if (this.mutableMessages.length > 10) {
      this.smartSnipHistory(32000);
    }
  }

  async assembleSystemPrompt(options) {
    let parts = [`Você é o Engenheiro de Software Autônomo Antigravity do VSAI - IA.`];
    
    // Core logic from architecture docs
    parts.push(`## Operação Autônoma
1. Analise o diretório antes de agir.
2. Use edições granulares (file_patch).
3. Proponha mudanças críticas para revisão.
4. Nunca peça para o usuário digitar código.`);

    // Project Context
    if (this.config.projectId) {
      const wsp = await this.getWorkspacePath();
      if (wsp) parts.push(`\nActive Workspace: ${wsp}`);
    }

    return parts.join('\n\n');
  }

  async getWorkspacePath() {
    const projDir = path.join(PROJECTS_DIR, this.config.projectId);
    const configPath = path.join(projDir, 'nexus.config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.workspacePath;
    }
    return null;
  }

  updateUsage(usageEvent) {
    this.totalUsage.inputTokens += usageEvent.input_tokens || 0;
    this.totalUsage.outputTokens += usageEvent.output_tokens || 0;
    // Model-specific cost calculation
    const modelConfig = MODEL_CONFIGS[this.config.model] || MODEL_CONFIGS['default'];
    const inputCost = (usageEvent.input_tokens || 0) * modelConfig.inputRate;
    const outputCost = (usageEvent.output_tokens || 0) * modelConfig.outputRate;
    this.costTracker.totalCostUsd += inputCost + outputCost;
  }

  abort() {
    this.abortController.abort();
    this.abortController = new AbortController();
  }
}

/**
 * query() — The Turn Loop (Heart of Tool Execution)
 * Standalone function as per architecture/01-query-engine.md
 */
export async function* query({ engine, messages, systemPrompt, tools, maxTurns, taskBudget, abortSignal }) {
  const apiClient = engine.config.apiClient;
  let turnCount = 0;

  while (true) {
    // 1. Pre-processing Pipeline
    if (FLAGS.HISTORY_SNIP) {
      // Logic for HISTORY_SNIP (placeholder: simulated optimization)
    }

    if (turnCount >= maxTurns || engine.costTracker.totalCostUsd >= taskBudget) {
      yield { type: 'error', message: 'Budget or turn limit reached.' };
      return;
    }

    if (abortSignal.aborted) return;

    turnCount++;
    engine.turnCount = turnCount;

    // 2. Call API (Streaming)
    let assistantContent = '';
    let toolCalls = [];
    let stopReason = 'end_turn';

    const toolDefs = tools.map(t => ({
      name: t.name,
      description: t.description || '',
      input_schema: t.inputSchema || { type: 'object' }
    }));

    try {
      const stream = await apiClient.stream({
        model: engine.config.model,
        system: systemPrompt,
        messages: formatMessagesForAPI(messages),
        tools: toolDefs
      });

      for await (const event of stream) {
        if (abortSignal.aborted) break;

        if (event.type === 'content_block_delta') {
          if (event.delta?.type === 'text_delta') {
            assistantContent += event.delta.text;
            yield { type: 'stream_event', text: event.delta.text };
          } else if (event.delta?.type === 'input_json_delta') {
            const lastTC = toolCalls[toolCalls.length - 1];
            if (lastTC) lastTC.input += event.delta.partial_json;
          }
        } else if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
          toolCalls.push({ id: event.content_block.id, name: event.content_block.name, input: '' });
        } else if (event.type === 'message_delta') {
          stopReason = event.delta?.stop_reason || stopReason;
          if (event.usage) yield { type: 'usage', ...event.usage };
        }
      }

      // 3. Process Result & Tools
      const assistantMessage = {
        uuid: uuidv4(),
        type: 'assistant',
        role: 'assistant',
        content: assistantContent,
        toolCalls: toolCalls.map(tc => {
          try { return { ...tc, input: JSON.parse(tc.input) }; } catch { return { ...tc, input: {} }; }
        }),
        timestamp: Date.now()
      };

      messages.push(assistantMessage);
      yield { type: 'assistant', ...assistantMessage };

      if (stopReason !== 'tool_use' || toolCalls.length === 0) return;

      // 4. Exec Tools
      for (const tc of assistantMessage.toolCalls) {
        yield { type: 'status_update', message: `Usando ferramenta: ${tc.name}...` };
        
        const tool = tools.find(t => t.name === tc.name);
        let result;

        if (!tool) {
          result = { error: `Ferramenta ${tc.name} não encontrada.` };
        } else {
          try {
            result = await tool.call(tc.input, { sessionId: engine.sessionId });
            if (result?.status === 'proposed') {
              yield { type: 'tool_propose', ...result, toolUseId: tc.id, toolName: tc.name };
            }
          } catch (e) {
            result = { error: e.message };
          }
        }

        const toolResultMsg = {
          uuid: uuidv4(),
          type: 'tool_result',
          role: 'user',
          toolUseId: tc.id,
          toolName: tc.name, // Important for Gemini mapping
          content: typeof result === 'string' ? result : JSON.stringify(result),
          isError: !!result?.error,
          timestamp: Date.now()
        };

        messages.push(toolResultMsg);
        yield toolResultMsg;
      }

    } catch (e) {
      if (e.status === 429) {
        yield { type: 'status_update', message: 'Aguardando liberação de cota (5s)...' };
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }
      throw e;
    }
  }
}

/**
 * Utility to format messages for Anthropic/Gemini APIs
 */
function formatMessagesForAPI(messages) {
  return messages.map(m => {
    if (m.type === 'tool_result') {
      return {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: m.toolUseId, content: m.content, is_error: m.isError }]
      };
    }
    if (m.role === 'assistant' && m.toolCalls) {
      const content = [];
      if (m.content) content.push({ type: 'text', text: m.content });
      m.toolCalls.forEach(tc => content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input }));
      return { role: 'assistant', content };
    }
    return { role: m.role, content: m.content };
  });
}
