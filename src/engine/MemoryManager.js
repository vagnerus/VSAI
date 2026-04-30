import { query } from '../../api/_lib/db.js';
import { getApiClient } from '../../api/_lib/clientFactory.js';

/**
 * MemoryManager — Responsible for extracting and persisting user-specific 
 * long-term memory and personality traits from conversations.
 */
export class MemoryManager {
  /**
   * Analyzes recent messages to update the user's profile with new facts and personality insights.
   * Runs asynchronously to avoid blocking the main chat response.
   * 
   * @param {string} userId - The unique identifier of the user.
   * @param {Array} messages - The conversation history.
   */
  static async updateUserMemory(userId, messages) {
    if (!userId || userId === 'anonymous' || !messages || messages.length < 2) {
      return;
    }

    // Only run if the last message was from the assistant (turn completed)
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'assistant') return;

    try {
      // 1. Fetch current memory state
      const { rows } = await query(
        'SELECT long_term_memory, user_personality, full_name FROM profiles WHERE id = $1', 
        [userId]
      );
      
      if (rows.length === 0) return;

      const profile = rows[0];
      const currentMemory = profile.long_term_memory || 'Nenhuma informação salva ainda.';
      const currentPersonality = profile.user_personality || 'Personalidade ainda não mapeada.';
      const userName = profile.full_name || 'Usuário';

      // 2. Prepare the prompt for the AI Analyst
      const systemPrompt = `Você é o Analista de Memória da VSAI - IA. Sua missão é observar a conversa e atualizar o que sabemos sobre o usuário para que o assistente possa ser mais personalizado no futuro.

USUÁRIO: ${userName} (ID: ${userId})

MEMÓRIA ATUAL (Fatos, Projetos, Preferências):
${currentMemory}

ANÁLISE DE PERSONALIDADE ATUAL (Estilo de comunicação, temperamento):
${currentPersonality}

INSTRUÇÕES:
1. Analise as mensagens recentes da conversa.
2. Identifique NOVOS fatos (ex: "estou trabalhando em um app de delivery", "meu gato se chama Pipoca").
3. Identifique mudanças na PERSONALIDADE ou ESTILO (ex: "prefere explicações curtas", "usa muitos termos técnicos", "é focado em segurança").
4. Se nada de novo foi aprendido, retorne os valores atuais.
5. Retorne APENAS um objeto JSON válido com dois campos: "new_memory" e "new_personality".
6. Mantenha os textos em PORTUGUÊS, de forma profissional e sintética.`;

      // 3. Call a fast model (Gemini Flash) to perform the extraction
      const apiClient = await getApiClient('gemini', userId);
      
      // We only send the last few turns to keep it focused and save tokens
      const recentTurns = messages.slice(-6).map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : '[Conteúdo Complexo/Imagem]'
      }));

      const stream = await apiClient.stream({
        model: 'gemini-1.5-flash',
        system: systemPrompt,
        messages: recentTurns,
        temperature: 0.1, // Low temperature for consistent extraction
      });

      let responseText = '';
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta?.text) {
          responseText += event.delta.text;
        }
      }

      // 4. Parse the AI response and update the database
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          
          const finalMemory = data.new_memory || currentMemory;
          const finalPersonality = data.new_personality || currentPersonality;

          // Only update if there's an actual change to save DB writes
          if (finalMemory !== currentMemory || finalPersonality !== currentPersonality) {
            await query(
              'UPDATE profiles SET long_term_memory = $1, user_personality = $2, updated_at = NOW() WHERE id = $3',
              [finalMemory, finalPersonality, userId]
            );
            console.log(`[MemoryManager] Sucesso: Memória do usuário ${userId} atualizada.`);
          }
        }
      } catch (parseErr) {
        console.warn('[MemoryManager] Falha ao parsear resposta da IA:', responseText);
      }

    } catch (err) {
      console.error('[MemoryManager] Erro durante o processamento da memória:', err);
    }
  }
}
