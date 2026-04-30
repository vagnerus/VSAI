import React from 'react';

export default function LandingPage({ onNavigate }) {
  return (
    <div className="landing-page-metallic" style={{ background: 'var(--bg-primary)' }}>
      {/* ─── Header / Navbar ─── */}
      <nav className="navbar-fixed" style={{ position: 'fixed', top: 0, left: 0, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px', height: 'var(--topbar-height)', background: 'var(--bg-secondary)', backdropFilter: 'var(--glass-blur)', borderBottom: '1px solid var(--platinum-light)', zIndex: 1000 }}>
        <div className="flex items-center gap-2">
          <div className="logo-icon-shell">
            <span style={{ fontSize: 20 }}>🧠</span>
          </div>
          <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: -1, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
            Nexus<span style={{ color: 'var(--text-platinum)' }}>AI</span>
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8 font-bold" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          <a href="#features" style={{ textDecoration: 'none', color: 'inherit' }}>Recursos</a>
          <a href="#solutions" style={{ textDecoration: 'none', color: 'inherit' }}>Soluções</a>
          <a href="#pricing" style={{ textDecoration: 'none', color: 'inherit' }}>Preços</a>
        </div>

        <div className="flex items-center gap-4">
          <button 
            className="btn-ghost" 
            onClick={() => onNavigate('login')}
            style={{ color: 'var(--text-primary)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Entrar
          </button>
          <button 
            className="btn-liquid" 
            style={{ padding: '10px 24px', fontSize: 13 }}
            onClick={() => onNavigate('register')}
          >
            Começar Grátis
          </button>
        </div>
      </nav>

      {/* ─── Hero Section ─── */}
      <section className="hero-metallic" style={{ paddingTop: 160, paddingBottom: 100, textAlign: 'center' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--platinum-light)', borderRadius: 100, marginBottom: 32 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-platinum)', textTransform: 'uppercase', letterSpacing: 2 }}>⚡ Novo: Versão 2.5 Platinum</span>
          </div>
          
          <h1 className="text-metallic" style={{ fontSize: 'clamp(40px, 8vw, 90px)', fontWeight: 900, letterSpacing: -3, lineHeight: 0.9, marginBottom: 32 }}>
            Inteligência <br />
            <span style={{ color: 'var(--text-platinum)' }}>Forjada em Platina</span>
          </h1>

          <p style={{ fontSize: 20, color: 'var(--text-secondary)', maxWidth: 700, margin: '0 auto 48px', lineHeight: 1.6, fontWeight: 500 }}>
            A ferramenta de IA mais sofisticada do mercado. Velocidade instantânea com um design que define o novo padrão de luxo digital.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
            <button 
              className="btn-liquid" 
              onClick={() => onNavigate('register')}
              style={{ padding: '20px 48px', fontSize: 18 }}
            >
              🚀 Ativar Protocolo Platinum
            </button>
          </div>

          {/* Hero Visual Mockup */}
          <div style={{ marginTop: 80, position: 'relative' }}>
            <div className="card-metallic" style={{ 
              maxWidth: 900, 
              margin: '0 auto', 
              padding: 8,
              borderRadius: 32
            }}>
              <div style={{ background: 'white', borderRadius: 24, overflow: 'hidden' }}>
                <img src="/landing_metallic_mockup.png" alt="NexusAI Mockup" style={{ width: '100%', display: 'block' }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features Grid ─── */}
      <section id="features" style={{ padding: '100px 20px', background: 'var(--bg-secondary)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <h2 style={{ fontSize: 12, fontWeight: 900, color: 'var(--text-platinum)', textTransform: 'uppercase', letterSpacing: 4, marginBottom: 16 }}>Recursos de Elite</h2>
            <h3 className="text-metallic" style={{ fontSize: 40, fontWeight: 900 }}>Tecnologia que Brilha</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32 }}>
            {[
              { icon: '⚡', title: 'Velocidade Cromo', desc: 'Processamento em milissegundos com a nova arquitetura Gemini 2.5 Platinum.' },
              { icon: '🛡️', title: 'Segurança Platinum', desc: 'Criptografia de ponta a ponta e isolamento total de seus projetos estratégicos.' },
              { icon: '💠', title: 'Multi-Agentes', desc: 'Coordene múltiplos modelos simultaneamente para fluxos de trabalho avançados.' }
            ].map((f, i) => (
              <div key={i} className="card-metallic">
                <div className="feature-icon-metallic" style={{ fontSize: 32, marginBottom: 20 }}>{f.icon}</div>
                <h4 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>{f.title}</h4>
                <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      <section style={{ padding: '100px 20px', background: 'var(--bg-primary)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 80, color: 'var(--platinum-light)', opacity: 0.5, lineHeight: 1, marginBottom: -20, fontFamily: 'serif' }}>“</div>
          <p style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)', fontStyle: 'italic', marginBottom: 32, lineHeight: 1.5 }}>
            "A transição para o NexusAI foi como sair de uma ferramenta rudimentar para um assistente de luxo. O design Platinum não é apenas estética, é funcionalidade pura."
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--silver-brushed)', border: '2px solid white' }}></div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Vagner Santos</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-platinum)', textTransform: 'uppercase' }}>CEO @ NexusAI</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer style={{ padding: '64px 20px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--platinum-light)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 40 }}>
          <div style={{ maxWidth: 300 }}>
             <div className="flex items-center gap-2" style={{ marginBottom: 20 }}>
                <div className="logo-icon-shell" style={{ width: 32, height: 32, fontSize: 14 }}>
                  <span>🧠</span>
                </div>
                <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)' }}>NEXUS<span style={{ color: 'var(--text-platinum)' }}>AI</span></span>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>Elevando a produtividade humana através da inteligência artificial de elite.</p>
          </div>
        </div>
        <div style={{ maxWidth: 1200, margin: '48px auto 0', paddingTop: 24, borderTop: '1px solid var(--border-platinum)', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--text-platinum)', fontWeight: 600 }}>© {new Date().getFullYear()} NexusAI Platinum Edition. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
