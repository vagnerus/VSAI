/**
 * CodeInterpreter Tool — Allows the IA to execute Javascript code to solve complex problems.
 */
export const codeInterpreter = {
  name: 'code_interpreter',
  description: 'Executa código Javascript para resolver problemas matemáticos, processar dados ou realizar simulações.',
  inputSchema: {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'O código Javascript a ser executado.' }
    },
    required: ['code']
  },
  async call({ code }) {
    console.log('[CodeInterpreter] Executing code...');
    try {
      // Create a restricted environment
      const context = {
        Math,
        Date,
        JSON,
        Array,
        Object,
        String,
        Number,
        console: { log: (...args) => args.join(' ') }
      };

      // Simple sandbox execution
      const fn = new Function(...Object.keys(context), `
        try {
          ${code}
        } catch (e) {
          return 'Erro na execução: ' + e.message;
        }
      `);

      const result = fn(...Object.values(context));
      return {
        status: 'success',
        result: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
      };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }
};
