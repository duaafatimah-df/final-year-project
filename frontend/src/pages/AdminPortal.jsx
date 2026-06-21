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
  UserCircle, RefreshCw, Ban, Trash2, Flag, FileText
} from 'lucide-react';
import './AdminPortal.css';

const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : (import.meta.env.VITE_API_URL || 'https://spareshare-ai.up.railway.app');
const defaultWeeklyData = [
  { name: 'Mon', registrations: 0, donations: 0, approvals: 0, requests: 0, receiverActivity: 0, claims: 0 },
  { name: 'Tue', registrations: 0, donations: 0, approvals: 0, requests: 0, receiverActivity: 0, claims: 0 },
  { name: 'Wed', registrations: 0, donations: 0, approvals: 0, requests: 0, receiverActivity: 0, claims: 0 },
  { name: 'Thu', registrations: 0, donations: 0, approvals: 0, requests: 0, receiverActivity: 0, claims: 0 },
  { name: 'Fri', registrations: 0, donations: 0, approvals: 0, requests: 0, receiverActivity: 0, claims: 0 },
  { name: 'Sat', registrations: 0, donations: 0, approvals: 0, requests: 0, receiverActivity: 0, claims: 0 },
  { name: 'Sun', registrations: 0, donations: 0, approvals: 0, requests: 0, receiverActivity: 0, claims: 0 },
];

