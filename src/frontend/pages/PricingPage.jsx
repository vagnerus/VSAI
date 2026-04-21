import React, { useState } from 'react';
import { useAuth } from '../providers/AuthProvider.jsx';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function PricingPage() {
  const { user, plan: currentPlan, getAuthHeaders } = useAuth();
  const [loading, setLoading] = useState(null);

  const handleSubscribe = async (planId) => {
    if (planId === 'free') return; // Cannot subscribe to free via Stripe
    
    setLoading(planId);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/billing/checkout`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId, successUrl: `${window.location.origin}/app`, cancelUrl: `${window.location.origin}/app` })
      });

      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Erro ao iniciar checkout');
      }
    } catch (err) {
      alert('Erro de conexão ao iniciar checkout');
    } finally {
      setLoading(null);
    }
  };

  const isCurrentPlan = (p) => currentPlan === p;

  return (
    <div className="animate-in" style={{ padding: '0 24px 48px' }}>
      <div style={{ textAlign: 'center', marginBottom: 48, paddingTop: 40 }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>Atualize seu Plano</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 16, maxWidth: 600, margin: '0 auto' }}>
          Desbloqueie todo o poder da inteligência artificial. Escolha o plano que melhor se adapta às suas necessidades.
        </p>
      </div>

      <div className="pricing-grid">
        {/* Plano Free */}
        <div className={`pricing-card ${isCurrentPlan('free') ? 'active' : ''}`} style={{ opacity: isCurrentPlan('free') ? 0.8 : 1 }}>
          <div className="pricing-header">
            <h3>Grátis</h3>
            <div className="price">$0<span>/mês</span></div>
          </div>
          <ul className="pricing-features">
            <li>✔️ 20 Mensagens por dia</li>
            <li>✔️ 50K Tokens mensais</li>
            <li>✔️ Modelos Básicos</li>
            <li>❌ Claude 3 Opus / Gemini Pro</li>
            <li>❌ Suporte Prioritário</li>
          </ul>
          <button 
            className="btn btn-secondary pricing-btn" 
            disabled={true}
          >
            {isCurrentPlan('free') ? 'Plano Atual' : 'Plano Básico'}
          </button>
        </div>

        {/* Plano Pro */}
        <div className={`pricing-card popular ${isCurrentPlan('pro') ? 'active' : ''}`}>
          <div className="popular-badge">Recomendado</div>
          <div className="pricing-header">
            <h3>Pro</h3>
            <div className="price">$19<span>/mês</span></div>
          </div>
          <ul className="pricing-features">
            <li>✔️ 200 Mensagens por dia</li>
            <li>✔️ 500K Tokens mensais</li>
            <li>✔️ Todos os Modelos (incluindo Claude Opus)</li>
            <li>✔️ Artefatos e Live Preview</li>
            <li>❌ Uso Ilimitado</li>
          </ul>
          <button 
            className="btn btn-primary pricing-btn" 
            onClick={() => handleSubscribe('pro')}
            disabled={loading !== null || isCurrentPlan('pro')}
          >
            {loading === 'pro' ? 'Redirecionando...' : isCurrentPlan('pro') ? 'Plano Atual' : 'Assinar Pro'}
          </button>
        </div>

        {/* Plano Premium */}
        <div className={`pricing-card ${isCurrentPlan('premium') ? 'active' : ''}`}>
          <div className="pricing-header">
            <h3>Premium</h3>
            <div className="price">$49<span>/mês</span></div>
          </div>
          <ul className="pricing-features">
            <li>✔️ Mensagens Ilimitadas</li>
            <li>✔️ 5 Milhões de Tokens mensais</li>
            <li>✔️ Acesso Antecipado a Novos Modelos</li>
            <li>✔️ Ferramentas Customizadas API</li>
            <li>✔️ Suporte Dedicado 24/7</li>
          </ul>
          <button 
            className="btn btn-primary pricing-btn"
            style={{ background: isCurrentPlan('premium') ? 'var(--glass-bg)' : 'var(--gradient-primary)' }}
            onClick={() => handleSubscribe('premium')}
            disabled={loading !== null || isCurrentPlan('premium')}
          >
            {loading === 'premium' ? 'Redirecionando...' : isCurrentPlan('premium') ? 'Plano Atual' : 'Assinar Premium'}
          </button>
        </div>
      </div>
    </div>
  );
}
