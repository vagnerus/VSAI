import React from 'react';

export default function PrivacyPage({ onNavigate }) {
  return (
    <div className="landing-layout" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: '100vh' }}>
      <header className="landing-header">
        <div className="landing-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="landing-logo" onClick={() => onNavigate('landing')} style={{ cursor: 'pointer' }}>
            <div className="landing-logo-icon">🧠</div>
            <div className="landing-logo-text">VSAI - IA</div>
          </div>
          <button className="btn btn-secondary" onClick={() => onNavigate('landing')}>Voltar</button>
        </div>
      </header>

      <main className="landing-container" style={{ paddingTop: 100, paddingBottom: 100, maxWidth: 800 }}>
        <h1 style={{ fontSize: 36, marginBottom: 24, fontWeight: 800 }}>Política de Privacidade (LGPD)</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 40 }}>Última atualização: 20 de Abril de 2026</p>

        <div className="legal-content" style={{ lineHeight: 1.8, color: 'var(--text-secondary)' }}>
          <h2 style={{ color: 'var(--text-primary)', marginTop: 32, marginBottom: 16 }}>1. Coleta de Dados</h2>
          <p>O VSAI - IA coleta os seguintes tipos de informações para prover e melhorar seus serviços: Informações de conta (nome, e-mail), logs de comunicação (prompts enviados para a IA) e metadados de uso (tokens consumidos).</p>

          <h2 style={{ color: 'var(--text-primary)', marginTop: 32, marginBottom: 16 }}>2. Uso das Informações</h2>
          <p>As informações coletadas são estritamente usadas para: prover o serviço contratado, faturamento e cumprimento de obrigações legais. Não vendemos ou comercializamos seus dados com terceiros para fins de marketing sob nenhuma hipótese.</p>

          <h2 style={{ color: 'var(--text-primary)', marginTop: 32, marginBottom: 16 }}>3. Compartilhamento de Dados</h2>
          <p>Seus textos/prompts são enviados de forma segura para parceiros de IA (Anthropic e Google) via API para geração de respostas. Eles são obrigados por contrato a não utilizar os dados da API para treinar seus modelos de inteligência artificial públicos (Zero Data Retention / No Training Policy).</p>

          <h2 style={{ color: 'var(--text-primary)', marginTop: 32, marginBottom: 16 }}>4. Seus Direitos (LGPD)</h2>
          <p>Em conformidade com a LGPD (Lei Geral de Proteção de Dados), você tem direito de: solicitar acesso aos seus dados, correção de dados incompletos, e exclusão completa da sua conta e de todo o seu histórico do nosso banco de dados. Para exercer esses direitos, contate o suporte.</p>
          
          <h2 style={{ color: 'var(--text-primary)', marginTop: 32, marginBottom: 16 }}>5. Armazenamento Seguro</h2>
          <p>Utilizamos a infraestrutura moderna e segura do Supabase (AWS), que fornece isolamento completo de dados por cliente através de Row Level Security (RLS) e criptografia em trânsito e em repouso.</p>
        </div>
      </main>
    </div>
  );
}
