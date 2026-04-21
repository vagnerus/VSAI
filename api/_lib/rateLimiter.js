import { getSupabaseAdmin } from './supabaseAdmin.js';

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

  const supabase = getSupabaseAdmin();
  if (!supabase) return { allowed: true }; // Se não há DB configurado, ignora limites

  try {
    // Buscar perfil do usuário
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('plan, tokens_used_month, tokens_limit')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) {
      console.error('[RateLimiter] Erro ao buscar perfil:', profileErr);
      return { allowed: true };
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

    const { count, error: msgErr } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('role', 'user')
      .gte('created_at', today.toISOString());

    if (!msgErr && count !== null) {
      if (count >= limits.maxMessagesPerDay) {
        return {
          allowed: false,
          reason: `Limite de mensagens diárias atingido (${limits.maxMessagesPerDay}/dia no plano ${plan.toUpperCase()}). Retorne amanhã ou faça upgrade.`,
          plan
        };
      }
    }

    return { allowed: true, plan };

  } catch (err) {
    console.error('[RateLimiter] Falha na verificação:', err);
    return { allowed: true }; // Fail-open para não quebrar a app
  }
}
