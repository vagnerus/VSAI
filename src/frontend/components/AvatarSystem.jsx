import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Float, Sphere, MeshDistortMaterial, Text, PerspectiveCamera } from '@react-three/drei';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import * as THREE from 'three';

// ─── Componente de Avatar 3D (Three.js) ─────────────────────
function ThreeAvatar({ config, isDragging }) {
  const group = useRef();
  const legs = useRef();

  // Animação de idle e drag
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    
    if (isDragging) {
      // Animação de "batendo as pernas" (kicking)
      legs.current.rotation.x = Math.sin(t * 15) * 0.5;
      group.current.rotation.y = Math.sin(t * 10) * 0.2;
    } else {
      // Idle sutil
      legs.current.rotation.x = Math.sin(t * 2) * 0.1;
      group.current.rotation.y = Math.sin(t * 0.5) * 0.1;
    }
  });

  return (
    <group ref={group}>
      {/* Corpo Principal */}
      <Sphere args={[1, 32, 32]} position={[0, 1, 0]}>
        <MeshDistortMaterial 
          color={config.bodyColor || '#8b5cf6'} 
          speed={2} 
          distort={0.3} 
          metalness={0.8} 
          roughness={0.2} 
        />
      </Sphere>

      {/* Olhos */}
      <group position={[0, 1.2, 0.8]}>
        <Sphere args={[0.1, 16, 16]} position={[-0.3, 0, 0]}>
          <meshStandardMaterial color="#000" />
        </Sphere>
        <Sphere args={[0.1, 16, 16]} position={[0.3, 0, 0]}>
          <meshStandardMaterial color="#000" />
        </Sphere>
      </group>

      {/* Pernas (Batendo) */}
      <group ref={legs} position={[0, 0.2, 0]}>
        <mesh position={[-0.4, -0.4, 0]}>
          <capsuleGeometry args={[0.15, 0.4, 4, 8]} />
          <meshStandardMaterial color={config.bodyColor || '#8b5cf6'} />
        </mesh>
        <mesh position={[0.4, -0.4, 0]}>
          <capsuleGeometry args={[0.15, 0.4, 4, 8]} />
          <meshStandardMaterial color={config.bodyColor || '#8b5cf6'} />
        </mesh>
      </group>

      {/* Acessório (Ex: Auréola ou Chapéu) */}
      {config.accessory === 'halo' && (
        <mesh position={[0, 2.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.5, 0.05, 16, 32]} />
          <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={2} />
        </mesh>
      )}
    </group>
  );
}

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
          style={{ width: 120, height: 120, cursor: 'grab' }}
          onClick={() => !isDragging && setIsOpen(!isOpen)}
        >
          <Canvas shadows camera={{ position: [0, 0, 5], fov: 40 }}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1.5} />
            <Suspense fallback={null}>
              <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
                <ThreeAvatar config={config} isDragging={isDragging} />
              </Float>
            </Suspense>
          </Canvas>

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

        <div className="studio-content">
          <div className="studio-preview">
            <Canvas camera={{ position: [0, 0, 5] }}>
              <ambientLight intensity={0.7} />
              <pointLight position={[5, 5, 5]} />
              <ThreeAvatar config={localConfig} />
              <OrbitControls enableZoom={false} />
            </Canvas>
          </div>

          <div className="studio-controls">
            <div className="control-group">
              <label>Cor do Corpo</label>
              <div className="color-grid">
                {['#8b5cf6', '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#f472b6'].map(color => (
                  <button 
                    key={color} 
                    style={{ background: color }} 
                    className={localConfig.bodyColor === color ? 'active' : ''}
                    onClick={() => setLocalConfig({ ...localConfig, bodyColor: color })}
                  />
                ))}
              </div>
            </div>

            <div className="control-group">
              <label>Acessórios</label>
              <select 
                value={localConfig.accessory} 
                onChange={(e) => setLocalConfig({ ...localConfig, accessory: e.target.value })}
              >
                <option value="none">Nenhum</option>
                <option value="halo">Auréola Divina</option>
              </select>
            </div>

            <button className="btn-save-avatar" onClick={() => onSave(localConfig)}>
              Salvar Identidade
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
