import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Mini Chat do Avatar ────────────────────────────────────
function MiniChatBubble({ initialPrompt, onClose, onSetEmotion }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (initialPrompt) {
      sendMessage(initialPrompt, true);
    } else {
      setMessages([{ role: 'assistant', content: 'Olá! Sou seu assistente virtual. Como posso ajudar?' }]);
    }
  }, [initialPrompt]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text, isHiddenPrompt = false) => {
    if (!text.trim()) return;
    
    const userMsg = { role: 'user', content: text };
    if (!isHiddenPrompt) {
      setMessages(prev => [...prev, userMsg]);
      setInput('');
    }
    
    setLoading(true);
    try {
      const token = localStorage.getItem('nexus_access_token');
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          content: text,
          messages: messages.filter(m => m.role !== 'system'),
          model: 'gemini-1.5-flash',
          provider: 'gemini'
        })
      });

      if (!res.ok) {
        if (onSetEmotion) {
          onSetEmotion('glitch');
          setTimeout(() => onSetEmotion('idle'), 1000);
        }
        throw new Error('Erro na API');
      }
      
      const data = await res.json();
      setMessages(prev => [...prev, userMsg, { role: 'assistant', content: data.reply || data.content }]);
      
      if (onSetEmotion) {
        onSetEmotion('happy');
        setTimeout(() => onSetEmotion('idle'), 1500);
      }
    } catch (err) {
      setMessages(prev => [...prev, userMsg, { role: 'assistant', content: 'Desculpe, tive um problema de conexão. Tente novamente!' }]);
      if (onSetEmotion && err.message !== 'Erro na API') {
        onSetEmotion('glitch');
        setTimeout(() => onSetEmotion('idle'), 1000);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20, filter: 'blur(10px)' }}
      animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 0.8, y: 20, filter: 'blur(10px)' }}
      className="avatar-minichat glass-panel"
      style={{
        position: 'absolute', bottom: 150, right: 0, 
        width: 320, height: 400, 
        display: 'flex', flexDirection: 'column',
        borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <header style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>💬 VSAI Assistente</h3>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.7 }}>✕</button>
      </header>
      
      <div style={{ flex: 1, minHeight: 0, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ 
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            background: m.role === 'user' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)',
            padding: '8px 12px', borderRadius: 12, fontSize: 13,
            maxWidth: '85%', wordBreak: 'break-word'
          }}>
            {m.content}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: 12, fontSize: 13 }}>
            <span className="typing-dots">Digitando...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 8 }}>
        <input 
          type="text" 
          placeholder="Pergunte algo..." 
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
          style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '8px 16px', color: '#fff', fontSize: 13, outline: 'none' }}
        />
        <button 
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          style={{ background: 'var(--accent-primary)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: (loading || !input.trim()) ? 0.5 : 1 }}
        >
          ➤
        </button>
      </div>
    </motion.div>
  );
}

