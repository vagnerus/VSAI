import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../providers/AuthProvider.jsx';

export default function LoginPage({ mode: initialMode = 'login', onNavigate }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { signInWithEmail, signUpWithEmail, signInWithOAuth, signInWithGoogle, resetPassword } = useAuth();
  
  const googleButtonRef = useRef(null);

  // Carregar o script do Google e renderizar o botão customizado
  useEffect(() => {
    if (mode === 'forgot') return;

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    console.log('[Google Auth] Client ID:', clientId ? 'Detectado' : 'AUSENTE');
    
    if (!clientId) {
      console.warn('VITE_GOOGLE_CLIENT_ID não encontrado no .env. Login do Google não funcionará.');
      return;
    }

    const loadGoogleScript = () => {
      if (window.google) {
        initializeGoogleSignIn();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogleSignIn;
      document.body.appendChild(script);
    };

    const initializeGoogleSignIn = () => {
      if (!window.google) return;
      
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleResponse,
        });

        if (googleButtonRef.current) {
          window.google.accounts.id.renderButton(
            googleButtonRef.current,
            { theme: 'outline', size: 'large', text: 'continue_with', width: '100%' }
          );
        }
      } catch (err) {
        console.error('[Google Auth] Erro ao renderizar botão:', err);
      }
    };

    loadGoogleScript();
  }, [mode]);

  const handleGoogleResponse = async (response) => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle(response.credential);
      onNavigate('app');
    } catch (err) {
      setError(err.message || 'Falha ao autenticar com o Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
        onNavigate('app');
      } else if (mode === 'register') {
        await signUpWithEmail(email, password, fullName);
        setSuccess('Conta criada! Faça login agora.');
        setMode('login');
      } else if (mode === 'forgot') {
        await resetPassword(email);
        setSuccess('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
        setMode('login');
      }
    } catch (err) {
      const msg = err?.message || 'Erro desconhecido';
      if (msg.includes('Invalid login')) setError('E-mail ou senha incorretos.');
      else if (msg.includes('already registered')) setError('Este e-mail já está cadastrado.');
      else if (msg.includes('Password should')) setError('A senha deve ter pelo menos 6 caracteres.');
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider) => {
    try {
      await signInWithOAuth(provider);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg-effects">
        <div className="auth-orb auth-orb-1"></div>
        <div className="auth-orb auth-orb-2"></div>
        <div className="auth-orb auth-orb-3"></div>
      </div>

      <div className="auth-container">
        <div className="auth-card">
          {/* Logo */}
          <div className="auth-logo" onClick={() => onNavigate('landing')}>
            <div className="landing-logo-icon">🧠</div>
            <span className="landing-logo-text">VSAI - IA</span>
          </div>

          {/* Title */}
          <h1 className="auth-title">
            {mode === 'login' && 'Bem-vindo de volta'}
            {mode === 'register' && 'Criar sua conta'}
            {mode === 'forgot' && 'Recuperar senha'}
          </h1>
          <p className="auth-subtitle">
            {mode === 'login' && 'Entre para acessar sua plataforma de IA'}
            {mode === 'register' && 'Comece gratuitamente, sem cartão de crédito'}
            {mode === 'forgot' && 'Enviaremos um link para redefinir sua senha'}
          </p>

          {/* OAuth buttons */}
          {mode !== 'forgot' && (
            <div className="auth-oauth">
              {/* Contêiner nativo do Google onde o botão oficial será injetado */}
              <div ref={googleButtonRef} className="google-btn-container" style={{ width: '100%', marginBottom: '10px' }}></div>
              
              <button className="auth-oauth-btn" onClick={() => handleOAuth('github')} type="button">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                GitHub
              </button>
            </div>
          )}

          {mode !== 'forgot' && <div className="auth-divider"><span>ou</span></div>}

          {/* Messages */}
          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          {/* Form */}
          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'register' && (
              <div className="auth-field">
                <label>Nome completo</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Seu nome" required />
              </div>
            )}
            <div className="auth-field">
              <label>E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required autoFocus />
            </div>
            {mode !== 'forgot' && (
              <div className="auth-field">
                <label>Senha</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
              </div>
            )}

            {mode === 'login' && (
              <button type="button" className="auth-forgot-link" onClick={() => { setMode('forgot'); setError(''); }}>
                Esqueceu sua senha?
              </button>
            )}

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? (
                <span className="auth-spinner"></span>
              ) : (
                <>
                  {mode === 'login' && '🔓 Entrar'}
                  {mode === 'register' && '🚀 Criar Conta'}
                  {mode === 'forgot' && '📧 Enviar Link'}
                </>
              )}
            </button>
          </form>

          {/* Switch mode */}
          <div className="auth-switch">
            {mode === 'login' && (
              <>Não tem conta? <button type="button" onClick={() => { setMode('register'); setError(''); }}>Criar conta</button></>
            )}
            {mode === 'register' && (
              <>Já tem conta? <button type="button" onClick={() => { setMode('login'); setError(''); }}>Entrar</button></>
            )}
            {mode === 'forgot' && (
              <>Lembrou? <button type="button" onClick={() => { setMode('login'); setError(''); }}>Voltar ao login</button></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
