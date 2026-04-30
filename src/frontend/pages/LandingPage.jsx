import React from 'react';

export default function LandingPage({ onNavigate }) {
  return (
    <div className="landing-page-metallic">
      {/* ─── Header / Navbar ─── */}
      <nav className="glass-nav">
        <div className="max-w-7xl mx-auto px-6 w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 metallic-gradient-bg rounded-xl flex items-center justify-center shadow-lg border border-white">
              <span style={{ fontSize: 20 }}>🧠</span>
            </div>
            <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: -1, color: '#0f172a', textTransform: 'uppercase' }}>
              Nexus<span style={{ color: '#94a3b8' }}>AI</span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 font-bold" style={{ fontSize: 13, color: '#64748b' }}>
            <a href="#features" style={{ textDecoration: 'none', color: 'inherit' }}>Recursos</a>
            <a href="#solutions" style={{ textDecoration: 'none', color: 'inherit' }}>Soluções</a>
            <a href="#pricing" style={{ textDecoration: 'none', color: 'inherit' }}>Preços</a>
          </div>

          <div className="flex items-center gap-4">
            <button 
              className="btn-ghost" 
              onClick={() => onNavigate('login')}
              style={{ color: '#475569', fontWeight: 700 }}
            >
              Entrar
            </button>
            <button 
              className="metallic-btn-hero" 
              style={{ padding: '10px 24px', fontSize: 13 }}
              onClick={() => onNavigate('register')}
            >
              Começar Grátis
            </button>
          </div>
        </div>
      </nav>

      {/* ─── Hero Section ─── */}
      <section className="hero-metallic">
        <div style={{ maxWidth: 1200, margin: '0 auto', px: 20 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 100, marginBottom: 32 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 2 }}>⚡ Novo: Versão 2.5 Metallic</span>
          </div>
          
          <h1 style={{ fontSize: 'clamp(40px, 8vw, 90px)', fontWeight: 900, letterSpacing: -3, lineHeight: 0.9, color: '#0f172a', marginBottom: 32 }}>
            Inteligência <br />
            <span style={{ color: '#94a3b8' }}>Forjada em Prata</span>
          </h1>

          <p style={{ fontSize: 20, color: '#64748b', maxWidth: 700, margin: '0 auto 48px', lineHeight: 1.6, fontWeight: 500 }}>
            A ferramenta de IA mais sofisticada do mercado. Velocidade instantânea com um design que define o novo padrão de luxo digital.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
            <button 
              className="metallic-btn-hero" 
              onClick={() => onNavigate('register')}
              style={{ padding: '20px 48px' }}
            >
              🚀 Ativar Minha Unidade
            </button>
          </div>

          {/* Hero Visual Mockup */}
          <div style={{ marginTop: 80, position: 'relative' }}>
            <div style={{ 
              maxWidth: 900, 
              margin: '0 auto', 
              padding: 8, 
              background: 'linear-gradient(135deg, #f8fafc, #e2e8f0)', 
              borderRadius: 32, 
              boxShadow: '0 50px 100px -20px rgba(0,0,0,0.1)',
              border: '1px solid #ffffff'
            }}>
              <div style={{ background: 'white', borderRadius: 24, overflow: 'hidden' }}>
                <img src="/landing_metallic_mockup.png" alt="NexusAI Mockup" style={{ width: '100%', display: 'block' }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features Grid ─── */}
      <section id="features" style={{ padding: '100px 20px', background: 'white' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <h2 style={{ fontSize: 12, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 4, marginBottom: 16 }}>Recursos de Elite</h2>
            <h3 style={{ fontSize: 40, fontWeight: 900, color: '#0f172a' }}>Tecnologia que Brilha</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32 }}>
            {[
              { icon: '⚡', title: 'Velocidade Cromo', desc: 'Processamento em milissegundos com a nova arquitetura Gemini 2.5 Flash.' },
              { icon: '🛡️', title: 'Segurança Prata', desc: 'Criptografia de ponta a ponta e isolamento total de seus projetos estratégicos.' },
              { icon: '💠', title: 'Multi-Agentes', desc: 'Coordene múltiplos modelos simultaneamente para fluxos de trabalho avançados.' }
            ].map((f, i) => (
              <div key={i} className="feature-card-metallic">
                <div className="feature-icon-metallic" style={{ fontSize: 32 }}>{f.icon}</div>
                <h4 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>{f.title}</h4>
                <p style={{ fontSize: 16, color: '#64748b', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      <section style={{ padding: '100px 20px', background: '#f8fafc' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 80, color: '#e2e8f0', lineHeight: 1, marginBottom: -20, fontFamily: 'serif' }}>“</div>
          <p style={{ fontSize: 28, fontWeight: 600, color: '#1e293b', fontStyle: 'italic', marginBottom: 32, lineHeight: 1.5 }}>
            "A transição para o NexusAI foi como sair de uma ferramenta rudimentar para um assistente de luxo. O design metálico não é apenas estética, é funcionalidade pura."
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #fff, #e2e8f0)', border: '2px solid white' }}></div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 800, color: '#0f172a' }}>Vagner Santos</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>CEO @ NexusAI</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer style={{ padding: '64px 20px', background: 'white', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 40 }}>
          <div style={{ maxWidth: 300 }}>
             <div className="flex items-center gap-2" style={{ marginBottom: 20 }}>
                <div className="w-8 h-8 metallic-gradient-bg rounded-lg flex items-center justify-center shadow border border-white">
                  <span style={{ fontSize: 14 }}>🧠</span>
                </div>
                <span style={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>NEXUS<span style={{ color: '#94a3b8' }}>AI</span></span>
            </div>
            <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>Elevando a produtividade humana através da inteligência artificial de elite.</p>
          </div>
          
          <div style={{ display: 'flex', gap: 64 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', marginBottom: 24 }}>Produto</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14, color: '#64748b' }}>
                <a href="#">Recursos</a>
                <a href="#">Preços</a>
                <a href="#">API</a>
              </div>
            </div>
          </div>
        </div>
        <div style={{ maxWidth: 1200, margin: '48px auto 0', paddingTop: 24, borderTop: '1px solid #f8fafc', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>© {new Date().getFullYear()} NexusAI Metallic Edition. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