// ─── Efeitos Visuais Extras ─────────────────────────────────
const ParticlesRenderer = ({ type }) => {
  if (!type || type === 'none') return null;
  const count = type === 'matrix' ? 10 : 20;
  return (
    <div className={`avatar-particles-container ${type}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`particle p-${i}`} style={{ '--i': i }}></div>
      ))}
    </div>
  );
};

// ─── Utils ──────────────────────────────────────────────────
const getAvatarStyles = (cfg) => {
  let base = {
    width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', backgroundColor: '#fff',
    transition: 'all 0.5s ease'
  };
  
  if (cfg.borderStyle === 'ouro') {
    base.border = `4px solid #fbbf24`;
    base.boxShadow = `0 0 20px #fbbf24, inset 0 0 15px #f59e0b`;
  } else if (cfg.borderStyle === 'neon') {
    base.border = `3px solid #ec4899`;
    base.boxShadow = `0 0 15px #ec4899, 0 0 30px #06b6d4, inset 0 0 20px #8b5cf6`;
  } else if (cfg.borderStyle === 'holo') {
    base.border = `4px solid transparent`;
    base.background = `linear-gradient(#fff, #fff) padding-box, linear-gradient(45deg, #ff00cc, #333399, #00ffcc) border-box`;
    base.boxShadow = `0 10px 30px rgba(0, 255, 204, 0.5)`;
    base.animation = `holoSpin 3s linear infinite`;
  } else {
    base.border = `3px solid ${cfg.bodyColor || '#8b5cf6'}`;
    base.boxShadow = `0 10px 25px ${(cfg.bodyColor || '#8b5cf6')}66, inset 0 0 10px rgba(0,0,0,0.1)`;
  }
  return base;
};

// ─── Widget Principal do Avatar ────────────────────────────
export function AvatarWidget({ profile, onUpdateProfile, onNavigate }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showStudio, setShowStudio] = useState(false);
  const [showMiniChat, setShowMiniChat] = useState(false);
  const [playMenuOpen, setPlayMenuOpen] = useState(false);
  const [miniChatContext, setMiniChatContext] = useState('');
  
  const [emotion, setEmotion] = useState('idle'); // idle, happy, glitch
  const [lookRotation, setLookRotation] = useState({ x: 0, y: 0 });
  const avatarContainerRef = useRef(null);
  
  const config = profile?.custom_avatar || { 
    bodyColor: '#8b5cf6', 
    accessory: 'none',
    borderStyle: 'default',
    particles: 'none',
    opacity: 100
  };
  
  // Lógica de Mouse Tracking Espacial
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!avatarContainerRef.current || isDragging) return;
      const rect = avatarContainerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const distanceX = e.clientX - centerX;
      const distanceY = e.clientY - centerY;
      
      const maxRotate = 25; // Limite de rotação da cabeça
      const rotY = Math.min(Math.max((distanceX / window.innerWidth) * 60, -maxRotate), maxRotate);
      const rotX = Math.min(Math.max(-(distanceY / window.innerHeight) * 60, -maxRotate), maxRotate);
      
      setLookRotation({ x: rotX, y: rotY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isDragging]);

  const handlePlayAction = (prompt) => {
    setMiniChatContext(prompt);
    setShowMiniChat(true);
    setPlayMenuOpen(false);
    setIsOpen(false);
  };

  return (
    <>
      <div 
        ref={avatarContainerRef}
        className="avatar-system-container" 
        style={{ position: 'fixed', bottom: 30, right: 30, zIndex: 9999, opacity: config.opacity / 100, transition: 'opacity 0.3s' }}
      >
        
        <AnimatePresence>
          {showMiniChat && (
            <MiniChatBubble 
              initialPrompt={miniChatContext} 
              onClose={() => { setShowMiniChat(false); setMiniChatContext(''); }} 
              onSetEmotion={setEmotion}
            />
          )}
        </AnimatePresence>

        <motion.div
          drag
          dragMomentum={false}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={() => { setIsDragging(false); setLookRotation({ x: 0, y: 0 }); }}
          className="avatar-draggable-wrapper"
          style={{ width: 140, height: 140, cursor: 'grab', position: 'relative' }}
          onClick={() => !isDragging && setIsOpen(!isOpen)}
        >
          <ParticlesRenderer type={config.particles} />

          {/* Imagem do Avatar em 3D com Física de Squish */}
          <motion.div 
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9, scaleX: 1.1, scaleY: 0.85 }}
            className={`avatar-3d-image ${isDragging ? 'dragging' : 'floating'} emotion-${emotion}`}
            style={{ perspective: 1000 }}
          >
            <div style={{
              width: '100%', height: '100%', position: 'relative',
              transform: `rotateX(${lookRotation.x}deg) rotateY(${lookRotation.y}deg)`,
              transition: 'transform 0.1s ease-out',
              transformStyle: 'preserve-3d'
            }}>
              <img 
                src="/avatar3d.png" 
                alt="VSAI Avatar" 
                style={getAvatarStyles(config)} 
              />
              {/* Acessórios */}
              {config.accessory === 'halo' && (
                <div className="avatar-halo" style={{ borderTopColor: '#fbbf24', transform: 'translateZ(20px) translateX(-50%)' }}></div>
              )}
              {config.accessory === 'crown' && (
                <div className="avatar-crown" style={{
                  position: 'absolute', top: '-25px', left: '50%', transform: 'translateZ(30px) translateX(-50%)',
                  fontSize: '2.5rem', zIndex: 10, animation: 'floatHalo 3s ease-in-out infinite alternate',
                  textShadow: '0 5px 10px rgba(0,0,0,0.5)'
                }}>👑</div>
              )}
              {config.accessory === 'glasses' && (
                <div className="avatar-cyber-glasses" style={{
                  position: 'absolute', top: '40%', left: '15%', width: '70%', height: '15%',
                  background: 'rgba(0,0,0,0.85)', border: '2px solid #0ff', borderRadius: '4px',
                  boxShadow: '0 0 10px #0ff', zIndex: 10, backdropFilter: 'blur(2px)', transform: 'translateZ(10px)'
                }}></div>
              )}
            </div>
          </motion.div>

          {/* Menu de Interação Holográfico */}
          <AnimatePresence>
            {isOpen && !playMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.8, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: 20, scale: 0.8, filter: 'blur(10px)' }}
                className="avatar-menu glass-panel"
                onClick={(e) => e.stopPropagation()}
              >
                <button onClick={() => { setShowMiniChat(true); setMiniChatContext(''); setIsOpen(false); }}>💬 Falar com IA</button>
                <button onClick={() => { setShowStudio(true); setIsOpen(false); }}>🎨 Personalizar</button>
                <button onClick={() => setPlayMenuOpen(true)}>🎮 Brincar ➜</button>
                <button onClick={() => window.open('mailto:suporte@vsai.ia')}>🎧 Suporte</button>
              </motion.div>
            )}

            {isOpen && playMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.8, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: 20, scale: 0.8, filter: 'blur(10px)' }}
                className="avatar-menu glass-panel"
                onClick={(e) => e.stopPropagation()}
              >
                <button onClick={() => setPlayMenuOpen(false)} style={{ opacity: 0.7 }}>⮐ Voltar</button>
                <button onClick={() => handlePlayAction('Conte uma piada muito engraçada, mas curta.')}>🪄 Contar Piada</button>
                <button onClick={() => handlePlayAction('Me diga uma curiosidade inútil, mas muito interessante.')}>🧠 Curiosidade</button>
                <button onClick={() => handlePlayAction('Finja que você tem uma bola de cristal e faça uma previsão engraçada e exagerada para o meu dia.')}>🔮 Previsão do Dia</button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Estúdio de Personalização */}
      <AnimatePresence>
        {showStudio && (
          <AvatarStudio 
            config={config} 
            onClose={() => setShowStudio(false)} 
            onSave={(newConfig) => {
              if (onUpdateProfile) onUpdateProfile({ ...profile, custom_avatar: newConfig });
              setShowStudio(false);
            }} 
          />
        )}
      </AnimatePresence>

      <style>{`
        .avatar-3d-image {
          width: 100%; height: 100%; position: relative; transition: transform 0.3s ease;
        }
        
        /* Respiração Inativa e Emoções */
        .avatar-3d-image.floating { animation: floatAvatar 3s ease-in-out infinite; }
        .avatar-3d-image.dragging { transform: scale(0.95); }
        
        .emotion-glitch { animation: glitchAnim 0.3s infinite !important; }
        .emotion-happy { animation: happyJump 0.5s ease-out !important; }

        .avatar-halo {
          position: absolute; top: -10px; left: 50%;
          width: 60px; height: 20px; border-radius: 50%; border: 4px solid transparent;
          border-top-color: #fbbf24; box-shadow: 0 -5px 15px rgba(251, 191, 36, 0.5);
          animation: floatHalo 3s ease-in-out infinite alternate;
        }
        
        /* Efeitos de Partículas */
        .avatar-particles-container {
          position: absolute; top: -30px; left: -30px; right: -30px; bottom: -30px;
          pointer-events: none; z-index: -1; overflow: hidden; border-radius: 50%;
        }
        .avatar-particles-container.fire .particle {
          position: absolute; bottom: 0; width: 8px; height: 8px; border-radius: 50%; opacity: 0;
          background: #f97316; box-shadow: 0 0 10px #fbbf24;
          animation: floatFire 2s infinite ease-in;
          left: calc(5% * var(--i)); animation-delay: calc(0.1s * var(--i));
        }
        .avatar-particles-container.matrix .particle {
          position: absolute; top: -10px; width: 2px; height: 20px; opacity: 0;
          background: #22c55e; box-shadow: 0 0 8px #4ade80;
          animation: fallMatrix 1.5s infinite linear;
          left: calc(5% * var(--i)); animation-delay: calc(0.2s * var(--i));
        }
        .avatar-particles-container.snow .particle {
          position: absolute; top: -10px; width: 6px; height: 6px; border-radius: 50%; opacity: 0;
          background: #fff; box-shadow: 0 0 5px #fff;
          animation: fallSnow 3s infinite linear;
          left: calc(5% * var(--i)); animation-delay: calc(0.15s * var(--i));
        }

        /* Keyframes */
        @keyframes floatFire {
          0% { transform: translateY(0) scale(1); opacity: 0.8; }
          100% { transform: translateY(-100px) scale(0); opacity: 0; }
        }
        @keyframes fallMatrix {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(180px); opacity: 0; }
        }
        @keyframes fallSnow {
          0% { transform: translate(0, 0); opacity: 0.8; }
          100% { transform: translate(20px, 150px); opacity: 0; }
        }
        @keyframes floatAvatar {
          0% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-10px) scale(1.02); } /* Respiração Sutil */
          100% { transform: translateY(0px) scale(1); }
        }
        @keyframes floatHalo {
          0% { transform: translateY(0px) rotateX(70deg); }
          100% { transform: translateY(-5px) rotateX(70deg); }
        }
        @keyframes holoSpin {
          0% { filter: hue-rotate(0deg); }
          100% { filter: hue-rotate(360deg); }
        }
        @keyframes glitchAnim {
          0% { transform: translate(0); filter: contrast(100%); }
          20% { transform: translate(-3px, 3px); filter: contrast(150%) hue-rotate(90deg); }
          40% { transform: translate(-3px, -3px); filter: contrast(100%); }
          60% { transform: translate(3px, 3px); filter: contrast(150%) hue-rotate(-90deg); }
          80% { transform: translate(3px, -3px); filter: contrast(100%); }
          100% { transform: translate(0); filter: contrast(100%); }
        }
        @keyframes happyJump {
          0% { transform: translateY(0) scale(1); }
          40% { transform: translateY(-20px) scale(1.05); }
          60% { transform: translateY(-20px) scale(1.05); }
          100% { transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}

// ─── Estúdio de Customização ────────────────────────────────
function AvatarStudio({ config, onClose, onSave }) {
  const [localConfig, setLocalConfig] = useState({
    bodyColor: config.bodyColor || '#8b5cf6',
    accessory: config.accessory || 'none',
    borderStyle: config.borderStyle || 'default',
    particles: config.particles || 'none',
    opacity: config.opacity || 100
  });

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="avatar-studio-overlay"
      style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 99999, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <motion.div 
        initial={{ y: 50, scale: 0.95 }} 
        animate={{ y: 0, scale: 1 }}
        className="avatar-studio-modal glass-panel"
        style={{ width: '90%', maxWidth: 800, maxHeight: '90vh', overflowY: 'auto' }}
      >
        <header className="studio-header" style={{ padding: 20, borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Estúdio de Criação VSAI - Fase 2 & 3</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </header>

        <div className="studio-content" style={{ display: 'flex', gap: 30, padding: 20, flexWrap: 'wrap' }}>
          <div className="studio-preview" style={{ flex: '1 1 300px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 40, minHeight: 300 }}>
             <div className="avatar-3d-image floating" style={{ width: 180, height: 180, position: 'relative' }}>
                <ParticlesRenderer type={localConfig.particles} />
                <img 
                  src="/avatar3d.png" 
                  alt="Preview" 
                  style={getAvatarStyles(localConfig)} 
                />
                {localConfig.accessory === 'halo' && <div className="avatar-halo"></div>}
                {localConfig.accessory === 'crown' && <div className="avatar-crown" style={{ position: 'absolute', top: '-25px', left: '50%', transform: 'translateX(-50%)', fontSize: '2.5rem', zIndex: 10, animation: 'floatHalo 3s ease-in-out infinite alternate', textShadow: '0 5px 10px rgba(0,0,0,0.5)' }}>👑</div>}
                {localConfig.accessory === 'glasses' && <div className="avatar-cyber-glasses" style={{ position: 'absolute', top: '40%', left: '15%', width: '70%', height: '15%', background: 'rgba(0,0,0,0.85)', border: '2px solid #0ff', borderRadius: '4px', boxShadow: '0 0 10px #0ff', zIndex: 10, backdropFilter: 'blur(2px)' }}></div>}
             </div>
          </div>

          <div className="studio-controls" style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            <div className="control-group">
              <label style={{ display: 'block', marginBottom: 10, fontWeight: 800 }}>Aura de Energia (Cor do Avatar)</label>
              <div className="color-grid" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {['#8b5cf6', '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#f472b6', '#ffffff'].map(color => (
                  <button 
                    key={color} 
                    style={{ background: color, width: 30, height: 30, borderRadius: '50%', border: localConfig.bodyColor === color ? '3px solid white' : 'none', cursor: 'pointer' }} 
                    onClick={() => setLocalConfig({ ...localConfig, bodyColor: color })}
                  />
                ))}
              </div>
            </div>

            <div className="control-group">
              <label style={{ display: 'block', marginBottom: 10, fontWeight: 800 }}>Moldura Especial de Raridade</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {['default', 'ouro', 'neon', 'holo'].map(b => (
                  <button key={b} className="btn-ghost" style={{ flex: 1, padding: 8, border: localConfig.borderStyle === b ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.1)' }} onClick={() => setLocalConfig({ ...localConfig, borderStyle: b })}>
                    {b === 'default' ? 'Comum' : b === 'ouro' ? 'Ouro' : b === 'neon' ? 'Neon' : 'Holográfica'}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-group">
              <label style={{ display: 'block', marginBottom: 10, fontWeight: 800 }}>Efeitos de Partículas</label>
              <select className="input" style={{ width: '100%' }} value={localConfig.particles} onChange={(e) => setLocalConfig({ ...localConfig, particles: e.target.value })}>
                <option value="none">Nenhuma</option>
                <option value="fire">🔥 Aura de Fogo</option>
                <option value="matrix">💻 Código Matrix</option>
                <option value="snow">❄️ Nevasca</option>
              </select>
            </div>

            <div className="control-group">
              <label style={{ display: 'block', marginBottom: 10, fontWeight: 800 }}>Acessórios</label>
              <select className="input" style={{ width: '100%' }} value={localConfig.accessory} onChange={(e) => setLocalConfig({ ...localConfig, accessory: e.target.value })}>
                <option value="none">Nenhum</option>
                <option value="halo">Auréola Divina</option>
                <option value="crown">Coroa de Rei</option>
                <option value="glasses">Óculos Cyberpunk</option>
              </select>
            </div>

            <div className="control-group">
              <label style={{ display: 'block', marginBottom: 10, fontWeight: 800 }}>Presença (Opacidade: {localConfig.opacity}%)</label>
              <input type="range" min="20" max="100" value={localConfig.opacity} onChange={(e) => setLocalConfig({ ...localConfig, opacity: Number(e.target.value) })} style={{ width: '100%' }} />
            </div>

            <button className="btn btn-primary" style={{ width: '100%', padding: 15, cursor: 'pointer', marginTop: 10 }} onClick={() => onSave(localConfig)}>
              Salvar Identidade Visual
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
