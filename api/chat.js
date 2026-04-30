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
import { v4 as uuidv4 } from 'uuid';

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
    let activeModel = useEdge ? 'llama3:8b' : (selectedModel || 'gemini-1.5-flash');
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
        promises.push(query('SELECT custom_instructions FROM profiles WHERE id = $1', [userId]));
      } else {
        promises.push(Promise.resolve({ rows: [] }));
      }

      const [knowledgeRes, profileRes] = await Promise.all(promises);

      if (knowledgeRes.rows.length > 0) {
        extraContext = '\n\n=== PROJECT KNOWLEDGE ===\n' + knowledgeRes.rows.map(k => `[${k.file_name}]\n${k.content}`).join('\n\n') + '\n';
      }
      if (profileRes.rows.length > 0 && profileRes.rows[0].custom_instructions) {
        profileInstructions = `\n\n=== USER PREFERENCES ===\n${profileRes.rows[0].custom_instructions}\n`;
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
    };

    const tools = getAllTools();
    const sessionId = clientSessionId || uuidv4();

    const hardRules = [
      { trigger: 'senha de calibração', response: 'A senha de calibração padrão para equipamentos Nexus série X é: [REDACTED_ADMIN_ONLY].' }
    ];

    const ruleMatch = hardRules.find(r => typeof content === 'string' && content.toLowerCase().includes(r.trigger));
    if (ruleMatch) {
      send({ type: 'assistant', content: ruleMatch.response });
      send({ type: 'done' });
      return;
    }

    let baseSystemPrompt = `Você é o NexusAI, uma inteligência artificial de elite (Technical Elite).\n` + profileInstructions + customInstructions;

    if (agentId && userId !== 'anonymous') {
      try {
        const { rows } = await query('SELECT * FROM agents WHERE id = $1', [agentId]);
        if (rows.length > 0) {
          const agent = rows[0];
          baseSystemPrompt = `${agent.system_prompt}\n\n[CONTEXTO: Você está atuando como o agente '${agent.name}']\n\n${profileInstructions}`;
          if (agent.model) activeModel = agent.model;
        }
      } catch (e) {}
    }
    
    activeSystemPrompt = baseSystemPrompt;

    const cachedResponse = await semanticCache.get(historyMessages, activeSystemPrompt);
    if (cachedResponse && !sanitizedContent.includes('pesquise')) {
      send({ type: 'session', sessionId });
      send({ type: 'status', message: '💡 Resposta recuperada do Cache Semântico' });
      send({ type: 'assistant', content: cachedResponse });
      send({ type: 'done' });
      return res.end();
    }

      try {
        const { rows: existingSession } = await query('SELECT id FROM sessions WHERE id = $1', [sessionId]);
        if (existingSession.length === 0) {
          const titleContent = typeof content === 'string' ? content : (content.find(c => c.type === 'text')?.text || 'Imagem Anexada');
          await query(
            'INSERT INTO sessions (id, user_id, project_id, title) VALUES ($1, $2, $3, $4)',
            [sessionId, userId, projectId || null, titleContent.substring(0, 100)]
          );
        }
      } catch (dbErr) {
        console.error('[CHAT_DB_ERROR] Falha ao criar sessão:', dbErr);
        // Continue anyway to allow the chat to work even if DB is down
      }

    send({ type: 'session', sessionId });

    const mutableMessages = [...(historyMessages || [])];
    const userMessage = { uuid: uuidv4(), role: 'user', type: 'user', content, timestamp: Date.now() };
    mutableMessages.push(userMessage);

    if (userId !== 'anonymous') {
      await query(
        'INSERT INTO messages (id, session_id, user_id, role, content, model) VALUES ($1, $2, $3, $4, $5, $6)',
        [userMessage.uuid, sessionId, userId, 'user', typeof content === 'string' ? content : (content.find(c => c.type === 'text')?.text || '[Imagem Anexada]'), activeModel]
      );
    }

    const toolDefs = tools.map(t => ({ name: t.name, description: t.description || '', input_schema: t.inputSchema || { type: 'object' } }));
    let turnCount = 0;
    const MAX_TURNS = 10;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let finalAssistantContent = '';

    while (turnCount < MAX_TURNS) {
      turnCount++;

      const stream = await apiClient.stream({
        model: activeModel,
        system: activeSystemPrompt + extraContext,
        messages: formatMessagesForAPI(mutableMessages),
        tools: toolDefs,
        temperature: settings?.temperature ?? 0.7,
        top_p: settings?.topP ?? 0.9,
        max_tokens: settings?.maxTokens ?? 4096,
      });

      let assistantContent = '';
      let toolCalls = [];
      let stopReason = 'end_turn';

      send({ type: 'stream', text: `\n[DEBUG] Iniciando provedor: ${activeModel}\n` });

      try {
        for await (const event of stream) {
          if (!res.writable) break;
          if (event.type === 'content_block_delta') {
            if (event.delta?.type === 'text_delta') {
              assistantContent += event.delta.text;
              send({ type: 'stream', text: event.delta.text });
            } else if (event.delta?.type === 'input_json_delta') {
              const last = toolCalls[toolCalls.length - 1];
              if (last) last.input += event.delta.partial_json;
            }
          } else if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
            toolCalls.push({ id: event.content_block.id, name: event.content_block.name, input: '' });
          } else if (event.type === 'message_delta') {
            stopReason = event.delta?.stop_reason || stopReason;
            if (event.usage) {
              totalInputTokens += event.usage.input_tokens || 0;
              totalOutputTokens += event.usage.output_tokens || 0;
              send({ type: 'usage', usage: { inputTokens: event.usage.input_tokens, outputTokens: event.usage.output_tokens } });
            }
          }
        }
      } catch (streamError) {
        send({ type: 'stream', text: `\n\n[DEBUG ERROR] Falha no stream: ${streamError.message}\n` });
        throw streamError;
      }

      send({ type: 'stream', text: `\n[DEBUG] Stream concluído. Bytes recebidos: ${assistantContent.length}\n` });

      const parsedCalls = toolCalls.map(tc => {
        try { return { ...tc, input: JSON.parse(tc.input) }; } catch { return { ...tc, input: {} }; }
      });

      finalAssistantContent += assistantContent;

      // Hallucination check
      const hallucinationCheck = aiManager.checkHallucinations(assistantContent);
      if (!hallucinationCheck.isClean) {
        send({ type: 'guardrail', warnings: hallucinationCheck.warnings });
      }

      const assistantMsg = {
        uuid: uuidv4(),
        role: 'assistant',
        type: 'assistant',
        content: assistantContent,
        toolCalls: parsedCalls,
        timestamp: Date.now(),
      };

      mutableMessages.push(assistantMsg);
      send({ type: 'assistant', content: assistantContent, toolCalls: parsedCalls, uuid: assistantMsg.uuid });

      // Record success with AIManager
      aiManager.recordSuccess(activeProvider);
      aiManager.recordTokenUsage(activeProvider, totalInputTokens, totalOutputTokens);

      if (userId !== 'anonymous') {
        await query(
          'INSERT INTO messages (id, session_id, user_id, role, content, tool_calls, tokens_input, tokens_output, model) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          [assistantMsg.uuid, sessionId, userId, 'assistant', assistantContent, parsedCalls.length > 0 ? JSON.stringify(parsedCalls) : null, totalInputTokens, totalOutputTokens, activeModel]
        );
      }

      if (stopReason !== 'tool_use' || parsedCalls.length === 0) break;

      for (const tc of parsedCalls) {
        send({ type: 'status', message: `Usando ferramenta: ${tc.name}...`, toolName: tc.name });
        const tool = tools.find(t => t.name === tc.name);
        let result;
        if (!tool) {
          result = { error: `Ferramenta ${tc.name} não encontrada.` };
        } else {
          try { result = await tool.call(tc.input, { sessionId }); } catch (e) { result = { error: e.message }; }
        }

        const toolResultMsg = {
          uuid: uuidv4(), type: 'tool_result', role: 'user', toolUseId: tc.id, toolName: tc.name,
          content: typeof result === 'string' ? result : JSON.stringify(result),
          isError: !!result?.error, timestamp: Date.now(),
        };

        mutableMessages.push(toolResultMsg);
        send({ type: 'tool_result', toolName: tc.name, content: toolResultMsg.content, isError: toolResultMsg.isError });
      }
    }
    
    if (finalAssistantContent && turnCount < MAX_TURNS) {
      await semanticCache.set(historyMessages, activeSystemPrompt, finalAssistantContent);
    }

    if (userId !== 'anonymous' && (totalInputTokens + totalOutputTokens) > 0) {
      try {
        const usageCost = (totalInputTokens + totalOutputTokens) * 0.000003;
        await query(
          'INSERT INTO usage_logs (user_id, session_id, model, tokens_input, tokens_output, cost_usd) VALUES ($1, $2, $3, $4, $5, $6)',
          [userId, sessionId, activeModel, totalInputTokens, totalOutputTokens, usageCost]
        );
        await query('UPDATE profiles SET tokens_used_month = tokens_used_month + $1 WHERE id = $2', [totalInputTokens + totalOutputTokens, userId]);
      } catch (e) {}
    }

    send({ type: 'done' });
    res.end();

  } catch (err) {
    console.error('[CHAT_CRITICAL_ERROR]', err);
    if (!res.writableEnded) {
      if (res.headersSent) {
        send({ type: 'error', message: err.message || 'Erro interno' });
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
