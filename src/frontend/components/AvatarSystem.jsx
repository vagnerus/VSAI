import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Motores Sensoriais ──────────────────────────────────────
const AudioFX = {
  ctx: null,
  enabled: true,
  init() {
    if (!this.enabled) return;
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },
  playTone(freq, type, duration, vol = 0.1) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(); osc.stop(this.ctx.currentTime + duration);
  },
  pop() { this.init(); this.playTone(600, 'sine', 0.1, 0.15); },
  success() { this.init(); this.playTone(800, 'sine', 0.1, 0.1); setTimeout(() => this.playTone(1200, 'sine', 0.2, 0.1), 100); },
  error() { this.init(); this.playTone(150, 'sawtooth', 0.2, 0.2); },
  levelUp() { 
    this.init(); [523, 659, 783, 1046].forEach((f, i) => setTimeout(() => this.playTone(f, 'triangle', 0.2, 0.2), i * 100)); 
  }
};

const speakText = (text) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.replace(/[*`_#\[\]]/g, ''));
  utterance.lang = 'pt-BR'; utterance.rate = 1.1; window.speechSynthesis.speak(utterance);
};

// ─── Lógica de Nível RPG ────────────────────────────────────
const getAvatarRank = (xp) => {
  const level = Math.floor((xp || 0) / 100) + 1;
  if (level < 5) return { title: 'IA Aprendiz', level, color: '#6ee7b7' };
  if (level < 10) return { title: 'IA Sábia', level, color: '#3b82f6' };
  return { title: 'Entidade Oráculo', level, color: '#f59e0b' };
};

const UI_THEME = {
  bgPanel: 'rgba(10, 12, 18, 0.98)',
  border: 'rgba(255, 255, 255, 0.15)',
  textPrimary: '#ffffff',
  accent: '#8b5cf6'
};

// ─── Parser Markdown ────────────────────────────────────────
const MarkdownRenderer = ({ content, isTyping }) => {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    if (!isTyping) { setDisplayed(content); return; }
    let i = 0; const interval = setInterval(() => {
      setDisplayed(content.substring(0, i)); i += 4;
      if (i > content.length) { setDisplayed(content); clearInterval(interval); }
    }, 15);
    return () => clearInterval(interval);
  }, [content, isTyping]);

  const parts = displayed.split(/```/);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '14px', lineHeight: 1.6 }}>
      {parts.map((part, index) => {
        if (index % 2 === 1) {
          const lines = part.split('\n');
          return (
            <div key={index} style={{ background: '#000', borderRadius: 10, padding: 12, border: '1px solid #333', margin: '5px 0' }}>
              <pre style={{ margin: 0, overflowX: 'auto', fontSize: 12, color: '#a78bfa', fontFamily: 'monospace' }}><code>{lines.slice(1).join('\n')}</code></pre>
            </div>
          );
        }
        return <div key={index}>{part.split(/(\*\*.*?\*\*|`.*?`)/g).map((t, k) => {
          if (t.startsWith('**')) return <strong key={k} style={{ color: '#fff' }}>{t.slice(2, -2)}</strong>;
          if (t.startsWith('`')) return <code key={k} style={{ background: '#222', padding: '2px 5px', borderRadius: 4 }}>{t.slice(1, -1)}</code>;
          return <span key={k}>{t}</span>;
        })}</div>;
      })}
    </div>
  );
};

