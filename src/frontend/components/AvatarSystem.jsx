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
  pop() {
    this.init();
    this.playTone(600, 'sine', 0.1, 0.15);
    setTimeout(() => this.playTone(800, 'sine', 0.1, 0.1), 50);
  },
  success() {
    this.init();
    this.playTone(800, 'sine', 0.1, 0.1);
    setTimeout(() => this.playTone(1200, 'sine', 0.2, 0.1), 100);
  },
  error() {
    this.init();
    this.playTone(150, 'sawtooth', 0.2, 0.2);
    setTimeout(() => this.playTone(100, 'sawtooth', 0.3, 0.2), 150);
  },
  warning() {
    this.init();
    this.playTone(400, 'square', 0.1, 0.1);
    setTimeout(() => this.playTone(300, 'square', 0.2, 0.1), 150);
  }
};

const speakText = (text) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const cleanText = text.replace(/[*`_#\[\]]/g, '');
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'pt-BR';
  utterance.rate = 1.1;
  window.speechSynthesis.speak(utterance);
};

// ─── Parser Simples de Markdown e Efeito Digitação ──────────
const MarkdownRenderer = ({ content, isTyping }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    if (!isTyping) {
      setDisplayedText(content);
      return;
    }
    let i = 0;
    const interval = setInterval(() => {
      setDisplayedText(content.substring(0, i));
      i += 3; 
      if (i > content.length) {
        setDisplayedText(content);
        clearInterval(interval);
      }
    }, 15);
    return () => clearInterval(interval);
  }, [content, isTyping]);

  // Suporte a gráficos em barra CSS nativo da Fase 6
  const regexGraph = /\[BAR_CHART:(.*?)\]/;
  const parts = displayedText.split(/```/);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {parts.map((part, index) => {
        if (index % 2 === 1) {
          const lines = part.split('\n');
          const code = lines.slice(1).join('\n');
          return (
            <div key={index} style={{ background: '#111', borderRadius: 8, padding: 8, position: 'relative', border: '1px solid #333' }}>
              <button 
                title="Copiar Código"
                onClick={() => { navigator.clipboard.writeText(code); AudioFX.pop(); }}
                style={{ position: 'absolute', top: 4, right: 4, background: 'var(--accent-primary)', border: 'none', color: '#fff', fontSize: 10, cursor: 'pointer', borderRadius: 4, padding: '4px 8px' }}
              >
                Copiar
              </button>
              <pre style={{ margin: 0, overflowX: 'auto', fontSize: 11, color: '#a78bfa', marginTop: 15, fontFamily: 'monospace' }}><code>{code}</code></pre>
            </div>
          );
        }
        
        // Separa texto comum dos gráficos [BAR_CHART:...]
        const textAndGraphs = part.split(regexGraph);
        
        return (
          <span key={index} style={{ lineHeight: 1.4 }}>
            {textAndGraphs.map((subpart, j) => {
              // Se for um bloco de gráfico capturado pelo regex
              if (j % 2 === 1) {
                const items = subpart.split(',').map(item => {
                  const [label, val] = item.split('|');
                  return { label, value: Number(val) };
                }).filter(i => !isNaN(i.value));
                
                const maxVal = Math.max(...items.map(i => i.value), 1);
                
                return (
                  <div key={j} style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 12, margin: '10px 0', border: '1px solid rgba(0,255,204,0.2)' }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: 12, color: '#0ff', display: 'flex', alignItems: 'center', gap: 5 }}>
                      📊 Visão Analítica VSAI
                    </h4>
                    {items.map((item, i) => (
                      <div key={i} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4, color: '#ccc' }}>
                          <span>{item.label}</span>
                          <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>{item.value}</span>
                        </div>
                        <div style={{ width: '100%', background: 'rgba(255,255,255,0.05)', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(item.value/maxVal)*100}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            style={{ background: `linear-gradient(90deg, var(--accent-primary), #0ff)`, height: '100%' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }
              
              // Se for texto normal, formata Markdown inline
              return subpart.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g).map((t, i) => {
                if (t.startsWith('**') && t.endsWith('**')) return <strong key={i} style={{ color: '#fff' }}>{t.slice(2, -2)}</strong>;
                if (t.startsWith('*') && t.endsWith('*')) return <em key={i} style={{ color: '#ccc' }}>{t.slice(1, -1)}</em>;
                if (t.startsWith('`') && t.endsWith('`')) return <code key={i} style={{ background: '#000', padding: '2px 4px', borderRadius: 4, fontSize: '0.9em' }}>{t.slice(1, -1)}</code>;
                return <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{t}</span>;
              });
            })}
          </span>
        );
      })}
    </div>
  );
};

