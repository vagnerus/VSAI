/**
 * POST /api/chat — SSE streaming chat with auth + Supabase persistence
 */

import { getApiClient } from './_lib/clientFactory.js';
import { verifyAuth } from './_lib/authMiddleware.js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { checkRateLimit } from './_lib/rateLimiter.js';
import { getAllTools } from '../src/tools/registry.js';
import { v4 as uuidv4 } from 'uuid';

export const config = {
  maxDuration: 60,
};

function formatMessagesForAPI(messages) {
  return messages.map(m => {
    if (m.type === 'tool_result') {
      return {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: m.toolUseId, content: m.content, is_error: m.isError }],
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

  // Auth check (optional — falls back for local dev)
  const auth = await verifyAuth(req);
  const userId = auth?.user?.id || 'anonymous';

  const { content, messages: historyMessages = [], model, projectId, sessionId: clientSessionId } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'content is required' });
  }

  // Rate limit check via Centralized Limiter
  const limitCheck = await checkRateLimit(userId);
  if (!limitCheck.allowed) {
    return res.status(429).json({
      error: limitCheck.reason,
      plan: limitCheck.plan,
    });
  }

  const supabaseAdmin = getSupabaseAdmin();

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  function send(obj) {
    if (!res.writable) return;
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  }

  const apiClient = getApiClient();
  const tools = getAllTools();
  const sessionId = clientSessionId || uuidv4();

  // Create/update session in Supabase
  if (supabaseAdmin && userId !== 'anonymous') {
    const { data: existingSession } = await supabaseAdmin
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .single();

    if (!existingSession) {
      await supabaseAdmin.from('sessions').insert({
        id: sessionId,
        user_id: userId,
        project_id: projectId || null,
        title: content.substring(0, 100),
      });
    }
  }

  send({ type: 'session', sessionId });

  const mutableMessages = [...(historyMessages || [])];
  const userMessage = {
    uuid: uuidv4(),
    role: 'user',
    type: 'user',
    content,
    timestamp: Date.now(),
  };
  mutableMessages.push(userMessage);

  // Save user message
  if (supabaseAdmin && userId !== 'anonymous') {
    await supabaseAdmin.from('messages').insert({
      id: userMessage.uuid,
      session_id: sessionId,
      user_id: userId,
      role: 'user',
      content,
      model: model || 'gemini-2.5-flash',
    });
  }

  const systemPrompt = `Você é o NexusAI, um assistente de IA avançado. Seja preciso, útil e responda em português.`;

  const toolDefs = tools.map(t => ({
    name: t.name,
    description: t.description || '',
    input_schema: t.inputSchema || { type: 'object' },
  }));

  let turnCount = 0;
  const MAX_TURNS = 10;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  try {
    while (turnCount < MAX_TURNS) {
      turnCount++;

      const stream = await apiClient.stream({
        model: model || process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        system: systemPrompt,
        messages: formatMessagesForAPI(mutableMessages),
        tools: toolDefs,
      });

      let assistantContent = '';
      let toolCalls = [];
      let stopReason = 'end_turn';

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

      const parsedCalls = toolCalls.map(tc => {
        try { return { ...tc, input: JSON.parse(tc.input) }; } catch { return { ...tc, input: {} }; }
      });

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

      // Save assistant message
      if (supabaseAdmin && userId !== 'anonymous') {
        await supabaseAdmin.from('messages').insert({
          id: assistantMsg.uuid,
          session_id: sessionId,
          user_id: userId,
          role: 'assistant',
          content: assistantContent,
          tool_calls: parsedCalls.length > 0 ? parsedCalls : null,
          tokens_input: totalInputTokens,
          tokens_output: totalOutputTokens,
          model: model || 'gemini-2.5-flash',
        });
      }

      if (stopReason !== 'tool_use' || parsedCalls.length === 0) break;

      // Execute tools
      for (const tc of parsedCalls) {
        send({ type: 'status', message: `Usando ferramenta: ${tc.name}...`, toolName: tc.name });

        const tool = tools.find(t => t.name === tc.name);
        let result;

        if (!tool) {
          result = { error: `Ferramenta ${tc.name} não encontrada.` };
        } else {
          try {
            result = await tool.call(tc.input, { sessionId });
          } catch (e) {
            result = { error: e.message };
          }
        }

        const toolResultMsg = {
          uuid: uuidv4(),
          type: 'tool_result',
          role: 'user',
          toolUseId: tc.id,
          toolName: tc.name,
          content: typeof result === 'string' ? result : JSON.stringify(result),
          isError: !!result?.error,
          timestamp: Date.now(),
        };

        mutableMessages.push(toolResultMsg);
        send({ type: 'tool_result', toolName: tc.name, content: toolResultMsg.content, isError: toolResultMsg.isError });
      }
    }
  } catch (err) {
    send({ type: 'error', message: err.message || 'Erro interno' });
  }

  // Update token usage in profile
  if (supabaseAdmin && userId !== 'anonymous' && (totalInputTokens + totalOutputTokens) > 0) {
    // Log usage
    const usageCost = (totalInputTokens + totalOutputTokens) * 0.000003;
    await supabaseAdmin.from('usage_logs').insert({
      user_id: userId,
      session_id: sessionId,
      model: model || 'gemini-2.5-flash',
      tokens_input: totalInputTokens,
      tokens_output: totalOutputTokens,
      cost_usd: usageCost,
    });

    // Increment monthly counter
    // First fetch current, then update (since we don't have RPC guaranteed)
    const { data: prof } = await supabaseAdmin.from('profiles').select('tokens_used_month').eq('id', userId).single();
    if (prof) {
      await supabaseAdmin
        .from('profiles')
        .update({ tokens_used_month: (prof.tokens_used_month || 0) + totalInputTokens + totalOutputTokens })
        .eq('id', userId);
    }
  }

  send({ type: 'done' });
  res.end();
}