// ─── Mini Chat ──────────────────────────────────────────────
function MiniChatBubble({ onClose, onSetEmotion, pageContext, profile, config, onUpdateConfig, onEarnXP }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    const name = profile?.full_name?.split(' ')[0] || 'visitante';
    setMessages([{ role: 'assistant', content: `${greet}, **${name}**! Sou ${config.avatarName}. Digite \`/ajuda\` para ver meus comandos.` }]);
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const sendMessage = async (text) => {
    const txt = text.trim(); if (!txt) return;
    
    if (txt === '/matrix') {
      onUpdateConfig({ ...config, particles: 'matrix', bodyColor: '#00ff00', borderStyle: 'neon' });
      setMessages(p => [...p, { role: 'user', content: txt }, { role: 'assistant', content: 'Protocolo Matrix Ativado.' }]);
      setInput(''); AudioFX.success(); return;
    }
    if (txt === '/festa') {
      onSetEmotion('happy'); onEarnXP(5);
      setMessages(p => [...p, { role: 'user', content: txt }, { role: 'assistant', content: '🎉 HORA DE COMEMORAR!' }]);
      setInput(''); AudioFX.levelUp(); return;
    }
    if (txt === '/ajuda') {
      setMessages(p => [...p, { role: 'user', content: txt }, { role: 'assistant', content: 'Comandos:\n- `/matrix`\n- `/festa`\n- `/lembrar [texto]`\n- `/notas`\n- `/limpar`' }]);
      setInput(''); return;
    }

    if (txt.startsWith('/lembrar ')) {
      const note = txt.substring(9);
      const newNotes = [...(config.avatarNotes || []), note];
      onUpdateConfig({ ...config, avatarNotes: newNotes });
      setMessages(p => [...p, { role: 'user', content: txt }, { role: 'assistant', content: 'Nota salva na nuvem! ☁️' }]);
      setInput(''); onEarnXP(10); return;
    }

    if (txt === '/notas') {
      const notes = config.avatarNotes || [];
      setMessages(p => [...p, { role: 'user', content: txt }, { role: 'assistant', content: notes.length ? `Notas:\n${notes.map((n, i) => `${i+1}. ${n}`).join('\n')}` : 'Sem notas.' }]);
      setInput(''); onEarnXP(5); return;
    }

    setMessages(p => [...p, { role: 'user', content: txt }]); setInput(''); setLoading(true);
    try {
      const token = localStorage.getItem('nexus_access_token');
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          content: txt, messages: messages.map(m => ({ role: m.role, content: m.content })),
          customInstructions: `Seu nome é ${config.avatarName}. Contexto: "${pageContext}". Memórias: ${(config.avatarNotes||[]).join('; ')}`
        })
      });
      const data = await res.json();
      setMessages(p => [...p, { role: 'assistant', content: data.reply || data.content, isNew: true }]);
      onEarnXP(10); onSetEmotion('happy'); setTimeout(() => onSetEmotion('idle'), 2000);
    } catch (err) {
      AudioFX.error(); onSetEmotion('glitch');
      setMessages(p => [...p, { role: 'assistant', content: 'Falha neural.' }]);
    } finally { setLoading(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 30 }}
      style={{ position: 'absolute', bottom: 160, right: 0, width: 360, height: 500, display: 'flex', flexDirection: 'column', borderRadius: 24, overflow: 'hidden', boxShadow: '0 30px 70px rgba(0,0,0,0.8)', border: `1px solid ${UI_THEME.border}`, background: UI_THEME.bgPanel, backdropFilter: 'blur(30px)', zIndex: 10000 }}
      onClick={e => e.stopPropagation()}
    >
      <header style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${UI_THEME.border}` }}>
        <div><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>💬 {config.avatarName}</h3><span style={{ fontSize: 11, color: loading ? UI_THEME.accent : '#888' }}>{loading ? 'ANALISANDO...' : 'SISTEMA ONLINE'}</span></div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 20 }}>✕</button>
      </header>
      <div style={{ flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 15 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', background: m.role === 'user' ? UI_THEME.accent : 'rgba(255,255,255,0.06)', padding: '12px 18px', borderRadius: 18, maxWidth: '85%', color: '#fff', border: m.role === 'user' ? 'none' : `1px solid ${UI_THEME.border}` }}>
            <MarkdownRenderer content={m.content} isTyping={m.isNew} />
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div style={{ padding: 15, background: 'rgba(0,0,0,0.3)', borderTop: `1px solid ${UI_THEME.border}`, display: 'flex', gap: 10 }}>
        <input type="text" placeholder="Fale comigo..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage(input)} style={{ flex: 1, background: '#000', border: `1px solid ${UI_THEME.border}`, borderRadius: 25, padding: '12px 20px', color: '#fff', fontSize: 14, outline: 'none' }} />
        <button onClick={() => sendMessage(input)} style={{ background: UI_THEME.accent, border: 'none', borderRadius: '50%', width: 45, height: 45, cursor: 'pointer', color: '#fff' }}>➤</button>
      </div>
    </motion.div>
  );
}

// ─── Estúdio ────────────────────────────────────────────────
function AvatarStudio({ config, onClose, onSave }) {
  const [local, setLocal] = useState({ ...config });
  const [tab, setTab] = useState('look');
  const rank = getAvatarRank(local.avatarXP);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100001, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }} onClick={e => e.stopPropagation()}>
      <motion.div initial={{ y: 100 }} animate={{ y: 0 }} style={{ background: UI_THEME.bgPanel, width: '90%', maxWidth: 850, borderRadius: 32, border: `1px solid ${UI_THEME.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ padding: '30px 40px', borderBottom: `1px solid ${UI_THEME.border}`, display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 30 }}>
            <button onClick={() => setTab('look')} style={{ background: 'none', border: 'none', color: tab === 'look' ? UI_THEME.accent : '#555', fontWeight: 800, cursor: 'pointer', fontSize: 18 }}>ESTÉTICA</button>
            <button onClick={() => setTab('rpg')} style={{ background: 'none', border: 'none', color: tab === 'rpg' ? UI_THEME.accent : '#555', fontWeight: 800, cursor: 'pointer', fontSize: 18 }}>PROGRESSO</button>
          </div>
          <button onClick={onClose} style={{ color: '#fff', background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}>✕</button>
        </header>
        <div style={{ padding: 40, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 50 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30 }}>
            <div style={{ width: 180, height: 180, position: 'relative' }}>
              <img src="/avatar3d.png" style={{ width: '100%', height: '100%', borderRadius: '50%', border: `4px solid ${local.bodyColor}` }} alt="Preview" />
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent)' }}></div>
            </div>
            <div style={{ textAlign: 'center' }}><span style={{ color: rank.color, fontWeight: 900, fontSize: 12, letterSpacing: 3 }}>{rank.title}</span><h3 style={{ margin: '10px 0', fontSize: 28, color: '#fff' }}>Nível {rank.level}</h3></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 25 }}>
            {tab === 'look' ? (
              <>
                <div className="field"><label>NOME DA IA</label><input type="text" value={local.avatarName} onChange={e => setLocal({...local, avatarName: e.target.value})} /></div>
                <div className="field"><label>ESTILO</label><select value={local.borderStyle} onChange={e => setLocal({...local, borderStyle: e.target.value})}><option value="default">PADRÃO</option><option value="ouro">OURO</option><option value="neon">NEON</option><option value="plasma">PLASMA (LVL 5)</option></select></div>
                <div className="field"><label>AURA</label><select value={local.particles} onChange={e => setLocal({...local, particles: e.target.value})}><option value="none">NENHUMA</option><option value="fire">FOGO</option><option value="matrix">MATRIX</option></select></div>
              </>
            ) : (
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 30, borderRadius: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 15, color: '#fff' }}><span style={{ fontWeight: 800 }}>PONTOS DE XP</span><span style={{ color: UI_THEME.accent }}>{local.avatarXP}</span></div>
                <div style={{ width: '100%', height: 16, background: '#000', borderRadius: 8, overflow: 'hidden' }}><div style={{ width: `${local.avatarXP % 100}%`, height: '100%', background: UI_THEME.accent }}></div></div>
              </div>
            )}
            <button className="save-btn" onClick={() => onSave(local)}>SALVAR E FECHAR</button>
          </div>
        </div>
      </motion.div>
      <style>{`
        .field label { color: #888; font-size: 11px; font-weight: 800; display: block; margin-bottom: 8px; letter-spacing: 1px; }
        .field input, .field select { width: 100%; background: #0a0a0f; border: 1px solid ${UI_THEME.border}; padding: 12px; border-radius: 12px; color: #fff; }
        .save-btn { width: 100%; padding: 18px; background: ${UI_THEME.accent}; color: #fff; border: none; border-radius: 15px; font-weight: 900; cursor: pointer; }
      `}</style>
    </div>
  );
}

