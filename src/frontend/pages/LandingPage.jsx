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
          <div className="hero-badge">💎 NexusAI Alpha-300 — AGI-Ready OS</div>
          <h1 className="hero-title">
            Domine a Singularidade com<br/>
            <span className="hero-gradient-text">Governança Total de IA</span>
          </h1>
          <p className="hero-subtitle">
            O primeiro sistema operacional corporativo autônomo. 
            300 módulos de inteligência integrando Gêmeos Digitais, 
            Vigilância Satelital e Autocura Sistêmica. 🏛️🌐✨
          </p>
          <div className="hero-actions">
            <button className="btn-cta btn-cta-lg" onClick={() => onNavigate('register')}>
              🚀 Ativar Protocolo Alpha
            </button>
            <button className="btn-outline-hero" onClick={() => {
              document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
            }}>
              Ver 300 Módulos →
            </button>
          </div>
          <div className="hero-stats">
            <div className="hero-stat"><strong>300</strong><span>Módulos Ativos</span></div>
            <div className="hero-stat-sep"></div>
            <div className="hero-stat"><strong>256-bit</strong><span>Quantum-Safe</span></div>
            <div className="hero-stat-sep"></div>
            <div className="hero-stat"><strong>∞</strong><span>Autonomia</span></div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-mockup">
            <div className="mockup-topbar">
              <span className="mockup-dot red"></span>
              <span className="mockup-dot yellow"></span>
              <span className="mockup-dot green"></span>
              <span className="mockup-title">NexusAI Alpha — Digital Twin</span>
            </div>
            <div className="mockup-body">
              <div className="mockup-msg user">Executar simulação de stress na infraestrutura global.</div>
              <div className="mockup-msg ai">
                <div className="mockup-typing">
                  <span className="typing-cursor"></span>
                  Iniciando Módulo 292. Analisando 12 enxames... Detectado gargalo em S01. Aplicando Self-Healing.
                </div>
              </div>
              <div className="mockup-artifact">
                <div className="artifact-header">💠 Digital Twin Report — Artifact</div>
                <div style={{ padding: 10, fontSize: 11 }}>
                  <div style={{ color: '#10b981' }}>● [AUTO-HEAL] Re-roteando tráfego via Módulo 151 (Edge).</div>
                  <div style={{ color: '#3b82f6', marginTop: 5 }}>● [SAT] Sentinel-2 confirma integridade física do Data Center.</div>
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
            <span className="section-badge">Módulos de Elite</span>
            <h2 className="section-title">Infraestrutura em Nível de Singularidade</h2>
            <p className="section-desc">Uma arquitetura projetada para soberania total, do hardware à consciência digital.</p>
          </div>
          <div className="features-grid">
            {[
              { icon: '🏛️', title: 'Governança AGI', desc: 'Controle total sobre enxames de agentes autônomos com o interruptor Alpha Switch (300).' },
              { icon: '💠', title: 'Gêmeo Digital', desc: 'Réplica virtual 1:1 de toda a sua organização para simulações preditivas em tempo real (203).' },
              { icon: '🛰️', title: 'Vigilância Satelital', desc: 'Monitoramento planetário via Sentinel-2 para logística e segurança de infraestrutura (252).' },
              { icon: '🛡️', title: 'Quantum-Safe', desc: 'Cofre de dados protegido por criptografia resiliente a ataques de computação quântica (211).' },
              { icon: '🩹', title: 'Self-Healing', desc: 'Reparo automático de código e infraestrutura sem necessidade de intervenção humana (293).' },
              { icon: '🌍', title: 'Geo-Inteligência', desc: 'Análise de terreno e clima severo com impacto direto na eficiência operacional (254).' },
              { icon: '🎙️', title: 'Bio-Sinais IA', desc: 'Monitoramento de stress vocal e integração com wearables para bem-estar da equipe (261).' },
              { icon: '👓', title: 'Holografia XR', desc: 'Interface espacial e projeção 3D para colaboração em metaversos de elite (271).' },
              { icon: '🌱', title: 'Eco-Sustentável', desc: 'Otimização energética via Green Scheduler para mínima pegada de carbono (285).' },
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
                <li>❌ Self-Healing</li>
                <li>❌ Gêmeo Digital</li>
              </ul>
              <button className="btn-pricing" onClick={() => onNavigate('register')}>Começar Grátis</button>
            </div>
            <div className="pricing-card pricing-card-popular">
              <div className="pricing-popular-badge">Mais Popular</div>
              <div className="pricing-name">Pro</div>
              <div className="pricing-price">R$ 99<span>/mês</span></div>
              <ul className="pricing-features">
                <li>✅ 1M tokens/mês</li>
                <li>✅ Projetos ilimitados</li>
                <li>✅ Gemini Pro + Claude</li>
                <li>✅ Todas ferramentas</li>
                <li>✅ Self-Healing (Lite)</li>
                <li>✅ Gêmeo Digital (Básico)</li>
              </ul>
              <button className="btn-pricing btn-pricing-primary" onClick={() => onNavigate('register')}>Assinar Pro</button>
            </div>
            <div className="pricing-card">
              <div className="pricing-name">Enterprise</div>
              <div className="pricing-price">Consultar<span>/mês</span></div>
              <ul className="pricing-features">
                <li>✅ Tokens Ilimitados</li>
                <li>✅ Tudo do Pro</li>
                <li>✅ Alpha Switch Access</li>
                <li>✅ Vigilância Satelital</li>
                <li>✅ Suporte 24/7 Humano+IA</li>
                <li>✅ White-label Total</li>
              </ul>
              <button className="btn-pricing" onClick={() => onNavigate('register')}>Falar com Especialista</button>
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
              { q: 'O que é o Alpha Switch?', a: 'É o protocolo final de autonomia que permite ao NexusAI gerir infraestruturas complexas sem supervisão constante, utilizando o Módulo 300.' },
              { q: 'A segurança quântica é real?', a: 'Sim. Utilizamos algoritmos baseados em Lattice (Módulo 211) que são resistentes a ataques de computadores quânticos atuais e futuros.' },
              { q: 'Como funciona o Gêmeo Digital?', a: 'Criamos uma réplica virtual de seus processos e dados (Módulo 203) para testar mudanças antes de aplicá-las ao mundo real.' },
              { q: 'Posso integrar com hardware físico?', a: 'Sim. Através dos módulos de RPA Extremo e Telepresença (181/275), o NexusAI pode controlar dispositivos IoT, robôs e infra de rede.' },
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
          <h2>Pronto para a Singularidade?</h2>
          <p>O futuro da governança empresarial começa agora.</p>
          <button className="btn-cta btn-cta-lg" onClick={() => onNavigate('register')}>
            Ativar Minha Unidade Alpha →
          </button>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <div className="landing-logo-icon" style={{ width: 28, height: 28, fontSize: 14 }}>🧠</div>
            <span>NexusAI Alpha</span>
          </div>
          <div className="footer-links">
            <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('terms'); }}>Termos Alpha</a>
            <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('privacy'); }}>Privacidade (LGPD+)</a>
            <a href="mailto:contato@nexusai.com">Comando Alpha</a>
          </div>
          <div className="footer-copy">© {new Date().getFullYear()} NexusAI Alpha-300. Soberania Digital por Vagner Oliveira.</div>
        </div>
      </footer>
    </div>
  );
}