const AdminPortal = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [activeTab, setActiveTab] = useState('dashboard');
  const [pendingNGOs, setPendingNGOs] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [allDonations, setAllDonations] = useState([]);
  const [allDemands, setAllDemands] = useState([]);
  const [allReports, setAllReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const [stats, setStats] = useState({ totalUsers: 0, verifiedNGOs: 0, pendingNGOs: 0, activeReports: 0 });
  const [weeklyData, setWeeklyData] = useState(defaultWeeklyData);
  const [userFilter, setUserFilter] = useState('all');
  const [donationFilter, setDonationFilter] = useState('active');
  const [demandFilter, setDemandFilter] = useState('all');
  const [expandedUserId, setExpandedUserId] = useState(null);

  const getH = () => ({ headers: { 'x-auth-token': localStorage.getItem('token') } });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAll = async () => {
    setLoading(true);
    const config = getH();
    let successCount = 0;
    let failCount = 0;

    try {
      const res = await axios.get(`${API}/api/users/pending`, config);
      setPendingNGOs(res.data);
      successCount++;
    } catch (err) {
      console.error("Pending NGOs fetch failed:", err.message);
      failCount++;
    }

    try {
      const res = await axios.get(`${API}/api/users/all`, config);
      setAllUsers(res.data);
      successCount++;
    } catch (err) {
      console.error("All Users fetch failed:", err.message);
      failCount++;
    }

    try {
      const res = await axios.get(`${API}/api/donations/all`, config);
      setAllDonations(res.data);
      successCount++;
    } catch (err) {
      console.error("Donations fetch failed:", err.message);
      failCount++;
    }

    try {
      const res = await axios.get(`${API}/api/posts/all`, config);
      setAllDemands(res.data);
      successCount++;
    } catch (err) {
      console.error("Demands fetch failed:", err.message);
      failCount++;
    }

    try {
      const res = await axios.get(`${API}/api/reports`, config);
      setAllReports(res.data);
      successCount++;
    } catch (err) {
      console.error("Reports fetch failed:", err.message);
      failCount++;
    }

    try {
      const res = await axios.get(`${API}/api/users/admin-stats`, config);
      setStats(res.data.stats);
      setWeeklyData(res.data.weeklyData || defaultWeeklyData);
      successCount++;
    } catch (err) {
      console.error("Admin Stats fetch failed:", err.message);
      failCount++;
    }

    setLoading(false);
    if (failCount === 0) {
      showToast('✅ All data refreshed successfully!');
    } else if (successCount > 0) {
      showToast(`⚠️ Refreshed ${successCount} feeds, ${failCount} failed.`, 'warning');
    } else {
      showToast('❌ All refresh requests failed.', 'error');
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleApprove = async (id, name) => {
    try {
      await axios.put(`${API}/api/users/${id}/verify`, {}, getH());
      showToast(`✅ ${name} verified & approved!`);
      fetchAll();
    } catch { showToast('Failed to verify.', 'error'); }
  };

  const handleReject = async (id, name) => {
    if (!window.confirm(`Are you sure you want to reject ${name}'s registration request?`)) return;
    try {
      await axios.put(`${API}/api/users/${id}/reject`, {}, getH());
      showToast(`❌ ${name}'s request rejected.`);
      fetchAll();
    } catch { showToast('Failed to reject receiver.', 'error'); }
  };


  const handleBlock = async (id, isBlocked) => {
    try {
      await axios.put(`${API}/api/users/${id}/${isBlocked ? 'unblock' : 'block'}`, {}, getH());
      showToast(isBlocked ? '✅ User unblocked' : '🚫 User blocked');
      fetchAll();
    } catch { showToast('Action failed.', 'error'); }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Delete this user? This cannot be undone.')) return;
    try {
      await axios.delete(`${API}/api/users/${id}`, getH());
      showToast('🗑️ User deleted');
      fetchAll();
    } catch { showToast('Delete failed.', 'error'); }
  };

  const handleExpireDonation = async (id) => {
    try {
      await axios.put(`${API}/api/donations/${id}/expire`, {}, getH());
      showToast('⏰ Donation expired');
      fetchAll();
    } catch { showToast('Failed.', 'error'); }
  };

  const handleDeleteDonation = async (id) => {
    if (!window.confirm('Delete this donation?')) return;
    try {
      await axios.delete(`${API}/api/donations/${id}`, getH());
      showToast('🗑️ Donation deleted');
      fetchAll();
    } catch { showToast('Delete failed.', 'error'); }
  };

  const handleDeleteDemand = async (id) => {
    if (!window.confirm('Delete this demand post?')) return;
    try {
      await axios.delete(`${API}/api/posts/${id}`, getH());
      showToast('🗑️ Demand post deleted');
      fetchAll();
    } catch { showToast('Delete failed.', 'error'); }
  };

  const handleToggleDemandStatus = async (post) => {
    const newStatus = post.status === 'Fulfilled' ? 'Active' : 'Fulfilled';
    try {
      await axios.put(`${API}/api/posts/${post._id}/status`, { status: newStatus }, getH());
      showToast(`✅ Status updated to ${newStatus}`);
      fetchAll();
    } catch { showToast('Failed to update status.', 'error'); }
  };

  const handleReviewReport = async (id, status) => {
    try {
      await axios.put(`${API}/api/reports/${id}/review`, { status }, getH());
      showToast('Report updated');
      fetchAll();
    } catch { showToast('Failed.', 'error'); }
  };

  const roleColor = r => ({ donor: '#3b82f6', receiver: '#10b981', admin: '#f59e0b' }[r] || '#64748b');

  const TABS = [
    { id: 'dashboard', label: 'Dashboard', Icon: TrendingUp },
    { id: 'users', label: 'All Users', Icon: Users, count: stats.totalUsers },
    { id: 'pending', label: 'Pending NGOs', Icon: Clock, count: stats.pendingNGOs },
    { id: 'donations', label: 'Donations', Icon: Package, count: allDonations.length },
    { id: 'demands', label: 'Receiver Demands', Icon: FileText, count: allDemands.length },
    { id: 'reports', label: 'Reports', Icon: Flag, count: stats.activeReports },
  ];

  const filteredUsers = allUsers.filter(u => {
    if (userFilter === 'all') return true;
    if (userFilter === 'donor') return u.role === 'donor';
    if (userFilter === 'receiver') return u.role === 'receiver';
    if (userFilter === 'approved_ngo') return u.role === 'receiver' && u.isVerified && u.approvalStatus === 'approved';
    if (userFilter === 'pending_ngo') return u.role === 'receiver' && u.approvalStatus === 'pending';
    if (userFilter === 'rejected_ngo') return u.role === 'receiver' && u.approvalStatus === 'rejected';
    return true;
  });

  const filteredDonations = allDonations.filter(d => {
    const isExpired = d.isExpired || d.status === 'expired' || (d.expiryTime && new Date(d.expiryTime) < new Date());
    if (donationFilter === 'active') return d.status === 'active' && !isExpired && (d.reportCount || 0) === 0;
    if (donationFilter === 'completed') return d.status === 'completed';
    if (donationFilter === 'claimed') return d.status === 'pending_receiver' || d.claimedBy || d.receiverId;
    if (donationFilter === 'expired') return isExpired;
    if (donationFilter === 'flagged') return d.reportCount > 0 || d.status === 'needs_review';
    return true;
  });

  const filteredDemands = allDemands.filter(p => {
    if (demandFilter === 'active') return p.status?.toLowerCase() === 'active';
    if (demandFilter === 'fulfilled') return p.status?.toLowerCase() === 'fulfilled';
    return true;
  });

  return (
    <div className="admin-layout">
      {toast && <div className={`admin-toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>{toast.msg}</div>}

      <aside className="admin-sidebar">
        <div className="admin-logo">
          <img src="/logo.png" alt="SpareShare" onError={e => e.target.style.display = 'none'} />
          <span>Admin Panel</span>
        </div>
        <nav className="admin-nav">
          {TABS.map(({ id, label, Icon, count }) => (
            <button key={id} className={`admin-nav-item ${activeTab === id ? 'active' : ''}`} onClick={() => { setActiveTab(id); fetchAll(); }}>
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
              <div>
                <h1>Admin Dashboard</h1>
                <p>Monitor platform health and donation activity.</p>
              </div>
            </div>
            <div className="admin-stats-grid">
              {[
                { label: 'Total Users', value: stats.totalUsers, color: 'stat-blue', Icon: Users },
                { label: 'Verified NGOs', value: stats.verifiedNGOs, color: 'stat-green', Icon: ShieldCheck },
                { label: 'Pending NGOs', value: stats.pendingNGOs, color: 'stat-yellow', Icon: Clock },
                { label: 'Active Reports', value: stats.activeReports, color: 'stat-red', Icon: AlertTriangle },
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
                    <Bar dataKey="registrations" fill="#f59e0b" radius={[6, 6, 0, 0]} name="Registrations" />
                    <Bar dataKey="donations" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Donations" />
                    <Bar dataKey="approvals" fill="#10b981" radius={[6, 6, 0, 0]} name="NGO Approvals" />
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
                    <Area type="monotone" dataKey="requests" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={2.5} name="Requests" />
                    <Area type="monotone" dataKey="receiverActivity" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} strokeWidth={2.5} name="Receiver Activity" />
                    <Area type="monotone" dataKey="claims" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={2.5} name="Claims" />
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
              <div><h1>All Users</h1><p>Manage all registered users block, unblock or delete.</p></div>
              <button className="admin-refresh-btn" onClick={fetchAll} disabled={loading}><RefreshCw size={16} /> Refresh</button>
            </div>
            
            <div className="admin-filter-bar">
              {[
                { id: 'all', label: 'All Users' },
                { id: 'donor', label: 'Donors' },
                { id: 'receiver', label: 'Receivers' },
                { id: 'approved_ngo', label: 'Approved NGOs' },
                { id: 'pending_ngo', label: 'Pending NGOs' },
                { id: 'rejected_ngo', label: 'Rejected NGOs' }
              ].map(f => (
                <button
                  key={f.id}
                  className={`admin-filter-btn ${userFilter === f.id ? 'active' : ''}`}
                  onClick={() => setUserFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="admin-verified-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Email Status</th><th>Approval Status</th><th>Joined</th><th>Actions</th></tr></thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <>
                      <tr key={u._id} onClick={() => setExpandedUserId(expandedUserId === u._id ? null : u._id)} style={{ cursor: 'pointer', opacity: u.isBlocked ? 0.6 : 1 }}>
                        <td><div className="table-org-name"><UserCircle size={18} /><strong>{u.name}</strong></div></td>
                        <td style={{ fontSize: '0.82rem', color: '#94a3b8' }}>{u.email}</td>
                        <td><span className="org-type-pill" style={{ background: `${roleColor(u.role)}22`, color: roleColor(u.role) }}>{u.role}</span></td>
                        <td>
                          {u.isEmailVerified
                            ? <span className="verified-badge"><ShieldCheck size={12} /> Verified</span>
                            : <span className="pending-badge" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', borderColor: 'rgba(239,68,68,0.2)' }}><XCircle size={12} /> Unverified</span>}
                        </td>
                        <td>
                          {u.isBlocked
                            ? <span className="pending-badge" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', borderColor: 'rgba(239,68,68,0.2)' }}>🚫 Blocked</span>
                            : u.role === 'receiver'
                              ? (
                                  u.approvalStatus === 'approved'
                                    ? <span className="verified-badge"><ShieldCheck size={12} /> Approved</span>
                                    : u.approvalStatus === 'rejected'
                                      ? <span className="pending-badge" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', borderColor: 'rgba(239,68,68,0.2)' }}><XCircle size={12} /> Rejected</span>
                                      : <span className="pending-badge"><Clock size={12} /> Pending</span>
                                )
                              : <span style={{ color: '#64748b' }}>N/A</span>}
                        </td>
                        <td style={{ fontSize: '0.78rem', color: '#64748b' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem' }} onClick={e => e.stopPropagation()}>
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
                      {expandedUserId === u._id && (
                        <tr key={`${u._id}-expanded`}>
                          <td colSpan="7" style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', fontSize: '0.85rem' }}>
                              <div>
                                <p style={{ margin: '4px 0' }}><strong style={{ color: '#94a3b8' }}>User ID:</strong> {u._id}</p>
                                <p style={{ margin: '4px 0' }}><strong style={{ color: '#94a3b8' }}>Name:</strong> {u.name}</p>
                                <p style={{ margin: '4px 0' }}><strong style={{ color: '#94a3b8' }}>Email:</strong> {u.email}</p>
                                <p style={{ margin: '4px 0' }}><strong style={{ color: '#94a3b8' }}>Phone:</strong> {u.phone || 'N/A'}</p>
                              </div>
                              <div>
                                <p style={{ margin: '4px 0' }}><strong style={{ color: '#94a3b8' }}>Role:</strong> {u.role}</p>
                                {u.role === 'receiver' && (
                                  <>
                                    <p style={{ margin: '4px 0' }}><strong style={{ color: '#94a3b8' }}>Org Type:</strong> {u.orgType || 'N/A'}</p>
                                    <p style={{ margin: '4px 0' }}><strong style={{ color: '#94a3b8' }}>Tax ID:</strong> {u.taxId || 'N/A'}</p>
                                  </>
                                )}
                                <p style={{ margin: '4px 0' }}><strong style={{ color: '#94a3b8' }}>Flag Count:</strong> {u.flagCount || 0}</p>
                                <p style={{ margin: '4px 0' }}><strong style={{ color: '#94a3b8' }}>Joined:</strong> {new Date(u.createdAt).toLocaleString()}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
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
                      <button className="btn-reject" onClick={() => handleReject(org._id, org.name)}><XCircle size={16} /> Reject</button>
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
              <div><h1>All Donations</h1><p>Manage all platform donations expire or delete.</p></div>
              <button className="admin-refresh-btn" onClick={fetchAll}><RefreshCw size={16} /> Refresh</button>
            </div>

            <div className="admin-filter-bar">
              {[
                { id: 'active', label: 'Active Donations' },
                { id: 'claimed', label: 'Claimed Donations' },
                { id: 'completed', label: 'Completed Donations' },
                { id: 'expired', label: 'Expired Donations' },
                { id: 'flagged', label: 'Flagged Donations' }
              ].map(t => (
                <button
                  key={t.id}
                  className={`admin-filter-btn ${donationFilter === t.id ? 'active' : ''}`}
                  onClick={() => setDonationFilter(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="admin-verified-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Donation Title</th><th>Donor Name</th><th>Category</th><th>Quantity</th><th>Status</th><th>Expiry Information</th><th>Donation Date</th><th>Reports</th><th>Actions</th></tr></thead>
                <tbody>
                  {filteredDonations.map(d => {
                    const isExpired = d.isExpired || d.status === 'expired' || (d.expiryTime && new Date(d.expiryTime) < new Date());
                    return (
                      <tr key={d._id} style={{ opacity: isExpired ? 0.5 : 1 }}>
                        <td><strong style={{ fontSize: '0.88rem' }}>{d.title}</strong></td>
                        <td style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                          <div>{d.donorId?.name || 'N/A'}</div>
                          {d.donorId?.email && <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{d.donorId.email}</div>}
                        </td>
                        <td><span className="org-type-pill">{d.category}</span></td>
                        <td style={{ fontSize: '0.82rem' }}>{d.quantity || 'N/A'}</td>
                        <td>
                          <span className="pending-badge" style={{
                            background: d.status === 'active' && !isExpired ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                            color: d.status === 'active' && !isExpired ? '#10b981' : '#f87171',
                            borderColor: d.status === 'active' && !isExpired ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'
                          }}>{isExpired ? 'expired' : d.status}</span>
                        </td>
                        <td style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          {d.expiryTime ? new Date(d.expiryTime).toLocaleString() : 'N/A'}
                        </td>
                        <td style={{ fontSize: '0.78rem', color: '#64748b' }}>{new Date(d.createdAt).toLocaleDateString()}</td>
                        <td style={{ color: d.reportCount > 0 ? '#f59e0b' : '#64748b', fontWeight: 700 }}>{d.reportCount || 0}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            {d.status === 'active' && !isExpired && (
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── DEMANDS ── */}
        {activeTab === 'demands' && (
          <div className="admin-content animate-fade-in">
            <div className="admin-page-header">
              <div><h1>Receiver Demands</h1><p>Manage all demand posts submitted by NGOs and receivers.</p></div>
              <button className="admin-refresh-btn" onClick={fetchAll}><RefreshCw size={16} /> Refresh</button>
            </div>

            <div className="admin-filter-bar">
              {[
                { id: 'all', label: 'All Demands' },
                { id: 'active', label: 'Active Demands' },
                { id: 'fulfilled', label: 'Fulfilled Demands' }
              ].map(t => (
                <button
                  key={t.id}
                  className={`admin-filter-btn ${demandFilter === t.id ? 'active' : ''}`}
                  onClick={() => setDemandFilter(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="admin-verified-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Demand Title</th><th>Receiver Name</th><th>Category</th><th>Urgency</th><th>Status</th><th>Posted Date</th><th>Actions</th></tr></thead>
                <tbody>
                  {filteredDemands.map(p => {
                    return (
                      <tr key={p._id}>
                        <td><strong style={{ fontSize: '0.88rem' }}>{p.title}</strong></td>
                        <td style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                          <div>{p.receiverId?.name || 'N/A'}</div>
                          {p.receiverId?.email && <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{p.receiverId.email}</div>}
                        </td>
                        <td><span className="org-type-pill">{p.category || 'General'}</span></td>
                        <td>
                          <span style={{ 
                            color: p.urgency === 'High' ? '#ef4444' : p.urgency === 'Medium' ? '#f59e0b' : '#10b981',
                            fontWeight: 600,
                            fontSize: '0.82rem'
                          }}>{p.urgency}</span>
                        </td>
                        <td>
                          <span className="pending-badge" style={{
                            background: p.status?.toLowerCase() === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)',
                            color: p.status?.toLowerCase() === 'active' ? '#10b981' : '#3b82f6',
                            borderColor: p.status?.toLowerCase() === 'active' ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.2)'
                          }}>{p.status}</span>
                        </td>
                        <td style={{ fontSize: '0.78rem', color: '#64748b' }}>{new Date(p.createdAt).toLocaleDateString()}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button 
                              className="btn-approve" 
                              style={{ padding: '5px 10px', fontSize: '0.72rem' }} 
                              onClick={() => handleToggleDemandStatus(p)}
                            >
                              {p.status === 'Fulfilled' ? 'Mark Active' : 'Mark Completed'}
                            </button>
                            <button 
                              className="btn-reject" 
                              style={{ padding: '5px 10px', fontSize: '0.72rem' }} 
                              onClick={() => handleDeleteDemand(p._id)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
                        <span className="org-type-pill">Donation: {rep.donationId?.title || 'N/A'}</span>
                      </div>
                      <span className="pending-badge" style={{ 
                        background: rep.status === 'pending' ? 'rgba(245,158,11,0.1)' : rep.status === 'reviewed' ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)', 
                        color: rep.status === 'pending' ? '#fbbf24' : rep.status === 'reviewed' ? '#60a5fa' : '#10b981' 
                      }}>
                        {rep.status}
                      </span>
                    </div>
                    <div className="admin-org-details">
                      <div className="org-detail-row"><span className="detail-label">Reporter</span><span>{rep.reporterId?.name || 'N/A'} ({rep.reporterId?.email || 'N/A'})</span></div>
                      <div className="org-detail-row">
                        <span className="detail-label">Related User/Donation</span>
                        <span>
                          {rep.donationId 
                            ? `Donation: ${rep.donationId.title} (Donor: ${rep.donationId.donorId?.name || 'N/A'})` 
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="org-detail-row"><span className="detail-label">Details</span><span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>{rep.details || 'No details'}</span></div>
                      <div className="org-detail-row"><span className="detail-label">Filed</span><span>{new Date(rep.createdAt).toLocaleString()}</span></div>
                    </div>
                    {rep.status === 'pending' && (
                      <div className="admin-org-actions">
                        <button className="btn-approve" style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)' }} onClick={() => handleReviewReport(rep._id, 'reviewed')}><Clock size={16} /> Review</button>
                        <button className="btn-approve" onClick={() => handleReviewReport(rep._id, 'actioned')}><CheckCircle2 size={16} /> Resolve</button>
                        <button className="btn-reject" onClick={() => handleReviewReport(rep._id, 'dismissed')}><XCircle size={16} /> Dismiss</button>
                      </div>
                    )}
                    {rep.status === 'reviewed' && (
                      <div className="admin-org-actions">
                        <button className="btn-approve" onClick={() => handleReviewReport(rep._id, 'actioned')}><CheckCircle2 size={16} /> Resolve</button>
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
