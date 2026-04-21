import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * WindowsServiceTool — Manage Windows Services (Start, Stop, Restart).
 */
export const WindowsServiceTool = {
  name: 'windows_service_manager',
  description: 'Lista, inicia, para ou reinicia serviços do Windows (ex: spooler). Requer privilégios administrativos.',
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
        const { stdout } = await execAsync('net start');
        return { status: 'success', services: stdout.split('\n').map(s => s.trim()).filter(s => s) };
      }

      if (!serviceName) {
        return { error: 'O nome do serviço é obrigatório para esta ação.' };
      }

      let command = '';
      switch (action) {
        case 'start': command = `net start "${serviceName}"`; break;
        case 'stop': command = `net stop "${serviceName}"`; break;
        case 'restart': command = `powershell "Restart-Service -Name '${serviceName}' -Force"`; break;
        case 'status': command = `sc query "${serviceName}"`; break;
      }

      const { stdout, stderr } = await execAsync(command);
      
      if (stderr && !stdout) {
        return { error: stderr };
      }

      return {
        status: 'success',
        action,
        serviceName,
        message: stdout || `Ação ${action} executada no serviço ${serviceName}.`
      };
    } catch (e) {
      if (e.message.includes('Access is denied') || e.message.includes('5')) {
        return { error: 'Acesso negado. Certifique-se de que o NexusAI está rodando como Administrador.' };
      }
      return { error: e.message };
    }
  }
};
