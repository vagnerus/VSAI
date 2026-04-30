import { exec } from 'child_process';
import { promisify } from 'util';
import { buildTool } from './factory.js';

const execAsync = promisify(exec);

/**
 * WindowsServiceTool — Manage Windows Services (Start, Stop, Restart).
 * B14 Fix: Now uses buildTool() for proper defaults and is registered in registry.
 */
export const WindowsServiceTool = buildTool({
  name: 'windows_service_manager',
  description: 'Lista, inicia, para ou reinicia serviços do Windows (ex: spooler). Requer privilégios administrativos.',
  isReadOnly: (input) => input?.action === 'list' || input?.action === 'status',
  isEnabled: () => process.platform === 'win32' && !process.env.VERCEL,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['start', 'stop', 'restart', 'status', 'list'],
        description: 'Ação a ser executada no serviço.'
      },
      serviceName: {
        type: 'string',
        description: 'Nome técnico do serviço (ex: "spooler" para Spooler de Impressão).'
      }
    },
    required: ['action']
  },

  async call({ action, serviceName }) {
    try {
      if (action === 'list') {
        const { stdout } = await execAsync('net start', { timeout: 15000 });
        return { status: 'success', services: stdout.split('\n').map(s => s.trim()).filter(s => s) };
      }

      if (!serviceName) {
        return { error: 'O nome do serviço é obrigatório para esta ação.' };
      }

      // Sanitize service name to prevent injection
      const safeName = serviceName.replace(/[^a-zA-Z0-9_\-. ]/g, '');

      let command = '';
      switch (action) {
        case 'start': command = `net start "${safeName}"`; break;
        case 'stop': command = `net stop "${safeName}"`; break;
        case 'restart': command = `powershell "Restart-Service -Name '${safeName}' -Force"`; break;
        case 'status': command = `sc query "${safeName}"`; break;
      }

      const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
      
      if (stderr && !stdout) {
        return { error: stderr };
      }

      return {
        status: 'success',
        action,
        serviceName: safeName,
        message: stdout || `Ação ${action} executada no serviço ${safeName}.`
      };
    } catch (e) {
      if (e.message.includes('Access is denied') || e.message.includes('5')) {
        return { error: 'Acesso negado. Certifique-se de que o VSAI - IA está rodando como Administrador.' };
      }
      return { error: e.message };
    }
  }
});
