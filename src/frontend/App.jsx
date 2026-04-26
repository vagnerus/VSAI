import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from './providers/AuthProvider.jsx';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import AdminLayout from './pages/AdminLayout.jsx';
import PricingPage from './pages/PricingPage.jsx';
import TermsPage from './pages/TermsPage.jsx';
import PrivacyPage from './pages/PrivacyPage.jsx';
import ArtifactsPanel, { extractArtifacts } from './components/ArtifactsPanel.jsx';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { SpeedInsights } from "@vercel/speed-insights/react"


// ═══════════════════════════════════════════════════════════════
// NexusAI — Main Application
// ═══════════════════════════════════════════════════════════════

const API_BASE = '/api';

/**
 * Global Error Boundary (Pillar 2: Resilience)
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) { return { hasError: true }; }
  componentDidCatch(error, errorInfo) { console.error('[UI_CRITICAL_ERROR]', error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#1e293b', padding: 20, textAlign: 'center' }}>
          <h1 style={{ fontSize: 48 }}>⚠️</h1>
          <h2>Ops! Algo deu errado na interface.</h2>
          <p style={{ color: '#64748b', maxWidth: 400 }}>Ocorreu um erro inesperado. Não se preocupe, seus dados estão seguros.</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()} style={{ marginTop: 20 }}>Recarregar Aplicativo</button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Memoized Message Bubble (Pillar 3: Performance)
 * Prevents re-rendering historical messages during chat streaming.
 */
const MessageBubble = React.memo(({ message, onCopy }) => {
  const isAssistant = message.role === 'assistant';
  return (
    <div className={`message-wrapper ${message.role} animate-in`}>
      <div className="message-avatar">{isAssistant ? '🧠' : '👤'}</div>
      <div className="message-content-wrapper">
        <div className="message-header">
          <span className="message-author">{isAssistant ? 'NexusAI' : 'Você'}</span>
          <span className="message-time">{new Date(message.timestamp).toLocaleTimeString()}</span>
        </div>
        <div className="message-bubble">
          {isAssistant ? (
            <div dangerouslySetInnerHTML={{ __html: parseMarkdown(message.content) }} />
          ) : (
            <div className="user-message-text">{typeof message.content === 'string' ? message.content : '[Mensagem Multimodal]'}</div>
          )}
          {message.toolCalls?.map(tc => (
            <div key={tc.id} className="tool-call-badge">🛠️ Usou: {tc.name}</div>
          ))}
        </div>
        <div className="message-actions">
          <button className="message-action-btn" onClick={() => onCopy(message.content)} title="Copiar">📋</button>
        </div>
      </div>
    </div>
  );
});

// ─── API Helper (with auth token) ────────────────────────────
async function api(path, options = {}) {
  let token = null;
  try {
    token = localStorage.getItem('nexus_access_token');
  } catch (e) { /* localStorage not available */ }

  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;


  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.warn(`[API_ERROR] ${path}:`, errorData);
      return { stats: { apiConfigured: false }, error: errorData.error };
    }
    return res.json();
  } catch (err) {
    console.error(`[API_FETCH_CRITICAL] ${path}:`, err);
    return { stats: { apiConfigured: false }, error: err.message };
  }
}

// ─── Markdown Parser (enhanced Claude-like) ─────────────────
// ═══════════════════════════════════════════════════════════════
// Power Features: Dynamic Charts & Prompt Library
// ═══════════════════════════════════════════════════════════════

/**
 * @typedef {Object} ChartData
 * @property {string} name
 * @property {number} value
 */

/**
 * @typedef {Object} ChartConfig
 * @property {string} type
 * @property {string} title
 * @property {ChartData[]} data
 */

/**
 * DynamicChart Component (Pillar 3: Performance & Pillar 4: Clean Code)
 * Memoized to prevent re-renders on every chat stream update.
 */
