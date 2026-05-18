import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import {
  Users, Package, AlertTriangle, TrendingUp, ShieldCheck, ShieldX,
  LogOut, Clock, CheckCircle2, XCircle, Globe, Link2, Building2,
  UserCircle, RefreshCw, Ban, Trash2, Flag
} from 'lucide-react';
import './AdminPortal.css';

const API = 'http://localhost:5000';
const weeklyData = [
  { name: 'Mon', donations: 40, requests: 24 },
  { name: 'Tue', donations: 30, requests: 13 },
  { name: 'Wed', donations: 20, requests: 38 },
  { name: 'Thu', donations: 27, requests: 39 },
  { name: 'Fri', donations: 18, requests: 48 },
  { name: 'Sat', donations: 23, requests: 38 },
  { name: 'Sun', donations: 34, requests: 43 },
];

const AdminPortal = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [activeTab, setActiveTab] = useState('dashboard');
  const [pendingNGOs, setPendingNGOs] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [allDonations, setAllDonations] = useState([]);
  const [allReports, setAllReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const h = { headers: { 'x-auth-token': token } };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [pend, users, dons, reps] = await Promise.all([
        axios.get(`${API}/api/users/pending`, h),
        axios.get(`${API}/api/users/all`, h),
        axios.get(`${API}/api/donations/all`, h),
        axios.get(`${API}/api/reports`, h),
      ]);
      setPendingNGOs(pend.data);
      setAllUsers(users.data);
      setAllDonations(dons.data);
      setAllReports(reps.data);
    } catch { showToast('Failed to load data.', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleApprove = async (id, name) => {
    try {
      await axios.put(`${API}/api/users/${id}/verify`, {}, h);
      showToast(`✅ ${name} verified!`);
      fetchAll();
    } catch { showToast('Failed to verify.', 'error'); }
  };

  const handleBlock = async (id, isBlocked) => {
    try {
      await axios.put(`${API}/api/users/${id}/${isBlocked ? 'unblock' : 'block'}`, {}, h);
      showToast(isBlocked ? '✅ User unblocked' : '🚫 User blocked');
      fetchAll();
    } catch { showToast('Action failed.', 'error'); }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Delete this user? This cannot be undone.')) return;
    try {
      await axios.delete(`${API}/api/users/${id}`, h);
      showToast('🗑️ User deleted');
      fetchAll();
    } catch { showToast('Delete failed.', 'error'); }
  };

  const handleExpireDonation = async (id) => {
    try {
      await axios.put(`${API}/api/donations/${id}/expire`, {}, h);
      showToast('⏰ Donation expired');
      fetchAll();
    } catch { showToast('Failed.', 'error'); }
  };

  const handleDeleteDonation = async (id) => {
    if (!window.confirm('Delete this donation?')) return;
    try {
      await axios.delete(`${API}/api/donations/${id}`, h);
      showToast('🗑️ Donation deleted');
      fetchAll();
    } catch { showToast('Delete failed.', 'error'); }
  };

  const handleReviewReport = async (id, status) => {
    try {
      await axios.put(`${API}/api/reports/${id}/review`, { status }, h);
      showToast('Report updated');
      fetchAll();
    } catch { showToast('Failed.', 'error'); }
  };

  const roleColor = r => ({ donor: '#3b82f6', receiver: '#10b981', admin: '#f59e0b' }[r] || '#64748b');

  const TABS = [
    { id: 'dashboard', label: 'Dashboard', Icon: TrendingUp },
    { id: 'users', label: 'All Users', Icon: Users, count: allUsers.length },
    { id: 'pending', label: 'Pending NGOs', Icon: Clock, count: pendingNGOs.length },
    { id: 'donations', label: 'Donations', Icon: Package, count: allDonations.length },
    { id: 'reports', label: 'Reports', Icon: Flag, count: allReports.filter(r => r.status === 'pending').length },
  ];

  return (
    <div className="admin-layout">
      {toast && <div className={`admin-toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>{toast.msg}</div>}

      <aside className="admin-sidebar">
        <div className="admin-logo">
          <img src="/logo.png" alt="SpareShare" onError={e => e.target.style.display='none'} />
          <span>Admin Panel</span>
        </div>
        <nav className="admin-nav">
          {TABS.map(({ id, label, Icon, count }) => (
            <button key={id} className={`admin-nav-item ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>
              <Icon size={18} /> {label}
              {count > 0 && <span className="nav-badge">{count}</span>}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-user-info">
            <UserCircle size={36} color="#10b981" />
            <div>
              <p className="admin-user-name">{user?.name || 'Admin'}</p>
              <p className="admin-user-role">Super Admin</p>
            </div>
          </div>
          <button className="admin-logout-btn" onClick={() => { logout(); navigate('/'); }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      <main className="admin-main">

        {/* ── DASHBOARD ── */}
        {activeTab === 'dashboard' && (
          <div className="admin-content animate-fade-in">
            <div className="admin-page-header">
              <h1>Admin Dashboard</h1>
              <p>Monitor platform health and donation activity.</p>
            </div>
            <div className="admin-stats-grid">
              {[
                { label: 'Total Users', value: allUsers.length, color: 'stat-blue', Icon: Users },
                { label: 'Verified NGOs', value: allUsers.filter(u => u.role === 'receiver' && u.isVerified).length, color: 'stat-green', Icon: ShieldCheck },
                { label: 'Pending NGOs', value: pendingNGOs.length, color: 'stat-yellow', Icon: Clock },
                { label: 'Active Reports', value: allReports.filter(r => r.status === 'pending').length, color: 'stat-red', Icon: AlertTriangle },
              ].map(({ label, value, color, Icon }) => (
                <div key={label} className={`admin-stat-card ${color}`}>
                  <div className="stat-icon-wrap"><Icon size={24} /></div>
                  <div><h2>{value}</h2><p>{label}</p></div>
                </div>
              ))}
            </div>
            <div className="admin-charts-grid">
              <div className="admin-chart-card">
                <h3>Weekly Activity</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 10 }} />
                    <Bar dataKey="donations" fill="#3b82f6" radius={[6,6,0,0]} name="Donations" />
                    <Bar dataKey="requests" fill="#10b981" radius={[6,6,0,0]} name="Requests" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="admin-chart-card">
                <h3>Request Trend</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 10 }} />
                    <Area type="monotone" dataKey="requests" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            {pendingNGOs.length > 0 && (
              <div className="admin-alert-banner" onClick={() => setActiveTab('pending')}>
                <Clock size={20} />
                <span><strong>{pendingNGOs.length} NGO(s)</strong> awaiting verification.</span>
                <span className="alert-arrow">→</span>
              </div>
            )}
          </div>
        )}

        {/* ── ALL USERS ── */}
        {activeTab === 'users' && (
          <div className="admin-content animate-fade-in">
            <div className="admin-page-header">
              <div><h1>All Users</h1><p>Manage all registered users — block, unblock or delete.</p></div>
              <button className="admin-refresh-btn" onClick={fetchAll} disabled={loading}><RefreshCw size={16} /> Refresh</button>
            </div>
            <div className="admin-verified-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
                <tbody>
                  {allUsers.map(u => (
                    <tr key={u._id} style={{ opacity: u.isBlocked ? 0.6 : 1 }}>
                      <td><div className="table-org-name"><UserCircle size={18} /><strong>{u.name}</strong></div></td>
                      <td style={{ fontSize: '0.82rem', color: '#94a3b8' }}>{u.email}</td>
                      <td><span className="org-type-pill" style={{ background: `${roleColor(u.role)}22`, color: roleColor(u.role) }}>{u.role}</span></td>
                      <td>
                        {u.isBlocked
                          ? <span className="pending-badge" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>🚫 Blocked</span>
                          : u.isVerified
                          ? <span className="verified-badge"><ShieldCheck size={12} /> Verified</span>
                          : <span className="pending-badge"><Clock size={12} /> Pending</span>}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: '#64748b' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          {u.role !== 'admin' && (
                            <button className={u.isBlocked ? 'btn-approve' : 'btn-reject'} style={{ padding: '5px 10px', fontSize: '0.75rem' }} onClick={() => handleBlock(u._id, u.isBlocked)}>
                              {u.isBlocked ? '✅ Unblock' : <><Ban size={13} /> Block</>}
                            </button>
                          )}
                          {!u.isVerified && u.role === 'receiver' && (
                            <button className="btn-approve" style={{ padding: '5px 10px', fontSize: '0.75rem' }} onClick={() => handleApprove(u._id, u.name)}>
                              <ShieldCheck size={13} /> Verify
                            </button>
                          )}
                          {u.role !== 'admin' && (
                            <button className="btn-reject" style={{ padding: '5px 10px', fontSize: '0.75rem' }} onClick={() => handleDeleteUser(u._id)}>
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── PENDING NGOs ── */}
        {activeTab === 'pending' && (
          <div className="admin-content animate-fade-in">
            <div className="admin-page-header">
              <div><h1>Pending Verifications</h1><p>Approve or reject newly registered NGOs.</p></div>
              <button className="admin-refresh-btn" onClick={fetchAll}><RefreshCw size={16} /> Refresh</button>
            </div>
            {pendingNGOs.length === 0 ? (
              <div className="admin-empty-state"><CheckCircle2 size={64} color="#10b981" /><h2>All Clear!</h2><p>No pending NGOs.</p></div>
            ) : (
              <div className="admin-cards-grid">
                {pendingNGOs.map(org => (
                  <div key={org._id} className="admin-org-card">
                    <div className="admin-org-card-header">
                      <div className="admin-org-icon"><Building2 size={20} /></div>
                      <div><h3>{org.name}</h3><span className="org-type-pill">{org.orgType || 'Organization'}</span></div>
                      <span className="pending-badge"><Clock size={12} /> Pending</span>
                    </div>
                    <div className="admin-org-details">
                      {[['Email', org.email], ['Phone', org.phone || 'N/A'], ['Tax ID', org.taxId || 'N/A'], ['Registered', new Date(org.createdAt).toLocaleDateString()]].map(([l, v]) => (
                        <div key={l} className="org-detail-row"><span className="detail-label">{l}</span><span>{v}</span></div>
                      ))}
                    </div>
                    <div className="admin-org-actions">
                      <button className="btn-approve" onClick={() => handleApprove(org._id, org.name)}><ShieldCheck size={16} /> Approve</button>
                      <button className="btn-reject" onClick={() => handleBlock(org._id, false)}><XCircle size={16} /> Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── DONATIONS ── */}
        {activeTab === 'donations' && (
          <div className="admin-content animate-fade-in">
            <div className="admin-page-header">
              <div><h1>All Donations</h1><p>Manage all platform donations — expire or delete.</p></div>
              <button className="admin-refresh-btn" onClick={fetchAll}><RefreshCw size={16} /> Refresh</button>
            </div>
            <div className="admin-verified-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Title</th><th>Category</th><th>Donor</th><th>Status</th><th>Expiry</th><th>Reports</th><th>Actions</th></tr></thead>
                <tbody>
                  {allDonations.map(d => (
                    <tr key={d._id} style={{ opacity: d.isExpired ? 0.5 : 1 }}>
                      <td><strong style={{ fontSize: '0.88rem' }}>{d.title}</strong></td>
                      <td><span className="org-type-pill">{d.category}</span></td>
                      <td style={{ fontSize: '0.82rem', color: '#94a3b8' }}>{d.donorId?.name || '—'}</td>
                      <td>
                        <span className={`pending-badge ${d.status === 'active' ? '' : ''}`} style={{
                          background: d.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                          color: d.status === 'active' ? '#10b981' : '#f87171'
                        }}>{d.status}</span>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: '#64748b' }}>{new Date(d.expiryTime).toLocaleDateString()}</td>
                      <td style={{ color: d.reportCount > 0 ? '#f59e0b' : '#64748b', fontWeight: 700 }}>{d.reportCount || 0}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          {d.status === 'active' && (
                            <button className="btn-reject" style={{ padding: '5px 10px', fontSize: '0.75rem' }} onClick={() => handleExpireDonation(d._id)}>
                              <Clock size={13} /> Expire
                            </button>
                          )}
                          <button className="btn-reject" style={{ padding: '5px 10px', fontSize: '0.75rem' }} onClick={() => handleDeleteDonation(d._id)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── REPORTS ── */}
        {activeTab === 'reports' && (
          <div className="admin-content animate-fade-in">
            <div className="admin-page-header">
              <div><h1>Reports</h1><p>Review and action user-submitted reports.</p></div>
              <button className="admin-refresh-btn" onClick={fetchAll}><RefreshCw size={16} /> Refresh</button>
            </div>
            {allReports.length === 0 ? (
              <div className="admin-empty-state"><Flag size={64} color="#94a3b8" /><h2>No Reports</h2><p>No reports have been filed yet.</p></div>
            ) : (
              <div className="admin-cards-grid">
                {allReports.map(rep => (
                  <div key={rep._id} className="admin-org-card">
                    <div className="admin-org-card-header">
                      <div className="admin-org-icon" style={{ background: 'rgba(239,68,68,0.1)' }}><Flag size={20} color="#f87171" /></div>
                      <div>
                        <h3 style={{ fontSize: '0.95rem' }}>{rep.reason}</h3>
                        <span className="org-type-pill">Donation: {rep.donationId?.title || '—'}</span>
                      </div>
                      <span className="pending-badge" style={{ background: rep.status === 'pending' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)', color: rep.status === 'pending' ? '#fbbf24' : '#10b981' }}>
                        {rep.status}
                      </span>
                    </div>
                    <div className="admin-org-details">
                      <div className="org-detail-row"><span className="detail-label">Reporter</span><span>{rep.reporterId?.name || '—'}</span></div>
                      <div className="org-detail-row"><span className="detail-label">Details</span><span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>{rep.details || 'No details'}</span></div>
                      <div className="org-detail-row"><span className="detail-label">Filed</span><span>{new Date(rep.createdAt).toLocaleDateString()}</span></div>
                    </div>
                    {rep.status === 'pending' && (
                      <div className="admin-org-actions">
                        <button className="btn-approve" onClick={() => handleReviewReport(rep._id, 'actioned')}><CheckCircle2 size={16} /> Take Action</button>
                        <button className="btn-reject" onClick={() => handleReviewReport(rep._id, 'dismissed')}><XCircle size={16} /> Dismiss</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
};

export default AdminPortal;
