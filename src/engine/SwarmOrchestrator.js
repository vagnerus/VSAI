import { getApiClient } from '../../api/_lib/clientFactory.js';
import { query } from '../../api/_lib/db.js';

/**
 * SwarmOrchestrator — Orchestrates multiple specialized agents to solve complex tasks.
 */
export class SwarmOrchestrator {
  /**
   * Orchestrates a swarm response.
   * @param {string} userQuery - The original user request.
   * @param {Object} context - Context (userId, projectId, etc.)
   */
  static async orchestrate(userQuery, context) {
    console.log('[SwarmOrchestrator] Initing Swarm for:', userQuery);

    try {
      // 1. Fetch available agents
      const { rows: agents } = await query('SELECT name, system_prompt, model FROM agents LIMIT 5');
      if (agents.length === 0) return null; // No agents to swarm with

      // 2. Decompose task using the primary model
      const decompositionPrompt = `Você é o Maestro do Enxame VSAI. 
Sua tarefa é dividir o pedido do usuário em subtarefas especializadas.

AGENTES DISPONÍVEIS:
${agents.map(a => `- ${a.name}`).join('\n')}

PEDIDO DO USUÁRIO:
"${userQuery}"

Retorne um JSON com a lista de subtarefas:
{ "subtasks": [ { "agent_name": "string", "instruction": "string" } ] }`;

      const apiClient = await getApiClient('gemini', context.userId);
      const stream = await apiClient.stream({
        model: 'gemini-1.5-flash',
        system: decompositionPrompt,
        messages: [{ role: 'user', content: 'Decomponha a tarefa.' }],
        temperature: 0.2
      });

      let decompositionText = '';
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta?.text) decompositionText += event.delta.text;
      }

      const { subtasks } = JSON.parse(decompositionText.match(/\{[\s\S]*\}/)[0]);
      console.log(`[SwarmOrchestrator] Task decomposed into ${subtasks.length} subtasks.`);

      // 3. Execute subtasks in parallel
      const subtaskResults = await Promise.all(subtasks.map(async task => {
        const agent = agents.find(a => a.name === task.agent_name) || agents[0];
        const agentClient = await getApiClient('gemini', context.userId);
        
        let resultText = '';
        const agentStream = await agentClient.stream({
          model: agent.model || 'gemini-1.5-flash',
          system: agent.system_prompt,
          messages: [{ role: 'user', content: task.instruction }],
          temperature: 0.7
        });

        for await (const event of agentStream) {
          if (event.type === 'content_block_delta' && event.delta?.text) resultText += event.delta.text;
        }

        return { agent: agent.name, result: resultText };
      }));

      // 4. Synthesize final answer
      const synthesisPrompt = `Você é o Sintetizador do Enxame VSAI.
Abaixo estão os resultados de diferentes especialistas sobre o pedido do usuário.
Combine tudo em uma resposta única, coesa e de altíssima qualidade.

PEDIDO ORIGINAL: ${userQuery}

RESULTADOS:
${subtaskResults.map(r => `--- [${r.agent}] ---\n${r.result}`).join('\n\n')}`;

      const finalStream = await apiClient.stream({
        model: 'gemini-1.5-pro', // Use a stronger model for synthesis
        system: synthesisPrompt,
        messages: [{ role: 'user', content: 'Sintetize os resultados.' }],
      });

      return finalStream;

    } catch (err) {
      console.error('[SwarmOrchestrator] Error:', err);
      return null;
    }
  }
}
