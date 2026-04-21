import React, { useState, useEffect } from 'react';
import { useAuth } from '../providers/AuthProvider.jsx';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function AdminLayout() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [dbData, setDbData] = useState([]);
  const [dbTable, setDbTable] = useState('profiles');
  const [loading, setLoading] = useState(true);
  const { getAuthHeaders } = useAuth();

  useEffect(() => {
    fetchData();
  }, [activeTab, dbTable]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();

      if (activeTab === 'dashboard') {
        const res = await fetch(`${API_BASE}/admin/analytics`, { headers });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } else if (activeTab === 'users') {
        const res = await fetch(`${API_BASE}/admin/users`, { headers });
        if (res.ok) {
          const data = await res.json();
          setUsers(data.users || []);
        }
      } else if (activeTab === 'database') {
        const res = await fetch(`${API_BASE}/admin/db?table=${dbTable}`, { headers });
        if (res.ok) {
          const result = await res.json();
          setDbData(result.data || []);
        } else {
          setDbData([]);
        }
      }
    } catch (err) {
      console.error('Admin API error:', err);
    } finally {
      setLoading(false);
    }
  };

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
                <td>
                  <select
                    className="admin-select"
                    value={u.plan}
                    onChange={(e) => handleUpdatePlan(u.id, e.target.value)}
                  >
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="premium">Premium</option>
                  </select>
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
          <button className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>👥 Usuários</button>
          <button className={`admin-tab ${activeTab === 'database' ? 'active' : ''}`} onClick={() => setActiveTab('database')}>🗄️ Banco de Dados</button>
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
          </>
        )}
      </div>

      <style>{`
        .admin-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 20px 24px; border-bottom: 1px solid var(--border);
          background: rgba(0,0,0,0.2);
        }
        .admin-badge {
          background: rgba(255, 0, 0, 0.15); color: #ff4d4d;
          padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; border: 1px solid rgba(255,0,0,0.3);
        }
        .admin-tabs { display: flex; gap: 8px; background: rgba(0,0,0,0.2); padding: 4px; border-radius: 8px; }
        .admin-tab {
          background: transparent; color: var(--text-secondary); border: none;
          padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 500;
          transition: all 0.2s;
        }
        .admin-tab.active { background: var(--bg-card); color: white; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
        .admin-tab:hover:not(.active) { color: white; background: rgba(255,255,255,0.02); }
        
        .admin-dashboard-grid { display: flex; flex-direction: column; gap: 24px; }
        .admin-stats-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
        .admin-stat-card {
          display: flex; align-items: center; gap: 16px; padding: 20px;
          background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border);
        }
        .stat-icon { font-size: 32px; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 12px; }
        .stat-label { font-size: 13px; color: var(--text-secondary); margin-bottom: 4px; }
        .stat-value { font-size: 24px; font-weight: bold; color: white; }
        
        .admin-dashboard-row { display: flex; gap: 24px; }
        .flex-1 { flex: 1; }
        .admin-panel-section { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 24px; }
        .admin-panel-section h3 { margin-bottom: 16px; font-size: 18px; display: flex; align-items: center; gap: 8px; }
        
        .admin-activity-list { display: flex; flex-direction: column; gap: 12px; }
        .activity-item { display: flex; align-items: center; gap: 12px; padding: 12px; background: rgba(0,0,0,0.2); border-radius: 8px; }
        .activity-icon { font-size: 20px; }
        .activity-info { display: flex; flex-direction: column; }
        .activity-info span { font-size: 12px; color: var(--text-secondary); }
        
        .admin-system-status { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 12px; }
        .admin-system-status li { display: flex; align-items: center; gap: 12px; font-size: 14px; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px;}
        .status-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
        .status-dot.green { background: #10b981; box-shadow: 0 0 8px #10b981; }
        .status-dot.yellow { background: #f59e0b; box-shadow: 0 0 8px #f59e0b; }
        
        .glow-card { position: relative; overflow: hidden; }
        .glow-card::before {
          content: ''; position: absolute; top: 0; left: -100%; width: 50%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent);
          transform: skewX(-20deg); animation: shine 6s infinite;
        }
        @keyframes shine { 0% { left: -100%; } 20% { left: 200%; } 100% { left: 200%; } }
        
        .admin-table-container { overflow-x: auto; }
        .admin-table { width: 100%; border-collapse: collapse; text-align: left; }
        .admin-table th { padding: 12px; border-bottom: 1px solid var(--border); color: var(--text-secondary); font-weight: 500; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;}
        .admin-table td { padding: 16px 12px; border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 14px; }
        .db-table td { font-family: monospace; font-size: 13px; color: #a5b4fc; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;}
        
        .admin-select { background: rgba(0,0,0,0.3); border: 1px solid var(--border); color: white; padding: 6px 12px; border-radius: 6px; outline: none; }
        .admin-select:focus { border-color: var(--accent); }
        
        .role-badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
        .role-badge.admin { background: rgba(139, 92, 246, 0.2); color: #c4b5fd; border: 1px solid rgba(139, 92, 246, 0.5); }
        .role-badge.user { background: rgba(255, 255, 255, 0.1); color: #ccc; }
        
        .plan-badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
        .plan-badge.free { background: rgba(156, 163, 175, 0.2); color: #d1d5db; border: 1px solid rgba(156, 163, 175, 0.5); }
        .plan-badge.pro { background: rgba(59, 130, 246, 0.2); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.5); }
        .plan-badge.premium { background: rgba(245, 158, 11, 0.2); color: #fcd34d; border: 1px solid rgba(245, 158, 11, 0.5); }
        
        .animate-in { animation: fadeIn 0.4s ease forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
