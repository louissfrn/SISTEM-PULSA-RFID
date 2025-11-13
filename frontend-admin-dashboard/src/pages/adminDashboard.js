import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import adminApi from '../services/adminApi';
import PendingCustomers from './pendingCustomers';
import Transaction from '../pages/transaction';
import ReportAdmin from './reportAdmin';
import SimManagement from './simManagement';
import CreateAdminModal from './CreateAdminModal';
import './adminDashboard.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [adminData, setAdminData] = useState(null);
  const [stats, setStats] = useState(null);
  const [adminsList, setAdminsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isCreateAdminModalOpen, setIsCreateAdminModalOpen] = useState(false);

  useEffect(() => {
    const storedAdmin = localStorage.getItem('adminData');
    if (!storedAdmin) {
      navigate('/');
      return;
    }

    setAdminData(JSON.parse(storedAdmin));
    loadStats();
  }, [navigate]);

  const loadStats = async () => {
  try {
    setLoading(true);
    const result = await adminApi.getDashboardStats();
    
    if (result.success) {
      // Ambil total pending count
      const countResult = await adminApi.getPendingCount();
      if (countResult.success) {
        setStats({
          ...result.data,
          pendingCustomers: countResult.data.totalCount  // ✅ Ubah ke total
        });
      } else {
        setStats(result.data);
      }
    }
  } catch (error) {
    console.error('Load stats error:', error);
  } finally {
    setLoading(false);
  }
};

  const fetchAdminsList = async () => {
  try {
    const response = await adminApi.getAdminList();  // ← Pakai adminApi!
    
    if (response.success) {
      setAdminsList(response.data);
    }
  } catch (error) {
    console.error('Error fetching admins list:', error);
  }
};
  const handleAdminTabClick = () => {
    setActiveTab('admin-management');
    fetchAdminsList();
  };

  const handleLogout = () => {
    localStorage.removeItem('adminData');
    navigate('/');
  };

  if (!adminData) {
    return null;
  }

  return (
    <div className="admin-dashboard">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>UD. Lijaya</h2>
          <p>{adminData.fullName}</p>
          <span className="user-role">{adminData.role}</span>
        </div>

        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>

          <button 
            className={`nav-item ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            Aktivasi RFID Customer
            {stats && stats.pendingCustomers > 0 && (
              <span className="badge">{stats.pendingCustomers}</span>
            )}
          </button>

          <button 
            className={`nav-item ${activeTab === 'sim-management' ? 'active' : ''}`}
            onClick={() => setActiveTab('sim-management')}
          >
            Input Kartu SIM
          </button>

          <button 
            className={`nav-item ${activeTab === 'transactions' ? 'active' : ''}`}
            onClick={() => setActiveTab('transactions')}
          >
            Transaksi
          </button>

          <button 
            className={`nav-item ${activeTab === 'laporan' ? 'active' : ''}`}
            onClick={() => setActiveTab('laporan')}
          >
            Laporan
          </button>

          {adminData.role === 'administrator' && (
            <button 
              className={`nav-item ${activeTab === 'admin-management' ? 'active' : ''}`}
              onClick={handleAdminTabClick}
            >
              Manajemen Admin
            </button>
          )}
        </nav>

        <button className="btn-logout" onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div className="main-content">
        {activeTab === 'dashboard' && (
          <div className="dashboard-content">
            <h1>Dashboard Kasir</h1>
            
            {loading ? (
              <div className="loading">
                <div className="spinner"></div>
                <p>Memuat data...</p>
              </div>
            ) : stats ? (
              <>
                <div className="stats-grid">
                  <div className="stat-card pending">
                    <div className="stat-info">
                      <h3>{stats.pendingCustomers}</h3>
                      <p>Customer Pending</p>
                    </div>
                  </div>

                  <div className="stat-card active">
                    <div className="stat-info">
                      <h3>{stats.activeCustomers}</h3>
                      <p>Customer Active</p>
                    </div>
                  </div>

                  <div className="stat-card cards">
                    <div className="stat-info">
                      <h3>{stats.totalRfidCards}</h3>
                      <p>Total Kartu RFID</p>
                    </div>
                  </div>

                  <div className="stat-card balance">
                    <div className="stat-info">
                      <h3>Rp {Math.round(stats.totalBalance || 0).toLocaleString('id-ID')}</h3>
                      <p>Total Saldo</p>
                    </div>
                  </div>
                </div>

                {stats.recentActivations && stats.recentActivations.length > 0 && (
                  <div className="recent-activations">
                    <h2>Aktivasi Terbaru</h2>
                    <div className="activations-list">
                      {stats.recentActivations.map((activation, index) => (
                        <div key={index} className="activation-item">
                          <div className="activation-info">
                            <h4>{activation.Name}</h4>
                            <p>{activation.Phone_Number}</p>
                          </div>
                          <div className="activation-detail">
                            <span className="rfid-code">{activation.RFID_Code}</span>
                            <span className="activation-date">
                              {new Date(activation.Activated_At).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            <span className="activated-by">oleh {activation.Activated_By}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p>Gagal memuat statistik</p>
            )}
          </div>
        )}

        {activeTab === 'pending' && (
          <PendingCustomers 
            adminData={adminData} 
            onActivationSuccess={loadStats}
          />
        )}

        {activeTab === 'sim-management' && adminData && (
          <SimManagement adminData={adminData} />
        )}

        {activeTab === 'transactions' && adminData && (
          <Transaction adminData={adminData} />
        )}

        {activeTab === 'laporan' && adminData && (
          <ReportAdmin adminData={adminData} />
        )}

        {activeTab === 'admin-management' && adminData && adminData.role === 'administrator' && (
          <div className="admin-management-content">
            <div className="admin-management-header">
              <h1>Manajemen Admin</h1>
              <button 
                className="btn btn-primary btn-add-admin"
                onClick={() => setIsCreateAdminModalOpen(true)}
              >
                + Tambah Admin Baru
              </button>
            </div>

            {adminsList.length === 0 ? (
              <div className="empty-state">
                <p>Tidak ada data admin</p>
              </div>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Username</th>
                      <th>Nama Lengkap</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Last Login</th>
                      <th>Dibuat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminsList.map((admin, index) => (
                      <tr key={admin.Admin_ID}>
                        <td>{index + 1}</td>
                        <td>
                          <span className="username-badge">@{admin.Username}</span>
                        </td>
                        <td>{admin.Full_Name || '-'}</td>
                        <td>
                          <span className={`role-badge role-${admin.Role}`}>
                            {admin.Role === 'administrator' ? 'Administrator' : 'Kasir'}
                          </span>
                        </td>
                        <td>
                          <span className={`status-badge status-${admin.Status}`}>
                            {admin.Status === 'active' ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td>
                          <span className="last-login">
                            {admin.Last_Login 
                              ? new Date(admin.Last_Login).toLocaleString('id-ID', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : 'Belum login'
                            }
                          </span>
                        </td>
                        <td>
                          <span className="created-date">
                            {new Date(admin.Created_at).toLocaleString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <CreateAdminModal
        isOpen={isCreateAdminModalOpen}
        onClose={() => setIsCreateAdminModalOpen(false)}
        onAdminCreated={() => {
          fetchAdminsList();
          setIsCreateAdminModalOpen(false);
        }}
      />
    </div>
  );
};

export default AdminDashboard;