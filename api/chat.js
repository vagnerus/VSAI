/**
 * POST /api/chat
 * 
 * Substitui o WebSocket por Server-Sent Events (SSE).
 * O frontend envia uma mensagem via POST e recebe o stream via SSE na mesma resposta.
 * Funciona perfeitamente no Vercel (Pro plan: 60s timeout, Hobby: 10s).
 */

import { getApiClient } from './_lib/clientFactory.js';
import { getAllTools } from '../src/tools/registry.js';
import { v4 as uuidv4 } from 'uuid';

export const config = {
  maxDuration: 60, // segundos (requer Vercel Pro para >10s)
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

  const { content, messages: historyMessages = [], model, projectId } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'content is required' });
  }

  // Configurar SSE
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
  const sessionId = uuidv4();

  // Enviar sessão
  send({ type: 'session', sessionId });

  // Montar histórico de mensagens
  const mutableMessages = [...(historyMessages || [])];

  const userMessage = {
    uuid: uuidv4(),
    role: 'user',
    type: 'user',
    content,
    timestamp: Date.now(),
  };
  mutableMessages.push(userMessage);

  const systemPrompt = `Você é o NexusAI, um assistente de IA avançado. Seja preciso, útil e responda em português.`;

  const toolDefs = tools.map(t => ({
    name: t.name,
    description: t.description || '',
    input_schema: t.inputSchema || { type: 'object' },
  }));

  let turnCount = 0;
  const MAX_TURNS = 10;

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
          if (event.usage) send({ type: 'usage', usage: { inputTokens: event.usage.input_tokens, outputTokens: event.usage.output_tokens } });
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

      // Se não usou ferramentas, terminamos
      if (stopReason !== 'tool_use' || parsedCalls.length === 0) break;

      // Executar ferramentas
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

  send({ type: 'done' });
  res.end();
}
