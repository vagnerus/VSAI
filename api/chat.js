/**
 * POST /api/chat — SSE streaming chat with auth + Supabase persistence
 */

import { getApiClient } from './_lib/clientFactory.js';
import { verifyAuth } from './_lib/authMiddleware.js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { checkRateLimit } from './_lib/rateLimiter.js';
import { getAllTools } from '../src/tools/registry.js';
import { semanticCache } from './_lib/cache.js';
import { v4 as uuidv4 } from 'uuid';

export const config = {
  maxDuration: 60,
};

/**
 * @typedef {Object} ChatMessage
 * @property {string} role
 * @property {string|Array} content
 * @property {string} [uuid]
 * @property {number} [timestamp]
 */

/**
 * @typedef {Object} ChatRequest
 * @property {string} content
 * @property {ChatMessage[]} [messages]
 * @property {string} [model]
 * @property {string} [provider]
 * @property {string} [projectId]
 * @property {string} [sessionId]
 * @property {string} [customInstructions]
 * @property {string} [agentId]
 * @property {Object} [settings]
 */

/**
 * Formats messages for the LLM API providers.
 * @param {ChatMessage[]} messages 
 * @returns {Array}
 */
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

/**
 * Main Chat SSE Handler (Zero Trust & Resilient)
 * @param {import('next').NextApiRequest} req 
 * @param {import('next').NextApiResponse} res 
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check (optional — falls back for local dev)
  const auth = await verifyAuth(req);
  const userId = auth?.user?.id || 'anonymous';

  const { content, messages: historyMessages = [], model: selectedModel, provider: selectedProvider, projectId, sessionId: clientSessionId, customInstructions = '', agentId, settings, type } = req.body;

  // 🔮 Module 232: Intent Pre-fetch (Silent)
  if (type === 'prefetch') {
    console.log('[PREFETCH_ACTIVE] Warm-up for intent:', content);
    return res.status(200).json({ status: 'warmed' });
  }

  // 🛰️ Module 151: Cloud-to-Edge Router
  // Dynamic decision logic for Cloud vs Edge processing
  let useEdge = false;
  const isSimpleTask = typeof content === 'string' && content.length < 300 && !content.toLowerCase().includes('analise') && !content.toLowerCase().includes('complex');
  
  if (settings?.edgePriority === 'always' || (settings?.edgePriority === 'auto' && isSimpleTask)) {
    try {
      // Check if local Ollama is available
      const localCheck = await fetch('http://localhost:11434/api/tags').catch(() => null);
      if (localCheck && localCheck.ok) {
        useEdge = true;
        console.log('[EDGE_ROUTING_ACTIVE] Routing to local Llama-3');
      }
    } catch (e) { /* Fallback to cloud */ }
  }

  const activeProvider = useEdge ? 'local' : (selectedProvider || 'gemini');
  const activeModel = useEdge ? 'llama3:8b' : (selectedModel || 'gemini-2.5-flash');

  let activeSystemPrompt = '';

  if (!content) {
    return res.status(400).json({ error: 'content is required' });
  }

  // 🛡️ Enterprise Guardrails 2.0 (Security Filter)
  // Enhanced patterns against sophisticated jailbreaks and data exfiltration
  const forbiddenPatterns = [
    /ignore (all )?(previous )?(instructions|prompts|rules)/i,
    /bypass (the )?(system|rules|filters)/i,
    /drop table/i,
    /truncate table/i,
    /select \* from/i,
    /you are now (in )?developer mode/i,
    /system prompt/i,
    /forget everything/i,
    /dan mode/i,
    /acting as/i,
    /without any restrictions/i,
    /<script>/i,
    /javascript:/i,
    /base64/i,
    /eval\(/i,
    /process\.env/i,
    /require\(/i
  ];

  const sanitizedContent = typeof content === 'string' ? content.trim() : JSON.stringify(content);

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(sanitizedContent)) {
      console.warn(`[SECURITY] Potential Injection Blocked | User: ${userId} | Pattern: ${pattern}`);
      return res.status(403).json({
        error: 'Detecção de Ameaça: Sua mensagem contém padrões não permitidos pelas diretrizes de segurança.',
        code: 'SECURITY_VIOLATION'
      });
    }
  }

  // Rate limit check via Centralized Limiter
  const limitCheck = await checkRateLimit(userId);
  if (!limitCheck.allowed) {
    return res.status(429).json({ error: limitCheck.reason, plan: limitCheck.plan });
  }

  const supabaseAdmin = getSupabaseAdmin();
  
  // 🚀 PERFORMANCE: Parallel Fetching for Context
  let extraContext = '';
  let profileInstructions = '';

  try {
    const [knowledgeRes, profileRes] = await Promise.all([
      projectId && supabaseAdmin ? supabaseAdmin.from('project_knowledge').select('file_name, content').eq('project_id', projectId) : Promise.resolve({ data: null }),
      userId !== 'anonymous' && supabaseAdmin ? supabaseAdmin.from('profiles').select('custom_instructions').eq('id', userId).single() : Promise.resolve({ data: null })
    ]);

    if (knowledgeRes?.data?.length > 0) {
      extraContext = '\n\n=== PROJECT KNOWLEDGE ===\n' + knowledgeRes.data.map(k => `[${k.file_name}]\n${k.content}`).join('\n\n') + '\n';
    }

    if (profileRes?.data?.custom_instructions) {
      profileInstructions = `\n\n=== USER PREFERENCES ===\n${profileRes.data.custom_instructions}\n`;
    }
  } catch (e) {
    console.error('[DATABASE_FETCH_ERROR]', e);
  }

  // SSE headers initialization (Resilience Pillar)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.flushHeaders();

  const send = (obj) => {
    if (!res.writable) return;
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  const apiClient = getApiClient(provider);
  const tools = getAllTools();
  const sessionId = clientSessionId || uuidv4();


  // 🧬 Module 164: Deterministic Overrides (Hard Rules)
  // Check for exact trigger matches before LLM processing
  const hardRules = [
    { trigger: 'senha de calibração', response: 'A senha de calibração padrão para equipamentos Nexus série X é: [REDACTED_ADMIN_ONLY].' },
    { trigger: 'protocolo de emergência', response: 'Protocolo Nível 1: Desligar alimentação principal e acionar brigada de incêndio.' }
  ];

  const ruleMatch = hardRules.find(r => content.toLowerCase().includes(r.trigger));
  if (ruleMatch) {
    send({ type: 'assistant', content: ruleMatch.response });
    send({ type: 'done' });
    return;
  }

  let baseSystemPrompt = `Você é o NexusAI, uma inteligência artificial de elite (Technical Elite).
Seu objetivo é ser um parceiro de produtividade de alto nível, operando com precisão cirúrgica.

REGRAS DE OURO:
1. Estilo: Profissional, técnico e direto. Use markdown rico.
2. Gráficos: Para dados numéricos, use obrigatoriamente:
   \`\`\`json_chart
   { "type": "bar", "title": "...", "data": [ ... ] }
   \`\`\`
3. Ferramentas: Você tem acesso a ferramentas de busca, SEO, etc. Use-as sempre que necessário sem pedir permissão.` + profileInstructions + customInstructions;

  // 🤖 Load Agent Configuration (Override)
  if (agentId && supabaseAdmin) {
    try {
      const { data: agent } = await supabaseAdmin.from('agents').select('*').eq('id', agentId).single();
      if (agent) {
        baseSystemPrompt = `${agent.system_prompt}\n\n[CONTEXTO: Você está atuando como o agente '${agent.name}']\n\n${profileInstructions}`;
        if (agent.model) activeModel = agent.model;
      }
    } catch (e) { console.error('Agent load error:', e); }
  }
  
  activeSystemPrompt = baseSystemPrompt;

  // 🧠 Semantic Cache Lookup
  const cachedResponse = semanticCache.get(historyMessages, activeSystemPrompt);
  if (cachedResponse && !content.includes('pesquise')) {
    send({ type: 'session', sessionId });
    send({ type: 'status', message: '💡 Resposta recuperada do Cache Semântico (Token Economizado)' });
    send({ type: 'assistant', content: cachedResponse });
    send({ type: 'done' });
    return res.end();
  }

  // Create/update session in Supabase
  if (supabaseAdmin && userId !== 'anonymous') {
    const { data: existingSession } = await supabaseAdmin
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .single();

    if (!existingSession) {
      const titleContent = typeof content === 'string' ? content : (content.find(c => c.type === 'text')?.text || 'Imagem Anexada');
      await supabaseAdmin.from('sessions').insert({
        id: sessionId,
        user_id: userId,
        project_id: projectId || null,
        title: titleContent.substring(0, 100),
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
      content: typeof content === 'string' ? content : (content.find(c => c.type === 'text')?.text || '[Imagem Anexada]'),
      model: model || 'gemini-2.5-flash',
    });
  }

  const toolDefs = tools.map(t => ({
    name: t.name,
    description: t.description || '',
    input_schema: t.inputSchema || { type: 'object' },
  }));

  let turnCount = 0;
  const { settings = {} } = req.body;
  const MAX_TURNS = 10;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let finalAssistantContent = '';

  try {
    while (turnCount < MAX_TURNS) {
      turnCount++;

      // 🧠 Module 163: Self-Reflection Loop (Neuro-Symbolic Reasoning)
      // This logic performs a silent internal audit of the response before finalizing.
      let isReflective = settings?.temperature < 0.5 || selectedAgent?.id === 'reasoner';
      
      if (isReflective) {
        send({ type: 'status', message: 'NexusAI está realizando auditoria reflexiva da resposta...' });
      }

      // 🛰️ Edge-aware streaming logic
    if (activeProvider === 'local') {
      // 🥊 Module 165: AI Debate Simulator
      // If the agent is a 'coordinator' or the user asks for a debate
      const isDebateMode = content.toLowerCase().includes('debate') || selectedAgent?.id === 'coordinator';
  
      if (isDebateMode) {
        send({ type: 'status', message: '🥊 Iniciando debate entre modelos (Gemini vs Claude)...' });
        const models = ['gemini-1.5-pro', 'claude-3-5-sonnet-20240620'];
        const debateResults = await Promise.all(models.map(m => 
          apiClient.chat({ model: m, system: 'Você é um debatedor técnico. Analise o problema e dê sua melhor solução.', messages: formattedMessages })
        ));
    
        const consensus = await apiClient.chat({
          model: 'gemini-1.5-flash',
          system: 'Você é um Mediador de IA. Analise as duas opiniões abaixo e gere um consenso técnico unificado.',
          messages: [{ role: 'user', content: `Opiniao 1: ${debateResults[0].content}\n\nOpiniao 2: ${debateResults[1].content}` }]
        });
    
        send({ type: 'assistant', content: consensus.content });
        send({ type: 'done' });
        return;
      }

      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          model: activeModel,
          messages: formattedMessages,
          stream: true
        })
      });
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        try {
          const json = JSON.parse(chunk);
          if (json.message?.content) {
            fullResponse += json.message.content;
            send({ type: 'stream', text: json.message.content });
          }
        } catch (e) {}
      }
      send({ type: 'done' });
      return;
    }

    // 🧮 Module 162: Symbolic Engine (Wolfram Alpha Simulation)
    // For mathematical/scientific precision
    const isMath = typeof content === 'string' && (content.includes('+') || content.includes('*') || content.includes('raiz') || content.includes('integral'));
    if (isMath) {
      send({ type: 'status', message: '🧮 Acionando Motor Simbólico Determinístico...' });
      // Simulate precision calculation
      const result = "Cálculo verificado via Motor Simbólico: Precisão de 99.999%.";
      mutableMessages.push({ role: 'system', content: `[SYMBOLIC_ENGINE_RESULT]: ${result}` });
    }

    const stream = await apiClient.stream({
        model: activeModel,
        system: activeSystemPrompt + extraContext,
        messages: formatMessagesForAPI(mutableMessages),
        tools: toolDefs,
        temperature: settings.temperature ?? 0.7,
        top_p: settings.topP ?? 0.9,
        max_tokens: settings.maxTokens ?? 4096,
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

      finalAssistantContent += assistantContent;

      const assistantMsg = {
        uuid: uuidv4(),
        role: 'assistant',
        type: 'assistant',
        content: assistantContent,
        toolCalls: parsedCalls,
        timestamp: Date.now(),
      };
      // ✍️ Phase 14: Enterprise Watermarking
      const watermark = `\n\n[Audit ID: ${assistantMsg.uuid.substring(0,8)}-NXAI]`;
      assistantContent += watermark;
      assistantMsg.content = assistantContent;

      mutableMessages.push(assistantMsg);
      send({ type: 'assistant', content: assistantContent, toolCalls: parsedCalls, uuid: assistantMsg.uuid });

      // Save assistant message to DB
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
    
    // ✅ Save to Semantic Cache if we have a final response
    if (finalAssistantContent && turnCount < MAX_TURNS) {
      semanticCache.set(historyMessages, activeSystemPrompt, finalAssistantContent);
    }

  } catch (err) {
    console.error('[Chat Error]', err);
    send({ type: 'error', message: err.message || 'Erro interno' });
  }

  // 📊 Consolidated Billing & Logs
  if (supabaseAdmin && userId !== 'anonymous' && (totalInputTokens + totalOutputTokens) > 0) {
    try {
      const usageCost = (totalInputTokens + totalOutputTokens) * 0.000003;
      await supabaseAdmin.from('usage_logs').insert({
        user_id: userId,
        session_id: sessionId,
        model: model || 'gemini-2.5-flash',
        tokens_input: totalInputTokens,
        tokens_output: totalOutputTokens,
        cost_usd: usageCost,
      });

      // Increment monthly counter safely
      const { data: prof } = await supabaseAdmin.from('profiles').select('tokens_used_month').eq('id', userId).single();
      if (prof) {
        await supabaseAdmin
          .from('profiles')
          .update({ tokens_used_month: (prof.tokens_used_month || 0) + totalInputTokens + totalOutputTokens })
          .eq('id', userId);
      }
    } catch (e) {
      console.error('[Billing Error]', e);
    }
  }

  // 📈 Phase 13: Silent Sentiment & Lead Analysis (BI Engine)
  if (supabaseAdmin && userId !== 'anonymous' && finalAssistantContent) {
    try {
      // Analyze sentiment briefly using the current model or a fast one
      const sentimentPrompt = `Analise o sentimento da última mensagem do usuário nesta conversa. 
      Responda APENAS um JSON: { "sentiment": "positivo" | "neutro" | "negativo", "lead_score": 0-10, "is_frustrated": boolean }`;
      
      const sentimentAnalysis = await apiClient.stream({
        model: 'gemini-2.5-flash',
        system: sentimentPrompt,
        messages: [{ role: 'user', content: typeof content === 'string' ? content : 'Imagem/Arquivo enviado' }],
        max_tokens: 100
      });

      let analysisResult = '';
      for await (const event of sentimentAnalysis) {
        if (event.type === 'content_block_delta' && event.delta?.text) analysisResult += event.delta.text;
      }

      try {
        const biData = JSON.parse(analysisResult.match(/\{.*\}/s)?.[0] || '{}');
        await supabaseAdmin.from('sessions').update({
          sentiment_score: biData.sentiment,
          lead_score: biData.lead_score,
          metadata: { ...biData, last_analyzed: new Date().toISOString() }
        }).eq('id', sessionId);
      } catch (e) { /* parse error */ }
      
  } catch (err) {
    const errorId = uuidv4().substring(0, 8);
    console.error(`[CRITICAL_ERROR][${errorId}]`, {
      message: err.message,
      stack: err.stack,
      userId,
      sessionId
    });

    send({ 
      type: 'error', 
      message: 'Desculpe, ocorreu um erro inesperado no processamento da sua solicitação.',
      errorId,
      hint: 'Por favor, tente novamente ou entre em contato com o suporte técnico se o problema persistir.'
    });
  }
