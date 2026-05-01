/**
 * CodeInterpreter Tool — Allows the IA to execute code in multiple languages.
 * Now supports Python and Javascript via Piston API.
 */
export const codeInterpreter = {
  name: 'code_interpreter',
  description: 'Executa código (Python ou Javascript) para resolver problemas matemáticos, processar dados ou realizar simulações complexas.',
  inputSchema: {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'O código a ser executado.' },
      language: { type: 'string', enum: ['python', 'javascript'], default: 'javascript', description: 'A linguagem do código.' }
    },
    required: ['code']
  },
  async call({ code, language = 'javascript' }) {
    console.log(`[CodeInterpreter] Executing ${language} code...`);
    
    try {
      // Try using Piston API for real execution (Safe & Isolated)
      const response = await fetch('https://emkc.org/api/v2/piston/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: language === 'python' ? 'python3' : 'javascript',
          version: '*',
          files: [{ content: code }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        return {
          status: 'success',
          result: data.run.stdout || data.run.stderr || 'Execução concluída sem saída.',
          exitCode: data.run.code
        };
      }
      
      // Fallback for Javascript only if Piston fails
      if (language === 'javascript') {
        const context = { Math, Date, JSON, Array, Object, String, Number };
        const fn = new Function(...Object.keys(context), `try { ${code} } catch (e) { return 'Erro: ' + e.message; }`);
        const result = fn(...Object.values(context));
        return { status: 'success', result: JSON.stringify(result, null, 2) };
      }

      return { status: 'error', message: 'Linguagem não suportada no modo fallback.' };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }
};
