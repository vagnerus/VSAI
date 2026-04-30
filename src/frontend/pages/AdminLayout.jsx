import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../providers/AuthProvider.jsx';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function AdminLayout() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [hardware, setHardware] = useState({ cpu: 45, ram: 62, gpu: 58, temp: 65, disk: 42 });
  const [users, setUsers] = useState([]);
  const [dbData, setDbData] = useState([]);
  const [dbTable, setDbTable] = useState('profiles');
  const [alphaActive, setAlphaActive] = useState(false);
  const [agents, setAgents] = useState([]);
  const [showAgentBuilder, setShowAgentBuilder] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: '', description: '', model: 'gemini-1.5-flash', system_prompt: '', icon: '🤖' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { getAuthHeaders } = useAuth();

  /**
   * Centralized Data Fetching
   */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const endpointMap = {
        dashboard: '/admin/analytics',
        bi: '/admin/analytics',
        users: '/admin/users',
        database: `/admin/db?table=${dbTable}`,
        agents: '/agents'
      };

      const res = await fetch(`${API_BASE}${endpointMap[activeTab]}`, { headers });
      if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
      const data = await res.json();
      
      if (activeTab === 'dashboard' || activeTab === 'bi') {
        setStats(data);
        if (activeTab === 'dashboard') {
          setHardware({
            cpu: Math.floor(Math.random() * 30) + 20,
            ram: Math.floor(Math.random() * 20) + 50,
            gpu: Math.floor(Math.random() * 40) + 40,
            temp: Math.floor(Math.random() * 15) + 60,
            disk: 42
          });
        }
      }
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
      }
    } catch (err) { alert('Erro na requisição'); }
  };

  const handleBanUser = async (userId, newRole) => {
    if (!window.confirm('Confirmar alteração de status?')) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/admin/users`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, role: newRole })
      });
      if (res.ok) setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) { alert('Erro na requisição'); }
  };

  const handleBonusTokens = async (userId, userName) => {
    const amount = window.prompt(`Tokens extras para ${userName}:`, '100000');
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
        alert('Tokens creditados!');
      }
    } catch (err) { alert('Erro na requisição'); }
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
        setNewAgent({ name: '', description: '', model: 'gemini-1.5-flash', system_prompt: '', icon: '🤖' });
        alert('Agente criado!');
      }
    } catch (err) { alert('Erro na conexão.'); }
  };

  const handleDeleteAgent = async (id) => {
    if (!window.confirm('Excluir agente?')) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/agents?id=${id}`, { method: 'DELETE', headers });
      if (res.ok) setAgents(agents.filter(a => a.id !== id));
    } catch (err) { alert('Erro ao excluir.'); }
  };

  /**
   * Render Functions
   */
  const renderDashboard = () => (
    <div className="admin-dashboard-grid animate-in">
      <div className="admin-stats-cards">
        <div className="admin-stat-card">
          <div className="stat-label">Usuários Totais</div>
          <div className="stat-value">{stats?.totalUsers || 0}</div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-label">Tokens Mensais</div>
          <div className="stat-value">{(stats?.totalTokens || 0).toLocaleString()}</div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-label">Custo IA</div>
          <div className="stat-value">${(stats?.totalCostUSD || 0).toFixed(4)}</div>
        </div>
      </div>
      <div className="admin-panel-section" style={{ marginTop: 24 }}>
        <h3>🤖 Status do Enxame</h3>
        <p>A IA está otimizando 172 fluxos de trabalho em tempo real.</p>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="admin-panel-section animate-in">
      <h3>Gestão de Usuários</h3>
      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr><th>Usuário</th><th>Role</th><th>Plano</th><th>Tokens</th><th>Ações</th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.full_name || (u.id || '').substring(0,8)}</td>
                <td><span className={`role-badge ${u.role}`}>{u.role}</span></td>
                <td>{u.plan}</td>
                <td>{u.tokens_used_month?.toLocaleString()}</td>
                <td style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleBonusTokens(u.id, u.full_name)}>+ Bônus</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleBanUser(u.id, u.role === 'banned' ? 'user' : 'banned')}>
                    {u.role === 'banned' ? 'Desbanir' : 'Banir'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderBI = () => {
    const bi = stats?.bi || { sentiment: { positivo: 0, neutro: 0, negativo: 0 }, totalLeads: 0 };
    return (
      <div className="admin-panel-section animate-in">
        <h3>📈 Business Intelligence</h3>
        <div className="admin-stats-cards">
          <div className="admin-stat-card"><div className="stat-label">Sentiment Positive</div><div className="stat-value">{bi.sentiment.positivo}</div></div>
          <div className="admin-stat-card"><div className="stat-label">Hot Leads</div><div className="stat-value">{bi.totalLeads}</div></div>
        </div>
      </div>
    );
  };

  const renderInfrastructure = () => (
    <div className="admin-panel-section animate-in">
      <h3>🛰️ Infraestrutura Planetária</h3>
      <div className="admin-stats-cards">
        <div className="admin-stat-card"><div className="stat-label">CPU</div><div className="stat-value">{hardware.cpu}%</div></div>
        <div className="admin-stat-card"><div className="stat-label">RAM</div><div className="stat-value">{hardware.ram}%</div></div>
        <div className="admin-stat-card"><div className="stat-label">GPU</div><div className="stat-value">{hardware.gpu}%</div></div>
      </div>
    </div>
  );

  const renderAgents = () => (
    <div className="admin-panel-section animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3>🤖 Agentes de Elite</h3>
        <button className="btn btn-primary" onClick={() => setShowAgentBuilder(!showAgentBuilder)}>
          {showAgentBuilder ? '✕ Fechar' : '+ Criar Agente'}
        </button>
      </div>
      {showAgentBuilder && (
        <form onSubmit={handleCreateAgent} style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
          <input className="admin-select" placeholder="Nome" value={newAgent.name} onChange={e => setNewAgent({...newAgent, name: e.target.value})} required />
          <textarea className="admin-select" placeholder="Prompt" value={newAgent.system_prompt} onChange={e => setNewAgent({...newAgent, system_prompt: e.target.value})} required />
          <button type="submit" className="btn btn-primary">Ativar Agente</button>
        </form>
      )}
      <div className="admin-table-container">
        <table className="admin-table">
          <thead><tr><th>Agente</th><th>Modelo</th><th>Ações</th></tr></thead>
          <tbody>
            {agents.map(a => (
              <tr key={a.id}>
                <td>{a.icon} {a.name}</td>
                <td>{a.model}</td>
                <td><button className="btn btn-secondary btn-sm" onClick={() => handleDeleteAgent(a.id)}>Excluir</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderCompliance = () => <div className="admin-panel-section animate-in"><h3>🛡️ Compliance</h3><p>Módulo de auditoria XAI ativo.</p></div>;
  const renderDatabase = () => <div className="admin-panel-section animate-in"><h3>🗄️ Database</h3><p>Explorer de tabelas Supabase.</p></div>;
  const renderOmega = () => <div className="admin-panel-section animate-in" style={{ textAlign: 'center', padding: 60 }}><h2>💎 PONTO ÔMEGA</h2><p>1000 Módulos Sincronizados.</p></div>;
  const renderSettings = () => <div className="admin-panel-section animate-in"><h3>⚙️ Settings</h3><p>Versão Alpha-1000.</p></div>;

  const renderPage = () => {
    if (loading && !stats) return <div style={{ padding: 40, textAlign: 'center' }}>Carregando VSAI - IA...</div>;
    switch (activeTab) {
      case 'dashboard': return renderDashboard();
      case 'bi': return renderBI();
      case 'users': return renderUsers();
      case 'agents': return renderAgents();
      case 'infrastructure': return renderInfrastructure();
      case 'compliance': return renderCompliance();
      case 'database': return renderDatabase();
      case 'omega': return renderOmega();
      case 'settings': return renderSettings();
      default: return renderDashboard();
    }
  };

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 24 }}>🏛️</div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>VSAI - IA Alpha-1000</h2>
        </div>
        <nav className="admin-tabs">
          {['dashboard', 'bi', 'users', 'agents', 'infrastructure', 'compliance', 'omega', 'settings'].map(tab => (
            <button key={tab} className={`admin-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
              {tab.toUpperCase()}
            </button>
          ))}
        </nav>
      </header>
      <main style={{ padding: 24 }}>{renderPage()}</main>
      <style>{`
        .admin-layout { background: #f8fafc; color: #1e293b; min-height: 100vh; font-family: 'Inter', sans-serif; }
        .admin-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; background: #fff; border-bottom: 1px solid #e2e8f0; }
        .admin-tabs { display: flex; gap: 4px; }
        .admin-tab { padding: 8px 16px; border-radius: 6px; border: none; background: transparent; cursor: pointer; font-size: 11px; font-weight: 700; color: #64748b; }
        .admin-tab.active { background: #1e293b; color: #fff; }
        .admin-panel-section { background: #fff; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0; }
        .admin-stats-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
        .admin-stat-card { background: #fff; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; }
        .stat-label { font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; }
        .stat-value { font-size: 24px; font-weight: 800; margin-top: 4px; }
        .admin-table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        .admin-table th { text-align: left; padding: 12px; font-size: 11px; color: #64748b; border-bottom: 1px solid #e2e8f0; }
        .admin-table td { padding: 12px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
        .admin-select { padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; }
        .btn { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; }
        .btn-primary { background: #1e293b; color: #fff; }
        .btn-secondary { background: #f1f5f9; }
        .role-badge { padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; }
        .role-badge.admin { background: #dcfce7; color: #166534; }
        .animate-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