// ─── Mini Chat do Avatar ────────────────────────────────────
function MiniChatBubble({ initialPrompt, onClose, onSetEmotion, pageContext, soundEnabled, profile }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => { AudioFX.enabled = soundEnabled; }, [soundEnabled]);

  useEffect(() => {
    if (initialPrompt) {
      sendMessage(initialPrompt, true);
    } else {
      setMessages([{ role: 'assistant', content: 'Olá! Sou seu analista de IA. Digite `/metricas` para ver os dados do sistema ou `/` para comandos.' }]);
    }
  }, [initialPrompt]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const fetchMetricsMockOrReal = async () => {
    try {
      const token = localStorage.getItem('nexus_access_token');
      const res = await fetch('/api/admin?action=analytics', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        return `[BAR_CHART:Usuários Ativos|${data.totalUsers || 10},Sessões Iniciais|${data.activeSessions || 5},Tokens Usados (mil)|${Math.round(data.totalTokens/1000) || 50}]
        
A análise estrutural do sistema aponta estabilidade. Seus custos estão dentro da margem de segurança. Quer otimizar alguma métrica específica?`;
      }
      throw new Error('Fallback para mock');
    } catch(e) {
      // Mock inteligente caso o usuário não seja admin
      const limit = profile?.tokens_limit || 50000;
      const used = profile?.tokens_used_month || Math.floor(Math.random() * 40000);
      const isOverBudget = used > limit;
      
      let msg = `[BAR_CHART:Seu Uso de Tokens|${used},Limite Mensal do Plano|${limit},Custos API|${Math.round((used/1000)*0.03)}]
      
`;
      if (isOverBudget) {
        msg += `**ALERTA**: Você ultrapassou seu limite de tokens. Recomendamos revisar seus prompts e apagar conversas mortas para economizar.`;
        if (onSetEmotion) onSetEmotion('warning');
        AudioFX.warning();
      } else {
        msg += `Suas finanças de inteligência artificial estão extremamente saudáveis! Você usou ${(used/limit*100).toFixed(1)}% da sua cota.`;
      }
      return msg;
    }
  };

  const sendMessage = async (text, isHiddenPrompt = false) => {
    const txt = text.trim();
    if (!txt) return;
    
    if (txt === '/limpar') {
      setMessages([{ role: 'assistant', content: 'Memória apagada! Como posso ajudar agora?' }]);
      setInput('');
      AudioFX.pop();
      return;
    }
    
    let processedText = txt;
    if (txt === '/resumir') {
      processedText = `Faça um resumo explicativo do que é e para que serve a aba atual "${pageContext}" do VSAI.`;
    }

    const userMsg = { role: 'user', content: processedText };
    if (!isHiddenPrompt) {
      setMessages(prev => [...prev, userMsg]);
      setInput('');
    }
    
    setLoading(true);
    
    // Fase 6: Comandos Analíticos Avançados
    if (txt === '/metricas' || txt === '/analisar') {
      setTimeout(async () => {
        const analysisResponse = await fetchMetricsMockOrReal();
        setMessages(prev => [...prev, userMsg, { role: 'assistant', content: analysisResponse, isNew: true }]);
        setLoading(false);
        if (!analysisResponse.includes('ALERTA')) {
          AudioFX.success();
          if (onSetEmotion) { onSetEmotion('happy'); setTimeout(() => onSetEmotion('idle'), 1500); }
        }
      }, 1000); // tempo de "análise profunda" fake
      return;
    }

    // Fluxo normal de chat
    try {
      const token = localStorage.getItem('nexus_access_token');
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          content: processedText,
          messages: messages.map(m => ({ role: m.role, content: m.content })).filter(m => m.role !== 'system'),
          model: 'gemini-1.5-flash',
          provider: 'gemini',
          customInstructions: `Contexto Ativo do Usuário: Tela "${pageContext}". Mantenha respostas curtas. Para dados quantitativos ou comparações, USE A SINTAXE DE GRÁFICO: [BAR_CHART:Nome1|Valor1,Nome2|Valor2] na sua resposta para gerar barras visuais lindíssimas.`
        })
      });

      if (!res.ok) {
        AudioFX.error();
        if (onSetEmotion) { onSetEmotion('glitch'); setTimeout(() => onSetEmotion('idle'), 1000); }
        throw new Error('Erro na API');
      }
      
      const data = await res.json();
      setMessages(prev => [...prev, userMsg, { role: 'assistant', content: data.reply || data.content, isNew: true }]);
      
      AudioFX.success();
      if (onSetEmotion) { onSetEmotion('happy'); setTimeout(() => onSetEmotion('idle'), 1500); }
    } catch (err) {
      setMessages(prev => [...prev, userMsg, { role: 'assistant', content: 'Desculpe, falha na matriz neural. Tente novamente.', isNew: true }]);
      if (onSetEmotion && err.message !== 'Erro na API') { onSetEmotion('glitch'); setTimeout(() => onSetEmotion('idle'), 1000); }
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
        width: 340, height: 420, 
        display: 'flex', flexDirection: 'column',
        borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <header style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>💬 VSAI Analista</h3>
        <button title="Fechar Chat (Ctrl+Espaço)" onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.7 }}>✕</button>
      </header>
      
      <div style={{ flex: 1, minHeight: 0, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ 
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            background: m.role === 'user' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.08)',
            padding: '10px 14px', borderRadius: 12, fontSize: 13,
            maxWidth: '90%', wordBreak: 'break-word',
            border: m.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.05)',
            position: 'relative'
          }}>
            {m.role === 'assistant' ? (
              <>
                <MarkdownRenderer content={m.content} isTyping={m.isNew} />
                <button 
                  title="Ouvir Análise em Voz Alta"
                  onClick={() => speakText(m.content)}
                  style={{ position: 'absolute', bottom: -20, right: 0, background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 12 }}
                >
                  🔊 Ler
                </button>
              </>
            ) : (
              <span>{m.content}</span>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.08)', padding: '10px 14px', borderRadius: 12, fontSize: 13, border: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="typing-dots">Analisando Dados...</span>
          </div>
        )}
        <div ref={messagesEndRef} style={{ height: 20 }} />
      </div>

      <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 8, position: 'relative' }}>
        <input 
          type="text" 
          placeholder="/metricas, /analisar, ou pergunte" 
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
          style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '10px 16px', color: '#fff', fontSize: 13, outline: 'none' }}
        />
        <button 
          title="Executar Comando"
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          style={{ background: 'var(--accent-primary)', border: 'none', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: (loading || !input.trim()) ? 0.5 : 1 }}
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

