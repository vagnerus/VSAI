import { query } from './db.js';

const PLAN_LIMITS = {
  free: {
    maxMessagesPerDay: 20,
    maxTokensPerMonth: 50000,
  },
  pro: {
    maxMessagesPerDay: 200,
    maxTokensPerMonth: 500000,
  },
  premium: {
    maxMessagesPerDay: 999999, // unlimited
    maxTokensPerMonth: 5000000,
  }
};

/**
 * Verifica limites de taxa e tokens para um usuário
 * @param {string} userId
 * @returns {Promise<{ allowed: boolean, reason?: string, plan?: string }>}
 */
export async function checkRateLimit(userId) {
  if (userId === 'anonymous' || userId === 'local-dev') {
    return { allowed: true }; // Permite dev local
  }

  try {
    // Buscar perfil do usuário
    const { rows: profileRows } = await query(
      'SELECT plan, role, tokens_used_month, tokens_limit FROM profiles WHERE id = $1',
      [userId]
    );

    if (profileRows.length === 0) {
      return { allowed: true };
    }

    const profile = profileRows[0];

    if (profile.role === 'banned') {
      return {
        allowed: false,
        reason: 'Sua conta foi suspensa por violação dos termos de serviço.',
        plan: 'banned'
      };
    }

    const plan = profile.plan || 'free';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
    const tokensLimit = profile.tokens_limit || limits.maxTokensPerMonth;

    // 1. Checagem de Tokens (Mensal)
    if (profile.tokens_used_month >= tokensLimit) {
      return { 
        allowed: false, 
        reason: `Limite de tokens atingido (${tokensLimit.toLocaleString()} tokens/mês). Faça upgrade do plano.`,
        plan
      };
    }

    // 2. Checagem de Mensagens (Diário)
    // Contar mensagens enviadas hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { rows: msgRows } = await query(
      "SELECT COUNT(*) FROM messages WHERE user_id = $1 AND role = 'user' AND created_at >= $2",
      [userId, today.toISOString()]
    );

    const count = parseInt(msgRows[0].count, 10);

    if (count >= limits.maxMessagesPerDay) {
      return {
        allowed: false,
        reason: `Limite de mensagens diárias atingido (${limits.maxMessagesPerDay}/dia no plano ${plan.toUpperCase()}). Retorne amanhã ou faça upgrade.`,
        plan
      };
    }

    return { allowed: true, plan };

  } catch (err) {
    console.error('[RateLimiter] Falha na verificação:', err);
    return { allowed: true }; // Fail-open para não quebrar a app
  }
}