// ─── Widget Principal ───────────────────────────────────────
export function AvatarWidget({ profile, onUpdateProfile, currentPage }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showMiniChat, setShowMiniChat] = useState(false);
  const [showStudio, setShowStudio] = useState(false);
  const [emotion, setEmotion] = useState('idle');
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [isAsleep, setIsAsleep] = useState(false);
  const [floatingXP, setFloatingXP] = useState([]);
  const containerRef = useRef(null); const sleepTimer = useRef(null);

  const config = profile?.custom_avatar || { 
    bodyColor: '#8b5cf6', avatarName: 'VSAI Assistente', avatarXP: 0, avatarNotes: [], particles: 'none', borderStyle: 'default', opacity: 100, soundEnabled: true
  };

  useEffect(() => {
    const move = (e) => {
      if (isAsleep) setIsAsleep(false); clearTimeout(sleepTimer.current);
      sleepTimer.current = setTimeout(() => setIsAsleep(true), 60000);
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - (rect.left + 70)) / 10;
      const y = (e.clientY - (rect.top + 70)) / 10;
      setLook({ x: -y, y: x });
    };
    window.addEventListener('mousemove', move); return () => window.removeEventListener('mousemove', move);
  }, [isAsleep]);

  const onEarnXP = (amt) => {
    const newXP = (config.avatarXP || 0) + amt;
    if (Math.floor(newXP/100) > Math.floor((config.avatarXP||0)/100)) AudioFX.levelUp();
    setFloatingXP(p => [...p, { id: Date.now(), amt }]);
    onUpdateProfile({ ...profile, custom_avatar: { ...config, avatarXP: newXP } });
  };

  return (
    <>
      <AnimatePresence>
        {showMiniChat && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9998, pointerEvents: 'none' }} />}
      </AnimatePresence>

      <div ref={containerRef} style={{ position: 'fixed', bottom: 30, right: 30, zIndex: 9999, opacity: (config.opacity || 100) / 100 }}>
        <AnimatePresence>
          {showMiniChat && <MiniChatBubble onClose={() => setShowMiniChat(false)} onSetEmotion={setEmotion} pageContext={currentPage} profile={profile} config={config} onUpdateConfig={c => onUpdateProfile({...profile, custom_avatar: c})} onEarnXP={onEarnXP} />}
        </AnimatePresence>

        <div className="hologram-plate" style={{ position: 'absolute', bottom: -15, left: '50%', transform: 'translateX(-50%)', width: 120, height: 30, background: 'radial-gradient(ellipse at center, rgba(0,255,255,0.4) 0%, transparent 80%)', borderRadius: '50%', zIndex: -1 }}>
          <div className="beam" style={{ position: 'absolute', bottom: 10, left: '15%', width: '70%', height: 130, background: 'linear-gradient(to top, rgba(0,255,255,0.15), transparent)', clipPath: 'polygon(15% 100%, 85% 100%, 100% 0, 0 0)', opacity: showMiniChat ? 1 : 0, transition: '0.8s' }}></div>
        </div>

        <motion.div 
          style={{ width: 140, height: 140, cursor: 'grab', position: 'relative', perspective: '1000px' }}
          onClick={() => { AudioFX.init(); if (isAsleep) setIsAsleep(false); setIsOpen(!isOpen); AudioFX.pop(); }}
        >
          <AnimatePresence>
            {floatingXP.map(x => <motion.div key={x.id} initial={{ y: 0, opacity: 1 }} animate={{ y: -70, opacity: 0 }} onAnimationComplete={() => setFloatingXP(p => p.filter(i => i.id !== x.id))} style={{ position: 'absolute', width: '100%', textAlign: 'center', color: '#4ade80', fontWeight: 900, zIndex: 10 }}>+{x.amt} XP</motion.div>)}
          </AnimatePresence>

          <div className={`particles ${config.particles}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', transformStyle: 'preserve-3d' }}>
            {config.particles !== 'none' && Array.from({ length: 12 }).map((_, i) => <div key={i} className="p" style={{ '--i': i, '--delay': `${i * 0.3}s` }}></div>)}
          </div>

          <motion.div 
            animate={{ rotateX: look.x, rotateY: look.y, y: isAsleep ? 50 : 0, scale: isAsleep ? 0.8 : 1 }} 
            whileTap={{ scale: 0.85, scaleX: 1.25 }}
            style={{ width: '100%', height: '100%', transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
          >
            <img src="/avatar3d.png" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: config.borderStyle === 'plasma' ? 'none' : `3px solid ${config.bodyColor}`, boxShadow: config.borderStyle === 'ouro' ? '0 0 30px #fbbf24' : config.borderStyle === 'neon' ? '0 0 30px #ec4899' : 'none', background: '#fff' }} className={config.borderStyle === 'plasma' ? 'plasma' : ''} alt="Avatar" />
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `radial-gradient(circle at ${50 + (look.y * 2)}% ${50 - (look.x * 2)}%, rgba(255,255,255,0.4), transparent 60%)`, pointerEvents: 'none' }}></div>
          </motion.div>

          <AnimatePresence>
            {isOpen && (
              <motion.div initial={{ scale: 0, x: 20 }} animate={{ scale: 1, x: 0 }} exit={{ scale: 0 }} style={{ position: 'absolute', bottom: 160, right: 0, display: 'flex', flexDirection: 'column', gap: 10, width: 140, zIndex: 10001 }}>
                <button className="menu-btn" onClick={(e) => { e.stopPropagation(); setShowMiniChat(true); setIsOpen(false); }}>💬 CHAT</button>
                <button className="menu-btn" onClick={(e) => { e.stopPropagation(); setShowStudio(true); setIsOpen(false); }}>🎨 ESTÚDIO</button>
                <button className="menu-btn" onClick={(e) => { e.stopPropagation(); window.open('mailto:suporte@vsai.ia'); }}>🎧 SUPORTE</button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <AnimatePresence>{showStudio && <AvatarStudio config={config} onClose={() => setShowStudio(false)} onSave={c => { onUpdateProfile({...profile, custom_avatar: c}); setShowStudio(false); AudioFX.success(); }} />}</AnimatePresence>

      <style>{`
        .menu-btn { background: ${UI_THEME.bgPanel}; border: 1px solid ${UI_THEME.border}; color: #fff; padding: 14px; border-radius: 16px; font-weight: 800; cursor: pointer; backdrop-filter: blur(15px); font-size: 11px; box-shadow: 0 10px 20px rgba(0,0,0,0.4); text-align: left; }
        .menu-btn:hover { background: ${UI_THEME.accent}; color: #fff; transform: translateX(-5px); }
        .plasma { animation: plasma 2s linear infinite; border: 4px solid transparent !important; }
        @keyframes plasma { 0% { box-shadow: 0 0 20px #f00; } 33% { box-shadow: 0 0 20px #0f0; } 66% { box-shadow: 0 0 20px #00f; } 100% { box-shadow: 0 0 20px #f00; } }
        .particles .p { position: absolute; width: 6px; height: 6px; background: #fff; border-radius: 50%; animation: orbit 4s linear infinite; animation-delay: var(--delay); left: 50%; top: 50%; }
        .matrix .p { background: #0f0; box-shadow: 0 0 10px #0f0; width: 2px; height: 15px; border-radius: 0; }
        .fire .p { background: #f90; box-shadow: 0 0 10px #f60; }
        @keyframes orbit { 0% { transform: translate(-50%, -50%) rotateY(0deg) translateZ(100px) rotateY(0deg); opacity: 0; } 50% { opacity: 1; } 100% { transform: translate(-50%, -50%) rotateY(360deg) translateZ(100px) rotateY(-360deg); opacity: 0; } }
      `}</style>
    </>
  );
}