// ─── Componente Gráfico Radar SVG (Fase 6) ──────────────────
const RPG_RadarChart = ({ config }) => {
  // Atributos Base
  let c_foco = 50, c_criatividade = 50, c_velocidade = 50;

  // Cálculos Mágicos baseados nas escolhas de roupa
  if (config.particles === 'fire') { c_foco += 30; c_velocidade += 20; }
  if (config.particles === 'matrix') { c_foco += 40; c_criatividade -= 10; }
  if (config.particles === 'snow') { c_foco += 10; c_velocidade -= 20; }
  
  if (config.borderStyle === 'neon') c_criatividade += 40;
  if (config.borderStyle === 'ouro') c_foco += 20;
  if (config.borderStyle === 'holo') { c_criatividade += 20; c_velocidade += 20; }
  
  if (config.accessory === 'glasses') { c_foco += 30; c_velocidade += 10; }
  if (config.accessory === 'crown') c_criatividade += 20;
  if (config.accessory === 'halo') c_foco += 20;

  // Limitar a 100
  c_foco = Math.min(100, Math.max(0, c_foco));
  c_criatividade = Math.min(100, Math.max(0, c_criatividade));
  c_velocidade = Math.min(100, Math.max(0, c_velocidade));

  // Desenhar Triângulo de Radar Simples (Topo, Inferior Dir, Inferior Esq)
  const size = 100;
  const center = size / 2;
  const radius = size / 2.5;

  const getPoint = (val, angleOffset) => {
    const r = (val / 100) * radius;
    const x = center + r * Math.cos(angleOffset);
    const y = center + r * Math.sin(angleOffset);
    return `${x},${y}`;
  };

  const p1 = getPoint(c_foco, -Math.PI / 2); // Topo
  const p2 = getPoint(c_criatividade, Math.PI / 6); // Baixo Direita
  const p3 = getPoint(c_velocidade, 5 * Math.PI / 6); // Baixo Esquerda

  return (
    <div style={{ textAlign: 'center', marginTop: 20 }}>
      <h4 style={{ fontSize: 12, opacity: 0.8, marginBottom: 5 }}>Atributos da Personalidade</h4>
      <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
        {/* Fundo do Radar */}
        <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
          <polygon points={`${center},${center-radius} ${center+radius*Math.cos(Math.PI/6)},${center+radius*Math.sin(Math.PI/6)} ${center+radius*Math.cos(5*Math.PI/6)},${center+radius*Math.sin(5*Math.PI/6)}`} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <polygon points={`${center},${center-radius/2} ${center+(radius/2)*Math.cos(Math.PI/6)},${center+(radius/2)*Math.sin(Math.PI/6)} ${center+(radius/2)*Math.cos(5*Math.PI/6)},${center+(radius/2)*Math.sin(5*Math.PI/6)}`} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          <line x1={center} y1={center} x2={center} y2={center-radius} stroke="rgba(255,255,255,0.2)" />
          <line x1={center} y1={center} x2={center+radius*Math.cos(Math.PI/6)} y2={center+radius*Math.sin(Math.PI/6)} stroke="rgba(255,255,255,0.2)" />
          <line x1={center} y1={center} x2={center+radius*Math.cos(5*Math.PI/6)} y2={center+radius*Math.sin(5*Math.PI/6)} stroke="rgba(255,255,255,0.2)" />
          
          {/* O Valor Ativo em Si */}
          <motion.polygon 
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            key={`${c_foco}-${c_criatividade}-${c_velocidade}`}
            points={`${p1} ${p2} ${p3}`} 
            fill="rgba(0, 255, 204, 0.4)" 
            stroke="#0ff" 
            strokeWidth="2" 
          />
        </svg>
        <span style={{ position: 'absolute', top: -15, left: '50%', transform: 'translateX(-50%)', fontSize: 9 }}>Foco</span>
        <span style={{ position: 'absolute', bottom: 5, right: -25, fontSize: 9 }}>Criatividade</span>
        <span style={{ position: 'absolute', bottom: 5, left: -25, fontSize: 9 }}>Velocidade</span>
      </div>
    </div>
  );
};


