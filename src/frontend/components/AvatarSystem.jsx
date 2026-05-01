import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Mini Chat do Avatar ────────────────────────────────────
function MiniChatBubble({ initialPrompt, onClose }) {
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
          messages: messages.filter(m => m.role !== 'system'), // Envia o histórico do mini-chat
          model: 'gemini-1.5-flash',
          provider: 'gemini'
        })
      });

      if (!res.ok) throw new Error('Erro na API');
      
      const data = await res.json();
      setMessages(prev => [...prev, userMsg, { role: 'assistant', content: data.reply || data.content }]);
    } catch (err) {
      setMessages(prev => [...prev, userMsg, { role: 'assistant', content: 'Desculpe, tive um problema de conexão. Tente novamente!' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 20 }}
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

// ─── Widget Principal do Avatar ────────────────────────────
export function AvatarWidget({ profile, onUpdateProfile, onNavigate }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showStudio, setShowStudio] = useState(false);
  const [showMiniChat, setShowMiniChat] = useState(false);
  const [playMenuOpen, setPlayMenuOpen] = useState(false);
  const [miniChatContext, setMiniChatContext] = useState('');
  
  const config = profile?.custom_avatar || { bodyColor: '#8b5cf6', accessory: 'none' };
  
  const handlePlayAction = (prompt) => {
    setMiniChatContext(prompt);
    setShowMiniChat(true);
    setPlayMenuOpen(false);
    setIsOpen(false);
  };

  return (
    <>
      <div className="avatar-system-container" style={{ position: 'fixed', bottom: 30, right: 30, zIndex: 9999 }}>
        
        <AnimatePresence>
          {showMiniChat && (
            <MiniChatBubble 
              initialPrompt={miniChatContext} 
              onClose={() => { setShowMiniChat(false); setMiniChatContext(''); }} 
            />
          )}
        </AnimatePresence>

        <motion.div
          drag
          dragMomentum={false}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={() => setIsDragging(false)}
          whileTap={{ scale: 0.9, cursor: 'grabbing' }}
          className="avatar-draggable-wrapper"
          style={{ width: 140, height: 140, cursor: 'grab', position: 'relative' }}
          onClick={() => !isDragging && setIsOpen(!isOpen)}
        >
          {/* Imagem do Avatar em 3D */}
          <motion.div 
            whileHover={{ scale: 1.15 }}
            className={`avatar-3d-image ${isDragging ? 'dragging' : 'floating'}`}
          >
            <img 
              src="/avatar3d.png" 
              alt="VSAI Avatar" 
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover', 
                borderRadius: '50%',
                border: `3px solid ${config.bodyColor}`,
                boxShadow: `0 10px 25px ${config.bodyColor}66, inset 0 0 10px rgba(0,0,0,0.1)`,
                backgroundColor: '#fff'
              }} 
            />
            {/* Halo / Acessório */}
            {config.accessory === 'halo' && (
              <div className="avatar-halo" style={{ borderTopColor: '#fbbf24' }}></div>
            )}
          </motion.div>

          {/* Menu de Interação */}
          <AnimatePresence>
            {isOpen && !playMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.8 }}
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
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.8 }}
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
          width: 100%;
          height: 100%;
          position: relative;
          transition: transform 0.3s ease;
        }
        .avatar-3d-image.floating {
          animation: floatAvatar 3s ease-in-out infinite;
        }
        .avatar-3d-image.dragging {
          transform: scale(0.95);
        }
        .avatar-halo {
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
          width: 60px;
          height: 20px;
          border-radius: 50%;
          border: 4px solid transparent;
          border-top-color: #fbbf24;
          box-shadow: 0 -5px 15px rgba(251, 191, 36, 0.5);
          animation: floatHalo 3s ease-in-out infinite alternate;
        }
        @keyframes floatAvatar {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        @keyframes floatHalo {
          0% { transform: translateX(-50%) translateY(0px) rotateX(70deg); }
          100% { transform: translateX(-50%) translateY(-5px) rotateX(70deg); }
        }
      `}</style>
    </>
  );
}

// ─── Estúdio de Customização ────────────────────────────────
function AvatarStudio({ config, onClose, onSave }) {
  const [localConfig, setLocalConfig] = useState(config);

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="avatar-studio-overlay"
      style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 99999, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <motion.div 
        initial={{ y: 50 }} 
        animate={{ y: 0 }}
        className="avatar-studio-modal glass-panel"
      >
        <header className="studio-header">
          <h2>Estúdio de Criação VSAI</h2>
          <button onClick={onClose}>✕</button>
        </header>

        <div className="studio-content" style={{ display: 'flex', gap: 30, padding: 20 }}>
          <div className="studio-preview" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 20 }}>
             <div className="avatar-3d-image floating" style={{ width: 160, height: 160 }}>
                <img 
                  src="/avatar3d.png" 
                  alt="Preview" 
                  style={{ 
                    width: '100%', height: '100%', objectFit: 'cover', 
                    borderRadius: '50%',
                    border: `3px solid ${localConfig.bodyColor}`,
                    boxShadow: `0 10px 25px ${localConfig.bodyColor}66, inset 0 0 10px rgba(0,0,0,0.1)`,
                    backgroundColor: '#fff'
                  }} 
                />
                {localConfig.accessory === 'halo' && (
                  <div className="avatar-halo"></div>
                )}
             </div>
          </div>

          <div className="studio-controls" style={{ flex: 1 }}>
            <div className="control-group" style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 10, fontWeight: 800 }}>Aura de Energia (Cor do Avatar)</label>
              <div className="color-grid" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {['#8b5cf6', '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#f472b6'].map(color => (
                  <button 
                    key={color} 
                    style={{ background: color, width: 30, height: 30, borderRadius: '50%', border: localConfig.bodyColor === color ? '3px solid white' : 'none', cursor: 'pointer' }} 
                    onClick={() => setLocalConfig({ ...localConfig, bodyColor: color })}
                  />
                ))}
              </div>
            </div>

            <div className="control-group" style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 10, fontWeight: 800 }}>Acessórios</label>
              <select 
                className="input"
                style={{ width: '100%', padding: 10, borderRadius: 8, background: 'var(--bg-primary)', color: 'white' }}
                value={localConfig.accessory} 
                onChange={(e) => setLocalConfig({ ...localConfig, accessory: e.target.value })}
              >
                <option value="none">Nenhum</option>
                <option value="halo">Auréola Divina</option>
              </select>
            </div>

            <button className="btn btn-primary" style={{ width: '100%', padding: 15, cursor: 'pointer' }} onClick={() => onSave(localConfig)}>
              Salvar Identidade
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
