import { query } from '../../api/_lib/db.js';
import { getApiClient } from '../../api/_lib/clientFactory.js';

/**
 * AnalyticsHook — Analyzes the completed session to determine user sentiment and business potential.
 */
export async function analyticsHook({ userId, sessionId, messages, result }) {
  if (!sessionId || !messages || messages.length < 2) return;

  try {
    const systemPrompt = `Você é um Analista de BI da VSAI - IA. 
Sua tarefa é analisar a conversa abaixo e classificar:
1. SENTIMENTO: positivo, neutro ou negativo.
2. LEAD SCORE: de 0 a 10 (onde 10 é um usuário extremamente interessado ou com alta probabilidade de conversão).

Retorne APENAS um objeto JSON válido:
{ "sentiment": "string", "lead_score": number }`;

    const apiClient = await getApiClient('gemini', userId);
    const recentMessages = messages.slice(-10).map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : '[Conteúdo Complexo]'
    }));

    const stream = await apiClient.stream({
      model: 'gemini-1.5-flash',
      system: systemPrompt,
      messages: recentMessages,
      temperature: 0.1
    });

    let responseText = '';
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.text) {
        responseText += event.delta.text;
      }
    }

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      await query(
        'UPDATE sessions SET sentiment_score = $1, lead_score = $2 WHERE id = $3',
        [data.sentiment, data.lead_score, sessionId]
      );
      console.log(`[AnalyticsHook] Session ${sessionId} analyzed: Sentiment=${data.sentiment}, Score=${data.lead_score}`);
    }
  } catch (err) {
    console.error('[AnalyticsHook] Error analyzing session:', err);
  }
}
