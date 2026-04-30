import { query } from '../../api/_lib/db.js';

/**
 * PluginTool — Dynamically loads and executes custom tools defined in the database.
 */
export const pluginTool = {
  name: 'custom_plugin',
  description: 'Executa ferramentas customizadas de terceiros integradas via API.',
  inputSchema: {
    type: 'object',
    properties: {
      plugin_name: { type: 'string', description: 'O nome do plugin a ser chamado.' },
      parameters: { type: 'object', description: 'Os parâmetros para o plugin.' }
    },
    required: ['plugin_name', 'parameters']
  },
  async call({ plugin_name, parameters }) {
    console.log(`[PluginTool] Calling plugin: ${plugin_name}`);
    try {
      const { rows } = await query('SELECT * FROM plugins WHERE name = $1', [plugin_name]);
      if (rows.length === 0) return { error: `Plugin ${plugin_name} não encontrado.` };

      const plugin = rows[0];
      const response = await fetch(plugin.api_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': plugin.api_key ? `Bearer ${plugin.api_key}` : ''
        },
        body: JSON.stringify(parameters)
      });

      const data = await response.json();
      return { status: 'success', data };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }
};
