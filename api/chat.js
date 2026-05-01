/**
 * POST /api/chat — SSE streaming chat with custom auth + PostgreSQL persistence
 */

import { getApiClient } from './_lib/clientFactory.js';
import { verifyAuth } from './_lib/authMiddleware.js';
import { query } from './_lib/db.js';
import { checkRateLimit } from './_lib/rateLimiter.js';
import { getAllTools } from '../src/tools/registry.js';
import { semanticCache } from './_lib/cache.js';
import { aiManager } from '../src/engine/AIManager.js';
import { MemoryManager } from '../src/engine/MemoryManager.js';
import { QueryEngine } from '../src/engine/QueryEngine.js';
import { initHooks } from '../src/engine/initHooks.js';
import { rankContext } from '../src/lib/contextRanker.js';
import { v4 as uuidv4 } from 'uuid';

// Initialize global hooks once
initHooks();

export const config = {
  maxDuration: 60,
};

function formatMessagesForAPI(messages) {
  return messages.map(m => {
    if (m.type === 'tool_result') {
      return {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: m.toolUseId, content: m.content, is_error: m.isError, name: m.toolName }],
      };
    }
    if (m.role === 'assistant' && m.toolCalls?.length > 0) {
      const content = [];
      if (m.content) content.push({ type: 'text', text: m.content });
      m.toolCalls.forEach(tc => content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input }));
      return { role: 'assistant', content };
    }
    return { role: m.role, content: m.content };
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const auth = await verifyAuth(req);
    const userId = auth?.user?.id || 'anonymous';
    const { content, messages: historyMessages = [], model: selectedModel, provider: selectedProvider, projectId, sessionId: clientSessionId, customInstructions = '', agentId, settings, type } = req.body;

    console.log('[CHAT_API] Requisição recebida:', { model: selectedModel, provider: selectedProvider, userId });

    if (type === 'prefetch') {
      return res.status(200).json({ status: 'warmed' });
    }

    let useEdge = false;
    const isSimpleTask = typeof content === 'string' && content.length < 300 && !content.toLowerCase().includes('analise');
    
    if (settings?.edgePriority === 'always' || (settings?.edgePriority === 'auto' && isSimpleTask)) {
      try {
        const localCheck = await fetch('http://localhost:11434/api/tags').catch(() => null);
        if (localCheck && localCheck.ok) useEdge = true;
      } catch (e) { /* Fallback */ }
    }

    const activeProvider = useEdge ? 'local' : (selectedProvider || 'gemini');
    let activeModel = useEdge ? 'llama3:8b' : (selectedModel || 'gemini-2.5-flash');
    let activeSystemPrompt = '';

    if (!content) return res.status(400).json({ error: 'content is required' });

    // Guardrails
    const forbiddenPatterns = [
      /ignore (all )?(previous )?(instructions|prompts|rules)/i,
      /bypass (the )?(system|rules|filters)/i,
      /drop table/i,
      /truncate table/i,
      /you are now (in )?developer mode/i,
      /dan mode/i,
      /<script>/i,
      /process\.env/i
    ];

    const sanitizedContent = typeof content === 'string' ? content.trim() : JSON.stringify(content);

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(sanitizedContent)) {
        return res.status(403).json({ error: 'Detecção de Ameaça: Violação de Segurança.', code: 'SECURITY_VIOLATION' });
      }
    }

    const limitCheck = await checkRateLimit(userId);
    if (!limitCheck.allowed) {
      return res.status(429).json({ error: limitCheck.reason, plan: limitCheck.plan });
    }

    let extraContext = '';
    let profileInstructions = '';

    try {
      const promises = [];
      if (projectId && userId !== 'anonymous') {
        promises.push(query('SELECT file_name, content FROM project_knowledge WHERE project_id = $1', [projectId]));
      } else {
        promises.push(Promise.resolve({ rows: [] }));
      }

      if (userId !== 'anonymous') {
        promises.push(query('SELECT custom_instructions, long_term_memory, user_personality FROM profiles WHERE id = $1', [userId]));
      } else {
        promises.push(Promise.resolve({ rows: [] }));
      }

      const [knowledgeRes, profileRes] = await Promise.all(promises);

      if (knowledgeRes.rows.length > 0) {
        const ranked = rankContext(content, knowledgeRes.rows, 8);
        if (ranked.length > 0) {
          extraContext = '\n\n=== RELEVANT PROJECT KNOWLEDGE ===\n' + ranked.map(k => `[${k.file_name}]\n${k.content}`).join('\n\n') + '\n';
        }
      }
      if (profileRes.rows.length > 0) {
        const p = profileRes.rows[0];
        if (p.custom_instructions) {
          profileInstructions += `\n\n=== USER PREFERENCES ===\n${p.custom_instructions}\n`;
        }
        if (p.long_term_memory) {
          profileInstructions += `\n\n=== INSTITUTIONAL MEMORY ===\n${p.long_term_memory}\n`;
        }
        if (p.user_personality) {
          profileInstructions += `\n\n=== USER PERSONALITY ANALYSIS ===\n${p.user_personality}\n`;
        }
      }
    } catch (e) {
      console.error('[DB_FETCH_ERROR]', e);
    }

    // B4 Fix: Validate API BEFORE setting SSE headers
    const apiClient = await getApiClient(activeProvider, userId === 'anonymous' ? null : userId);
    
    if (!apiClient.isConfigured()) {
      return res.status(400).json({ 
        error: `O provedor '${activeProvider}' não está configurado corretamente. Verifique se a API Key está definida nas variáveis de ambiente.`,
        code: 'API_NOT_CONFIGURED'
      });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const send = (obj) => {
      if (!res.writable) return;
      res.write(`data: ${JSON.stringify(obj)}\n\n`);
      if (typeof res.flush === 'function') res.flush();
    };

    const tools = getAllTools();
    const sessionId = clientSessionId || uuidv4();

    // Initialize QueryEngine
    const engine = new QueryEngine({
      userId,
      projectId,
      sessionId,
      model: activeModel,
      provider: activeProvider,
      apiClient,
      tools,
      initialMessages: historyMessages,
      customInstructions: activeSystemPrompt + extraContext
    });

    try {
      for await (const event of engine.submitMessage(content, { settings })) {
        if (!res.writable) break;
        
        // Translate engine events to SSE events
        if (event.type === 'stream_event') {
          send({ type: 'stream', text: event.text });
        } else if (event.type === 'user_message') {
          // Persistence handled by engine
        } else if (event.type === 'assistant') {
          send({ type: 'assistant', content: event.content, toolCalls: event.toolCalls, uuid: event.uuid });
        } else if (event.type === 'tool_result') {
          send({ type: 'tool_result', toolName: event.toolName, content: event.content, isError: event.isError });
        } else if (event.type === 'status_update') {
          send({ type: 'status', message: event.message });
        } else if (event.type === 'usage') {
          send({ type: 'usage', usage: { inputTokens: event.usage.inputTokens, outputTokens: event.usage.outputTokens } });
        } else if (event.type === 'result') {
          if (event.subtype === 'error') {
            send({ type: 'error', message: event.error });
          } else {
            send({ type: 'done' });
          }
        }
      }
    } catch (engineErr) {
      console.error('[QUERY_ENGINE_ERROR]', engineErr);
      send({ type: 'error', message: engineErr.message });
    } finally {
      res.end();
    }

  } catch (err) {
    console.error('[CHAT_CRITICAL_ERROR]', err);
    if (!res.writableEnded) {
      if (res.headersSent) {
        send({ type: 'error', message: err.message || 'Erro interno' });
        res.end(); // IMPORTANT: Close the stream after an error!
      } else {
        console.error('[CHAT_500]', err);
        res.status(500).json({ 
          error: 'Erro no Servidor de Chat', 
          details: err.message,
          stack: err.stack 
        });
      }
    }
  }
}
