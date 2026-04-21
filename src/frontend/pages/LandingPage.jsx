import React from 'react';

export default function LandingPage({ onNavigate }) {
  return (
    <div className="landing-page">
      {/* ─── Navbar ─── */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-logo">
            <div className="landing-logo-icon">🧠</div>
            <span className="landing-logo-text">NexusAI</span>
          </div>
          <div className="landing-nav-links">
            <a href="#features">Recursos</a>
            <a href="#pricing">Planos</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="landing-nav-actions">
            <button className="btn-ghost" onClick={() => onNavigate('login')}>Entrar</button>
            <button className="btn-cta" onClick={() => onNavigate('register')}>Começar Grátis</button>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="landing-hero">
        <div className="hero-glow"></div>
        <div className="hero-content">
          <div className="hero-badge">✨ Plataforma de IA de Nova Geração</div>
          <h1 className="hero-title">
            Construa projetos com<br/>
            <span className="hero-gradient-text">Inteligência Artificial</span>
          </h1>
          <p className="hero-subtitle">
            Crie, gerencie e escale projetos de IA com chat avançado, 
            ferramentas autônomas e base de conhecimento personalizada. 
            Powered by Gemini & Claude.
          </p>
          <div className="hero-actions">
            <button className="btn-cta btn-cta-lg" onClick={() => onNavigate('register')}>
              🚀 Começar Gratuitamente
            </button>
            <button className="btn-outline-hero" onClick={() => {
              document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
            }}>
              Saiba Mais →
            </button>
          </div>
          <div className="hero-stats">
            <div className="hero-stat"><strong>20+</strong><span>Ferramentas IA</span></div>
            <div className="hero-stat-sep"></div>
            <div className="hero-stat"><strong>200K</strong><span>Tokens de Contexto</span></div>
            <div className="hero-stat-sep"></div>
            <div className="hero-stat"><strong>99.9%</strong><span>Uptime</span></div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-mockup">
            <div className="mockup-topbar">
              <span className="mockup-dot red"></span>
              <span className="mockup-dot yellow"></span>
              <span className="mockup-dot green"></span>
              <span className="mockup-title">NexusAI — Chat</span>
            </div>
            <div className="mockup-body">
              <div className="mockup-msg user">Crie uma API REST completa em Node.js com autenticação JWT</div>
              <div className="mockup-msg ai">
                <div className="mockup-typing">
                  <span className="typing-cursor"></span>
                  Vou criar uma API REST completa com Express, JWT e PostgreSQL...
                </div>
              </div>
              <div className="mockup-artifact">
                <div className="artifact-header">📄 server.js — Artifact</div>
                <div className="artifact-code">
                  <span className="code-keyword">import</span> express <span className="code-keyword">from</span> <span className="code-string">'express'</span>;<br/>
                  <span className="code-keyword">import</span> jwt <span className="code-keyword">from</span> <span className="code-string">'jsonwebtoken'</span>;<br/>
                  <br/>
                  <span className="code-keyword">const</span> app = <span className="code-fn">express</span>();
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="landing-section" id="features">
        <div className="section-inner">
          <div className="section-header">
            <span className="section-badge">Recursos</span>
            <h2 className="section-title">Tudo que você precisa para criar com IA</h2>
            <p className="section-desc">Uma plataforma completa que combina o melhor dos modelos de IA com ferramentas profissionais de desenvolvimento.</p>
          </div>
          <div className="features-grid">
            {[
              { icon: '💬', title: 'Chat Avançado', desc: 'Streaming em tempo real com suporte a Markdown, código com syntax highlighting e artifacts.' },
              { icon: '📁', title: 'Projetos Isolados', desc: 'Cada projeto tem suas próprias instruções, base de conhecimento e histórico de conversas.' },
              { icon: '🛠️', title: '20+ Ferramentas', desc: 'Busca web, leitura/escrita de arquivos, análise de código, tradução, SEO e muito mais.' },
              { icon: '🤖', title: 'Multi-Agentes', desc: 'Coordenação de múltiplos agentes de IA trabalhando em paralelo para tarefas complexas.' },
              { icon: '🔐', title: 'Segurança Total', desc: 'Autenticação JWT, isolamento de dados por usuário e chaves de API protegidas no backend.' },
              { icon: '⚡', title: 'Streaming SSE', desc: 'Respostas aparecem em tempo real com efeito de digitação. Sem esperar carregamentos.' },
              { icon: '📚', title: 'Base de Conhecimento', desc: 'Upload de PDFs, documentos e arquivos para a IA analisar e responder com contexto.' },
              { icon: '♊', title: 'Multi-Provider', desc: 'Alterne entre Google Gemini e Anthropic Claude com um clique. Use o melhor modelo para cada tarefa.' },
              { icon: '📊', title: 'Analytics', desc: 'Monitore tokens consumidos, custos e performance em tempo real.' },
            ].map((f, i) => (
              <div key={i} className="feature-card">
                <div className="feature-icon">{f.icon}</div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section className="landing-section landing-section-alt" id="pricing">
        <div className="section-inner">
          <div className="section-header">
            <span className="section-badge">Planos</span>
            <h2 className="section-title">Escolha o plano ideal</h2>
            <p className="section-desc">Comece gratuitamente e escale conforme sua necessidade.</p>
          </div>
          <div className="pricing-grid">
            <div className="pricing-card">
              <div className="pricing-name">Free</div>
              <div className="pricing-price">R$ 0<span>/mês</span></div>
              <ul className="pricing-features">
                <li>✅ 50K tokens/mês</li>
                <li>✅ 3 Projetos</li>
                <li>✅ Chat com Gemini Flash</li>
                <li>✅ 5 Ferramentas</li>
                <li>❌ Artifacts</li>
                <li>❌ Suporte prioritário</li>
              </ul>
              <button className="btn-pricing" onClick={() => onNavigate('register')}>Começar Grátis</button>
            </div>
            <div className="pricing-card pricing-card-popular">
              <div className="pricing-popular-badge">Mais Popular</div>
              <div className="pricing-name">Pro</div>
              <div className="pricing-price">R$ 49<span>/mês</span></div>
              <ul className="pricing-features">
                <li>✅ 500K tokens/mês</li>
                <li>✅ Projetos ilimitados</li>
                <li>✅ Gemini Pro + Claude</li>
                <li>✅ Todas ferramentas</li>
                <li>✅ Artifacts</li>
                <li>✅ Multi-agentes</li>
              </ul>
              <button className="btn-pricing btn-pricing-primary" onClick={() => onNavigate('register')}>Assinar Pro</button>
            </div>
            <div className="pricing-card">
              <div className="pricing-name">Premium</div>
              <div className="pricing-price">R$ 149<span>/mês</span></div>
              <ul className="pricing-features">
                <li>✅ 5M tokens/mês</li>
                <li>✅ Tudo do Pro</li>
                <li>✅ API access</li>
                <li>✅ Webhooks</li>
                <li>✅ Suporte prioritário</li>
                <li>✅ White-label</li>
              </ul>
              <button className="btn-pricing" onClick={() => onNavigate('register')}>Assinar Premium</button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="landing-section" id="faq">
        <div className="section-inner">
          <div className="section-header">
            <span className="section-badge">FAQ</span>
            <h2 className="section-title">Perguntas Frequentes</h2>
          </div>
          <div className="faq-grid">
            {[
              { q: 'Quais modelos de IA são suportados?', a: 'Suportamos Google Gemini (2.5 Flash e Pro) e Anthropic Claude (Sonnet, Opus e Haiku). Você pode alternar entre eles a qualquer momento.' },
              { q: 'Meus dados estão seguros?', a: 'Sim. Utilizamos Supabase com PostgreSQL e Row Level Security. Seus dados são isolados e nunca acessíveis por outros usuários.' },
              { q: 'Preciso instalar algo?', a: 'Não. NexusAI funciona 100% no navegador. Basta criar uma conta e começar a usar.' },
              { q: 'Posso cancelar a qualquer momento?', a: 'Sim, sem multas ou compromissos. Seu plano volta ao Free automaticamente.' },
            ].map((item, i) => (
              <div key={i} className="faq-item">
                <h3 className="faq-question">{item.q}</h3>
                <p className="faq-answer">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Final ─── */}
      <section className="landing-cta">
        <div className="cta-inner">
          <h2>Pronto para criar com IA?</h2>
          <p>Junte-se a milhares de desenvolvedores e criadores.</p>
          <button className="btn-cta btn-cta-lg" onClick={() => onNavigate('register')}>
            Criar Conta Gratuita →
          </button>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <div className="landing-logo-icon" style={{ width: 28, height: 28, fontSize: 14 }}>🧠</div>
            <span>NexusAI</span>
          </div>
          <div className="footer-links">
            <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('terms'); }}>Termos de Uso</a>
            <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('privacy'); }}>Privacidade (LGPD)</a>
            <a href="mailto:contato@nexusai.com">Contato</a>
          </div>
          <div className="footer-copy">© {new Date().getFullYear()} NexusAI. Desenvolvido por Vagner Oliveira.</div>
        </div>
      </footer>
    </div>
  );
}
