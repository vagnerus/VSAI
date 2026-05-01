import { buildTool } from './factory.js';
import { query } from '../api/_lib/db.js';

export const SqlDatabaseTool = buildTool({
  name: 'sql_db_reader',
  description: 'Executa consultas SQL de leitura (SELECT) ou lista tabelas disponíveis para gerar relatórios e BI.',
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['query', 'list_tables'], default: 'query' },
      sql: { type: 'string', description: 'A consulta SQL SELECT (necessária se action=query).' },
    },
    required: [],
  },
  async call({ action = 'query', sql }) {
    if (action === 'list_tables') {
      return {
        tables: ['profiles', 'projects', 'sessions', 'messages', 'usage_logs', 'project_knowledge', 'agents'],
        note: 'Use SELECT para consultar estas tabelas.'
      };
    }

    if (!sql) return { error: 'SQL query is required for action=query' };

    // Segurança: Permitir apenas SELECT
    const trimmedSql = sql.trim().toUpperCase();
    if (!trimmedSql.startsWith('SELECT')) {
      return { error: 'Apenas consultas de leitura (SELECT) são permitidas para segurança.' };
    }

    // Lista de tabelas proibidas (senhas, etc)
    const forbidden = ['users', 'secrets', 'keys', 'passwords', 'system_settings'];
    if (forbidden.some(t => trimmedSql.includes(t.toUpperCase()))) {
      return { error: 'Acesso a tabelas confidenciais negado por política de segurança.' };
    }

    try {
      const { rows } = await query(sql);
      return {
        status: 'success',
        rowCount: rows.length,
        rows: rows.slice(0, 50),
        note: rows.length > 50 ? 'Exibindo apenas os primeiros 50 resultados.' : ''
      };
    } catch (err) {
      return { error: `Erro na consulta SQL: ${err.message}` };
    }
  },
});
