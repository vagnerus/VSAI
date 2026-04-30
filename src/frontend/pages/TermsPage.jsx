import React from 'react';

export default function TermsPage({ onNavigate }) {
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
        <h1 style={{ fontSize: 36, marginBottom: 24, fontWeight: 800 }}>Termos de Uso</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 40 }}>Última atualização: 20 de Abril de 2026</p>

        <div className="legal-content" style={{ lineHeight: 1.8, color: 'var(--text-secondary)' }}>
          <h2 style={{ color: 'var(--text-primary)', marginTop: 32, marginBottom: 16 }}>1. Aceitação dos Termos</h2>
          <p>Ao acessar e usar a plataforma VSAI - IA ("Serviço"), você concorda em cumprir e ser regido pelos presentes Termos de Uso. Se você não concorda com qualquer parte destes termos, você está proibido de usar nosso Serviço.</p>

          <h2 style={{ color: 'var(--text-primary)', marginTop: 32, marginBottom: 16 }}>2. Descrição do Serviço</h2>
          <p>O VSAI - IA é uma plataforma de Inteligência Artificial que facilita a criação, análise de código e automação de fluxos de trabalho utilizando APIs de IA de terceiros (como OpenAI, Anthropic e Google).</p>

          <h2 style={{ color: 'var(--text-primary)', marginTop: 32, marginBottom: 16 }}>3. Processamento via IAs de Terceiros</h2>
          <p>Você entende e concorda que os dados e prompts enviados através do VSAI - IA podem ser processados pelas APIs de IA conectadas (ex: Google Gemini, Anthropic Claude). O VSAI - IA não usa seus dados para treinar modelos base próprios, mas os termos de terceiros se aplicam ao tráfego gerado em suas respectivas APIs.</p>

          <h2 style={{ color: 'var(--text-primary)', marginTop: 32, marginBottom: 16 }}>4. Planos e Assinaturas</h2>
          <p>Os pagamentos são processados com segurança por gateways terceirizados. Assinaturas renovam-se automaticamente a menos que sejam canceladas antes do fim do ciclo de faturamento. Não há reembolso proporcional em caso de cancelamento no meio do ciclo.</p>

          <h2 style={{ color: 'var(--text-primary)', marginTop: 32, marginBottom: 16 }}>5. Abuso do Sistema</h2>
          <p>A utilização de bots não autorizados, engenharia reversa para burlar contadores de tokens, ou a geração de conteúdo ilegal resultará na suspensão imediata e irrevogável da conta, sem direito a reembolso.</p>
        </div>
      </main>
    </div>
  );
}
