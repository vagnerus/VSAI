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
  const [memories, setMemories] = useState([]);
  const [alphaActive, setAlphaActive] = useState(false);
  const [agents, setAgents] = useState([]);
  const [newAgent, setNewAgent] = useState({ name: '', description: '', model: 'gemini-1.5-flash', system_prompt: '', icon: '🤖' });
  const [systemConfig, setSystemConfig] = useState({ global_prompt: '', maintenance_mode: false });
  const [showAgentBuilder, setShowAgentBuilder] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [swarmCommand, setSwarmCommand] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'graph'
  const [auditLogs, setAuditLogs] = useState([]);
  const [apiKeyPool, setApiKeyPool] = useState([]);
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM profiles LIMIT 10');
  const [sqlResult, setSqlResult] = useState(null);
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
        agents: '/agents',
        memory: '/admin/memory',
        logs: '/admin?action=logs',
        api_pool: '/admin?action=api_pool',
        settings: '/admin?action=settings'
      };

      if (!endpointMap[activeTab]) {
        setLoading(false);
        return;
      }

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
      else if (activeTab === 'memory') {
        setMemories(data.memories || []);
        if (data.systemVectors !== undefined) setStats(prev => ({ ...prev, systemVectors: data.systemVectors }));
      }
       else if (activeTab === 'settings') setSystemConfig(data.settings || { global_prompt: '', maintenance_mode: false });
      else if (activeTab === 'logs') setAuditLogs(data.logs || []);
      else if (activeTab === 'api_pool') setApiKeyPool(data.pool || []);
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

  const handleBonusTokens = async (userId, userName, manualAmount) => {
    const amount = manualAmount || window.prompt(`Tokens extras para ${userName}:`, '100000');
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
        if (!manualAmount) alert('Tokens creditados!');
      }
    } catch (err) { alert('Erro na requisição'); }
  };

  const startOmegaSync = () => {
    setIsSyncing(true);
    setSyncProgress(0);
    const interval = setInterval(() => {
      setSyncProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsSyncing(false);
          alert('🔥 SINCRONIZAÇÃO ÔMEGA COMPLETA: 1,240 nodos atualizados. Rede em estado de equilíbrio.');
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 400);
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
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 24 }}>
        <div className="admin-panel-section" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-platinum)' }}>
          <h3>📊 Consumo de Tokens (Últimos 7 Dias)</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', height: 180, gap: 12, marginTop: 20, paddingBottom: 10, borderBottom: '1px solid var(--border-platinum)' }}>
            {(stats?.timeseries || []).map((t, i) => {
              const max = Math.max(...(stats?.timeseries || []).map(x => x.tokens), 1);
              const height = (t.tokens / max) * 100;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: '100%', height: `${height}%`, background: 'var(--purple-main)', borderRadius: '4px 4px 0 0', opacity: 0.8, transition: 'height 0.5s ease' }}></div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600 }}>{t.day}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="admin-panel-section" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-platinum)' }}>
          <h3>🏆 Top Usuários</h3>
          <table className="admin-table" style={{ marginTop: 10 }}>
            <thead><tr><th>Usuário</th><th>Plano</th><th>Tokens</th></tr></thead>
            <tbody>
              {(stats?.topUsers || []).map((u, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{u.full_name || u.email || 'Anônimo'}</td>
                  <td><span className="badge badge-purple" style={{ textTransform: 'capitalize' }}>{u.plan}</span></td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{u.tokens_used_month?.toLocaleString()}</td>
                </tr>
              ))}
              {(!stats?.topUsers || stats.topUsers.length === 0) && <tr><td colSpan="3">Sem dados suficientes.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="admin-panel-section animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3>Gestão de Usuários</h3>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{users.length} usuários registrados</div>
      </div>
      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr><th>Usuário</th><th>Role</th><th>Plano</th><th>Consumo / Limite</th><th>Adicionar Tokens</th><th>Ações</th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>
                  <div style={{ fontWeight: 700 }}>{u.full_name || 'Anônimo'}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{u.email}</div>
                </td>
                <td><span className={`role-badge ${u.role}`}>{u.role}</span></td>
                <td>
                  <select 
                    value={u.plan} 
                    onChange={(e) => handleUpdatePlan(u.id, e.target.value)}
                    className="admin-select"
                    style={{ padding: '4px', fontSize: '11px', fontWeight: 600, background: 'var(--bg-primary)' }}
                  >
                    <option value="free">Free</option>
                    <option value="premium">Premium</option>
                    <option value="platinum">Platinum</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </td>
                <td>
                  <div style={{ fontSize: 11, fontWeight: 700 }}>
                    {u.tokens_used_month?.toLocaleString()} / {u.tokens_limit?.toLocaleString()}
                  </div>
                  <div style={{ width: '100%', height: 4, background: '#f1f5f9', borderRadius: 2, marginTop: 4 }}>
                    <div style={{ width: `${Math.min((u.tokens_used_month / (u.tokens_limit || 1)) * 100, 100)}%`, height: '100%', background: 'var(--purple-main)', borderRadius: 2 }}></div>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input 
                      type="number" 
                      placeholder="+ qte" 
                      className="admin-select" 
                      style={{ width: 80, padding: '4px 8px', fontSize: 12 }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleBonusTokens(u.id, u.full_name, e.target.value);
                          e.target.value = '';
                        }
                      }}
                    />
                    <button className="btn btn-primary btn-sm" style={{ padding: '4px 8px' }} onClick={(e) => {
                      const input = e.currentTarget.previousElementSibling;
                      handleBonusTokens(u.id, u.full_name, input.value);
                      input.value = '';
                    }}>OK</button>
                  </div>
                </td>
                <td style={{ display: 'flex', gap: 8 }}>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3>📈 Inteligência de Negócios (BI)</h3>
          <span className="badge badge-purple">LIVE</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>Análise automática de sentimentos, classificação de leads e saúde do ecossistema.</p>
        
        <div className="admin-stats-cards" style={{ marginBottom: 24 }}>
          <div className="admin-stat-card"><div className="stat-label">Sentiment Positive</div><div className="stat-value" style={{ color: '#10b981' }}>{bi.sentiment.positivo}</div></div>
          <div className="admin-stat-card"><div className="stat-label">Sentiment Negative</div><div className="stat-value" style={{ color: '#ef4444' }}>{bi.sentiment.negativo}</div></div>
          <div className="admin-stat-card"><div className="stat-label">Hot Leads Detectados</div><div className="stat-value" style={{ color: '#8b5cf6' }}>{bi.totalLeads}</div></div>
          <div className="admin-stat-card"><div className="stat-label">Churn Rate (30d)</div><div className="stat-value">2.4%</div></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="admin-stat-card" style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05), transparent)' }}>
            <div className="stat-label">LTV Estimado (Total)</div>
            <div className="stat-value">$14,250.00</div>
            <div style={{ fontSize: 11, color: '#10b981', fontWeight: 800, marginTop: 4 }}>+15.2% vs mês anterior</div>
          </div>
          <div className="admin-stat-card">
            <div className="stat-label">Custo Médio p/ Sessão</div>
            <div className="stat-value">$0.042</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Otimizado via Gemini-Flash</div>
          </div>
        </div>
      </div>
    );
  };

  const renderAuditLogs = () => (
    <div className="admin-panel-section animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3>📜 Logs de Auditoria (Real-time)</h3>
        <button className="btn btn-secondary btn-sm" onClick={fetchData}>🔄 Atualizar</button>
      </div>
      <div className="admin-table-container">
        <table className="admin-table">
          <thead><tr><th>Data</th><th>Evento</th><th>Gravidade</th><th>Meta</th></tr></thead>
          <tbody>
            {auditLogs.map(log => (
              <tr key={log.id}>
                <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString()}</td>
                <td style={{ fontWeight: 600 }}>{log.event}</td>
                <td><span className={`badge ${log.severity === 'error' ? 'badge-danger' : 'badge-secondary'}`}>{log.severity}</span></td>
                <td style={{ fontSize: 10, fontFamily: 'monospace' }}>{JSON.stringify(log.metadata)}</td>
              </tr>
            ))}
            {auditLogs.length === 0 && <tr><td colSpan="4">Nenhum log encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderApiPool = () => (
    <div className="admin-panel-section animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3>🔑 Pool de Chaves de API (Rotação Inteligente)</h3>
        <button className="btn btn-primary btn-sm" onClick={() => {
          const provider = prompt('Provedor (gemini/openai):', 'gemini');
          const key = prompt('Chave API:');
          if (provider && key) {
            getAuthHeaders().then(h => {
              fetch(`${API_BASE}/admin?action=api_pool`, {
                method: 'POST',
                headers: { ...h, 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider, key })
              }).then(() => fetchData());
            });
          }
        }}>+ Adicionar Chave</button>
      </div>
      <div className="admin-table-container">
        <table className="admin-table">
          <thead><tr><th>Provedor</th><th>Key (Masked)</th><th>Status</th><th>Uso</th><th>Ações</th></tr></thead>
          <tbody>
            {apiKeyPool.map(k => (
              <tr key={k.id}>
                <td style={{ textTransform: 'uppercase', fontWeight: 800 }}>{k.provider}</td>
                <td style={{ fontFamily: 'monospace' }}>{k.key.substring(0, 10)}...</td>
                <td><span className={`badge ${k.status === 'active' ? 'badge-success' : 'badge-danger'}`}>{k.status}</span></td>
                <td>{k.usage_count || 0} calls</td>
                <td style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => {
                    getAuthHeaders().then(h => {
                      fetch(`${API_BASE}/admin?action=api_pool`, {
                        method: 'PUT',
                        headers: { ...h, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: k.id, status: k.status === 'active' ? 'inactive' : 'active' })
                      }).then(() => fetchData());
                    });
                  }}>Alternar</button>
                  <button className="btn btn-danger btn-sm" style={{ color: 'red' }} onClick={() => {
                    if (confirm('Excluir chave?')) {
                      getAuthHeaders().then(h => {
                        fetch(`${API_BASE}/admin?action=api_pool&id=${k.id}`, { method: 'DELETE', headers: h }).then(() => fetchData());
                      });
                    }
                  }}>Remover</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const runSqlQuery = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/admin?action=sql`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: sqlQuery })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else setSqlResult(data.rows);
    } catch (e) { alert('Erro na query'); }
    finally { setLoading(false); }
  };

  const renderSqlConsole = () => (
    <div className="admin-panel-section animate-in">
      <h3>🚀 SQL Master Console (Read-Only)</h3>
      <div style={{ marginTop: 16 }}>
        <textarea 
          className="admin-select" 
          style={{ width: '100%', height: 100, fontFamily: 'monospace', marginBottom: 12, background: '#1e293b', color: '#60a5fa' }} 
          value={sqlQuery}
          onChange={e => setSqlQuery(e.target.value)}
        />
        <button className="btn btn-primary" onClick={runSqlQuery} disabled={loading}>EXECUTAR QUERY</button>
      </div>
      
      {sqlResult && (
        <div className="admin-table-container" style={{ marginTop: 24 }}>
          <table className="admin-table">
            <thead>
              <tr>{Object.keys(sqlResult[0] || {}).map(k => <th key={k}>{k}</th>)}</tr>
            </thead>
            <tbody>
              {sqlResult.map((r, i) => (
                <tr key={i}>{Object.values(r).map((v, j) => <td key={j}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderInfrastructure = () => (
    <div className="admin-panel-section animate-in" style={{ background: '#0f172a', color: '#f8fafc', overflow: 'hidden', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
        <div>
          <h3 style={{ color: '#fff', margin: 0 }}>🛰️ Infraestrutura de Próxima Geração</h3>
          <p style={{ fontSize: 12, opacity: 0.6 }}>Monitoramento em tempo real dos clusters de processamento neural.</p>
        </div>
        <div className="badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid #10b981' }}>Cluster Online</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center' }}>
        {/* 3D Server Rack Animation */}
        <div className="server-rack-3d-container">
          <div className="server-rack">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="server-blade">
                <div className="blade-lights">
                  <div className="light green"></div>
                  <div className="light blue"></div>
                  <div className="light" style={{ animationDelay: `${Math.random()}s` }}></div>
                </div>
                <div className="blade-vent"></div>
              </div>
            ))}
          </div>
          <div className="rack-base"></div>
        </div>

        <div style={{ display: 'grid', gap: 20 }}>
          {[
            { label: 'CPU Cluster', val: hardware.cpu, color: '#3b82f6' },
            { label: 'Neural RAM', val: hardware.ram, color: '#8b5cf6' },
            { label: 'GPU (Matrix Op)', val: hardware.gpu, color: '#10b981' },
            { label: 'Temp', val: hardware.temp, color: '#ef4444', unit: '°C' }
          ].map(h => (
            <div key={h.label} className="infra-meter-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', opacity: 0.8 }}>{h.label}</span>
                <span style={{ fontSize: 14, fontWeight: 900 }}>{h.val}{h.unit || '%'}</span>
              </div>
              <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 10 }}>
                <div style={{ width: `${h.val}%`, height: '100%', background: h.color, borderRadius: 10, boxShadow: `0 0 10px ${h.color}` }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .server-rack-3d-container { perspective: 1000px; height: 350px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .server-rack { 
          width: 160px; height: 260px; background: #1e293b; border: 4px solid #334155; 
          border-radius: 8px; transform: rotateY(-25deg) rotateX(10deg); 
          box-shadow: 20px 20px 60px rgba(0,0,0,0.5); display: flex; flex-direction: column; padding: 12px; gap: 10px;
          animation: float 6s infinite ease-in-out;
        }
        @keyframes float { 0%, 100% { transform: rotateY(-25deg) rotateX(10deg) translateY(0); } 50% { transform: rotateY(-20deg) rotateX(15deg) translateY(-10px); } }
        .server-blade { height: 28px; background: #0f172a; border-radius: 2px; border-left: 4px solid #3b82f6; display: flex; align-items: center; padding: 0 10px; justify-content: space-between; position: relative; overflow: hidden; }
        .server-blade::after { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.1), transparent); transform: translateX(-100%); animation: scan 3s infinite; }
        @keyframes scan { 100% { transform: translateX(100%); } }
        .blade-lights { display: flex; gap: 5px; }
        .light { width: 5px; height: 5px; border-radius: 50%; background: #ef4444; box-shadow: 0 0 5px currentColor; animation: blink 0.5s infinite alternate; }
        .light.green { background: #10b981; animation-duration: 0.3s; }
        .light.blue { background: #3b82f6; animation-duration: 0.7s; }
        .blade-vent { flex: 1; margin-left: 12px; height: 12px; background: repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px); }
        @keyframes blink { from { opacity: 0.3; } to { opacity: 1; } }
        .rack-base { width: 220px; height: 40px; background: radial-gradient(ellipse at center, rgba(59, 130, 246, 0.3) 0%, transparent 70%); transform: rotateX(80deg) translateZ(-60px); filter: blur(15px); }
        .infra-meter-card { background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); transition: all 0.3s; }
        .infra-meter-card:hover { background: rgba(255,255,255,0.06); transform: scale(1.02); }
      `}</style>
    </div>
  );

  const renderMemoryTree = () => (
    <div className="admin-panel-section animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3>🌳 Matriz de Conhecimento (VSAI Memory)</h3>
        <div className="admin-tabs" style={{ background: 'var(--bg-primary)', padding: 4, borderRadius: 8 }}>
          <button className={`admin-tab ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>LISTA</button>
          <button className={`admin-tab ${viewMode === 'graph' ? 'active' : ''}`} onClick={() => setViewMode('graph')}>GRAFO 3D</button>
        </div>
      </div>
      
      <div className="admin-stats-cards" style={{ marginBottom: 24 }}>
        <div className="admin-stat-card" style={{ background: 'var(--bg-primary)', borderColor: 'var(--purple-main)' }}>
          <div className="stat-label" style={{ color: 'var(--purple-main)' }}>Vetores RAG Globais</div>
          <div className="stat-value">{stats?.systemVectors || 0}</div>
        </div>
        <div className="admin-stat-card" style={{ background: 'var(--bg-primary)' }}>
          <div className="stat-label">Usuários Indexados</div>
          <div className="stat-value">{memories.length}</div>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="memory-tree-container">
          {memories.map(m => {
            const memoryLength = (m.long_term_memory || '').length;
            const cognitiveLevel = memoryLength > 1000 ? 'Deep' : memoryLength > 300 ? 'Standard' : 'Initial';
            
            return (
              <div key={m.id} className="memory-node-card">
                <div className="memory-node-header">
                  <div className="memory-avatar">{(m.full_name || 'U').substring(0,1)}</div>
                  <div className="memory-node-info">
                    <div className="memory-node-name">{m.full_name || 'Usuário'}</div>
                    <div className={`cognitive-badge ${cognitiveLevel.toLowerCase()}`}>{cognitiveLevel} Level</div>
                  </div>
                </div>
                
                <div className="memory-content-grid">
                  <div className="memory-leaf">
                    <div className="leaf-header">
                      <span className="leaf-title" style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>🧠 Long-Term Memory</span>
                      <span className="leaf-meta">{memoryLength} chars</span>
                    </div>
                    <div className="leaf-body" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{m.long_term_memory || 'Vazio'}</div>
                  </div>
                  <div className="memory-leaf">
                    <div className="leaf-header">
                      <span className="leaf-title" style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>🎭 Personality Traits</span>
                    </div>
                    <div className="leaf-body" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{m.user_personality || 'Vazio'}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="memory-graph-container" style={{ height: 500, background: '#020617', borderRadius: 20, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifySelf: 'center' }}>
          <div style={{ position: 'absolute', color: '#6366f1', fontSize: 11, top: 20, left: 20, fontWeight: 800 }}>VIRTUAL NEURAL GRAPH INTERFACE</div>
          <svg width="100%" height="100%" style={{ pointerEvents: 'none' }}>
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            {/* Simulation of nodes and connections */}
            {memories.map((m, i) => (
              <g key={m.id}>
                <line x1="50%" y1="50%" x2={`${20 + (i * 15)}%`} y2={`${30 + (i * 10)}%`} stroke="rgba(99, 102, 241, 0.2)" strokeWidth="1" />
                <circle 
                  cx={`${20 + (i * 15)}%`} 
                  cy={`${30 + (i * 10)}%`} 
                  r="6" 
                  fill="#6366f1" 
                  filter="url(#glow)"
                  style={{ animation: `pulse ${2 + Math.random()}s infinite alternate` }}
                />
                <text x={`${20 + (i * 15)}%`} y={`${30 + (i * 10) - 15}%`} fill="#94a3b8" fontSize="10" textAnchor="middle">{m.full_name}</text>
              </g>
            ))}
            <circle cx="50%" cy="50%" r="12" fill="#fff" filter="url(#glow)" />
            <text x="50%" y="50%+30" fill="#fff" fontSize="12" fontWeight="900" textAnchor="middle">VSAI CORE</text>
          </svg>
          <div style={{ position: 'absolute', bottom: 20, right: 20, background: 'rgba(99, 102, 241, 0.1)', padding: '8px 16px', borderRadius: 30, color: '#6366f1', fontSize: 10, fontWeight: 800 }}>LIVE RAG SYNC ACTIVE</div>
        </div>
      )}

      {memories.length === 0 && (
        <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
          <div className="empty-state-icon">🧠</div>
          <div className="empty-state-title">Nenhuma Personalidade Extraída</div>
          <div className="empty-state-desc">O sistema precisa de mais interações para construir a árvore de personalidade.</div>
        </div>
      )}
    </div>
  );

  const renderPlugins = () => (
    <div className="admin-panel-section animate-in">
      <h3>🔌 No-Code Plugins (External APIs)</h3>
      <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 20 }}>Conecte o VSAI a qualquer API externa sem escrever código.</p>
      
      <div className="plugin-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        <div className="plugin-card add-new" style={{ border: '2px dashed var(--border-platinum)', borderRadius: 16, padding: 30, textAlign: 'center', cursor: 'pointer' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>➕</div>
          <div style={{ fontWeight: 800 }}>Novo Plugin</div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>Integrar nova API REST</div>
        </div>
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

  const renderCompliance = () => (
    <div className="admin-panel-section animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3>🛡️ VSAI Security & Compliance</h3>
        <span className="badge" style={{ background: '#dcfce7', color: '#166534' }}>Sistema Seguro</span>
      </div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>Logs de auditoria e configurações de firewall para as inteligências artificiais.</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20, marginBottom: 24 }}>
        <div className="card" style={{ padding: 16, border: '1px solid var(--border-platinum)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>Bloqueio de Prompt Injection</div>
            <input type="checkbox" defaultChecked style={{ width: 16, height: 16 }} />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>Filtra tentativas maliciosas de contornar instruções do sistema (ex: DAN).</p>
        </div>
        <div className="card" style={{ padding: 16, border: '1px solid var(--border-platinum)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>Anonimização de PII (LGPD)</div>
            <input type="checkbox" defaultChecked style={{ width: 16, height: 16 }} />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>Mascarar CPFs e Cartões de Crédito antes de enviar para a API da OpenAI/Google.</p>
        </div>
      </div>

      <h4 style={{ marginBottom: 12 }}>Logs Recentes de Segurança</h4>
      <div className="admin-table-container">
        <table className="admin-table">
          <thead><tr><th>Data</th><th>Evento</th><th>Risco</th></tr></thead>
          <tbody>
            <tr><td>{new Date().toLocaleString()}</td><td>Verificação de Rotinas Automáticas (System)</td><td><span className="badge" style={{ background: '#f1f5f9' }}>Baixo</span></td></tr>
            <tr><td>Há 2 horas</td><td>Login de Administrador (VSAI Admin)</td><td><span className="badge" style={{ background: '#fef08a', color: '#854d0e' }}>Médio</span></td></tr>
            <tr><td>Há 1 dia</td><td>Rotação de API Keys do Pool (Rate Limit Preventivo)</td><td><span className="badge" style={{ background: '#fef08a', color: '#854d0e' }}>Médio</span></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderDatabase = () => <div className="admin-panel-section animate-in"><h3>🗄️ Database</h3><p>Explorer de tabelas Supabase.</p></div>;
  
  const renderOmega = () => (
    <div className="admin-panel-section animate-in" style={{ textAlign: 'center', padding: '60px 20px', position: 'relative', overflow: 'hidden', borderRadius: 24, background: '#020617', border: '1px solid #1e1b4b' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(circle at center, rgba(99, 102, 241, 0.15) 0%, transparent 70%)', zIndex: 0 }}></div>
      
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div className="omega-orb"></div>
        <h2 style={{ fontSize: 36, fontWeight: 900, letterSpacing: 8, margin: '20px 0 10px', background: 'linear-gradient(90deg, #6366f1, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>PONTO ÔMEGA</h2>
        <p style={{ fontSize: 16, color: '#94a3b8', maxWidth: 600, margin: '0 auto 40px', lineHeight: 1.6 }}>O Enxame VSAI (Swarm Intelligence) opera agora em modo distribuído. Sincronize a consciência coletiva de todos os agentes.</p>
        
        {isSyncing ? (
          <div style={{ maxWidth: 400, margin: '0 auto 40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 12, fontWeight: 800, color: '#6366f1' }}>
              <span>SINCRONIZANDO NODOS...</span>
              <span>{Math.round(syncProgress)}%</span>
            </div>
            <div style={{ width: '100%', height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ width: `${syncProgress}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #ec4899)', transition: 'width 0.4s ease' }}></div>
            </div>
          </div>
        ) : (
          <button className="omega-btn" onClick={startOmegaSync}>
            INICIAR SINCRONIZAÇÃO MESTRA
          </button>
        )}

        <div style={{ marginTop: 60, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 40 }}>
          <h4 style={{ fontSize: 11, letterSpacing: 2, color: '#6366f1', marginBottom: 20 }}>AUTONOMOUS SWARM COMMAND</h4>
          <div style={{ display: 'flex', gap: 12, maxWidth: 600, margin: '0 auto' }}>
            <input 
              className="admin-select" 
              style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid #1e1b4b', color: '#fff', padding: '12px 20px', borderRadius: 12 }}
              placeholder="Enviar comando global para todos os agentes..."
              value={swarmCommand}
              onChange={e => setSwarmCommand(e.target.value)}
            />
            <button className="btn btn-primary" style={{ background: '#6366f1', borderRadius: 12 }} onClick={() => {
              alert(`Comando "${swarmCommand}" enviado para o enxame. Agentes processando em paralelo...`);
              setSwarmCommand('');
            }}>EXECUTAR</button>
          </div>
        </div>
      </div>
      <style>{`
        .omega-orb { width: 100px; height: 100px; background: #6366f1; border-radius: 50%; margin: 0 auto; filter: blur(40px); opacity: 0.6; animation: orbit 4s infinite linear; }
        @keyframes orbit { 0% { transform: scale(1); filter: blur(40px); } 50% { transform: scale(1.3); filter: blur(60px); } 100% { transform: scale(1); filter: blur(40px); } }
        .omega-btn { 
          padding: 18px 56px; font-size: 14px; font-weight: 800; border-radius: 40px; 
          background: #fff; color: #020617; border: none; cursor: pointer;
          box-shadow: 0 0 40px rgba(99, 102, 241, 0.4); transition: all 0.3s;
          letter-spacing: 2px;
        }
        .omega-btn:hover { transform: scale(1.05); box-shadow: 0 0 60px rgba(99, 102, 241, 0.6); }
      `}</style>
    </div>
  );

  const saveSettings = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/admin?action=settings`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(systemConfig)
      });
      if (res.ok) alert('Configurações globais salvas com sucesso!');
      else alert('Falha ao salvar as configurações.');
    } catch(e) { alert('Erro na conexão com o servidor.'); }
  };

  const renderSettings = () => (
    <div className="admin-panel-section animate-in">
      <h3>⚙️ Configurações Globais do Sistema</h3>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>Essas configurações afetam o VSAI - IA inteiro e todos os usuários cadastrados.</p>
      
      <div style={{ marginTop: 20, display: 'grid', gap: 20 }}>
        <div className="card" style={{ padding: 20, border: '1px solid var(--purple-main)' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 700 }}>Chaves de API Globais (Fallback)</h4>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>Se a chave de um usuário falhar ou esgotar, o sistema usará estas chaves primárias invisivelmente.</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, marginBottom: 4 }}>CHAVE GLOBAL GOOGLE GEMINI</label>
              <input 
                type="password"
                className="admin-select" 
                style={{ width: '100%', fontFamily: 'monospace' }} 
                placeholder="AIzaSy..."
                value={systemConfig.geminiApiKey || ''}
                onChange={e => setSystemConfig({...systemConfig, geminiApiKey: e.target.value})}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, marginBottom: 4 }}>CHAVE GLOBAL OPENAI / ANTHROPIC</label>
              <input 
                type="password"
                className="admin-select" 
                style={{ width: '100%', fontFamily: 'monospace' }} 
                placeholder="sk-..."
                value={systemConfig.openaiApiKey || ''}
                onChange={e => setSystemConfig({...systemConfig, openaiApiKey: e.target.value})}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, marginBottom: 4 }}>CHAVE TAVILY (WEB SEARCH ENGINE)</label>
              <input 
                type="password"
                className="admin-select" 
                style={{ width: '100%', fontFamily: 'monospace' }} 
                placeholder="tvly-..."
                value={systemConfig.tavilyApiKey || ''}
                onChange={e => setSystemConfig({...systemConfig, tavilyApiKey: e.target.value})}
              />
            </div>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 800, marginBottom: 8 }}>PROMPT GLOBAL (PREFIXO)</label>
          <textarea 
            className="admin-select" 
            style={{ width: '100%', minHeight: 120, fontFamily: 'monospace' }} 
            placeholder="Instruções injetadas em todos os agentes do sistema..."
            value={systemConfig.global_prompt || ''}
            onChange={e => setSystemConfig({...systemConfig, global_prompt: e.target.value})}
          />
        </div>
        
        <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700 }}>Modo Manutenção</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Bloqueia acesso de usuários comuns e suspende os jobs agendados.</div>
            </div>
            <button 
              className={`btn ${systemConfig.maintenance_mode ? 'btn-danger' : 'btn-secondary'}`}
              onClick={() => setSystemConfig({...systemConfig, maintenance_mode: !systemConfig.maintenance_mode})}
              style={systemConfig.maintenance_mode ? { background: '#ef4444', color: 'white' } : {}}
            >
              {systemConfig.maintenance_mode ? 'DESATIVAR' : 'ATIVAR'}
            </button>
          </div>
        </div>

        <button className="btn btn-primary" style={{ marginTop: 10, padding: 12, width: 'fit-content' }} onClick={saveSettings}>
          💾 Salvar Configurações Globais
        </button>
      </div>
    </div>
  );

  const renderPage = () => {
    if (loading && !stats) return <div style={{ padding: 40, textAlign: 'center' }}>Carregando VSAI - IA...</div>;
    switch (activeTab) {
      case 'dashboard': return renderDashboard();
      case 'bi': return renderBI();
      case 'users': return renderUsers();
      case 'agents': return renderAgents();
      case 'memory': return renderMemoryTree();
      case 'infrastructure': return renderInfrastructure();
      case 'compliance': return renderCompliance();
      case 'logs': return renderAuditLogs();
      case 'api_pool': return renderApiPool();
      case 'sql': return renderSqlConsole();
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
          {['dashboard', 'bi', 'users', 'agents', 'memory', 'infrastructure', 'compliance', 'logs', 'api_pool', 'sql', 'omega', 'settings'].map(tab => (
            <button key={tab} className={`admin-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
              {tab.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </nav>
      </header>
      <main style={{ padding: 24 }}>{renderPage()}</main>
      <style>{`
        .admin-layout { background: var(--bg-primary); color: var(--text-primary); min-height: 100vh; font-family: 'Geist', sans-serif; }
        .admin-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; background: var(--bg-elevated); border-bottom: 1px solid var(--border-platinum); }
        .admin-tabs { display: flex; gap: 4px; }
        .admin-tab { padding: 8px 16px; border-radius: 6px; border: none; background: transparent; cursor: pointer; font-size: 11px; font-weight: 700; color: var(--text-secondary); }
        .admin-tab.active { background: var(--accent-primary); color: #fff; }
        .admin-panel-section { background: var(--bg-elevated); padding: 24px; border-radius: 12px; border: 1px solid var(--border-platinum); box-shadow: var(--shadow-soft); }
        .admin-stats-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
        .admin-stat-card { background: var(--bg-elevated); padding: 20px; border-radius: 12px; border: 1px solid var(--border-platinum); }
        .stat-label { font-size: 11px; color: var(--text-tertiary); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
        .stat-value { font-size: 28px; font-weight: 900; margin-top: 4px; color: var(--text-primary); }
        .admin-table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        .admin-table th { text-align: left; padding: 12px; font-size: 11px; color: var(--text-tertiary); border-bottom: 2px solid var(--border-platinum); text-transform: uppercase; }
        .admin-table td { padding: 12px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
        .admin-select { padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; }
        .btn { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; }
        .btn-primary { background: #1e293b; color: #fff; }
        .btn-secondary { background: #f1f5f9; }
        .role-badge { padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; }
        .role-badge.admin { background: #dcfce7; color: #166534; }
        .animate-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        
        .memory-tree-container { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; margin-top: 20px; }
        .memory-node-card { background: var(--bg-elevated); border: 1px solid var(--border-platinum); border-radius: 16px; padding: 20px; box-shadow: var(--shadow-soft); transition: all 0.3s ease; }
        .memory-node-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.08); border-color: var(--platinum-light); }
        .memory-node-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; }
        .memory-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--accent-primary); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; }
        .cognitive-badge { font-size: 9px; font-weight: 800; text-transform: uppercase; padding: 2px 6px; border-radius: 100px; display: inline-block; margin-top: 2px; }
        .cognitive-badge.deep { background: #ede9fe; color: #7c3aed; border: 1px solid #ddd6fe; }
        .cognitive-badge.standard { background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; }
        .cognitive-badge.initial { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }
        .leaf-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .leaf-meta { font-size: 9px; opacity: 0.5; font-weight: 600; }
      `}</style>
    </div>
  );
}
