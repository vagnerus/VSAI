import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Motores Sensoriais (Áudio e Fala) ──────────────────────
const AudioFX = {
  ctx: null,
  enabled: true,
  init() {
    if (!this.enabled) return;
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },
  playTone(freq, type, duration, vol = 0.1) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  },
  pop() { this.init(); this.playTone(600, 'sine', 0.1, 0.15); setTimeout(() => this.playTone(800, 'sine', 0.1, 0.1), 50); },
  success() { this.init(); this.playTone(800, 'sine', 0.1, 0.1); setTimeout(() => this.playTone(1200, 'sine', 0.2, 0.1), 100); },
  error() { this.init(); this.playTone(150, 'sawtooth', 0.2, 0.2); setTimeout(() => this.playTone(100, 'sawtooth', 0.3, 0.2), 150); },
  warning() { this.init(); this.playTone(400, 'square', 0.1, 0.1); setTimeout(() => this.playTone(300, 'square', 0.2, 0.1), 150); },
  levelUp() { this.init(); this.playTone(523.25, 'triangle', 0.15, 0.2); setTimeout(() => this.playTone(783.99, 'triangle', 0.6, 0.3), 450); }
};

const speakText = (text) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const cleanText = text.replace(/[*`_#\[\]]/g, '');
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'pt-BR'; utterance.rate = 1.1;
  window.speechSynthesis.speak(utterance);
};

// ─── Lógica de Nível RPG ────────────────────────────────────
const getAvatarRank = (xp) => {
  const level = Math.floor((xp || 0) / 100) + 1;
  if (level < 5) return { title: 'IA Aprendiz', level, color: '#6ee7b7' };
  if (level < 10) return { title: 'IA Sábia', level, color: '#3b82f6' };
  return { title: 'Entidade Oráculo', level, color: '#f59e0b' };
};

// ─── Estilos de Alto Contraste e Legibilidade ───────────────
const UI_THEME = {
  bgPanel: 'rgba(15, 17, 26, 0.98)',
  border: 'rgba(255, 255, 255, 0.15)',
  textPrimary: '#ffffff',
  textSecondary: '#d1d5db',
  accent: '#8b5cf6',
  glass: 'backdrop-filter: blur(24px);'
};

// ─── Parser Markdown e Gráficos ─────────────────────────────
const MarkdownRenderer = ({ content, isTyping }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    if (!isTyping) { setDisplayedText(content); return; }
    let i = 0;
    const interval = setInterval(() => {
      setDisplayedText(content.substring(0, i)); i += 3;
      if (i > content.length) { setDisplayedText(content); clearInterval(interval); }
    }, 15);
    return () => clearInterval(interval);
  }, [content, isTyping]);

  const regexGraph = /\[BAR_CHART:(.*?)\]/;
  const parts = displayedText.split(/```/);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '14px', color: UI_THEME.textPrimary }}>
      {parts.map((part, index) => {
        if (index % 2 === 1) {
          const lines = part.split('\n'); const code = lines.slice(1).join('\n');
          return (
            <div key={index} style={{ background: '#0a0a0f', borderRadius: 8, padding: 12, position: 'relative', border: '1px solid #333' }}>
              <button 
                title="Copiar" onClick={() => { navigator.clipboard.writeText(code); AudioFX.pop(); }}
                style={{ position: 'absolute', top: 6, right: 6, background: UI_THEME.accent, border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer', borderRadius: 4, padding: '4px 8px' }}
              >Copiar</button>
              <pre style={{ margin: 0, overflowX: 'auto', fontSize: 12, color: '#a78bfa', marginTop: 20, fontFamily: 'monospace' }}><code>{code}</code></pre>
            </div>
          );
        }

        const textAndGraphs = part.split(regexGraph);
        return (
          <div key={index} style={{ lineHeight: 1.6 }}>
            {textAndGraphs.map((subpart, j) => {
              if (j % 2 === 1) {
                const items = subpart.split(',').map(item => {
                  const [label, val] = item.split('|'); return { label, value: Number(val) };
                }).filter(i => !isNaN(i.value));
                const maxVal = Math.max(...items.map(i => i.value), 1);
                return (
                  <div key={j} style={{ background: 'rgba(0,0,0,0.4)', padding: 16, borderRadius: 12, margin: '12px 0', border: `1px solid ${UI_THEME.accent}44` }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: 13, color: '#0ff', fontWeight: 700 }}>📊 ANÁLISE DE DADOS</h4>
                    {items.map((item, k) => (
                      <div key={k} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                          <span style={{ fontWeight: 600 }}>{item.label}</span>
                          <span style={{ color: UI_THEME.accent, fontWeight: 800 }}>{item.value}</span>
                        </div>
                        <div style={{ width: '100%', background: 'rgba(255,255,255,0.1)', height: 10, borderRadius: 5, overflow: 'hidden' }}>
                          <motion.div initial={{ width: 0 }} animate={{ width: `${(item.value/maxVal)*100}%` }} style={{ background: `linear-gradient(90deg, ${UI_THEME.accent}, #0ff)`, height: '100%' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }
              return subpart.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g).map((t, k) => {
                if (t.startsWith('**') && t.endsWith('**')) return <strong key={k} style={{ color: '#fff', fontWeight: 800 }}>{t.slice(2, -2)}</strong>;
                if (t.startsWith('*') && t.endsWith('*')) return <em key={k} style={{ color: '#eee' }}>{t.slice(1, -1)}</em>;
                if (t.startsWith('`') && t.endsWith('`')) return <code key={k} style={{ background: '#000', padding: '2px 6px', borderRadius: 4, fontSize: '0.95em', border: '1px solid #333' }}>{t.slice(1, -1)}</code>;
                return <span key={k}>{t}</span>;
              });
            })}
          </div>
        );
      })}
    </div>
  );
};

// ─── Mini Chat do Avatar ────────────────────────────────────
function MiniChatBubble({ onClose, onSetEmotion, pageContext, soundEnabled, profile, avatarName, avatarXP, onEarnXP }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const hour = new Date().getHours();
    let greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    const userName = profile?.full_name ? profile.full_name.split(' ')[0] : 'visitante';
    setMessages([{ role: 'assistant', content: `${greeting}, **${userName}**! Sou ${avatarName}. Como posso turbinar seu dia hoje?` }]);
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const sendMessage = async (text) => {
    const txt = text.trim(); if (!txt) return;
    if (txt === '/limpar') { setMessages([{ role: 'assistant', content: 'Memória visual limpa.' }]); setInput(''); AudioFX.pop(); return; }
    
    if (txt.startsWith('/lembrar ')) {
      const note = txt.substring(9);
      const existing = JSON.parse(localStorage.getItem('avatar_notes') || '[]'); existing.push(note);
      localStorage.setItem('avatar_notes', JSON.stringify(existing));
      setMessages(prev => [...prev, { role: 'user', content: txt }, { role: 'assistant', content: `Lembrete salvo: **${note}**` }]);
      setInput(''); onEarnXP(10); return;
    }

    if (txt === '/notas') {
      const existing = JSON.parse(localStorage.getItem('avatar_notes') || '[]');
      setMessages(prev => [...prev, { role: 'user', content: txt }, { role: 'assistant', content: existing.length ? `Notas:\n${existing.map((n, i) => `${i+1}. ${n}`).join('\n')}` : 'Sem notas.' }]);
      setInput(''); onEarnXP(5); return;
    }

    const userMsg = { role: 'user', content: txt };
    setMessages(prev => [...prev, userMsg]); setInput(''); setLoading(true);

    try {
      const token = localStorage.getItem('nexus_access_token');
      const savedNotes = JSON.parse(localStorage.getItem('avatar_notes') || '[]');
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          content: txt, messages: messages.map(m => ({ role: m.role, content: m.content })),
          customInstructions: `Seu nome é ${avatarName}. Contexto: "${pageContext}". Use [BAR_CHART:A|10,B|20] para dados. Memórias: ${savedNotes.join('; ')}`
        })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || data.content, isNew: true }]);
      AudioFX.success(); onEarnXP(10);
    } catch (err) {
      AudioFX.error(); onSetEmotion('glitch'); setTimeout(() => onSetEmotion('idle'), 1000);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro de conexão.', isNew: true }]);
    } finally { setLoading(false); }
  };

  const rank = getAvatarRank(avatarXP);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 30 }}
      className="avatar-minichat"
      style={{ position: 'absolute', bottom: 150, right: 0, width: 360, height: 480, display: 'flex', flexDirection: 'column', borderRadius: 20, overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.7)', border: `1px solid ${UI_THEME.border}`, background: UI_THEME.bgPanel, backdropFilter: 'blur(20px)' }}
      onClick={(e) => e.stopPropagation()}
    >
      <header style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${UI_THEME.border}` }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>💬 {avatarName}</h3>
          <span style={{ fontSize: 11, color: rank.color, fontWeight: 600 }}>{rank.title} • Nível {rank.level}</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 18 }}>✕</button>
      </header>
      
      <div style={{ flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ 
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            background: m.role === 'user' ? UI_THEME.accent : 'rgba(255,255,255,0.06)',
            padding: '12px 16px', borderRadius: 16, border: m.role === 'user' ? 'none' : `1px solid ${UI_THEME.border}`,
            maxWidth: '85%', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', color: UI_THEME.textPrimary
          }}>
            <MarkdownRenderer content={m.content} isTyping={m.isNew} />
            {m.role === 'assistant' && <button title="Ouvir" onClick={() => speakText(m.content)} style={{ display: 'block', marginTop: 10, background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 11 }}>🔊 OUVIR RESPOSTA</button>}
          </div>
        ))}
        {loading && <div style={{ color: UI_THEME.accent, fontSize: 13, fontWeight: 700 }}>PROCESSANDO...</div>}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: 15, background: 'rgba(0,0,0,0.2)', borderTop: `1px solid ${UI_THEME.border}`, display: 'flex', gap: 10 }}>
        <input 
          type="text" placeholder="Fale comigo..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
          style={{ flex: 1, background: '#0a0a0f', border: `1px solid ${UI_THEME.border}`, borderRadius: 25, padding: '12px 20px', color: '#fff', fontSize: 14, outline: 'none' }}
        />
        <button 
          onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
          style={{ background: UI_THEME.accent, border: 'none', borderRadius: '50%', width: 45, height: 45, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >➤</button>
      </div>
    </motion.div>
  );
}

// ─── Efeitos Visuais Avançados (Fase 9) ──────────────────────
const ParticlesRenderer = ({ type }) => {
  if (!type || type === 'none') return null;
  return (
    <div className={`avatar-particles-container ${type}`}>
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={i} className="particle" style={{ '--i': i, '--delay': `${i * 0.2}s`, '--x': `${Math.random() * 100}%` }}></div>
      ))}
    </div>
  );
};

const getAvatarStyles = (cfg) => {
  let base = { width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', transition: 'all 0.5s ease', background: '#fff' };
  if (cfg.borderStyle === 'ouro') base.boxShadow = '0 0 30px #fbbf24';
  if (cfg.borderStyle === 'neon') base.boxShadow = '0 0 30px #ec4899';
  if (cfg.borderStyle === 'plasma') base.animation = 'plasmaSpin 2s linear infinite';
  return base;
};

// ─── Widget Principal ───────────────────────────────────────
export function AvatarWidget({ profile, onUpdateProfile, currentPage }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAsleep, setIsAsleep] = useState(false);
  const [showStudio, setShowStudio] = useState(false);
  const [showMiniChat, setShowMiniChat] = useState(false);
  const [emotion, setEmotion] = useState('idle');
  const [lookRotation, setLookRotation] = useState({ x: 0, y: 0 });
  const [floatingXPs, setFloatingXPs] = useState([]);
  const containerRef = useRef(null);
  const sleepTimer = useRef(null);

  const config = profile?.custom_avatar || { 
    bodyColor: '#8b5cf6', accessory: 'none', borderStyle: 'default', particles: 'none', opacity: 100, soundEnabled: true, avatarName: 'VSAI Assistente', avatarXP: 0 
  };

  useEffect(() => {
    const handleMove = (e) => {
      if (isAsleep) setIsAsleep(false);
      clearTimeout(sleepTimer.current);
      sleepTimer.current = setTimeout(() => setIsAsleep(true), 60000);
      
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - (rect.left + rect.width / 2)) / 10;
      const y = (e.clientY - (rect.top + rect.height / 2)) / 10;
      setLookRotation({ x: -y, y: x });
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, [isAsleep]);

  const onEarnXP = (amt) => {
    const newXP = (config.avatarXP || 0) + amt;
    if (Math.floor(newXP/100) > Math.floor((config.avatarXP||0)/100)) AudioFX.levelUp();
    setFloatingXPs(prev => [...prev, { id: Date.now(), amt }]);
    onUpdateProfile({ ...profile, custom_avatar: { ...config, avatarXP: newXP } });
  };

  return (
    <div ref={containerRef} style={{ position: 'fixed', bottom: 30, right: 30, zIndex: 9999, opacity: config.opacity / 100 }}>
      <AnimatePresence>
        {showMiniChat && <MiniChatBubble onClose={() => setShowMiniChat(false)} onSetEmotion={setEmotion} pageContext={currentPage} soundEnabled={config.soundEnabled} profile={profile} avatarName={config.avatarName} avatarXP={config.avatarXP} onEarnXP={onEarnXP} />}
      </AnimatePresence>

      {/* Fase 9: Base Holográfica */}
      <div className="hologram-base" style={{ position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)', width: 100, height: 20, background: 'radial-gradient(ellipse at center, rgba(0,255,255,0.5) 0%, transparent 70%)', borderRadius: '50%', zIndex: -1 }}>
        <div className="hologram-beam" style={{ position: 'absolute', bottom: 10, left: '10%', width: '80%', height: 120, background: 'linear-gradient(to top, rgba(0,255,255,0.2), transparent)', clipPath: 'polygon(20% 100%, 80% 100%, 100% 0, 0 0)', opacity: showMiniChat || isOpen ? 1 : 0, transition: '0.5s' }}></div>
      </div>

      <motion.div 
        drag dragMomentum={false} 
        style={{ width: 140, height: 140, cursor: 'grab', position: 'relative' }}
        onClick={() => { AudioFX.init(); if (isAsleep) setIsAsleep(false); setIsOpen(!isOpen); AudioFX.pop(); }}
      >
        <AnimatePresence>
          {floatingXPs.map(x => (
            <motion.div key={x.id} initial={{ y: 0, opacity: 1 }} animate={{ y: -60, opacity: 0 }} onAnimationComplete={() => setFloatingXPs(p => p.filter(i => i.id !== x.id))} style={{ position: 'absolute', width: '100%', textAlign: 'center', color: '#4ade80', fontWeight: 900 }}>+{x.amt} XP</motion.div>
          ))}
        </AnimatePresence>

        <ParticlesRenderer type={config.particles} />

        <motion.div 
          className={`avatar-3d ${isAsleep ? 'sleep' : emotion}`}
          animate={{ rotateX: lookRotation.x, rotateY: lookRotation.y, y: isAsleep ? 30 : 0 }}
          whileTap={{ scale: 0.8, scaleX: 1.2 }}
          style={{ width: '100%', height: '100%', transformStyle: 'preserve-3d' }}
        >
          <img src="/avatar3d.png" style={getAvatarStyles(config)} alt="Avatar" />
          {/* Fase 9: Luz Dinâmica Overlay */}
          <div className="dynamic-light" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: '50%', background: `radial-gradient(circle at ${50 + lookRotation.y}% ${50 - lookRotation.x}%, rgba(255,255,255,0.4) 0%, transparent 60%)`, pointerEvents: 'none' }}></div>
        </motion.div>

        <AnimatePresence>
          {isOpen && (
            <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="avatar-quick-menu">
              <button onClick={() => { setShowMiniChat(true); setIsOpen(false); }}>💬 CHAT</button>
              <button onClick={() => { setShowStudio(true); setIsOpen(false); }}>🎨 EDITAR</button>
              <button onClick={() => { window.open('mailto:suporte@vsai.ia'); }}>🎧 SUPORTE</button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {showStudio && <AvatarStudio config={config} onClose={() => setShowStudio(false)} onSave={(c) => { onUpdateProfile({ ...profile, custom_avatar: c }); setShowStudio(false); AudioFX.success(); }} />}
      </AnimatePresence>

      <style>{`
        .avatar-3d { transition: transform 0.1s ease-out; position: relative; }
        .avatar-3d.floating { animation: bob 3s ease-in-out infinite; }
        .avatar-3d.sleep { opacity: 0.4; filter: grayscale(1); }
        .avatar-3d.glitch { animation: shatter 0.2s infinite; }
        
        .avatar-quick-menu { position: absolute; bottom: 150; right: 0; display: flex; flex-direction: column; gap: 8px; width: 120px; }
        .avatar-quick-menu button { background: ${UI_THEME.bgPanel}; border: 1px solid ${UI_THEME.border}; color: #fff; padding: 12px; border-radius: 12px; font-weight: 700; cursor: pointer; backdrop-filter: blur(10px); font-size: 11px; }
        .avatar-quick-menu button:hover { background: ${UI_THEME.accent}; }

        .avatar-particles-container { position: absolute; width: 100%; height: 100%; transform-style: preserve-3d; }
        .particle { position: absolute; width: 6px; height: 6px; background: #fff; border-radius: 50%; animation: orbit 4s linear infinite; animation-delay: var(--delay); left: var(--x); }
        .fire .particle { background: #f97316; box-shadow: 0 0 10px #fbbf24; }
        
        @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes orbit { 0% { transform: rotateY(0deg) translateZ(80px) rotateY(0deg); opacity: 0; } 50% { opacity: 1; } 100% { transform: rotateY(360deg) translateZ(80px) rotateY(-360deg); opacity: 0; } }
        @keyframes plasmaSpin { 0% { border: 4px solid #f00; } 33% { border: 4px solid #0f0; } 66% { border: 4px solid #00f; } 100% { border: 4px solid #f00; } }
        @keyframes shatter { 0% { clip-path: inset(0 0 0 0); } 50% { clip-path: polygon(0 0, 100% 0, 80% 50%, 100% 100%, 0 100%, 20% 50%); } 100% { clip-path: inset(0 0 0 0); } }
      `}</style>
    </div>
  );
}

// ─── Estúdio de Customização ────────────────────────────────
function AvatarStudio({ config, onClose, onSave }) {
  const [local, setLocal] = useState({ ...config });
  const [tab, setTab] = useState('look');
  const rank = getAvatarRank(local.avatarXP);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <motion.div initial={{ y: 50 }} animate={{ y: 0 }} style={{ background: UI_THEME.bgPanel, width: '100%', maxWidth: 800, borderRadius: 24, border: `1px solid ${UI_THEME.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <header style={{ padding: 25, borderBottom: `1px solid ${UI_THEME.border}`, display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 20 }}>
            <button onClick={() => setTab('look')} style={{ background: 'none', border: 'none', color: tab === 'look' ? UI_THEME.accent : '#555', fontWeight: 800, cursor: 'pointer', fontSize: 16 }}>ESTILO</button>
            <button onClick={() => setTab('rpg')} style={{ background: 'none', border: 'none', color: tab === 'rpg' ? UI_THEME.accent : '#555', fontWeight: 800, cursor: 'pointer', fontSize: 16 }}>EVOLUÇÃO</button>
          </div>
          <button onClick={onClose} style={{ color: '#fff', background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}>✕</button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: 30, display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 40 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 160, height: 160, position: 'relative' }}>
              <img src="/avatar3d.png" style={getAvatarStyles(local)} alt="Preview" />
              <div className="dynamic-light" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent)' }}></div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ color: rank.color, fontWeight: 900, fontSize: 10, letterSpacing: 2 }}>{rank.title}</span>
              <h3 style={{ margin: '5px 0', fontSize: 22 }}>Nível {rank.level}</h3>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 25 }}>
            {tab === 'look' ? (
              <>
                <div>
                  <label style={{ color: '#888', fontSize: 11, fontWeight: 800, display: 'block', marginBottom: 10 }}>NOME DA IA</label>
                  <input type="text" value={local.avatarName} onChange={e => setLocal({...local, avatarName: e.target.value})} style={{ width: '100%', background: '#0a0a0f', border: `1px solid ${UI_THEME.border}`, padding: 12, borderRadius: 10, color: '#fff' }} />
                </div>
                <div>
                  <label style={{ color: '#888', fontSize: 11, fontWeight: 800, display: 'block', marginBottom: 10 }}>MOLDURA ESPECIAL</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {['default', 'ouro', 'neon', 'holo', 'plasma'].map(b => (
                      <button key={b} onClick={() => setLocal({...local, borderStyle: b})} style={{ flex: 1, padding: 10, borderRadius: 8, background: local.borderStyle === b ? UI_THEME.accent : '#0a0a0f', border: `1px solid ${UI_THEME.border}`, color: '#fff', fontSize: 10, fontWeight: 800 }}>{b.toUpperCase()}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ color: '#888', fontSize: 11, fontWeight: 800, display: 'block', marginBottom: 10 }}>PARTÍCULAS</label>
                  <select value={local.particles} onChange={e => setLocal({...local, particles: e.target.value})} style={{ width: '100%', background: '#0a0a0f', border: `1px solid ${UI_THEME.border}`, padding: 12, borderRadius: 10, color: '#fff' }}>
                    <option value="none">NENHUMA</option>
                    <option value="fire">FOGO</option>
                    <option value="matrix">MATRIX</option>
                  </select>
                </div>
              </>
            ) : (
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 20, borderRadius: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontWeight: 800, fontSize: 12 }}>PROGRESSO XP</span>
                  <span style={{ color: UI_THEME.accent, fontWeight: 900 }}>{local.avatarXP} pts</span>
                </div>
                <div style={{ width: '100%', height: 12, background: '#000', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${local.avatarXP % 100}%`, height: '100%', background: UI_THEME.accent }}></div>
                </div>
                <p style={{ fontSize: 11, color: '#555', marginTop: 15 }}>Converse com a IA para evoluir!</p>
              </div>
            )}
            <button onClick={() => onSave(local)} style={{ width: '100%', padding: 16, background: UI_THEME.accent, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 900, cursor: 'pointer', marginTop: 'auto' }}>SALVAR ALTERAÇÕES</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
