import React, { useState, useEffect, useRef, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════
// NexusAI — Main Application
// ═══════════════════════════════════════════════════════════════

const API_BASE = '/api';
const WS_URL = `ws://${window.location.hostname}:3777/ws`;

// ─── API Helper ──────────────────────────────────────────────
async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return res.json();
}

// ─── Markdown Parser (lightweight) ──────────────────────────
function parseMarkdown(text) {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="lang-$1">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold & Italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr/>')
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

function Sidebar({ currentPage, onNavigate, stats, collapsed, onToggle }) {
  const navItems = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'projects', icon: '📁', label: 'Projetos' },
    { id: 'chat', icon: '💬', label: 'Chat AI', badge: null },
    { id: 'tools', icon: '🛠️', label: 'Ferramentas', badge: stats?.totalTools },
    { id: 'agents', icon: '🤖', label: 'Agentes' },
    { id: 'sessions', icon: '📝', label: 'Sessões', badge: stats?.totalSessions },
    { id: 'hooks', icon: '🪝', label: 'Hooks', badge: stats?.totalHooks },
    { id: 'permissions', icon: '🔐', label: 'Permissões' },
    { id: 'analytics', icon: '📈', label: 'Analytics' },
    { id: 'plugins', icon: '🧩', label: 'Plugins' },
    { id: 'settings', icon: '⚙️', label: 'Configurações' },
  ];

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
      </nav>

      <div className="sidebar-footer">
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
  return (
    <div className="animate-in">
      <div className="welcome-banner">
        <h1>👋 Bem-vindo ao NexusAI</h1>
        <p>Sua plataforma de IA completa com 20+ ferramentas, multi-agentes, hooks e muito mais. Baseada na arquitetura do Claude Code.</p>
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
      </div>

      {recentSessions?.length > 0 && (
        <div className="card" style={{ marginTop: 8 }}>
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

// ═══════════════════════════════════════════════════════════════
// Chat Page
// ═══════════════════════════════════════════════════════════════

function ChatPage({ projectId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [statusText, setStatusText] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [toolUses, setToolUses] = useState([]);
  const [usage, setUsage] = useState(null);
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [agentLogs, setAgentLogs] = useState([]);
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const GEMINI_MODELS = [
    { id: 'gemini-2.5-flash', label: '⚡ Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro', label: '🧠 Gemini 2.5 Pro' },
    { id: 'gemini-2.0-flash', label: '🔹 Gemini 2.0 Flash' },
  ];

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamText, scrollToBottom]);

  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case 'swarm_event':
          setMessages(prev => [...prev, {
            role: 'system',
            agent: msg.agent,
            type: 'swarm',
            content: msg.content,
            timestamp: Date.now(),
          }]);
          break;

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

        case 'tool_use':
          setToolUses(prev => [...prev, { name: msg.toolName, input: msg.toolInput }]);
          break;

        case 'tool_propose':
          setToolUses(prev => [...prev, { 
            name: msg.toolName, 
            status: 'proposed', 
            path: msg.path, 
            proposal: msg.proposal, 
            original: msg.original,
            toolUseId: msg.toolUseId
          }]);
          break;

        case 'tool_result':
          setToolUses(prev => prev.map(t => 
            (t.name === msg.toolName || t.toolUseId === msg.toolUseId) ? { ...t, result: msg.content, isError: msg.isError, status: 'completed' } : t
          ));
          break;

        case 'usage':
          setUsage(msg.usage);
          break;

        case 'done':
          setIsStreaming(false);
          setStreamText('');
          setToolUses([]);
          break;

        case 'quota_warning':
          setMessages(prev => [...prev, {
            role: 'system',
            content: `⚠️ ${msg.message}`,
            timestamp: Date.now(),
          }]);
          break;

        case 'status':
          setAgentLogs(prev => [...prev, {
            message: msg.message,
            toolName: msg.toolName,
            timestamp: msg.timestamp || Date.now()
          }].slice(-50)); // Keep last 50 logs
          setStatusText(msg.message);
          break;

        case 'error':
          setIsStreaming(false);
          setStreamText('');
          setMessages(prev => [...prev, {
            role: 'system',
            content: `Error: ${msg.message}`,
            timestamp: Date.now(),
          }]);
          break;
      }
    };

    ws.onclose = () => {
      setTimeout(connectWS, 2000);
    };

    return ws;
  }, []);

  useEffect(() => {
    const ws = connectWS();
    return () => ws?.close();
  }, [connectWS]);

  const sendMessage = useCallback(() => {
    if (!input.trim() || isStreaming) return;

    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connectWS();
      return;
    }

    setMessages(prev => [...prev, {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    }]);

    ws.send(JSON.stringify({
      type: 'chat',
      content: input.trim(),
      projectId: projectId,
      model: selectedModel,
      sessionId: sessionId
    }));

    setInput('');
    setIsStreaming(true);
  }, [input, isStreaming, sessionId, connectWS]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleAbort = () => {
    wsRef.current?.send(JSON.stringify({ type: 'abort' }));
    setIsStreaming(false);
    setStreamText('');
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
    <div className="chat-layout-wrapper">
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
            <button className="btn btn-secondary btn-sm" onClick={newChat}>+ Nova</button>
          </div>
        </div>

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

          {messages.map((msg, i) => (
            <div key={i} className={`chat-message ${msg.role === 'system' ? 'assistant' : msg.role}`}>
              {msg.type === 'swarm' && (
                <div style={{ marginBottom: 8, fontSize: 13, background: 'var(--accent-purple)', color: 'white', display: 'inline-block', padding: '2px 8px', borderRadius: 4 }}>
                  🔄 Sub-Agente Reporta: @{msg.agent}
                </div>
              )}
              <div
                className="chat-message-bubble"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }}
              />
              <div className="chat-message-meta">
                <span>{msg.role === 'user' ? '👤 Você' : msg.role === 'assistant' ? '🧠 NexusAI' : '🤖 Sistema'}</span>
                <span>•</span>
                <span>{new Date(msg.timestamp).toLocaleTimeString('pt-BR')}</span>
              </div>
            </div>
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
              <div
                className="chat-message-bubble"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(streamText) }}
              />
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
          {/* Model selector bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Modelo:</span>
            {GEMINI_MODELS.map(m => (
              <button
                key={m.id}
                onClick={() => setSelectedModel(m.id)}
                style={{
                  fontSize: 11,
                  padding: '3px 10px',
                  borderRadius: 20,
                  border: '1px solid',
                  cursor: 'pointer',
                  borderColor: selectedModel === m.id ? 'var(--accent-primary)' : 'var(--glass-border)',
                  background: selectedModel === m.id ? 'var(--accent-primary)' : 'transparent',
                  color: selectedModel === m.id ? 'white' : 'var(--text-secondary)',
                  transition: 'all 0.15s',
                }}
              >{m.label}</button>
            ))}
          </div>
          <div className="chat-input-wrapper">
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

      <div className="chat-sidebar-activity">
        <ActivityFeed logs={agentLogs} />
      </div>
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
    bash: '🖥️', file_read: '📖', file_write: '📝', web_search: '🔍', web_fetch: '🌐',
    code_generate: '💻', analyze_image: '🖼️', process_document: '📄', translate: '🌍',
    summarize: '📋', analyze_sentiment: '🎭', seo_analyze: '📊', compose_email: '✉️',
    format_data: '🗃️', calculate: '🧮', create_diagram: '📐', regex: '🔣',
    sql_query: '🗄️', spawn_agent: '🤖', calculate_tokens: '🔢',
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
                <tr key={s.sessionId}>
                  <td><code style={{ fontSize: 11 }}>{s.sessionId.substring(0, 12)}...</code></td>
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.firstPrompt || '-'}
                  </td>
                  <td>{s.messageCount || 0}</td>
                  <td>{formatBytes(s.size || 0)}</td>
                  <td>{s.lastModified ? new Date(s.lastModified).toLocaleString('pt-BR') : '-'}</td>
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
    api('/permissions').then(setPermissions);
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
              <tr><td>Gemini 2.5 Flash</td><td>Rápido e econômico — modelo padrão</td><td>$0.075</td><td>$0.30</td></tr>
              <tr><td>Gemini 2.5 Pro</td><td>Mais poderoso para tarefas complexas</td><td>$1.25</td><td>$5.00</td></tr>
              <tr><td>Gemini 2.0 Flash</td><td>Alternativa estável e rápida</td><td>$0.075</td><td>$0.30</td></tr>
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
    loadProjects();
  }, []);

  const loadProjects = () => {
    api('/projects').then(data => {
      setProjects(data.projects || []);
      if (selectedProject) {
        const updated = (data.projects || []).find(p => p.id === selectedProject.id);
        if (updated) setSelectedProject(updated);
      }
    });
  };

  const createProject = async () => {
    if (!name.trim()) return;
    await api('/projects', { method: 'POST', body: { name, description: desc } });
    setName('');
    setDesc('');
    loadProjects();
  };

  const selectProject = (p) => {
    setSelectedProject(p);
    setSystemPrompt(p.systemPrompt || '');
    setWorkspacePath(p.workspacePath || '');
  };

  const saveProjectConfig = async () => {
    await api(`/projects/${selectedProject.id}`, { method: 'PUT', body: { systemPrompt, workspacePath } });
    alert('Configuração salva!');
    loadProjects();
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
    loadProjects();
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
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Otimizado)</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro (Poderoso)</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash (Estável)</option>
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
// Main App Component
// ═══════════════════════════════════════════════════════════════

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [dashboardData, setDashboardData] = useState({ stats: {}, recentSessions: [] });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isElectron = !!window.electron;

  useEffect(() => {
    const fetchData = () => {
      api('/dashboard').then(setDashboardData).catch(() => {});
    };
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  // Desktop defaults
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
      case 'hooks': return <HooksPage />;
      case 'permissions': return <PermissionsPage />;
      case 'analytics': return <AnalyticsPage stats={dashboardData.stats} />;
      case 'plugins': return <PluginsPage />;
      case 'settings': return <SettingsPage />;
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
          </div>
        </header>

        <section className={`page-content ${currentPage === 'chat' ? 'full-height' : ''}`}>
          {renderPage()}
        </section>
      </main>
    </div>
  );
}
