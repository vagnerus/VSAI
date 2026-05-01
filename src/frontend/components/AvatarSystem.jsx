import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Motores Sensoriais ──────────────────────────────────────
const AudioFX = {
  ctx: null, enabled: true,
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
  levelUp() { this.init(); [523, 659, 783, 1046].forEach((f, i) => setTimeout(() => this.playTone(f, 'triangle', 0.2, 0.2), i * 100)); }
};

// ─── Sistema de Catálogo (150+ Itens) ────────────────────────
const CATEGORIES = [
  { id: 'acessorio', label: 'Cabeça/Acessórios', icon: '🎧' },
  { id: 'camisa', label: 'Tronco/Roupas', icon: '👕' },
  { id: 'calca', label: 'Pernas/Calças', icon: '👖' },
  { id: 'tenis', label: 'Pés/Calçados', icon: '👟' },
  { id: 'blusa', label: 'Blusas/Casacos', icon: '🧥' }
];

const ITEM_STYLES = {
  colors: ['#8b5cf6', '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#ec4899', '#ffffff', '#1f2937', '#06b6d4', '#f43f5e'],
  gradients: [
    'linear-gradient(45deg, #f09, #3cf)', 'linear-gradient(45deg, #0f0, #0ff)', 'linear-gradient(45deg, #f90, #f09)',
    'linear-gradient(45deg, #8b5cf6, #ec4899)', 'linear-gradient(45deg, #10b981, #3b82f6)'
  ],
  names: {
    acessorio: ['Fone Gamer', 'Óculos Cyber', 'Auréola', 'Coroa', 'Boné VSAI', 'Máscara Tech', 'Capuz Ninja', 'Antenas', 'Chifres Neon', 'Headset Pro'],
    camisa: ['Camiseta Básica', 'Polo Executiva', 'Regata Fitness', 'Camisa Social', 'T-Shirt Logo', 'Colete Tático', 'Manto Sagrado', 'Traje de Vôo', 'Kimono', 'Armadura Leve'],
    calca: ['Jeans Clássico', 'Cargo Tech', 'Bermuda Surf', 'Legging Sport', 'Calça Social', 'Jogger Street', 'Shorts Curto', 'Armadura Pernas', 'Saia Cyber', 'Chinos'],
    tenis: ['Sneaker Neon', 'Bota de Couro', 'Sandália Zen', 'Sapato Social', 'Botas Espaciais', 'All-Star', 'Tênis de Corrida', 'Tamanco Digital', 'Mocassim', 'Pantufas'],
    blusa: ['Moletom Oversized', 'Jaqueta de Couro', 'Capa de Mago', 'Sobretudo Noir', 'Blazer Moderno', 'Kimono Longo', 'Suéter de Lã', 'Jaqueta Bomber', 'Colete Puffer', 'Poncho Tech']
  }
};

const getItemsForCategory = (catId) => {
  const items = [];
  for (let i = 1; i <= 30; i++) {
    const nameIndex = (i - 1) % 10;
    const isSpecial = i > 10;
    const isLegendary = i > 20;
    items.push({
      id: i,
      name: `${ITEM_STYLES.names[catId][nameIndex]} ${i > 10 ? (i > 20 ? 'Lendário' : 'Raro') : 'V' + i}`,
      rarity: isLegendary ? 'legendary' : (isSpecial ? 'rare' : 'common'),
      color: i <= 10 ? ITEM_STYLES.colors[i-1] : (i <= 20 ? ITEM_STYLES.gradients[(i-11)%5] : 'conic-gradient(#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)'),
      pattern: i > 20 ? 'animated-glow' : (i > 10 ? 'gradient' : 'solid')
    });
  }
  return items;
};

