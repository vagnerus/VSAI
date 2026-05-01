import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Widget Principal do Avatar ────────────────────────────
export function AvatarWidget({ profile, onUpdateProfile, onNavigate }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showStudio, setShowStudio] = useState(false);
  const [tourState, setTourState] = useState(null); // { step: 0, targets: [] }
  
  const config = profile?.custom_avatar || { bodyColor: '#8b5cf6', accessory: 'none' };
  
  // Lógica do Tour
  const startTour = () => {
    const targets = [
      { id: 'agents', msg: 'Aqui você encontra meus irmãos especialistas!' },
      { id: 'tools', msg: 'Estas ferramentas me dão superpoderes!' },
      { id: 'account', msg: 'Aqui você pode mudar minha aparência.' },
    ];
    setTourState({ step: 0, targets });
    setIsOpen(false);
  };

  const nextStep = () => {
    if (!tourState) return;
    if (tourState.step < tourState.targets.length - 1) {
      setTourState({ ...tourState, step: tourState.step + 1 });
    } else {
      setTourState(null);
    }
  };

  const currentTarget = tourState?.targets[tourState.step];
  const targetEl = currentTarget ? document.getElementById(currentTarget.id) : null;
  const targetRect = targetEl?.getBoundingClientRect();

  return (
    <>
      <div className="avatar-system-container" style={{ position: 'fixed', bottom: 30, right: 30, zIndex: 9999 }}>
        <AnimatePresence>
          {tourState && targetRect && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ 
                opacity: 1, 
                scale: 1,
                x: targetRect.left - window.innerWidth + 100,
                y: targetRect.top - window.innerHeight + 100
              }}
              exit={{ opacity: 0, scale: 0 }}
              className="avatar-tour-bubble"
              style={{ position: 'absolute', bottom: 120, right: 0, width: 200 }}
            >
              <div className="speech-bubble">
                {currentTarget.msg}
                <button onClick={nextStep} className="btn-tour-next">Próximo ➜</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          drag
          dragMomentum={false}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={() => setIsDragging(false)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9, cursor: 'grabbing' }}
          className="avatar-draggable-wrapper"
          style={{ width: 140, height: 140, cursor: 'grab', position: 'relative' }}
          onClick={() => !isDragging && setIsOpen(!isOpen)}
        >
          {/* Imagem do Avatar em 3D */}
          <div className={`avatar-3d-image ${isDragging ? 'dragging' : 'floating'}`}>
            <img 
              src="/avatar3d.png" 
              alt="VSAI Avatar" 
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'contain', 
                filter: `drop-shadow(0px 10px 15px ${config.bodyColor}66)`,
                borderRadius: '50%'
              }} 
            />
            {/* Halo / Acessório */}
            {config.accessory === 'halo' && (
              <div className="avatar-halo" style={{ borderTopColor: '#fbbf24' }}></div>
            )}
          </div>

          {/* Menu de Interação */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                className="avatar-menu glass-panel"
                onClick={(e) => e.stopPropagation()}
              >
                <button onClick={() => { if(onNavigate) onNavigate('chat'); setIsOpen(false); }}>💬 Falar com IA</button>
                <button onClick={() => setShowStudio(true)}>🎨 Personalizar</button>
                <button onClick={startTour}>🎮 Brincar (Tour)</button>
                <button onClick={() => window.open('mailto:suporte@vsai.ia')}>🎧 Suporte</button>
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
              onUpdateProfile({ ...profile, custom_avatar: newConfig });
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
                    width: '100%', height: '100%', objectFit: 'contain', 
                    filter: `drop-shadow(0px 10px 20px ${localConfig.bodyColor})` 
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
                    style={{ background: color, width: 30, height: 30, borderRadius: '50%', border: localConfig.bodyColor === color ? '3px solid white' : 'none' }} 
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

            <button className="btn btn-primary" style={{ width: '100%', padding: 15 }} onClick={() => onSave(localConfig)}>
              Salvar Identidade
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