// ─── Widget Principal do Avatar ────────────────────────────
export function AvatarWidget({ profile, onUpdateProfile, currentPage }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showStudio, setShowStudio] = useState(false);
  const [showMiniChat, setShowMiniChat] = useState(false);
  const [playMenuOpen, setPlayMenuOpen] = useState(false);
  const [miniChatContext, setMiniChatContext] = useState('');
  
  const [emotion, setEmotion] = useState('idle');
  const [lookRotation, setLookRotation] = useState({ x: 0, y: 0 });
  const avatarContainerRef = useRef(null);
  
  const config = profile?.custom_avatar || { 
    bodyColor: '#8b5cf6', accessory: 'none', borderStyle: 'default', particles: 'none', opacity: 100, soundEnabled: true
  };
  
  useEffect(() => {
    AudioFX.enabled = config.soundEnabled !== false;
  }, [config.soundEnabled]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        setShowMiniChat(prev => !prev);
        if (!showMiniChat) AudioFX.pop();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showMiniChat]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!avatarContainerRef.current || isDragging) return;
      const rect = avatarContainerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const distanceX = e.clientX - centerX;
      const distanceY = e.clientY - centerY;
      
      const maxRotate = 25;
      const rotY = Math.min(Math.max((distanceX / window.innerWidth) * 60, -maxRotate), maxRotate);
      const rotX = Math.min(Math.max(-(distanceY / window.innerHeight) * 60, -maxRotate), maxRotate);
      
      setLookRotation({ x: rotX, y: rotY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isDragging]);

  const handlePlayAction = (prompt) => {
    AudioFX.pop();
    setMiniChatContext(prompt);
    setShowMiniChat(true);
    setPlayMenuOpen(false);
    setIsOpen(false);
  };

  const handleAvatarClick = () => {
    if (isDragging) return;
    AudioFX.init();
    if (!isOpen) AudioFX.pop();
    setIsOpen(!isOpen);
    setPlayMenuOpen(false);
  };

  // Fase 6: Geração Automática de Suporte com Logs
  const handleSupportClick = () => {
    AudioFX.pop();
    const subject = encodeURIComponent(`Suporte VSAI - Ajuda na tela ${currentPage}`);
    const body = encodeURIComponent(`Olá VSAI,\n\nPreciso de ajuda com o sistema.\n\n---\n[DEBUG LOGS INTERNOS - NÃO APAGAR]\nID do Usuário: ${profile?.id}\nRole: ${profile?.role}\nTela Atual: ${currentPage}\nHumor do Avatar: ${emotion}\n---\n\n`);
    window.open(`mailto:suporte@vsai.ia?subject=${subject}&body=${body}`);
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
              pageContext={currentPage}
              soundEnabled={config.soundEnabled !== false}
              profile={profile}
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
          onClick={handleAvatarClick}
          title="Clique para abrir opções ou arraste para mover"
        >
          <ParticlesRenderer type={config.particles} />

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

          <AnimatePresence>
            {isOpen && !playMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.8, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: 20, scale: 0.8, filter: 'blur(10px)' }}
                className="avatar-menu glass-panel"
                onClick={(e) => e.stopPropagation()}
              >
                <button title="Conversar por texto e análise" onClick={() => { AudioFX.pop(); setShowMiniChat(true); setMiniChatContext(''); setIsOpen(false); }}>💬 Falar com IA</button>
                <button title="Mudar aparência e estilo" onClick={() => { AudioFX.pop(); setShowStudio(true); setIsOpen(false); }}>🎨 Personalizar</button>
                <button title="Interações divertidas" onClick={() => { AudioFX.pop(); setPlayMenuOpen(true); }}>🎮 Brincar ➜</button>
                <button title="Gera um log automático por email" onClick={handleSupportClick}>🎧 Suporte com Logs</button>
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
                <button title="Voltar ao menu anterior" onClick={() => { AudioFX.pop(); setPlayMenuOpen(false); }} style={{ opacity: 0.7 }}>⮐ Voltar</button>
                <button onClick={() => handlePlayAction('Conte uma piada muito engraçada, mas curta.')}>🪄 Contar Piada</button>
                <button onClick={() => handlePlayAction('Me diga uma curiosidade inútil, mas muito interessante.')}>🧠 Curiosidade</button>
                <button onClick={() => handlePlayAction('Faça uma leitura de métricas engraçada, fingindo ser vidente.')}>🔮 Vidente de Métricas</button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <AnimatePresence>
        {showStudio && (
          <AvatarStudio 
            config={config} 
            onClose={() => setShowStudio(false)} 
            onSave={(newConfig) => {
              AudioFX.success();
              if (onUpdateProfile) onUpdateProfile({ ...profile, custom_avatar: newConfig });
              setShowStudio(false);
            }} 
          />
        )}
      </AnimatePresence>

      <style>{`
        .avatar-3d-image { width: 100%; height: 100%; position: relative; transition: transform 0.3s ease; }
        .avatar-3d-image.floating { animation: floatAvatar 3s ease-in-out infinite; }
        .avatar-3d-image.dragging { transform: scale(0.95); }
        
        .emotion-glitch { animation: glitchAnim 0.3s infinite !important; }
        .emotion-happy { animation: happyJump 0.5s ease-out !important; }
        /* Fase 6: Alerta Amarelo Piscante */
        .emotion-warning img { border: 4px solid #fbbf24 !important; box-shadow: 0 0 30px #f59e0b, inset 0 0 20px #fbbf24 !important; animation: warningPulse 1s infinite alternate; }

        .avatar-halo {
          position: absolute; top: -10px; left: 50%; width: 60px; height: 20px; border-radius: 50%; border: 4px solid transparent; border-top-color: #fbbf24; box-shadow: 0 -5px 15px rgba(251, 191, 36, 0.5); animation: floatHalo 3s ease-in-out infinite alternate;
        }
        
        .avatar-particles-container { position: absolute; top: -30px; left: -30px; right: -30px; bottom: -30px; pointer-events: none; z-index: -1; overflow: hidden; border-radius: 50%; }
        .avatar-particles-container.fire .particle { position: absolute; bottom: 0; width: 8px; height: 8px; border-radius: 50%; opacity: 0; background: #f97316; box-shadow: 0 0 10px #fbbf24; animation: floatFire 2s infinite ease-in; left: calc(5% * var(--i)); animation-delay: calc(0.1s * var(--i)); }
        .avatar-particles-container.matrix .particle { position: absolute; top: -10px; width: 2px; height: 20px; opacity: 0; background: #22c55e; box-shadow: 0 0 8px #4ade80; animation: fallMatrix 1.5s infinite linear; left: calc(5% * var(--i)); animation-delay: calc(0.2s * var(--i)); }
        .avatar-particles-container.snow .particle { position: absolute; top: -10px; width: 6px; height: 6px; border-radius: 50%; opacity: 0; background: #fff; box-shadow: 0 0 5px #fff; animation: fallSnow 3s infinite linear; left: calc(5% * var(--i)); animation-delay: calc(0.15s * var(--i)); }

        @keyframes floatFire { 0% { transform: translateY(0) scale(1); opacity: 0.8; } 100% { transform: translateY(-100px) scale(0); opacity: 0; } }
        @keyframes fallMatrix { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(180px); opacity: 0; } }
        @keyframes fallSnow { 0% { transform: translate(0, 0); opacity: 0.8; } 100% { transform: translate(20px, 150px); opacity: 0; } }
        @keyframes floatAvatar { 0% { transform: translateY(0px) scale(1); } 50% { transform: translateY(-10px) scale(1.02); } 100% { transform: translateY(0px) scale(1); } }
        @keyframes floatHalo { 0% { transform: translateY(0px) rotateX(70deg); } 100% { transform: translateY(-5px) rotateX(70deg); } }
        @keyframes holoSpin { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(360deg); } }
        @keyframes warningPulse { 0% { filter: hue-rotate(0deg) contrast(150%); } 100% { filter: hue-rotate(-20deg) contrast(200%); } }
        @keyframes glitchAnim { 0% { transform: translate(0); filter: contrast(100%); } 20% { transform: translate(-3px, 3px); filter: contrast(150%) hue-rotate(90deg); } 40% { transform: translate(-3px, -3px); filter: contrast(100%); } 60% { transform: translate(3px, 3px); filter: contrast(150%) hue-rotate(-90deg); } 80% { transform: translate(3px, -3px); filter: contrast(100%); } 100% { transform: translate(0); filter: contrast(100%); } }
        @keyframes happyJump { 0% { transform: translateY(0) scale(1); } 40% { transform: translateY(-20px) scale(1.05); } 60% { transform: translateY(-20px) scale(1.05); } 100% { transform: translateY(0) scale(1); } }
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
    opacity: config.opacity !== undefined ? config.opacity : 100,
    soundEnabled: config.soundEnabled !== false
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
          <h2 style={{ margin: 0 }}>Estúdio de Criação VSAI - Fase 6 (Dados)</h2>
          <button title="Fechar Estúdio" onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </header>

        <div className="studio-content" style={{ display: 'flex', gap: 30, padding: 20, flexWrap: 'wrap' }}>
          <div className="studio-preview" style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 40, minHeight: 300 }}>
             <div className="avatar-3d-image floating" style={{ width: 180, height: 180, position: 'relative', flexShrink: 0 }}>
                <ParticlesRenderer type={localConfig.particles} />
                <img src="/avatar3d.png" alt="Preview" style={getAvatarStyles(localConfig)} />
                {localConfig.accessory === 'halo' && <div className="avatar-halo"></div>}
                {localConfig.accessory === 'crown' && <div className="avatar-crown" style={{ position: 'absolute', top: '-25px', left: '50%', transform: 'translateX(-50%)', fontSize: '2.5rem', zIndex: 10, animation: 'floatHalo 3s ease-in-out infinite alternate', textShadow: '0 5px 10px rgba(0,0,0,0.5)' }}>👑</div>}
                {localConfig.accessory === 'glasses' && <div className="avatar-cyber-glasses" style={{ position: 'absolute', top: '40%', left: '15%', width: '70%', height: '15%', background: 'rgba(0,0,0,0.85)', border: '2px solid #0ff', borderRadius: '4px', boxShadow: '0 0 10px #0ff', zIndex: 10, backdropFilter: 'blur(2px)' }}></div>}
             </div>
             
             {/* Fase 6: Gráfico Radar de RPG Injetado */}
             <RPG_RadarChart config={localConfig} />
          </div>

          <div className="studio-controls" style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="control-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: 15, borderRadius: 10 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 800 }}>Efeitos Sonoros & Fala</label>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Bips de interface e narração.</span>
              </div>
              <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" checked={localConfig.soundEnabled} onChange={(e) => setLocalConfig({ ...localConfig, soundEnabled: e.target.checked })} style={{ width: 20, height: 20, accentColor: 'var(--accent-primary)' }} />
                <span style={{ fontSize: 14 }}>{localConfig.soundEnabled ? '🔊 Ligado' : '🔇 Mudo'}</span>
              </label>
            </div>

            <div className="control-group">
              <label style={{ display: 'block', marginBottom: 10, fontWeight: 800 }}>Aura de Energia (Cor)</label>
              <div className="color-grid" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {['#8b5cf6', '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#f472b6', '#ffffff'].map(color => (
                  <button key={color} title={`Mudar cor para ${color}`} style={{ background: color, width: 30, height: 30, borderRadius: '50%', border: localConfig.bodyColor === color ? '3px solid white' : 'none', cursor: 'pointer' }} onClick={() => setLocalConfig({ ...localConfig, bodyColor: color })} />
                ))}
              </div>
            </div>

            <div className="control-group">
              <label style={{ display: 'block', marginBottom: 10, fontWeight: 800 }}>Moldura Especial</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {['default', 'ouro', 'neon', 'holo'].map(b => (
                  <button key={b} title={`Borda estilo ${b}`} className="btn-ghost" style={{ flex: 1, padding: 8, border: localConfig.borderStyle === b ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.1)' }} onClick={() => setLocalConfig({ ...localConfig, borderStyle: b })}>
                    {b === 'default' ? 'Comum' : b === 'ouro' ? 'Ouro' : b === 'neon' ? 'Neon' : 'Holográfica'}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-group">
              <label style={{ display: 'block', marginBottom: 10, fontWeight: 800 }}>Efeitos Visuais</label>
              <select title="Selecione as partículas de fundo" className="input" style={{ width: '100%' }} value={localConfig.particles} onChange={(e) => setLocalConfig({ ...localConfig, particles: e.target.value })}>
                <option value="none">Nenhuma</option>
                <option value="fire">🔥 Aura de Fogo</option>
                <option value="matrix">💻 Código Matrix</option>
                <option value="snow">❄️ Nevasca</option>
              </select>
            </div>

            <div className="control-group">
              <label style={{ display: 'block', marginBottom: 10, fontWeight: 800 }}>Acessórios Extras</label>
              <select title="Adicione um enfeite 3D" className="input" style={{ width: '100%' }} value={localConfig.accessory} onChange={(e) => setLocalConfig({ ...localConfig, accessory: e.target.value })}>
                <option value="none">Nenhum</option>
                <option value="halo">Auréola Divina</option>
                <option value="crown">Coroa de Rei</option>
                <option value="glasses">Óculos Cyberpunk</option>
              </select>
            </div>

            <div className="control-group">
              <label style={{ display: 'block', marginBottom: 10, fontWeight: 800 }}>Presença (Opacidade: {localConfig.opacity}%)</label>
              <input title="Reduza para deixar o avatar transparente" type="range" min="20" max="100" value={localConfig.opacity} onChange={(e) => setLocalConfig({ ...localConfig, opacity: Number(e.target.value) })} style={{ width: '100%' }} />
            </div>

            <button title="Salvar todas as mudanças" className="btn btn-primary" style={{ width: '100%', padding: 15, cursor: 'pointer', marginTop: 10 }} onClick={() => onSave(localConfig)}>
              Salvar Identidade Visual
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
