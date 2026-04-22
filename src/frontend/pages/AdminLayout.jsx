import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../providers/AuthProvider.jsx';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function AdminLayout() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [dbData, setDbData] = useState([]);
  const [dbTable, setDbTable] = useState('profiles');
  const [agents, setAgents] = useState([]);
  const [showAgentBuilder, setShowAgentBuilder] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: '', description: '', model: 'gemini-2.5-flash', system_prompt: '', icon: '🤖' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { getAuthHeaders } = useAuth();

  /**
   * Centralized Data Fetching (Pillar 3: Performance)
   * Memoized to prevent unnecessary re-creations.
   */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const endpointMap = {
        dashboard: '/admin/analytics',
        users: '/admin/users',
        database: `/admin/db?table=${dbTable}`,
        agents: '/agents'
      };

      const res = await fetch(`${API_BASE}${endpointMap[activeTab]}`, { headers });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erro HTTP ${res.status}`);
      }

      const data = await res.json();
      
      if (activeTab === 'dashboard') setStats(data);
      else if (activeTab === 'users') setUsers(data.users || []);
      else if (activeTab === 'database') setDbData(data.data || []);
      else if (activeTab === 'agents') setAgents(data);

    } catch (err) {
      console.error('[ADMIN_FETCH_ERROR]', err);
      setError(`Falha ao carregar dados: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [activeTab, dbTable, getAuthHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdatePlan = async (userId, newPlan) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/admin/users`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, plan: newPlan })
      });
      if (res.ok) {
        const { user: updatedUser } = await res.json();
        setUsers(users.map(u => u.id === userId ? { ...u, plan: newPlan, tokens_limit: updatedUser.tokens_limit } : u));
      } else {
        alert('Erro ao atualizar plano');
      }
    } catch (err) {
      alert('Erro na requisição');
    }
  };

  const handleBanUser = async (userId, newRole) => {
    if (!window.confirm(newRole === 'banned' ? 'Tem certeza que deseja banir (suspender) este usuário permanentemente?' : 'Tem certeza que deseja desbanir este usuário?')) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/admin/users`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, role: newRole })
      });
      if (res.ok) {
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      } else {
        alert('Erro ao alterar status do usuário.');
      }
    } catch (err) {
      alert('Erro na requisição');
    }
  };

  const handleBonusTokens = async (userId, userName) => {
    const amount = window.prompt(`Quantos tokens extras deseja dar para ${userName}? (ex: 100000)`);
    if (!amount || isNaN(amount)) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/admin/users`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, bonus_tokens: parseInt(amount, 10) })
      });
      if (res.ok) {
        const { user: updatedUser } = await res.json();
        setUsers(users.map(u => u.id === userId ? { ...u, tokens_limit: updatedUser.tokens_limit } : u));
        alert('Tokens bônus adicionados com sucesso!');
      } else {
        alert('Erro ao adicionar tokens.');
      }
    } catch (err) {
      alert('Erro na requisição');
    }
  };

  const handleCreateAgent = async (e) => {
    e.preventDefault();
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/agents`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(newAgent)
      });
      if (res.ok) {
        const created = await res.json();
        setAgents([created, ...agents]);
        setShowAgentBuilder(false);
        setNewAgent({ name: '', description: '', model: 'gemini-2.5-flash', system_prompt: '', icon: '🤖' });
      } else {
        alert('Erro ao criar agente.');
      }
    } catch (err) {
      alert('Erro na conexão.');
    }
  };

  const handleDeleteAgent = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este agente?')) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/agents?id=${id}`, { method: 'DELETE', headers });
      if (res.ok) {
        setAgents(agents.filter(a => a.id !== id));
      }
    } catch (err) {
      alert('Erro ao excluir agente.');
    }
  };

  const renderDashboard = () => (
    <div className="admin-dashboard-grid animate-in">
      <div className="admin-stats-cards">
        <div className="admin-stat-card glow-card">
          <div className="stat-icon">👥</div>
          <div className="stat-details">
            <div className="stat-label">Usuários Totais</div>
            <div className="stat-value">{stats?.totalUsers || 0}</div>
          </div>
        </div>
        <div className="admin-stat-card glow-card">
          <div className="stat-icon">⚡</div>
          <div className="stat-details">
            <div className="stat-label">Sessões Ativas</div>
            <div className="stat-value">{stats?.activeSessions || 0}</div>
          </div>
        </div>
        <div className="admin-stat-card glow-card">
          <div className="stat-icon">🧠</div>
          <div className="stat-details">
            <div className="stat-label">Tokens Processados</div>
            <div className="stat-value">{(stats?.totalTokens || 0).toLocaleString()}</div>
          </div>
        </div>
        <div className="admin-stat-card glow-card" style={{ borderLeft: '4px solid var(--accent)' }}>
          <div className="stat-icon">💵</div>
          <div className="stat-details">
            <div className="stat-label">Custo Estimado (IA)</div>
            <div className="stat-value">${(stats?.totalCostUSD || 0).toFixed(4)}</div>
          </div>
        </div>
      </div>

      <div className="admin-dashboard-row">
        <div className="admin-panel-section glow-card flex-1">
          <h3>Atividade Recente</h3>
          <div className="admin-activity-list">
            {stats?.recentActivity?.length > 0 ? stats.recentActivity.map((act, i) => (
              <div key={i} className="activity-item">
                <div className="activity-icon">{act.type === 'Projeto Criado' ? '📁' : '📝'}</div>
                <div className="activity-info">
                  <strong>{act.title}</strong>
                  <span>{act.type} • {new Date(act.date).toLocaleDateString()}</span>
                </div>
              </div>
            )) : <p>Nenhuma atividade recente.</p>}
          </div>
        </div>

        <div className="admin-panel-section glow-card flex-1">
          <h3>Status do Sistema</h3>
          <ul className="admin-system-status">
            <li><span className="status-dot green"></span> API Conectada</li>
            <li><span className="status-dot green"></span> Banco de Dados Supabase</li>
            <li><span className="status-dot green"></span> Stripe Webhooks</li>
            <li><span className="status-dot yellow"></span> Gemini API (Rate Limits OK)</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="admin-panel-section glow-card animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3>Gestão de Usuários</h3>
        <button className="btn btn-secondary" onClick={fetchData}>🔄 Atualizar</button>
      </div>
      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>E-mail</th>
              <th>Role</th>
              <th>Plano</th>
              <th>Tokens Usados</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="avatar" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                  ) : (
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</div>
                  )}
                  {u.full_name || 'Desconhecido'}
                </td>
                <td>{u.id.substring(0, 8)}...</td>
                <td><span className={`role-badge ${u.role}`}>{u.role}</span></td>
                <td><span className={`plan-badge ${u.plan}`}>{u.plan}</span></td>
                <td>{u.tokens_used_month?.toLocaleString()} / {u.tokens_limit?.toLocaleString()}</td>
                <td style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    className="admin-select"
                    value={u.plan}
                    onChange={(e) => handleUpdatePlan(u.id, e.target.value)}
                  >
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="premium">Premium</option>
                  </select>
                  
                  <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={() => handleBanUser(u.id, u.role === 'banned' ? 'user' : 'banned')}
                    style={{ 
                      background: 'rgba(0,0,0,0.3)',
                      borderColor: u.role === 'banned' ? '#10b981' : '#ef4444', 
                      color: u.role === 'banned' ? '#10b981' : '#ef4444',
                      padding: '4px 8px', fontSize: 11
                    }}
                  >
                    {u.role === 'banned' ? 'Desbanir' : 'Banir'}
                  </button>
                  <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={() => handleBonusTokens(u.id, u.full_name || 'Usuário')}
                    style={{ padding: '4px 8px', fontSize: 11, borderColor: '#3b82f6', color: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)' }}
                  >
                    + Bônus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderDatabase = () => (
    <div className="admin-panel-section glow-card animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3>Database Explorer</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          <select className="admin-select" value={dbTable} onChange={e => setDbTable(e.target.value)}>
            <option value="profiles">Profiles (Usuários)</option>
            <option value="projects">Projects (Projetos)</option>
            <option value="sessions">Sessions (Sessões)</option>
            <option value="messages">Messages (Mensagens)</option>
            <option value="usage_logs">Usage Logs (Logs de Uso)</option>
            <option value="knowledge_files">Knowledge (Arquivos)</option>
          </select>
          <button className="btn btn-secondary" onClick={fetchData}>🔄 Consultar</button>
        </div>
      </div>

      <div className="admin-table-container" style={{ maxHeight: '60vh' }}>
        {dbData.length === 0 ? (
          <p style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Nenhum dado encontrado na tabela {dbTable}.</p>
        ) : (
          <table className="admin-table db-table">
            <thead>
              <tr>
                {Object.keys(dbData[0]).map(key => (
                  <th key={key}>{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dbData.map((row, i) => (
                <tr key={i}>
                  {Object.values(row).map((val, j) => (
                    <td key={j}>
                      {typeof val === 'object' ? JSON.stringify(val).substring(0, 50) + (JSON.stringify(val).length > 50 ? '...' : '') : String(val).substring(0, 50) + (String(val).length > 50 ? '...' : '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  return (
    <div className="admin-layout" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <header className="admin-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>👑 Super Painel Admin</h2>
          <span className="admin-badge">Acesso Restrito</span>
        </div>
        <div className="admin-tabs">
          <button className={`admin-tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>📊 Visão Geral</button>
          <button className={`admin-tab ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => setActiveTab('agents')}>🤖 Agentes</button>
          <button className={`admin-tab ${activeTab === 'bi' ? 'active' : ''}`} onClick={() => setActiveTab('bi')}>📈 Business Intelligence</button>
          <button className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>👥 Usuários</button>
          <button className={`admin-tab ${activeTab === 'database' ? 'active' : ''}`} onClick={() => setActiveTab('database')}>🗄️ Database</button>
          <button className={`admin-tab ${activeTab === 'compliance' ? 'active' : ''}`} onClick={() => setActiveTab('compliance')}>🛡️ Compliance</button>
        </div>
      </header>

      <div className="admin-content" style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {loading ? (
          <div className="loading-spinner" style={{ margin: '40px auto' }}></div>
        ) : (
          <>
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'users' && renderUsers()}
            {activeTab === 'database' && renderDatabase()}
            {activeTab === 'agents' && renderAgents()}
            {activeTab === 'bi' && renderBI()}
            {activeTab === 'compliance' && renderCompliance()}
          </>
        )}
      </div>

      <style>{`
        .admin-layout { background: #f8fafc; color: var(--text-primary); min-height: 100vh; }
        .admin-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 20px 24px; border-bottom: 1px solid var(--glass-border);
          background: #fff; box-shadow: var(--shadow-sm);
        }
        .admin-badge {
          background: #fef2f2; color: #ef4444;
          padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; border: 1px solid #fee2e2;
        }
        .admin-tabs { display: flex; gap: 4px; background: #f1f5f9; padding: 4px; border-radius: 12px; }
        .admin-tab {
          background: transparent; color: var(--text-secondary); border: none;
          padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px;
          transition: all 0.2s;
        }
        .admin-tab.active { background: #fff; color: var(--accent-primary); box-shadow: var(--shadow-sm); }
        .admin-tab:hover:not(.active) { color: var(--text-primary); background: rgba(255,255,255,0.5); }
        
        .admin-dashboard-grid { display: flex; flex-direction: column; gap: 24px; }
        .admin-stats-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
        .admin-stat-card {
          display: flex; align-items: center; gap: 16px; padding: 24px;
          background: #fff; border-radius: 16px; border: 1px solid var(--glass-border);
          box-shadow: var(--shadow-sm); transition: transform 0.2s;
        }
        .admin-stat-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
        .stat-icon { font-size: 28px; background: #f8fafc; padding: 12px; border-radius: 12px; }
        .stat-label { font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .stat-value { font-size: 26px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.5px; }
        
        .admin-dashboard-row { display: flex; gap: 24px; }
        .flex-1 { flex: 1; }
        .admin-panel-section { background: #fff; border: 1px solid var(--glass-border); border-radius: 16px; padding: 24px; box-shadow: var(--shadow-sm); }
        .admin-panel-section h3 { margin-bottom: 20px; font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 8px; color: var(--text-primary); }
        
        .admin-activity-list { display: flex; flex-direction: column; gap: 12px; }
        .activity-item { display: flex; align-items: center; gap: 12px; padding: 14px; background: #f8fafc; border-radius: 12px; border: 1px solid #f1f5f9; }
        .activity-icon { font-size: 20px; }
        .activity-info { display: flex; flex-direction: column; }
        .activity-info strong { font-size: 14px; color: var(--text-primary); }
        .activity-info span { font-size: 12px; color: var(--text-tertiary); }
        
        .admin-system-status { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 12px; }
        .admin-system-status li { display: flex; align-items: center; gap: 12px; font-size: 13px; font-weight: 500; background: #f8fafc; padding: 14px; border-radius: 12px; border: 1px solid #f1f5f9;}
        .status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
        .status-dot.green { background: #10b981; box-shadow: 0 0 8px rgba(16, 185, 129, 0.4); }
        .status-dot.yellow { background: #f59e0b; box-shadow: 0 0 8px rgba(245, 158, 11, 0.4); }
        
        .admin-table-container { overflow-x: auto; border-radius: 12px; border: 1px solid #f1f5f9; }
        .admin-table { width: 100%; border-collapse: collapse; text-align: left; }
        .admin-table th { padding: 12px 16px; background: #f8fafc; color: var(--text-tertiary); font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #f1f5f9; }
        .admin-table td { padding: 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: var(--text-secondary); }
        .db-table td { font-family: var(--font-mono); font-size: 12px; color: var(--accent-primary); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;}
        
        .admin-select { background: #fff; border: 1px solid var(--glass-border); color: var(--text-primary); padding: 6px 12px; border-radius: 8px; font-size: 13px; outline: none; transition: border-color 0.2s; }
        .admin-select:focus { border-color: var(--accent-primary); }
        
        .role-badge { padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .role-badge.admin { background: #eef2ff; color: #4f46e5; border: 1px solid #e0e7ff; }
        .role-badge.user { background: #f1f5f9; color: #64748b; }
        
        .plan-badge { padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .plan-badge.free { background: #f8fafc; color: #94a3b8; border: 1px solid #f1f5f9; }
        .plan-badge.pro { background: #eff6ff; color: #2563eb; border: 1px solid #dbeafe; }
        .plan-badge.premium { background: #fffbeb; color: #d97706; border: 1px solid #fef3c7; }
        
        .animate-in { animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

// 🤖 Agent Management Section
function renderAgents() {
  return (
    <div className="admin-panel-section animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h3 style={{ margin: 0 }}>🤖 Orquestração de Agentes Autônomos</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>Crie e gerencie sub-IAs especializadas para tarefas complexas.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAgentBuilder(!showAgentBuilder)}>
          {showAgentBuilder ? '✕ Cancelar' : '+ Criar Novo Agente'}
        </button>
      </div>
      
      {showAgentBuilder && (
        <div className="admin-panel-section" style={{ background: '#f8fafc', marginBottom: 24, border: '1px solid var(--accent-primary)' }}>
          <h4>🏗️ Agent Builder</h4>
          <form onSubmit={handleCreateAgent} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ gridColumn: 'span 1' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>NOME DO AGENTE</label>
              <input 
                type="text" className="admin-select" style={{ width: '100%' }} placeholder="Ex: Pesquisador SEO"
                value={newAgent.name} onChange={e => setNewAgent({...newAgent, name: e.target.value})} required
              />
            </div>
            <div style={{ gridColumn: 'span 1' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>ÍCONE (EMOJI)</label>
              <input 
                type="text" className="admin-select" style={{ width: '100%' }} placeholder="Ex: 🔍"
                value={newAgent.icon} onChange={e => setNewAgent({...newAgent, icon: e.target.value})}
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>DESCRIÇÃO BREVE</label>
              <input 
                type="text" className="admin-select" style={{ width: '100%' }} placeholder="O que este agente faz?"
                value={newAgent.description} onChange={e => setNewAgent({...newAgent, description: e.target.value})}
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>SYSTEM PROMPT (A ALMA DO AGENTE)</label>
              <textarea 
                className="admin-select" style={{ width: '100%', minHeight: 120, fontFamily: 'monospace' }} 
                placeholder="Defina as instruções específicas, persona e limitações deste agente..."
                value={newAgent.system_prompt} onChange={e => setNewAgent({...newAgent, system_prompt: e.target.value})} required
              />
            </div>
            <div style={{ gridColumn: 'span 1' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>MODELO BASE</label>
              <select 
                className="admin-select" style={{ width: '100%' }}
                value={newAgent.model} onChange={e => setNewAgent({...newAgent, model: e.target.value})}
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Veloz)</option>
                <option value="gemini-2.0-pro">Gemini 2.0 Pro (Inteligente)</option>
                <option value="gpt-4o">OpenAI GPT-4o</option>
                <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
              </select>
            </div>
            <div style={{ gridColumn: 'span 1', display: 'flex', alignItems: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', height: 38 }}>Salvar Agente de Elite</button>
            </div>
          </form>
        </div>
      )}

      <div className="admin-stats-cards" style={{ marginBottom: 24 }}>
        <div className="admin-stat-card">
          <div className="stat-icon">🤖</div>
          <div className="stat-details">
            <div className="stat-label">Agentes Ativos</div>
            <div className="stat-value">{agents.length}</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-icon">⚙️</div>
          <div className="stat-details">
            <div className="stat-label">Workflows</div>
            <div className="stat-value">0</div>
          </div>
        </div>
      </div>

      <div className="admin-table-container">
        {agents.length === 0 ? (
          <div className="admin-panel-section" style={{ background: '#f8fafc', textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🏗️</div>
            <h4 style={{ margin: 0 }}>Nenhum Agente Configurado</h4>
            <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Use o Agent Builder para começar a delegar tarefas.</p>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Agente</th>
                <th>Descrição</th>
                <th>Modelo</th>
                <th>Criado em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(a => (
                <tr key={a.id}>
                  <td style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 24 }}>{a.icon}</span>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{a.name}</div>
                  </td>
                  <td>{a.description}</td>
                  <td><span className="role-badge admin" style={{ fontSize: 10 }}>{a.model}</span></td>
                  <td>{new Date(a.created_at).toLocaleDateString()}</td>
                  <td>
                    <button 
                      className="btn btn-secondary btn-sm" 
                      onClick={() => handleDeleteAgent(a.id)}
                      style={{ color: '#ef4444', borderColor: '#fee2e2' }}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// 📈 Business Intelligence Section
function renderBI() {
  const bi = stats?.bi || { sentiment: { positivo: 0, neutro: 0, negativo: 0 }, hotLeads: [], totalLeads: 0 };
  const totalSentiment = (bi.sentiment.positivo || 0) + (bi.sentiment.neutro || 0) + (bi.sentiment.negativo || 0) || 1;
  
  return (
    <div className="admin-panel-section animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h3 style={{ margin: 0 }}>📈 Business Intelligence & Sentiment Analysis</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>Insights estratégicos baseados no comportamento e satisfação dos usuários.</p>
        </div>
      </div>

      <div className="admin-stats-cards" style={{ marginBottom: 24 }}>
        <div className="admin-stat-card">
          <div className="stat-icon">😊</div>
          <div className="stat-details">
            <div className="stat-label">Sentimento Positivo</div>
            <div className="stat-value">{Math.round(((bi.sentiment.positivo || 0) / totalSentiment) * 100)}%</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-icon">🔥</div>
          <div className="stat-details">
            <div className="stat-label">Leads Quentes</div>
            <div className="stat-value">{bi.totalLeads}</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-icon">📉</div>
          <div className="stat-details">
            <div className="stat-label">Usuários Frustrados</div>
            <div className="stat-value">{bi.sentiment.negativo || 0}</div>
          </div>
        </div>
      </div>
      
      <div className="admin-dashboard-row">
        <div className="admin-panel-section flex-1">
          <h4>📊 Distribuição de Sentimento</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
            {['positivo', 'neutro', 'negativo'].map(s => (
              <div key={s}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6, fontWeight: 600 }}>
                  <span style={{ textTransform: 'capitalize' }}>{s}</span>
                  <span>{bi.sentiment[s] || 0} sessões</span>
                </div>
                <div style={{ width: '100%', height: 10, background: '#f1f5f9', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${((bi.sentiment[s] || 0) / totalSentiment) * 100}%`,
                    background: s === 'positivo' ? '#10b981' : s === 'neutro' ? '#f59e0b' : '#ef4444',
                    transition: 'width 1s ease'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-panel-section flex-1">
          <h4>🔥 Hot Leads (Potencial de Venda)</h4>
          <div className="admin-table-container" style={{ marginTop: 20 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Sessão</th>
                  <th>Score</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {bi.hotLeads.length > 0 ? bi.hotLeads.map((lead, i) => (
                  <tr key={i}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{lead.title || 'Conversa sem título'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>ID: {lead.user_id?.substring(0,8)}...</div>
                    </td>
                    <td><span className="role-badge admin" style={{ background: '#fff7ed', color: '#ea580c', borderColor: '#ffedd5' }}>{lead.lead_score}/10</span></td>
                    <td><button className="btn btn-secondary btn-sm">Ver Chat</button></td>
                  </tr>
                )) : (
                  <tr><td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 20 }}>Nenhum lead quente identificado ainda.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// 🛡️ Compliance Section
function renderCompliance() {
  const [exporting, setExporting] = useState(false);

  const handleExportData = async () => {
    const userId = window.prompt('Insira o ID do Usuário para Exportação (GDPR/LGPD):');
    if (!userId) return;
    
    setExporting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/admin/db?table=messages&user_id=${userId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nexusai-export-user-${userId}.json`;
        a.click();
        alert('Exportação DSR (Data Subject Request) concluída com sucesso!');
      } else {
        alert('Erro ao buscar dados do usuário.');
      }
    } catch (e) {
      alert('Erro na exportação.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="admin-panel-section animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h3 style={{ margin: 0 }}>🛡️ Auditoria & Conformidade (Compliance)</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>Controles de privacidade, exportação de dados e segurança enterprise.</p>
        </div>
      </div>

      <div className="admin-dashboard-row">
        <div className="admin-panel-section flex-1">
          <h4>📦 Direitos do Titular (LGPD/GDPR)</h4>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 20 }}>Gere um relatório completo de todos os dados armazenados de um usuário específico.</p>
          <button 
            className="btn btn-secondary" 
            style={{ width: '100%', padding: '12px', fontWeight: 700 }}
            onClick={handleExportData}
            disabled={exporting}
          >
            {exporting ? '📦 Processando...' : '📥 Exportar Todos os Dados (DSR Export)'}
          </button>
        </div>

        <div className="admin-panel-section flex-1">
          <h4>🔒 Segurança Ativa</h4>
          <div className="admin-activity-list">
            <div className="activity-item">
              <div className="activity-icon">🛡️</div>
              <div className="activity-info">
                <strong>Filtro de PII (Personally Identifiable Info)</strong>
                <span>Status: <span style={{ color: '#10b981', fontWeight: 700 }}>ATIVO</span></span>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-icon">✍️</div>
              <div className="activity-info">
                <strong>Watermarking (Marca d'água Digital)</strong>
                <span>Status: <span style={{ color: '#10b981', fontWeight: 700 }}>ATIVO</span></span>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-icon">📜</div>
              <div className="activity-info">
                <strong>Logs de Auditoria Imutáveis</strong>
                <span>Status: <span style={{ color: '#10b981', fontWeight: 700 }}>ATIVO</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