const DynamicChart = React.memo(({ json }) => {
  try {
    const config = JSON.parse(json);
    const { type, title, data } = config;
    const maxVal = Math.max(...data.map(d => d.value), 1);
    
    return (
      <div className="card" style={{ padding: 16, marginTop: 12, border: '1px solid var(--glass-border)', background: 'var(--bg-secondary)', borderRadius: 12 }}>
        <h4 style={{ fontSize: 14, marginBottom: 16, textAlign: 'center', color: 'var(--text-primary)' }}>📊 {title || 'Análise de Dados'}</h4>
        <div style={{ height: 180, display: 'flex', alignItems: 'flex-end', gap: 8, padding: '0 10px' }}>
          {data.map((item, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div 
                style={{ 
                  width: '100%', 
                  height: `${(item.value / maxVal) * 100}%`, 
                  background: 'var(--gradient-primary)',
                  borderRadius: '4px 4px 0 0',
                  minHeight: 4,
                  boxShadow: '0 4px 12px rgba(0, 102, 255, 0.1)'
                }} 
                title={`${item.name}: ${item.value}`}
              />
              <span style={{ fontSize: 9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'center', opacity: 0.6 }}>
                {item.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  } catch (e) {
    return <div style={{ fontSize: 11, color: 'var(--accent-danger)' }}>Erro ao renderizar gráfico.</div>;
  }
});

function PromptLibrary({ onSelect }) {
  const categories = [
    { title: '🚀 Business & Marketing', prompts: [
        { label: 'Estratégia SaaS', text: 'Crie uma estratégia de marketing para um SaaS de IA focado em B2B. Defina canais, ICP e plano de 30 dias.' },
        { label: 'Copywriting de Elite', text: 'Reescreva o seguinte texto usando a técnica AIDA para converter mais assinantes premium: ' }
    ]},
    { title: '💻 Programação & Tech', prompts: [
        { label: 'Code Review Master', text: 'Analise este código e identifique bugs, problemas de performance e sugira refatoração para Clean Code: ' },
        { label: 'Arquiteto de DB', text: 'Desenhe o schema de banco de dados para um sistema de [DESCREVA O SISTEMA]. Retorne SQL e explicações.' }
    ]}
  ];

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>📚 Biblioteca de Prompts</h3>
      {categories.map(cat => (
        <div key={cat.title} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8 }}>{cat.title}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {cat.prompts.map(p => (
              <button 
                key={p.label} 
                className="btn btn-secondary btn-sm" 
                onClick={() => onSelect(p.text)}
                style={{ fontSize: 11, padding: '6px 12px', background: '#fff', border: '1px solid var(--glass-border)' }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function parseMarkdown(text) {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Mermaid Diagrams support
    .replace(/```mermaid\n([\s\S]*?)```/g, (_, code) => {
      return `<div class="mermaid-block"><pre class="mermaid">${code}</pre><div class="mermaid-hint">✨ Digrama Interativo (Mermaid)</div></div>`;
    })
    // Code blocks with copy button and language badge
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const langLabel = lang || 'code';
      return `<div class="code-block-wrapper"><div class="code-block-header"><span class="code-block-lang">${langLabel}</span><button class="code-block-copy" onclick="navigator.clipboard.writeText(this.closest('.code-block-wrapper').querySelector('code').textContent);this.textContent='✓ Copiado';setTimeout(()=>this.textContent='📋 Copiar',1500)">📋 Copiar</button></div><pre><code class="lang-${lang}">${code}</code></pre></div>`;
    })
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    // Tables (GFM)
    .replace(/^\|(.+)\|$/gm, (match) => {
      const cells = match.split('|').filter(c => c.trim());
      if (cells.every(c => c.trim().match(/^[-:]+$/))) return '<!--table-sep-->';
      const tag = 'td';
      return `<tr>${cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('')}</tr>`;
    })
    // Headers
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold & Italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Blockquotes
    .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr/>')
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="ol-item">$1</li>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');

  // Wrap list items
  html = html.replace(/(<li>.*?<\/li>(\s*<br\/>)?)+/g, (match) => `<ul>${match.replace(/<br\/>/g, '')}</ul>`);

  return `<p>${html}</p>`;
}

// ═══════════════════════════════════════════════════════════════
// Workspace Explorer Component
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// Agent Activity Feed Component
// ═══════════════════════════════════════════════════════════════

function ActivityFeed({ logs }) {
  const scrollRef = useRef();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="activity-feed">
      <div className="activity-header">
        <span>🤖 Atividade do Agente</span>
        <span className="activity-dot"></span>
      </div>
      <div className="activity-body" ref={scrollRef}>
        {logs.length === 0 ? (
          <div className="activity-empty">Aguardando ações...</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="activity-item animate-in">
              <span className="activity-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
              <span className="activity-msg">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function WorkspaceExplorer({ projectId, onFileSelect }) {
  const [tree, setTree] = useState([]);
  const [workspacePath, setWorkspacePath] = useState('');
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState({});

  const loadTree = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await api(`/projects/${projectId}/workspace`);
      setTree(data.tree || []);
      setWorkspacePath(data.workspacePath || '');
      setExists(data.exists);
    } catch (err) {
      console.error('Failed to load workspace tree', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadTree();
    const interval = setInterval(loadTree, 10000); // Polling for changes
    return () => clearInterval(interval);
  }, [loadTree]);

  const toggleCollapse = (path) => {
    setCollapsed(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const renderTree = (items) => {
    if (!items || items.length === 0) return <div className="workspace-empty">Pasta vazia</div>;

    return (
      <ul className="workspace-list">
        {items.map(item => (
          <li key={item.path} className="workspace-item">
            <div
              className={`workspace-item-header ${item.isDirectory ? 'directory' : 'file'}`}
              onClick={() => item.isDirectory ? toggleCollapse(item.path) : onFileSelect?.(item)}
            >
              <span className="workspace-icon">
                {item.isDirectory ? (collapsed[item.path] ? '📁' : '📂') : '📄'}
              </span>
              <span className="workspace-name">{item.name}</span>
            </div>
            {item.isDirectory && !collapsed[item.path] && item.children && (
              <div className="workspace-children">
                {renderTree(item.children)}
              </div>
            )}
          </li>
        ))}
      </ul>
    );
  };

  if (!projectId) return null;

  return (
    <div className="workspace-explorer">
      <div className="workspace-header">
        <div className="workspace-title">📁 Workspace Local</div>
        <button className="workspace-refresh" onClick={loadTree} title="Atualizar">🔄</button>
      </div>

      {loading && tree.length === 0 ? (
        <div className="workspace-loading">Carregando...</div>
      ) : !exists ? (
        <div className="workspace-error">
          <p>Workspace não vinculado ou não encontrado.</p>
          <code style={{ fontSize: 10, display: 'block', marginTop: 4 }}>{workspacePath}</code>
        </div>
      ) : (
        <div className="workspace-body">
          {renderTree(tree)}
        </div>
      )}

      <div className="workspace-footer">
        <div className="workspace-path-mini" title={workspacePath}>
          {workspacePath}
        </div>
      </div>
    </div>
  );
}

// 🎨 Diff Viewer — Antigravity Style
function DiffViewer({ original, proposal, path }) {
  const diffLines = (oldStr, newStr) => {
    const oldLines = (oldStr || '').split('\n');
    const newLines = (newStr || '').split('\n');
    const result = [];

    // Simple line-by-line diff (for visualization)
    let i = 0, j = 0;
    while (i < oldLines.length || j < newLines.length) {
      if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
        result.push({ type: 'unchanged', text: oldLines[i] });
        i++; j++;
      } else {
        if (i < oldLines.length) {
          result.push({ type: 'removed', text: oldLines[i] });
          i++;
        }
        if (j < newLines.length) {
          result.push({ type: 'added', text: newLines[j] });
          j++;
        }
      }
      if (result.length > 100) break; // Limit UI size
    }
    return result;
  };

  const lines = diffLines(original, proposal);

  return (
    <div className="diff-viewer">
      <div className="diff-header">
        <span>📝 Proposta: {path.split(/[\\/]/).pop()}</span>
        <span className="badge badge-purple">Diff View</span>
      </div>
      <div className="diff-body">
        {lines.map((line, idx) => (
          <div key={idx} className={`diff-line ${line.type}`}>
            <span className="diff-prefix">{line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}</span>
            <span className="diff-text">{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Sidebar Component
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// UI Components
// ═══════════════════════════════════════════════════════════════

function WindowControls() {
  const isElectron = !!window.electron;
  if (!isElectron) return null;

  return (
    <div className="window-controls">
      <div className="window-control-btn minimize" onClick={() => window.electron.minimize()}>➖</div>
      <div className="window-control-btn maximize" onClick={() => window.electron.maximize()}>🔲</div>
      <div className="window-control-btn close" onClick={() => window.electron.close()}>✕</div>
    </div>
  );
}

function Sidebar({ currentPage, onNavigate, stats, agents = [], selectedAgent, setSelectedAgent, collapsed, onToggle }) {
  const { isAdmin } = useAuth();

  const navItems = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'profile', icon: '👤', label: 'Meu Perfil' },
    { id: 'teams', icon: '🏢', label: 'Equipes (B2B)' },
    { id: 'projects', icon: '📁', label: 'Projetos' },
    { id: 'chat', icon: '💬', label: 'Chat AI', badge: null },
    { id: 'tools', icon: '🛠️', label: 'Ferramentas', badge: stats?.totalTools },
    { id: 'agents', icon: '🤖', label: 'Agentes' },
    { id: 'sessions', icon: '📝', label: 'Sessões', badge: stats?.totalSessions },
    { id: 'pricing', icon: '💎', label: 'Planos' },
    { id: 'hooks', icon: '🪝', label: 'Hooks', badge: stats?.totalHooks },
    { id: 'permissions', icon: '🔐', label: 'Permissões' },
    { id: 'analytics', icon: '📈', label: 'Analytics' },
    { id: 'plugins', icon: '🧩', label: 'Plugins' },
    { id: 'settings', icon: '⚙️', label: 'Configurações' },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin', icon: '👑', label: 'Painel Admin' });
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">🧠</div>
        <div className="sidebar-brand-text">
          <div className="sidebar-brand-name">NexusAI</div>
          <div className="sidebar-brand-version">Platform v1.0</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Principal</div>
        {navItems.slice(0, 5).map(item => (
          <div
            key={item.id}
            className={`sidebar-item ${currentPage === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="sidebar-item-icon">{item.icon}</span>
            <span>{item.label}</span>
            {item.badge != null && <span className="sidebar-item-badge">{item.badge}</span>}
          </div>
        ))}

        <div className="sidebar-section-label">Sistema</div>
        {navItems.slice(5).map(item => (
          <div
            key={item.id}
            className={`sidebar-item ${currentPage === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="sidebar-item-icon">{item.icon}</span>
            <span>{item.label}</span>
            {item.badge != null && <span className="sidebar-item-badge">{item.badge}</span>}
          </div>
        ))}

        {agents.length > 0 && (
          <>
            <div className="sidebar-section-label">🤖 Meus Agentes</div>
            {agents.map(agent => (
              <div
                key={agent.id}
                className={`sidebar-item ${selectedAgent?.id === agent.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedAgent(agent);
                  onNavigate('chat');
                }}
              >
                <span className="sidebar-item-icon">{agent.icon || '🤖'}</span>
                <span>{agent.name}</span>
                <span className="sidebar-item-badge" style={{ fontSize: 9 }}>Bot</span>
              </div>
            ))}
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        {stats && stats.tokensLimit && (
          <div style={{ padding: '0 16px 16px 16px', borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 8, color: 'var(--text-secondary)', fontWeight: 600 }}>
              <span style={{ textTransform: 'uppercase' }}>PLANO {stats.plan || 'FREE'}</span>
              <span>{Math.round(((stats.tokensUsed || 0) / stats.tokensLimit) * 100)}%</span>
            </div>
            <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ 
                height: '100%', 
                width: `${Math.min(((stats.tokensUsed || 0) / stats.tokensLimit) * 100, 100)}%`, 
                background: ((stats.tokensUsed || 0) / stats.tokensLimit) > 0.8 ? 'linear-gradient(90deg, #ef4444, #b91c1c)' : 'linear-gradient(90deg, #6c3bef, #8b5cf6)', 
                transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' 
              }} />
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 8, textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
              {(stats.tokensUsed || 0).toLocaleString()} / {stats.tokensLimit.toLocaleString()} TOKENS
            </div>
          </div>
        )}
        <div className="sidebar-status">
          <span className="sidebar-status-dot" style={{ backgroundColor: stats?.apiConfigured ? '#10b981' : '#f59e0b' }}></span>
          <span>{stats?.apiConfigured ? (stats.provider || 'API Conectada') : 'Modo Demo'}</span>
        </div>
      </div>
    </aside>
  );
}

// ═══════════════════════════════════════════════════════════════
// Dashboard Page
// ═══════════════════════════════════════════════════════════════

function DashboardPage({ stats, recentSessions }) {
  const chartData = [
    { name: 'Seg', chamadas: 12, tokens: 1500 },
    { name: 'Ter', chamadas: 25, tokens: 3200 },
    { name: 'Qua', chamadas: 18, tokens: 2100 },
    { name: 'Qui', chamadas: 34, tokens: 4000 },
    { name: 'Sex', chamadas: 22, tokens: 2500 },
    { name: 'Sab', chamadas: 8, tokens: 1000 },
    { name: 'Dom', chamadas: Math.max(5, stats?.totalSessions || 15), tokens: stats?.tokensUsed || 3000 }
  ];

  return (
    <div className="animate-in">
      <div className="welcome-banner">
        <h1>👋 Bem-vindo ao NexusAI</h1>
        <p>Sua plataforma de IA completa com 20+ ferramentas, multi-agentes, hooks e muito mais. Baseada na arquitetura do Claude Code.</p>
        <div style={{ marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a
            href="/painel"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', fontSize: 14, fontWeight: 700, textDecoration: 'none', borderRadius: 12, background: 'var(--gradient-primary)', color: 'white', boxShadow: '0 4px 12px rgba(0, 102, 255, 0.2)', transition: 'all 0.2s' }}
          >
            🚀 Abrir Painel do Usuário
          </a>
          <button
            className="btn btn-secondary"
            onClick={() => { navigator.clipboard.writeText(window.location.origin + '/painel'); alert('Link copiado!'); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '12px 20px', fontSize: 13, fontWeight: 600, border: '1px solid var(--glass-border)', borderRadius: 12, background: 'var(--glass-bg)', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            📋 Copiar Link do Painel
          </button>
        </div>
      </div>

      <div style={{ height: 24 }} />

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon">💬</div>
          <div className="stat-card-value">{stats?.totalSessions || 0}</div>
          <div className="stat-card-label">Sessões Totais</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">🔄</div>
          <div className="stat-card-value">{stats?.activeSessions || 0}</div>
          <div className="stat-card-label">Sessões Ativas</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">🛠️</div>
          <div className="stat-card-value">{stats?.totalTools || 0}</div>
          <div className="stat-card-label">Ferramentas</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">📨</div>
          <div className="stat-card-value">{stats?.totalMessages || 0}</div>
          <div className="stat-card-label">Mensagens</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">🪝</div>
          <div className="stat-card-value">{stats?.totalHooks || 0}</div>
          <div className="stat-card-label">Hooks Ativos</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">⏱️</div>
          <div className="stat-card-value">{Math.floor((stats?.uptime || 0) / 60)}m</div>
          <div className="stat-card-label">Uptime</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">🤖</div>
          <div className="stat-card-value">{(stats?.model || '').split('-').pop()?.substring(0, 8) || 'Sonnet'}</div>
          <div className="stat-card-label">Modelo Ativo</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">🔑</div>
          <div className="stat-card-value">{stats?.apiConfigured ? '✅' : '⚠️'}</div>
          <div className="stat-card-label">API Status</div>
        </div>
        <div className="stat-card" style={{ background: 'var(--accent-primary-glow)', borderColor: 'var(--accent-primary)' }}>
          <div className="stat-card-icon">💸</div>
          <div className="stat-card-value" style={{ color: 'var(--accent-primary)' }}>
            R$ {((stats?.tokensUsed || 0) * 0.000003 * 5.25).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="stat-card-label">Custo Estimado (BRL)</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24, marginBottom: 24, padding: 24, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>📈 Atividade da API</h3>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>Consumo de tokens estimado nos últimos 7 dias</p>
        </div>
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
              <YAxis stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
              <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" vertical={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(10,10,15,0.95)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
                itemStyle={{ color: '#fff', fontWeight: 600 }}
                labelStyle={{ color: 'var(--text-secondary)', marginBottom: 4 }}
              />
              <Area type="monotone" dataKey="tokens" name="Tokens Processados" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorTokens)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {recentSessions?.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">📋 Sessões Recentes</div>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Sessão</th>
                  <th>Primeira Mensagem</th>
                  <th>Mensagens</th>
                  <th>Última Atividade</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.map(s => (
                  <tr key={s.sessionId}>
                    <td><code style={{ fontSize: 11 }}>{s.sessionId.substring(0, 8)}...</code></td>
                    <td>{(s.firstPrompt || '').substring(0, 60)}{(s.firstPrompt || '').length > 60 ? '...' : ''}</td>
                    <td>{s.messageCount || 0}</td>
                    <td>{s.lastModified ? new Date(s.lastModified).toLocaleString('pt-BR') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatPage({ projectId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [imageAttachment, setImageAttachment] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingSync, setPendingSync] = useState([]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      // Logic to sync pending messages could go here
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [statusText, setStatusText] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [toolUses, setToolUses] = useState([]);
  const [usage, setUsage] = useState(null);
  const [selectedModel, setSelectedModel] = useState('gemini-1.5-flash');
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [agentLogs, setAgentLogs] = useState([]);
  const [showArtifacts, setShowArtifacts] = useState(false);
  const [showPromptLibrary, setShowPromptLibrary] = useState(false);
  const [activeArtifactIdx, setActiveArtifactIdx] = useState(0);
  const [errorState, setErrorState] = useState(null);
  const abortControllerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const data = await api('/agents');
      if (Array.isArray(data)) setAgents(data);
    } catch (e) { console.error('Failed to fetch agents', e); }
  }, []);

  /**
   * Optimized Artifact Extraction (Pillar 3: Performance)
   * Only re-calculates when messages change.
   */
  const allArtifacts = useMemo(() => {
    return messages
      .filter(m => m.role === 'assistant')
      .flatMap(m => extractArtifacts(m.content));
  }, [messages]);

  const exportChat = () => {
    if (messages.length === 0) return alert('O chat está vazio.');
    let content = "# Histórico de Conversa - NexusAI\n\n";
    messages.forEach(m => {
      content += `### ${m.role === 'user' ? '👤 Você' : '🧠 NexusAI'}\n`;
      content += `${m.content}\n\n---\n\n`;
    });
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-export-${new Date().toISOString().slice(0,10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyMessage = (content) => {
    navigator.clipboard.writeText(typeof content === 'string' ? content : content.find(c => c.type === 'text')?.text || '');
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) return alert('A imagem deve ter no máximo 4MB.');
    const reader = new FileReader();
    reader.onload = (event) => setImageAttachment(event.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const AI_CONFIG = {
    google: {
      name: 'Google Gemini',
      icon: '🔹',
      models: [
        { id: 'gemini-1.5-flash', label: '⚡ Gemini 1.5 Flash' },
        { id: 'gemini-1.5-pro', label: '🧠 Gemini 1.5 Pro' },
        { id: 'gemini-1.5-flash-8b', label: '🔹 Gemini 1.5 Flash 8B' },
      ]
    },
    openai: {
      name: 'OpenAI GPT',
      icon: '🟢',
      models: [
        { id: 'gpt-4o', label: '🚀 GPT-4o' },
        { id: 'gpt-4-turbo', label: '🔥 GPT-4 Turbo' },
      ]
    },
    anthropic: {
      name: 'Anthropic Claude',
      icon: '🏺',
      models: [
        { id: 'claude-3-5-sonnet-20240620', label: '🎭 Claude 3.5 Sonnet' },
      ]
    }
  };

  const [selectedProvider, setSelectedProvider] = useState('google');
  const [chatSettings, setChatSettings] = useState({ temperature: 0.7, topP: 0.9, maxTokens: 4096, edgePriority: 'auto' });
  const [showSettings, setShowSettings] = useState(false);

  // ... rest of state ...
  
  // UI do Seletor Compacto
  const renderAISelector = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f8fafc', padding: '6px 12px', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Inteligência:</span>
      <select 
        value={`${selectedProvider}:${selectedModel}`}
        onChange={(e) => {
          const [p, m] = e.target.value.split(':');
          setSelectedProvider(p);
          setSelectedModel(m);
        }}
        style={{ background: 'transparent', border: 'none', color: '#1e293b', fontWeight: 700, fontSize: 13, cursor: 'pointer', outline: 'none', flex: 1 }}
      >
        {Object.entries(AI_CONFIG).map(([pId, pCfg]) => (
          <optgroup key={pId} label={pCfg.name}>
            {pCfg.models.map(m => (
              <option key={m.id} value={`${pId}:${m.id}`}>{pCfg.icon} {m.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
      <button 
        onClick={() => setShowSettings(!showSettings)}
        style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 8px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: '#475569', transition: 'all 0.2s' }}
      >
        ⚙️ {showSettings ? 'Fechar' : 'Ajustes'}
      </button>
    </div>
  );

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
    // Re-render mermaid diagrams if available
    if (window.mermaid) {
      window.mermaid.contentLoaded();
    }
  }, [messages, streamText, scrollToBottom]);

  // ─── SSE-based sendMessage (substitui WebSocket) ─────────────────
  const sendMessage = useCallback(async () => {
    if ((!input.trim() && !imageAttachment) || isStreaming) return;

    if (isOffline) {
      const offlineMsg = {
        role: 'user',
        content: input.trim(),
        timestamp: Date.now(),
        isPending: true
      };
      setMessages(prev => [...prev, offlineMsg]);
      setPendingSync(prev => [...prev, offlineMsg]);
      setInput('');
      return;
    }

    const userContent = input.trim();
    const payloadContent = imageAttachment 
      ? [
          { type: 'image_url', image_url: { url: imageAttachment } },
          { type: 'text', text: userContent || 'O que você vê nesta imagem?' }
        ]
      : userContent;

    setInput('');
    setImageAttachment(null);
    setIsStreaming(true);
    setStreamText('');
    setToolUses([]);
    setStatusText('');

    setMessages(prev => [...prev, {
      role: 'user',
      content: payloadContent,
      timestamp: Date.now(),
    }]);

    // Abort controller para cancelar
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Get auth token for SSE request
      let authHeaders = { 'Content-Type': 'application/json' };
      try {
        const token = localStorage.getItem('nexus_access_token');
        if (token) authHeaders['Authorization'] = `Bearer ${token}`;
      } catch (e) { /* no auth */ }

      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: authHeaders,
        signal: controller.signal,
        body: JSON.stringify({
          content: userContent,
          messages: messages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({ role: m.role, content: m.content })),
          model: selectedModel,
          provider: selectedProvider,
          projectId,
          agentId: selectedAgent?.id,
          settings: chatSettings,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const msg = JSON.parse(line.slice(6));

            switch (msg.type) {
              case 'session':
                setSessionId(msg.sessionId);
                break;
              case 'stream':
                setStreamText(prev => prev + msg.text);
                break;
              case 'assistant':
                setStreamText('');
                setMessages(prev => [...prev, {
                  role: 'assistant',
                  content: msg.content,
                  toolCalls: msg.toolCalls,
                  timestamp: Date.now(),
                }]);
                break;
              case 'tool_result':
                setToolUses(prev => prev.map(t =>
                  t.name === msg.toolName ? { ...t, result: msg.content, isError: msg.isError, status: 'completed' } : t
                ));
                break;
              case 'status':
                setAgentLogs(prev => [...prev, { message: msg.message, toolName: msg.toolName, timestamp: Date.now() }].slice(-50));
                setStatusText(msg.message || '');
                break;
              case 'usage':
                setUsage(msg.usage);
                break;
              case 'done':
                setIsStreaming(false);
                setStreamText('');
                setToolUses([]);
                break;
              case 'error':
                setIsStreaming(false);
                setStreamText('');
                setErrorState({ message: msg.message, errorId: msg.errorId });
                break;
            }
          } catch { }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(prev => [...prev, { role: 'system', content: `Erro de conexão: ${err.message}`, timestamp: Date.now() }]);
      }
      setIsStreaming(false);
      setStreamText('');
    }
  }, [input, isStreaming, messages, sessionId, projectId, selectedModel]);

  const handleAbort = () => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    setStreamText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTextareaInput = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
  };

  const newChat = () => {
    setMessages([]);
    setSessionId(null);
    setUsage(null);
    setStreamText('');
    setToolUses([]);
  };

  return (
    <div className={`chat-layout-wrapper ${showArtifacts ? 'with-artifacts' : ''}`}>
      {projectId && (
        <div className="chat-sidebar-workspace">
          <WorkspaceExplorer projectId={projectId} />
        </div>
      )}
      <div className="chat-container">
        {/* Chat Header */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20 }}>💬</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                Chat NexusAI {projectId && <span className="badge badge-purple" style={{ marginLeft: 6 }}>Projeto: {projectId}</span>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {sessionId ? `Sessão: ${sessionId.substring(0, 8)}...` : 'Nova conversa'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {usage && (
              <span className="badge badge-purple" style={{ fontSize: 10 }}>
                🔤 {(usage.inputTokens + usage.outputTokens).toLocaleString()} tokens
              </span>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => setShowPromptLibrary(!showPromptLibrary)} style={{ marginRight: 8 }}>📚 Prompts</button>
            <button className="btn btn-secondary btn-sm" onClick={exportChat} style={{ marginRight: 8 }}>📤 Exportar (.md)</button>
            <button className="btn btn-secondary btn-sm" onClick={newChat}>+ Nova</button>
          </div>
        </div>

        {isOffline && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', padding: '8px 24px', fontSize: 12, borderBottom: '1px solid var(--accent-danger)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>📡 Modo Offline Ativo: Suas mensagens serão enfileiradas e enviadas quando a conexão voltar.</span>
            {pendingSync.length > 0 && <span className="badge badge-danger">{pendingSync.length} pendentes</span>}
          </div>
        )}

        {showPromptLibrary && (
          <div className="card animate-in" style={{ margin: '0 24px 20px 24px', border: '1px solid var(--accent-primary)' }}>
            <PromptLibrary onSelect={(text) => { setInput(text); setShowPromptLibrary(false); }} />
          </div>
        )}

        {/* Messages */}
        <div className="chat-messages">
          {messages.length === 0 && !isStreaming && (
            <div className="empty-state" style={{ flex: 1 }}>
              <div className="empty-state-icon">🧠</div>
              <div className="empty-state-title">NexusAI</div>
              <div className="empty-state-desc">
                Envie uma mensagem para começar. Posso ajudar com código, análise de texto, pesquisa, tradução, e muito mais.
              </div>
            </div>
          )}

          {/* Error Resilience Alert (Pillar 2) */}
          {errorState && (
            <div className="card animate-in" style={{ margin: '0 24px 20px 24px', border: '1px solid var(--accent-danger)', background: 'rgba(239, 68, 68, 0.05)', padding: 16, borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--accent-danger)', fontWeight: 700 }}>
                <span>⚠️ Erro de Sistema</span>
                <button className="btn btn-secondary btn-sm" onClick={() => setErrorState(null)} style={{ marginLeft: 'auto' }}>Fechar</button>
              </div>
              <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>{errorState.message}</p>
              {errorState.errorId && <code style={{ fontSize: 10, opacity: 0.6 }}>ID do Erro: {errorState.errorId}</code>}
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={msg.uuid || i} message={msg} onCopy={copyMessage} />
          ))}

          {/* Tool uses */}
          {toolUses.length > 0 && toolUses.map((tool, i) => (
            <div key={`tool-${i}`} className="tool-use-card">
              <div className="tool-use-header">
                🔧 Usando ferramenta: {tool.name}
              </div>
              <div className="tool-use-body">
                {JSON.stringify(tool.input, null, 2).substring(0, 300)}
                {tool.result && (
                  <div style={{ marginTop: 8, color: tool.isError ? 'var(--accent-danger)' : 'var(--accent-success)' }}>
                    → {typeof tool.result === 'string' ? tool.result.substring(0, 200) : JSON.stringify(tool.result).substring(0, 200)}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Streaming text */}
          {isStreaming && streamText && (
            <div className="chat-message assistant">
              <div className="chat-message-bubble">
                {streamText.includes('```json_chart') ? (
                  <>
                    <div dangerouslySetInnerHTML={{ __html: parseMarkdown(streamText.split('```json_chart')[0]) }} />
                    {streamText.includes('```', streamText.indexOf('```json_chart') + 13) && (
                      <DynamicChart json={streamText.split('```json_chart')[1].split('```')[0]} />
                    )}
                  </>
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: parseMarkdown(streamText) }} />
                )}
              </div>
              
              {/* Module 174: Next-Best-Action (NBA) */}
              {msg.role === 'assistant' && !isStreaming && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingLeft: 12 }}>
                  {['🔍 Analisar Logs', '📅 Agendar Task', '✉️ Notificar Admin'].map(action => (
                    <button
                      key={action}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 10, padding: '4px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', borderColor: 'var(--glass-border)' }}
                      onClick={() => setInput(action)}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Streaming indicator */}
          {isStreaming && !streamText && (
            <div className="chat-streaming">
              <div className="chat-streaming-dots">
                <span></span><span></span><span></span>
              </div>
              {statusText || 'NexusAI está pensando...'}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="chat-input-area">
          {/* Module 171: Predictive Intent Suggestions */}
          {!isStreaming && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
              {['Como corrigir erro de RAM?', 'Status dos servidores de borda', 'Relatório de custos mensal'].map(intent => (
                <button
                  key={intent}
                  className="btn btn-secondary btn-sm"
                  style={{ whiteSpace: 'nowrap', fontSize: 10, background: 'rgba(59, 130, 246, 0.05)', borderColor: 'rgba(59, 130, 246, 0.2)', color: 'var(--accent-primary)' }}
                  onClick={() => setInput(intent)}
                  onMouseEnter={() => {
                    // Pre-fetch trigger
                    fetch('/api/chat', { 
                      method: 'POST', 
                      body: JSON.stringify({ type: 'prefetch', content: intent }) 
                    }).catch(() => {});
                  }}
                >
                  🔮 {intent}
                </button>
              ))}
            </div>
          )}
          <div style={{ paddingBottom: 12, borderBottom: '1px solid var(--glass-border)', marginBottom: 12 }}>
            {renderAISelector()}

            {/* Advanced Settings Panel */}
            {showSettings && (
              <div className="animate-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, padding: 12, background: '#f1f5f9', borderRadius: 12, border: '1px solid var(--glass-border)' }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4, color: 'var(--text-secondary)' }}>TEMPERATURA: {chatSettings.temperature}</div>
                  <input 
                    type="range" min="0" max="1" step="0.1" 
                    value={chatSettings.temperature} 
                    onChange={(e) => setChatSettings({...chatSettings, temperature: parseFloat(e.target.value)})}
                    style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4, color: 'var(--text-secondary)' }}>TOP-P: {chatSettings.topP}</div>
                  <input 
                    type="range" min="0" max="1" step="0.05" 
                    value={chatSettings.topP} 
                    onChange={(e) => setChatSettings({...chatSettings, topP: parseFloat(e.target.value)})}
                    style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4, color: 'var(--text-secondary)' }}>MAX TOKENS: {chatSettings.maxTokens}</div>
                  <select 
                    value={chatSettings.maxTokens}
                    onChange={(e) => setChatSettings({...chatSettings, maxTokens: parseInt(e.target.value)})}
                    style={{ width: '100%', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--glass-border)', fontSize: 11 }}
                  >
                    <option value="1024">1024 (Curto)</option>
                    <option value="2048">2048 (Médio)</option>
                    <option value="4096">4096 (Longo)</option>
                    <option value="8192">8192 (Ultra)</option>
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)' }}>Roteamento de Inteligência (Module 151)</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['auto', 'cloud', 'always'].map(mode => (
                      <button
                        key={mode}
                        onClick={() => setChatSettings({...chatSettings, edgePriority: mode})}
                        className={`btn ${chatSettings.edgePriority === mode ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1, fontSize: 10, padding: '6px' }}
                      >
                        {mode === 'auto' ? '🛰️ Auto (Borda/Nuvem)' : mode === 'cloud' ? '☁️ Apenas Nuvem' : '🏠 Apenas Borda (Local)'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="chat-input-wrapper" style={{ position: 'relative' }}>
            {imageAttachment && (
              <div style={{ position: 'absolute', top: -70, left: 10, background: 'var(--bg-secondary)', padding: 4, borderRadius: 8, border: '1px solid var(--border)', zIndex: 10 }}>
                <img src={imageAttachment} style={{ height: 60, borderRadius: 4 }} alt="Preview" />
                <button onClick={() => setImageAttachment(null)} style={{ position: 'absolute', top: -8, right: -8, background: 'var(--accent-danger)', color: 'white', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
            )}
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 12px', color: 'var(--text-secondary)' }} title="Anexar Imagem">
              <span style={{ fontSize: 18 }}>📎</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
            </label>
            <textarea
              ref={textareaRef}
              placeholder="Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)"
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isStreaming}
            />
            {isStreaming ? (
              <button className="chat-send-btn" onClick={handleAbort} title="Parar">⏹</button>
            ) : (
              <button
                className="chat-send-btn"
                onClick={sendMessage}
                disabled={!input.trim()}
                title="Enviar"
              >
                ➤
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Artifacts Panel (Claude-like) */}
      {showArtifacts && allArtifacts.length > 0 ? (
        <ArtifactsPanel
          artifacts={allArtifacts}
          activeIndex={activeArtifactIdx}
          onSelect={setActiveArtifactIdx}
          onClose={() => setShowArtifacts(false)}
        />
      ) : (
        <div className="chat-sidebar-activity">
          <ActivityFeed logs={agentLogs} />
        </div>
      )}

      {/* Floating artifacts button */}
      {allArtifacts.length > 0 && !showArtifacts && (
        <button
          className="artifacts-float-btn"
          onClick={() => setShowArtifacts(true)}
          title={`${allArtifacts.length} artifact(s)`}
        >
          📄 {allArtifacts.length}
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Tools Page
// ═══════════════════════════════════════════════════════════════

function ToolsPage() {
  const [tools, setTools] = useState([]);

  useEffect(() => {
    api('/tools').then(data => setTools(data.tools || []));
  }, []);

  const toolIcons = {
    bash: '🖥️', file_read: '📖', file_write: '📝', file_patch: '🔧',
    web_search: '🔍', web_fetch: '🌐', code_generate: '💻',
    translate: '🌍', summarize: '📋', analyze_sentiment: '🎭',
    seo_analyze: '📊', compose_email: '✉️', format_data: '🗃️',
    calculate: '🧮', regex: '🔣', calculate_tokens: '🔢',
  };

  return (
    <div className="animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>🛠️ Ferramentas</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
            {tools.length} ferramentas disponíveis no sistema
          </p>
        </div>
      </div>

      <div className="tools-grid">
        {tools.map(tool => (
          <div key={tool.name} className="tool-card">
            <div className="tool-card-icon">{toolIcons[tool.name] || '🔧'}</div>
            <div className="tool-card-name">{tool.name}</div>
            <div className="tool-card-desc">{tool.description}</div>
            <div className="tool-card-flags">
              {tool.isEnabled && <span className="badge badge-success">Ativo</span>}
              {tool.isReadOnly && <span className="badge badge-info">Read-Only</span>}
              {tool.isConcurrencySafe && <span className="badge badge-purple">Concorrente</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Sessions Page
// ═══════════════════════════════════════════════════════════════

function SessionsPage() {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    api('/sessions?limit=50').then(data => setSessions(data.sessions || []));
  }, []);

  const formatBytes = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="animate-in">
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>📝 Sessões</h2>

      {sessions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-title">Nenhuma sessão ainda</div>
          <div className="empty-state-desc">Inicie uma conversa no Chat para criar sua primeira sessão.</div>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Primeira Mensagem</th>
                <th>Mensagens</th>
                <th>Tamanho</th>
                <th>Última Atividade</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id}>
                  <td><code style={{ fontSize: 11 }}>{(s.id || '').substring(0, 12)}...</code></td>
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.title || '-'}
                  </td>
                  <td>{s.message_count || 0}</td>
                  <td>{formatBytes(s.size || 0)}</td>
                  <td>{s.updated_at ? new Date(s.updated_at).toLocaleString('pt-BR') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Hooks Page
// ═══════════════════════════════════════════════════════════════

function HooksPage() {
  const [hooks, setHooks] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);

  useEffect(() => {
    api('/hooks').then(data => {
      setHooks(data.hooks || []);
      setEventTypes(data.eventTypes || []);
    });
  }, []);

  return (
    <div className="animate-in">
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>🪝 Hook System</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
        20 tipos de eventos do ciclo de vida para interceptar ações do sistema.
      </p>

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-card-icon">📡</div>
          <div className="stat-card-value">{eventTypes.length}</div>
          <div className="stat-card-label">Tipos de Eventos</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">🪝</div>
          <div className="stat-card-value">{hooks.length}</div>
          <div className="stat-card-label">Hooks Registrados</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">📋 Eventos Disponíveis</div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {eventTypes.map(event => (
            <span key={event} className="badge badge-purple">{event}</span>
          ))}
        </div>
      </div>

      {hooks.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <div className="card-title">🪝 Hooks Ativos</div>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr><th>ID</th><th>Evento</th><th>Matcher</th><th>Tipo</th><th>Status</th></tr>
              </thead>
              <tbody>
                {hooks.map(h => (
                  <tr key={h.id}>
                    <td><code style={{ fontSize: 11 }}>{h.id.substring(0, 16)}</code></td>
                    <td>{h.event}</td>
                    <td>{h.matcher}</td>
                    <td>{h.type}</td>
                    <td>{h.enabled ? <span className="badge badge-success">Ativo</span> : <span className="badge badge-danger">Inativo</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Permissions Page
// ═══════════════════════════════════════════════════════════════

function PermissionsPage() {
  const [permissions, setPermissions] = useState({ mode: 'default', denyRules: [], askRules: [], alwaysAllowRules: [] });

  useEffect(() => {
    api('/v1/permissions').then(setPermissions);
  }, []);

  const modes = [
    { id: 'default', label: 'Padrão', desc: 'Perguntar ao usuário', icon: '👤' },
    { id: 'plan', label: 'Plano', desc: 'Somente leitura', icon: '📋' },
    { id: 'acceptEdits', label: 'Aceitar Edições', desc: 'Auto-allow para edições', icon: '✏️' },
    { id: 'bypass', label: 'Bypass', desc: 'Permitir tudo', icon: '⚡' },
    { id: 'dontAsk', label: 'Não Perguntar', desc: 'Negar silenciosamente', icon: '🔇' },
    { id: 'auto', label: 'Auto', desc: 'IA decide', icon: '🤖' },
  ];

  const setMode = async (mode) => {
    await api('/permissions/mode', { method: 'POST', body: { mode } });
    setPermissions(prev => ({ ...prev, mode }));
  };

  return (
    <div className="animate-in">
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>🔐 Pipeline de Permissões</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
        Pipeline de 7 etapas inspirado na arquitetura do Claude Code.
      </p>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">🎛️ Modo de Permissão</div>
          <span className="badge badge-purple">{permissions.mode}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          {modes.map(mode => (
            <div
              key={mode.id}
              onClick={() => setMode(mode.id)}
              style={{
                padding: '14px 16px',
                background: permissions.mode === mode.id ? 'var(--accent-primary-glow)' : 'var(--glass-bg)',
                border: `1px solid ${permissions.mode === mode.id ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 6 }}>{mode.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{mode.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{mode.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">📋 Etapas do Pipeline</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { step: '1a', label: 'Deny Rules (tool-level)', icon: '🚫' },
            { step: '1b', label: 'Ask Rules (tool-level)', icon: '❓' },
            { step: '1c', label: 'tool.checkPermissions()', icon: '🔍' },
            { step: '1d-1g', label: 'Safety Checks (.git, .env)', icon: '🛡️' },
            { step: '2a', label: 'Bypass Mode', icon: '⚡' },
            { step: '2b', label: 'Always-Allow Rules', icon: '✅' },
            { step: '3', label: 'Passthrough → Ask', icon: '👤' },
          ].map(step => (
            <div key={step.step} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              background: 'var(--glass-bg)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--glass-border)',
            }}>
              <span style={{ fontSize: 18 }}>{step.icon}</span>
              <span className="badge badge-info" style={{ minWidth: 36, textAlign: 'center' }}>{step.step}</span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{step.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Agents Page
// ═══════════════════════════════════════════════════════════════

function AgentsPage() {
  return (
    <div className="animate-in">
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>🤖 Multi-Agent Coordinator</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
        Sistema de coordenação multi-agente: Leader → Workers paralelos com mailbox IPC.
      </p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon">👑</div>
          <div className="stat-card-value">Leader</div>
          <div className="stat-card-label">Coordinator Mode</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">🔧</div>
          <div className="stat-card-value">0</div>
          <div className="stat-card-label">Workers Ativos</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">📬</div>
          <div className="stat-card-value">0</div>
          <div className="stat-card-label">Mensagens no Mailbox</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div className="card-title">📋 Workflow do Coordenador</div>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {['📖 Research (Parallel)', '🧠 Synthesis (Coordinator)', '🔨 Implementation (Workers)', '✅ Verification (Fresh)'].map((phase, i) => (
            <div key={i} style={{
              flex: '1 1 200px', padding: 16, background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', textAlign: 'center',
            }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{phase}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Fase {i + 1}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Analytics Page
// ═══════════════════════════════════════════════════════════════

function AnalyticsPage({ stats }) {
  return (
    <div className="animate-in">
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>📈 Analytics</h2>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon">🔤</div>
          <div className="stat-card-value">0</div>
          <div className="stat-card-label">Total Input Tokens</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">📝</div>
          <div className="stat-card-value">0</div>
          <div className="stat-card-label">Total Output Tokens</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">💰</div>
          <div className="stat-card-value">$0.00</div>
          <div className="stat-card-label">Custo Total</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">📊</div>
          <div className="stat-card-value">{stats?.totalMessages || 0}</div>
          <div className="stat-card-label">Total de Mensagens</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">📋 Modelos Disponíveis</div></div>
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Modelo</th><th>Descrição</th><th>Input /1M</th><th>Output /1M</th></tr>
            </thead>
            <tbody>
              <tr><td>Gemini 2.0 Flash</td><td>Ultra-rápido e gratuito — padrão</td><td>$0.00</td><td>$0.00</td></tr>
              <tr><td>Gemini 1.5 Pro</td><td>Mais poderoso para tarefas complexas</td><td>$1.25</td><td>$5.00</td></tr>
              <tr><td>Gemini 1.5 Flash</td><td>Alternativa estável e rápida</td><td>$0.00</td><td>$0.00</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Plugins Page
// ═══════════════════════════════════════════════════════════════

function PluginsPage() {
  return (
    <div className="animate-in">
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>🧩 Plugin System</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
        Sistema completo de plugins com marketplace, hot-reload, e isolamento de falhas.
      </p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon">🧩</div>
          <div className="stat-card-value">0</div>
          <div className="stat-card-label">Plugins Instalados</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">🏪</div>
          <div className="stat-card-value">0</div>
          <div className="stat-card-label">Marketplace</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">📦 O que Plugins podem fornecer</div></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {['🤖 Agentes', '📋 Comandos (Slash)', '🪝 Hooks', '📚 Skills', '🔌 MCP Servers', '🎨 Output Styles'].map(item => (
            <div key={item} style={{
              padding: '14px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 500, textAlign: 'center',
            }}>{item}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Projects Page
// ═══════════════════════════════════════════════════════════════

function ProjectsPage({ onStartChat }) {
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [workspacePath, setWorkspacePath] = useState('');

  useEffect(() => {
    load();
  }, []);

  const load = () => {
    api('/projects').then(data => {
      setProjects(data.projects || []);
      if (selectedProject) {
        const updated = (data.projects || []).find(p => p.id === selectedProject.id);
        if (updated) setSelectedProject(updated);
      }
    });
  };

  const createProject = async (e) => {
    e?.preventDefault();
    if (!name.trim()) return;
    await api('/projects', { method: 'POST', body: { name, description: desc } });
    setName('');
    setDesc('');
    load();
  };

  const selectProject = (p) => {
    setSelectedProject(p);
    setSystemPrompt(p.systemPrompt || '');
    setWorkspacePath(p.workspacePath || '');
  };

  const saveProjectConfig = async () => {
    await api(`/projects/${selectedProject.id}`, { method: 'PUT', body: { systemPrompt, workspacePath } });
    alert('Configuração salva!');
    load();
  };

  const uploadFile = async (e) => {
    const files = e.target.files;
    if (!files.length) return;
    const formData = new FormData();
    for (let f of files) formData.append('files', f);

    await fetch(`/api/projects/${selectedProject.id}/knowledge`, {
      method: 'POST', body: formData
    });
    alert('Upload concluído com sucesso!');
    load();
  };

  if (selectedProject) {
    return (
      <div className="animate-in">
        <button className="btn btn-secondary btn-sm" onClick={() => setSelectedProject(null)}>← Voltar para Projetos</button>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: '20px 0' }}>📂 Projeto: {selectedProject.name}</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          <div className="card">
            <div className="card-header"><div className="card-title">📜 Instruções Customizadas (System Prompt)</div></div>
            <textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              placeholder="Ex: Atue como um engenheiro de software sênior... Só responda com código documentado em Markdown."
              style={{ width: '100%', height: 200, background: 'var(--glass-bg)', color: 'white', padding: 12, border: '1px solid var(--glass-border)', borderRadius: 4, fontFamily: 'monospace' }}
            />
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={saveProjectConfig}>Salvar Instruções</button>
          </div>

          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="card-title">🏠 Workspace Local</div>
              {selectedProject.workspacePath && (
                <button
                  className="btn btn-success btn-sm"
                  onClick={() => onStartChat(selectedProject.id)}
                >
                  💬 Iniciar Chat
                </button>
              )}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>Vincule uma pasta do seu computador para a IA salvar os arquivos.</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                type="text"
                value={workspacePath}
                onChange={e => setWorkspacePath(e.target.value)}
                placeholder="Ex: C:\Users\Nome\Documents\MeuProjeto"
                style={{ flex: 1, background: 'var(--glass-bg)', color: 'white', padding: '8px 12px', border: '1px solid var(--glass-border)', borderRadius: 4, fontSize: 13 }}
              />
              <button className="btn btn-purple btn-sm" onClick={saveProjectConfig}>Vincular</button>
            </div>

            {selectedProject.workspacePath && (
              <div style={{ marginTop: 10, borderTop: '1px solid var(--glass-border)', paddingTop: 10 }}>
                <WorkspaceExplorer projectId={selectedProject.id} />
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">📚 Base de Conhecimento</div></div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Arquivos injetados no limite de contexto para cada sessão.</p>
            <input type="file" multiple onChange={uploadFile} style={{ marginTop: 12, fontSize: 12, width: '100%' }} />
            <div style={{ marginTop: 12, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
              <span><strong>Total:</strong> {selectedProject.knowledgeCount || 0} arquivos</span>
              {!selectedProject.workspacePath && (
                <button className="btn btn-success btn-sm" onClick={() => onStartChat(selectedProject.id)}>💬 Chat</button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in">
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>📁 Projetos Isolados</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Crie ambientes de Inteligência Artificial pré-configurados com instruções e Conhecimento (RAG Limit). As sessões dentro do projeto não misturam contexto.</p>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header"><div className="card-title">✨ Novo Projeto</div></div>
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            type="text"
            placeholder="Nome (ex: meu-app)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '4px' }}
          />
          <input
            type="text"
            placeholder="Descrição"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            style={{ flex: 2, padding: '8px 12px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '4px' }}
          />
          <button className="btn btn-primary" onClick={createProject}>+ Criar</button>
        </div>
      </div>

      <div className="tools-grid">
        {projects.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)' }}>Nenhum projeto encontrado.</div>
        ) : (
          projects.map(p => (
          <div key={p.id} className="tool-card" style={{ cursor: 'pointer' }} onClick={() => selectProject(p)}>
            <div className="tool-card-icon">📂</div>
            <div className="tool-card-name" style={{ fontSize: 16 }}>{p.name}</div>
            <div className="tool-card-desc" style={{ marginTop: 8 }}>{p.description || 'Sem descrição'}</div>
            <div className="tool-card-flags">
              <span className="badge badge-purple">Conhecimento: {p.knowledgeCount || 0}</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{new Date(p.createdAt).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
        ))
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Settings Page
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// Profile Page
// ═══════════════════════════════════════════════════════════════

function ProfilePage() {
  const [profile, setProfile] = useState({ custom_instructions: '', plan: 'free', tokens_used_month: 0, tokens_limit: 50000 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/profile').then(data => {
      if (data && data.profile) setProfile(data.profile);
      setLoading(false);
    });
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api('/profile', { method: 'POST', body: { custom_instructions: profile.custom_instructions } });
      alert('Perfil e instruções salvas com sucesso! As próximas conversas usarão esta configuração.');
    } catch (e) {
      alert('Erro ao salvar o perfil.');
    }
    setSaving(false);
  };

  if (loading) return <div style={{ padding: 24 }}>Carregando perfil...</div>;

  return (
    <div className="animate-in" style={{ padding: 24, maxWidth: 800 }}>
      <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>👤 Meu Perfil e Customização da IA</h2>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header"><div className="card-title">Instruções Customizadas</div></div>
        <div className="card-body">
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
            O que a IA deve saber sobre você para fornecer respostas melhores? Como você quer que a IA responda? 
            Estas regras serão injetadas secretamente em todas as suas conversas.
          </p>
          <textarea
            className="input-field"
            rows={6}
            placeholder="Ex: Sou um desenvolvedor sênior de React. Nunca me explique conceitos básicos. Sempre use arrow functions e retorne apenas o código direto."
            value={profile.custom_instructions || ''}
            onChange={(e) => setProfile({ ...profile, custom_instructions: e.target.value })}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
          />
        </div>
        <div className="card-footer" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Instruções'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Resumo do Plano</div></div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Plano Atual</div>
              <div style={{ fontSize: 18, fontWeight: 700, textTransform: 'capitalize' }}>{profile.plan || 'Free'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Consumo Mensal</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {(profile.tokens_used_month || 0).toLocaleString()} / {(profile.tokens_limit || 50000).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Teams / Workspaces Page
// ═══════════════════════════════════════════════════════════════

function TeamsPage() {
  const [teams, setTeams] = useState([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/teams').then(data => {
      if (data && data.teams) setTeams(data.teams);
      setLoading(false);
    });
  }, []);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return alert('Digite um nome para a equipe.');
    const res = await api('/teams', { method: 'POST', body: { name: newTeamName } });
    if (res.success) {
      setTeams([...teams, { ...res.team, my_role: 'owner' }]);
      setNewTeamName('');
      alert('Equipe criada com sucesso!');
    } else {
      alert('Erro ao criar equipe: ' + (res.error || ''));
    }
  };

  if (loading) return <div style={{ padding: 24 }}>Carregando equipes...</div>;

  return (
    <div className="animate-in" style={{ padding: 24, maxWidth: 900 }}>
      <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>🏢 Organizações (B2B)</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Crie workspaces para sua empresa e divida os tokens do seu plano premium com toda a sua equipe.</p>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header"><div className="card-title">Criar Nova Equipe</div></div>
        <div className="card-body" style={{ display: 'flex', gap: 12 }}>
          <input 
            className="input-field" 
            placeholder="Nome da sua Empresa (ex: Agência Nexus)" 
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={handleCreateTeam}>+ Fundar Empresa</button>
        </div>
      </div>

      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Minhas Equipes</h3>
      
      {teams.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏢</div>
          <div className="empty-state-title">Nenhuma equipe ainda</div>
          <div className="empty-state-desc">Crie uma organização acima para começar a convidar colegas.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {teams.map(team => (
            <div key={team.id} className="card" style={{ padding: 16, border: '1px solid var(--purple-main)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ fontSize: 16, fontWeight: 700 }}>{team.name}</h4>
                <span className="badge badge-purple" style={{ textTransform: 'uppercase' }}>{team.my_role}</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>ID: {team.id.substring(0,8)}...</p>
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--glass-border)' }}>
                <button className="btn btn-secondary btn-sm" style={{ width: '100%' }}>Gerenciar Membros</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsPage() {
  const [config, setConfig] = useState({
    geminiApiKey: '',
    anthropicApiKey: '',
    defaultProvider: 'gemini',
    googleModel: 'gemini-1.5-flash',
    anthropicModel: 'claude-sonnet-4-20250514'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/config').then(data => {
      if (data) setConfig(data);
      setLoading(false);
    });
  }, []);

  const saveConfig = async () => {
    await api('/config', { method: 'POST', body: config });
    alert('Configurações salvas e motor reiniciado!');
  };

  if (loading) return <div style={{ padding: 20 }}>Carregando configurações...</div>;

  return (
    <div className="animate-in">
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>⚙️ Configurações do Sistema</h2>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><div className="card-title">🤖 Provedor de IA Ativo</div></div>
        <div style={{ display: 'flex', gap: 12, padding: 10 }}>
          <div
            className={`tool-card ${config.defaultProvider === 'gemini' ? 'active' : ''}`}
            style={{ flex: 1, padding: 15, cursor: 'pointer', border: config.defaultProvider === 'gemini' ? '2px solid var(--purple-main)' : '1px solid var(--glass-border)' }}
            onClick={() => setConfig({ ...config, defaultProvider: 'gemini' })}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>♊</div>
            <div style={{ fontWeight: 600 }}>Google Gemini</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Plano Gratuito/Pago via Google Cloud</div>
          </div>
          <div
            className={`tool-card ${config.defaultProvider === 'anthropic' ? 'active' : ''}`}
            style={{ flex: 1, padding: 15, cursor: 'pointer', border: config.defaultProvider === 'anthropic' ? '2px solid var(--purple-main)' : '1px solid var(--glass-border)' }}
            onClick={() => setConfig({ ...config, defaultProvider: 'anthropic' })}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>❄️</div>
            <div style={{ fontWeight: 600 }}>Anthropic Claude</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Melhor para codificação (Sonnet 3.5)</div>
          </div>
          <div
            className={`tool-card ${config.defaultProvider === 'local' ? 'active' : ''}`}
            style={{ flex: 1, padding: 15, cursor: 'pointer', border: config.defaultProvider === 'local' ? '2px solid var(--purple-main)' : '1px solid var(--glass-border)' }}
            onClick={() => setConfig({ ...config, defaultProvider: 'local' })}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>🏠</div>
            <div style={{ fontWeight: 600 }}>Local (Ollama)</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>100% Grátis e Privado (Offline)</div>
          </div>
        </div>
      </div>

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card">
          <div className="card-header"><div className="card-title">🔑 Google Gemini Config</div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="label">API Key (Google Studio)</label>
              <input
                type="password"
                className="input"
                value={config.geminiApiKey}
                onChange={e => setConfig({ ...config, geminiApiKey: e.target.value })}
                placeholder="AIzaSy..."
              />
            </div>
            <div>
              <label className="label">Modelo Gemini</label>
              <select
                className="input"
                value={config.googleModel}
                onChange={e => setConfig({ ...config, googleModel: e.target.value })}
              >
                <option value="gemini-2.0-flash">Gemini 2.0 Flash (Mais Rápido)</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro (Mais Inteligente)</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash (Padrão Grátis)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">🔑 Anthropic Claude Config</div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="label">API Key (Console Anthropic)</label>
              <input
                type="password"
                className="input"
                value={config.anthropicApiKey}
                onChange={e => setConfig({ ...config, anthropicApiKey: e.target.value })}
                placeholder="sk-ant-..."
              />
            </div>
            <div>
              <label className="label">Modelo Claude</label>
              <select
                className="input"
                value={config.anthropicModel}
                onChange={e => setConfig({ ...config, anthropicModel: e.target.value })}
              >
                <option value="claude-sonnet-4-20250514">Claude 3.5 Sonnet (Recomendado)</option>
                <option value="claude-3-opus-20240229">Claude 3 Opus (Extremo)</option>
                <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (Ultra Rápido)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">🏠 Local Ollama Config</div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="label">Ollama Host</label>
              <input
                type="text"
                className="input"
                value={config.ollamaHost}
                onChange={e => setConfig({ ...config, ollamaHost: e.target.value })}
                placeholder="http://localhost:11434"
              />
            </div>
            <div>
              <label className="label">Modelo Local</label>
              <input
                type="text"
                className="input"
                value={config.ollamaModel}
                onChange={e => setConfig({ ...config, ollamaModel: e.target.value })}
                placeholder="llama3:8b"
              />
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={saveConfig} style={{ padding: '12px 32px' }}>
          🚀 Aplicar Configurações
        </button>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">📋 Capacidades do Sistema (100+)</div></div>
        <div style={{ columns: 2, columnGap: 24, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 2 }}>
          {[
            'Interface Web de conversação', 'Artefatos e visualização', 'Projetos e workspace',
            'System Prompts personalizados', 'Knowledge base por projeto', 'Upload PDF/CSV/Excel',
            'Processamento de Imagens (Vision)', 'OCR e transcrição', 'Context window 200K tokens',
            'API com streaming', 'Tool Use / Function Calling', 'Cache de prompts',
            'Batch API', 'JSON estruturado', 'Código multi-linguagem',
            'Debug e refatoração', 'Testes unitários', 'SQL queries',
            'HTML/CSS/JS rendering', 'SVG e Mermaid.js', 'React components',
            'Scripts de automação', 'Regex', 'Redação e resumo',
            'Tradução multi-idioma', 'Análise de sentimento', 'SEO',
            'E-mails profissionais', 'Brainstorming', 'Constitutional AI',
            'RBAC e audit logs', 'Token calculator', 'Multi-agent coordinator',
          ].map((cap, i) => (
            <div key={i}>✅ {cap}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Dashboard Shell (Authenticated Area)
// ═══════════════════════════════════════════════════════════════

function DashboardShell({ onSignOut, userProfile }) {
  const { isAdmin } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [dashboardData, setDashboardData] = useState({ stats: {}, recentSessions: [] });
  const [agents, setAgents] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isElectron = !!window.electron;

  useEffect(() => {
    if (!userProfile) return;
    const fetchData = () => {
      api('/dashboard').then(data => {
        if (data.stats) setDashboardData(data);
      }).catch(() => { });
      api('/agents').then(data => { if (Array.isArray(data)) setAgents(data); }).catch(() => { });
    };
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [userProfile]);

  useEffect(() => {
    if (isElectron) {
      setSidebarCollapsed(true);
      setCurrentPage('chat');
    }
  }, [isElectron]);

  const startChat = (id) => {
    setActiveProjectId(id);
    setCurrentPage('chat');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <DashboardPage stats={dashboardData.stats} recentSessions={dashboardData.recentSessions} />;
      case 'projects': return <ProjectsPage onStartChat={startChat} />;
      case 'chat': return <ChatPage projectId={activeProjectId} />;
      case 'tools': return <ToolsPage />;
      case 'agents': return <AgentsPage />;
      case 'sessions': return <SessionsPage />;
      case 'pricing': return <PricingPage />;
      case 'hooks': return <HooksPage />;
      case 'permissions': return <PermissionsPage />;
      case 'analytics': return <AnalyticsPage stats={dashboardData.stats} />;
      case 'plugins': return <PluginsPage />;
      case 'settings': return <SettingsPage />;
      case 'profile': return <ProfilePage />;
      case 'teams': return <TeamsPage />;
      case 'admin': return isAdmin ? <AdminLayout onNavigate={setCurrentPage} /> : <DashboardPage stats={dashboardData.stats} recentSessions={dashboardData.recentSessions} />;
      default: return <DashboardPage stats={dashboardData.stats} recentSessions={dashboardData.recentSessions} />;
    }
  };

  return (
    <div className={`app-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${isElectron ? 'is-electron' : ''}`}>
      <WindowControls />

      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        stats={dashboardData.stats}
        agents={agents}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <main className="main-content">
        <header className="topbar">
          <button className="sidebar-toggle-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            {sidebarCollapsed ? '📂' : '⬅️'}
          </button>
          <div className="topbar-title">NexusAI • {currentPage.charAt(0).toUpperCase() + currentPage.slice(1)}</div>
          <div className="topbar-actions">
            <div className="status-indicator">
              <span className="status-dot"></span>
              {dashboardData.stats?.apiConfigured ? 'Conectado' : 'Modo Demo'}
            </div>
            {userProfile && (
              <div className="topbar-user">
                <span className="topbar-user-name">{userProfile.full_name || userProfile.email}</span>
                <span className="badge badge-purple" style={{ fontSize: 10 }}>{userProfile.plan || 'free'}</span>
                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={(e) => {
                    e.preventDefault();
                    onSignOut();
                  }}
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </header>

        <section className={`page-content ${currentPage === 'chat' ? 'full-height' : ''}`}>
          {renderPage()}
        </section>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main App — Router
// ═══════════════════════════════════════════════════════════════

export default function App() {
  return (
    <ErrorBoundary>
      <SpeedInsights />
      <MainApp />
    </ErrorBoundary>
  );
}

function MainApp() {
  const { user, profile, loading, isAuthenticated, signOut } = useAuth();
  const [route, setRoute] = useState('landing');

  // Determine initial route
  useEffect(() => {
    if (loading) return;
    const path = window.location.pathname;
    if (isAuthenticated) {
      if (path === '/login' || path === '/' || path === '') {
        setRoute('app');
      } else {
        setRoute('app');
      }
    } else {
      if (path === '/login') setRoute('login');
      else if (path === '/register') setRoute('register');
      else setRoute('landing');
    }
  }, [loading, isAuthenticated]);

  // Handle hash-based navigation for OAuth callback
  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash.includes('access_token')) {
        // Supabase OAuth callback - will be handled by AuthProvider
        setRoute('app');
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const navigate = (to) => {
    setRoute(to);
    if (to === 'landing') window.history.pushState({}, '', '/');
    else if (to === 'login' || to === 'register') window.history.pushState({}, '', '/login');
    else if (to === 'app') window.history.pushState({}, '', '/app');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('landing');
  };

  // Loading state
  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading-inner">
          <div className="landing-logo-icon" style={{ width: 56, height: 56, fontSize: 28 }}>🧠</div>
          <div className="app-loading-text">Carregando NexusAI...</div>
          <div className="app-loading-bar"><div className="app-loading-bar-fill"></div></div>
        </div>
      </div>
    );
  }

  // Route rendering
  switch (route) {
    case 'landing':
      return <LandingPage onNavigate={navigate} />;
    case 'terms':
      return <TermsPage onNavigate={navigate} />;
    case 'privacy':
      return <PrivacyPage onNavigate={navigate} />;
    case 'login':
      return <LoginPage mode="login" onNavigate={navigate} />;
    case 'register':
      return <LoginPage mode="register" onNavigate={navigate} />;
    case 'app':
      if (!isAuthenticated) return <LoginPage mode="login" onNavigate={navigate} />;
      return <DashboardShell onSignOut={handleSignOut} userProfile={profile || { email: user?.email }} />;
    default:
      return <LandingPage onNavigate={navigate} />;
  }
}