// ─── Motor de Renderização SVG (Character Creator) ──────────
const AvatarCharacter = ({ config, lookRotation, isAsleep, emotion }) => {
  const outfit = config.outfit || { acessorio: 1, camisa: 1, calca: 1, tenis: 1, blusa: 1 };
  
  const getStyle = (cat, id) => {
    const items = getItemsForCategory(cat);
    return items.find(it => it.id === id) || items[0];
  };

  const styles = {
    head: getStyle('acessorio', outfit.acessorio),
    body: getStyle('camisa', outfit.camisa),
    legs: getStyle('calca', outfit.calca),
    feet: getStyle('tenis', outfit.tenis),
    outer: getStyle('blusa', outfit.blusa)
  };

  return (
    <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%', filter: isAsleep ? 'grayscale(0.8) opacity(0.5)' : 'none' }}>
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        {Object.entries(styles).map(([key, item]) => (
          item.pattern === 'gradient' && (
            <linearGradient key={key} id={`grad-${key}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={item.color.match(/#[0-9a-f]{3,6}/gi)?.[0] || '#8b5cf6'} />
              <stop offset="100%" stopColor={item.color.match(/#[0-9a-f]{3,6}/gi)?.[1] || '#ec4899'} />
            </linearGradient>
          )
        ))}
      </defs>

      <g transform={`rotate(${lookRotation.y * 0.5}, 100, 100) translate(0, ${isAsleep ? 20 : 0})`} style={{ transition: 'transform 0.2s' }}>
        {/* Pernas / Calça */}
        <rect x="75" y="130" width="20" height="40" rx="5" fill={styles.legs.pattern === 'solid' ? styles.legs.color : `url(#grad-legs)`} />
        <rect x="105" y="130" width="20" height="40" rx="5" fill={styles.legs.pattern === 'solid' ? styles.legs.color : `url(#grad-legs)`} />
        
        {/* Pés / Tênis */}
        <rect x="70" y="165" width="25" height="15" rx="4" fill={styles.feet.pattern === 'solid' ? styles.feet.color : `url(#grad-feet)`} />
        <rect x="105" y="165" width="25" height="15" rx="4" fill={styles.feet.pattern === 'solid' ? styles.feet.color : `url(#grad-feet)`} />

        {/* Tronco / Camisa */}
        <rect x="65" y="70" width="70" height="70" rx="10" fill={styles.body.pattern === 'solid' ? styles.body.color : `url(#grad-body)`} />
        
        {/* Blusa / Casaco (Sobreposição) */}
        {outfit.blusa > 1 && (
          <path d="M60,70 L140,70 L140,140 L120,140 L120,85 L80,85 L80,140 L60,140 Z" fill={styles.outer.pattern === 'solid' ? styles.outer.color : `url(#grad-outer)`} opacity="0.9" />
        )}

        {/* Braços */}
        <motion.rect animate={{ rotate: emotion === 'happy' ? -40 : 0 }} style={{ originX: '70px', originY: '80px' }} x="45" y="75" width="15" height="50" rx="7" fill="#ffdbac" />
        <motion.rect animate={{ rotate: emotion === 'happy' ? 40 : 0 }} style={{ originX: '130px', originY: '80px' }} x="140" y="75" width="15" height="50" rx="7" fill="#ffdbac" />

        {/* Cabeça */}
        <circle cx="100" cy="45" r="30" fill="#ffdbac" />
        
        {/* Rosto / Emoções */}
        <g transform={`translate(${lookRotation.y * 0.1}, ${lookRotation.x * 0.1})`}>
          {isAsleep ? (
             <g stroke="#000" strokeWidth="2" fill="none">
               <path d="M85,45 Q90,50 95,45" /><path d="M105,45 Q110,50 115,45" />
             </g>
          ) : (
             <>
               <circle cx="90" cy="45" r="3" fill="#000" />
               <circle cx="110" cy="45" r="3" fill="#000" />
               <path d={emotion === 'happy' ? "M85,60 Q100,75 115,60" : "M90,65 Q100,65 110,65"} stroke="#000" strokeWidth="2" fill="none" />
             </>
          )}
        </g>

        {/* Acessório Cabeça */}
        {outfit.acessorio > 1 && (
          <path d="M70,30 Q100,10 130,30" stroke={styles.head.color} strokeWidth="8" fill="none" filter="url(#glow)" />
        )}
      </g>
    </svg>
  );
};

// ─── Estúdio de Personalização Massiva ──────────────────────
function AvatarStudio({ config, onClose, onSave, avatarXP }) {
  const [local, setLocal] = useState({ ...config, outfit: config.outfit || { acessorio: 1, camisa: 1, calca: 1, tenis: 1, blusa: 1 } });
  const [activeTab, setActiveTab] = useState('acessorio');
  const rank = getAvatarRank(avatarXP);

  const handleSelect = (catId, itemId) => {
    if (itemId > 20 && rank.level < 5) {
      AudioFX.error(); return;
    }
    setLocal({ ...local, outfit: { ...local.outfit, [catId]: itemId } });
    AudioFX.pop();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100001, background: 'rgba(5, 5, 10, 0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(15px)' }} onClick={onClose}>
      <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{ width: '95%', maxWidth: 1000, height: '85vh', background: '#111', borderRadius: 30, border: '1px solid #333', display: 'flex', overflow: 'hidden', boxShadow: '0 50px 100px rgba(0,0,0,0.8)' }} onClick={e => e.stopPropagation()}>
        
        {/* Sidebar Categorias */}
        <div style={{ width: 80, background: '#080808', display: 'flex', flexDirection: 'column', gap: 15, padding: '20px 0', borderRight: '1px solid #222' }}>
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setActiveTab(cat.id)} style={{ background: activeTab === cat.id ? '#8b5cf633' : 'transparent', border: 'none', color: '#fff', padding: 15, cursor: 'pointer', borderRadius: 12, margin: '0 10px', fontSize: 24, borderLeft: activeTab === cat.id ? '4px solid #8b5cf6' : '4px solid transparent' }} title={cat.label}>{cat.icon}</button>
          ))}
          <button onClick={() => setActiveTab('aura')} style={{ marginTop: 'auto', background: activeTab === 'aura' ? '#0ff3' : 'transparent', border: 'none', color: '#fff', padding: 15, cursor: 'pointer', fontSize: 24 }}>✨</button>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <header style={{ padding: 25, borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: 1 }}>{CATEGORIES.find(c => c.id === activeTab)?.label || 'Auras & Efeitos'}</h2>
            <div style={{ background: '#000', padding: '8px 15px', borderRadius: 20, fontSize: 12, border: '1px solid #333' }}>XP: <span style={{ color: '#8b5cf6', fontWeight: 900 }}>{avatarXP}</span> • Nível {rank.level}</div>
          </header>

          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Grid de Itens */}
            <div style={{ flex: 1, padding: 25, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 15 }}>
              {activeTab === 'aura' ? (
                 ['none', 'fire', 'matrix', 'snow', 'portal'].map(eff => (
                    <button key={eff} onClick={() => setLocal({...local, particles: eff})} style={{ background: local.particles === eff ? '#8b5cf6' : '#1a1a1a', border: '1px solid #333', borderRadius: 15, padding: 15, cursor: 'pointer', color: '#fff', fontSize: 11, fontWeight: 700 }}>{eff.toUpperCase()}</button>
                 ))
              ) : (
                getItemsForCategory(activeTab).map(item => {
                  const isLocked = item.id > 20 && rank.level < 5;
                  const isSelected = local.outfit[activeTab] === item.id;
                  return (
                    <button 
                      key={item.id} 
                      disabled={isLocked}
                      onClick={() => handleSelect(activeTab, item.id)}
                      style={{ position: 'relative', background: isSelected ? '#8b5cf6' : '#1a1a1a', border: '1px solid #333', borderRadius: 15, padding: 10, cursor: isLocked ? 'not-allowed' : 'pointer', opacity: isLocked ? 0.3 : 1, transition: '0.2s', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}
                    >
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: item.color, border: '2px solid rgba(255,255,255,0.1)' }}></div>
                      <span style={{ fontSize: 9, fontWeight: 800, textAlign: 'center', color: '#fff' }}>{item.name}</span>
                      {isLocked && <span style={{ position: 'absolute', top: 5, right: 5 }}>🔒</span>}
                    </button>
                  );
                })
              )}
            </div>

            {/* Preview Lateral */}
            <div style={{ width: 320, background: '#0a0a0f', borderLeft: '1px solid #222', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 30 }}>
              <div style={{ width: 220, height: 220, position: 'relative', background: 'radial-gradient(circle, #222 0%, transparent 70%)', borderRadius: '50%' }}>
                <AvatarCharacter config={local} lookRotation={{x:0, y:0}} isAsleep={false} emotion="idle" />
              </div>
              <div style={{ marginTop: 30, width: '100%' }}>
                 <div className="field"><label>NOME DO AVATAR</label><input type="text" value={local.avatarName} onChange={e => setLocal({...local, avatarName: e.target.value})} style={{ width: '100%', background: '#000', border: '1px solid #333', padding: 12, borderRadius: 10, color: '#fff' }} /></div>
                 <div className="field" style={{ marginTop: 20 }}><label>ESTILO DA BORDA</label><select value={local.borderStyle} onChange={e => setLocal({...local, borderStyle: e.target.value})} style={{ width: '100%', background: '#000', border: '1px solid #333', padding: 12, borderRadius: 10, color: '#fff' }}><option value="default">Padrão</option><option value="ouro">Ouro Lendário</option><option value="neon">Neon Futurista</option><option value="plasma">Plasma Galáctico</option></select></div>
              </div>
              <button onClick={() => onSave(local)} style={{ marginTop: 'auto', width: '100%', padding: 20, background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 15, fontWeight: 900, cursor: 'pointer', boxShadow: '0 10px 20px rgba(139, 92, 246, 0.3)' }}>SALVAR SUPER AVATAR</button>
            </div>
          </div>
        </div>
      </motion.div>
      <style>{`
        .field label { color: #555; font-size: 10px; font-weight: 800; display: block; margin-bottom: 8px; letter-spacing: 1px; }
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
    bodyColor: '#8b5cf6', avatarName: 'VSAI Assistente', avatarXP: 0, avatarNotes: [], particles: 'none', borderStyle: 'default', outfit: { acessorio: 1, camisa: 1, calca: 1, tenis: 1, blusa: 1 } 
  };

  useEffect(() => {
    const move = (e) => {
      if (isAsleep) setIsAsleep(false); clearTimeout(sleepTimer.current);
      sleepTimer.current = setTimeout(() => setIsAsleep(true), 60000);
      const rect = containerRef.current.getBoundingClientRect();
      setLook({ x: -(e.clientY - (rect.top + 70))/10, y: (e.clientX - (rect.left + 70))/10 });
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
        {showMiniChat && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9997, pointerEvents: 'none' }} />}
      </AnimatePresence>

      <div ref={containerRef} style={{ position: 'fixed', bottom: 30, right: 30, zIndex: 9998 }}>
        <AnimatePresence>
          {showMiniChat && <MiniChatBubble onClose={() => setShowMiniChat(false)} onSetEmotion={setEmotion} pageContext={currentPage} profile={profile} config={config} onUpdateConfig={c => onUpdateProfile({...profile, custom_avatar: c})} onEarnXP={onEarnXP} />}
        </AnimatePresence>

        <div className="hologram-plate" style={{ position: 'absolute', bottom: -15, left: '50%', transform: 'translateX(-50%)', width: 140, height: 40, background: 'radial-gradient(ellipse at center, rgba(0,255,255,0.4) 0%, transparent 80%)', borderRadius: '50%', zIndex: -1 }}>
           <div className="beam" style={{ position: 'absolute', bottom: 10, left: '20%', width: '60%', height: 150, background: 'linear-gradient(to top, rgba(0,255,255,0.2), transparent)', clipPath: 'polygon(15% 100%, 85% 100%, 100% 0, 0 0)', opacity: (showMiniChat || isOpen) ? 1 : 0, transition: '1s' }}></div>
        </div>

        <motion.div 
          style={{ width: 140, height: 140, cursor: 'grab', position: 'relative', perspective: '1000px' }}
          onClick={() => { AudioFX.init(); if (isAsleep) setIsAsleep(false); setIsOpen(!isOpen); AudioFX.pop(); }}
        >
          <AnimatePresence>
            {floatingXP.map(x => <motion.div key={x.id} initial={{ y: 0, opacity: 1 }} animate={{ y: -80, opacity: 0 }} onAnimationComplete={() => setFloatingXP(p => p.filter(i => i.id !== x.id))} style={{ position: 'absolute', width: '100%', textAlign: 'center', color: '#4ade80', fontWeight: 900, zIndex: 10 }}>+{x.amt} XP</motion.div>)}
          </AnimatePresence>

          {/* Efeito Matrix Melhorado (Digital Rain) */}
          {config.particles === 'matrix' && (
            <div style={{ position: 'absolute', inset: -20, pointerEvents: 'none', overflow: 'hidden' }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <motion.div key={i} initial={{ y: -100 }} animate={{ y: 200 }} transition={{ repeat: Infinity, duration: 1.5 + Math.random(), ease: 'linear', delay: i * 0.2 }} style={{ position: 'absolute', left: `${i * 15}%`, color: '#0f0', fontSize: 10, fontFamily: 'monospace', writingMode: 'vertical-rl', textShadow: '0 0 5px #0f0' }}>01011010110</motion.div>
              ))}
            </div>
          )}

          <div className={`particles ${config.particles}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', transformStyle: 'preserve-3d' }}>
            {config.particles === 'fire' && Array.from({ length: 15 }).map((_, i) => <div key={i} className="fire-p" style={{ '--i': i }}></div>)}
          </div>

          <motion.div animate={{ rotateX: look.x, rotateY: look.y, y: isAsleep ? 50 : 0, scale: isAsleep ? 0.7 : 1 }} whileTap={{ scale: 0.8, scaleX: 1.4 }} style={{ width: '100%', height: '100%', transformStyle: 'preserve-3d' }}>
            <AvatarCharacter config={config} lookRotation={look} isAsleep={isAsleep} emotion={emotion} />
          </motion.div>

          <AnimatePresence>
            {isOpen && (
              <motion.div initial={{ scale: 0, x: 20 }} animate={{ scale: 1, x: 0 }} exit={{ scale: 0 }} style={{ position: 'absolute', bottom: 160, right: 0, display: 'flex', flexDirection: 'column', gap: 10, width: 140, zIndex: 10001 }}>
                <button className="menu-btn" onClick={(e) => { e.stopPropagation(); setShowMiniChat(true); setIsOpen(false); }}>💬 CONVERSAR</button>
                <button className="menu-btn" onClick={(e) => { e.stopPropagation(); setShowStudio(true); setIsOpen(false); }}>🎨 SUPER CLOSET</button>
                <button className="menu-btn" onClick={(e) => { e.stopPropagation(); window.open('mailto:suporte@vsai.ia'); }}>🎧 SUPORTE</button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <AnimatePresence>{showStudio && <AvatarStudio config={config} avatarXP={config.avatarXP || 0} onClose={() => setShowStudio(false)} onSave={c => { onUpdateProfile({...profile, custom_avatar: c}); setShowStudio(false); AudioFX.success(); }} />}</AnimatePresence>

      <style>{`
        .menu-btn { background: #111; border: 1px solid #333; color: #fff; padding: 15px; border-radius: 18px; font-weight: 800; cursor: pointer; backdrop-filter: blur(15px); font-size: 11px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .menu-btn:hover { background: #8b5cf6; border-color: #8b5cf6; transform: translateX(-5px); }
        .fire-p { position: absolute; bottom: 20%; left: 50%; width: 10px; height: 10px; background: #f60; filter: blur(5px); border-radius: 50%; animation: fireUp 1.5s infinite; animation-delay: calc(var(--i) * 0.1s); }
        @keyframes fireUp { 0% { transform: translate(-50%, 0) scale(1); opacity: 0.8; } 100% { transform: translate(-50%, -100px) scale(0); opacity: 0; } }
      `}</style>
    </>
  );
}

// ─── Componentes de Apoio ──────────────────────────────────
function MiniChatBubble({ onClose, onSetEmotion, pageContext, profile, config, onUpdateConfig, onEarnXP }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const name = profile?.full_name?.split(' ')[0] || 'visitante';
    setMessages([{ role: 'assistant', content: `Olá **${name}**! Seu Super Avatar Nível ${getAvatarRank(config.avatarXP).level} está pronto. No que posso ajudar?` }]);
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const sendMessage = async (text) => {
    const txt = text.trim(); if (!txt) return;
    setMessages(p => [...p, { role: 'user', content: txt }]); setInput(''); setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('nexus_access_token')}` },
        body: JSON.stringify({ content: txt, messages: messages.map(m => ({ role: m.role, content: m.content })), customInstructions: `Nome: ${config.avatarName}.` })
      });
      const data = await res.json();
      setMessages(p => [...p, { role: 'assistant', content: data.reply || data.content, isNew: true }]);
      onEarnXP(10);
    } catch (err) { setMessages(p => [...p, { role: 'assistant', content: 'Erro neural.' }]); }
    finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} style={{ position: 'absolute', bottom: 160, right: 0, width: 360, height: 500, display: 'flex', flexDirection: 'column', borderRadius: 24, overflow: 'hidden', boxShadow: '0 30px 70px rgba(0,0,0,0.8)', border: '1px solid #333', background: '#0a0a0f', zIndex: 10000 }}>
      <header style={{ padding: 20, background: '#111', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222' }}>
        <h3 style={{ margin: 0, fontSize: 16, color: '#fff' }}>💬 {config.avatarName}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}>✕</button>
      </header>
      <div style={{ flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 15 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', background: m.role === 'user' ? '#8b5cf6' : '#222', padding: 12, borderRadius: 15, color: '#fff', fontSize: 14 }}>{m.content}</div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div style={{ padding: 15, borderTop: '1px solid #222', display: 'flex', gap: 10 }}>
        <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage(input)} style={{ flex: 1, background: '#000', border: '1px solid #333', padding: 12, borderRadius: 20, color: '#fff' }} />
        <button onClick={() => sendMessage(input)} style={{ background: '#8b5cf6', border: 'none', borderRadius: '50%', width: 40, height: 40, color: '#fff' }}>➤</button>
      </div>
    </motion.div>
  );
}
