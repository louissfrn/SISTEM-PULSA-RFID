import React, { useState, useEffect } from 'react';
import adminApi from '../services/adminApi';
import './pendingCustomers.css';

const PendingCustomers = ({ adminData, onActivationSuccess }) => {
  const [allCustomers, setAllCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('customer'); // 'customer' atau 'sim'
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [rfidCode, setRfidCode] = useState('');
  const [activating, setActivating] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPendingCustomers();
  }, []);

 const loadPendingCustomers = async () => {
  try {
    setLoading(true);
    console.log('Loading pending customers...');
    
    // Ambil pending customers
    const customerResult = await adminApi.getPendingCustomers();
    console.log('Customer result:', customerResult);
    
    // Ambil pending SIM purchases
    const simResult = await adminApi.getPendingSIMPurchases();
    console.log('SIM result:', simResult);

    let allData = [];
    
    if (customerResult.success && customerResult.data) {
      console.log('Added customer data:', customerResult.data.length);
      allData = [...customerResult.data];
    }
    
    if (simResult.success && simResult.data) {
      console.log('Added SIM data:', simResult.data.length);
      allData = [...allData, ...simResult.data];
    }
    
    console.log('Total data:', allData.length, allData);
    setAllCustomers(allData);
  } catch (error) {
    console.error('Load pending customers error:', error);
  } finally {
    setLoading(false);
  }
};

  // ==========================================
  // FILTER DATA BERDASARKAN TAB
  // ==========================================
  const filteredCustomers = allCustomers.filter(c => c.Type === activeTab);

  // Count untuk badge
  const customerCount = allCustomers.filter(c => c.Type === 'customer').length;
  const simCount = allCustomers.filter(c => c.Type === 'sim').length;

  // ==========================================
  // ACTIVATE RFID
  // ==========================================
  const handleActivateClick = (customer) => {
    setSelectedCustomer(customer);
    setShowActivateModal(true);
    setRfidCode('');
    setError('');
  };

  const handleCloseActivateModal = () => {
    if (!activating) {
      setShowActivateModal(false);
      setSelectedCustomer(null);
      setRfidCode('');
      setError('');
    }
  };

  const handleActivate = async (e) => {
    e.preventDefault();

    if (!rfidCode.trim()) {
      setError('Nomor RFID wajib diisi');
      return;
    }

    if (rfidCode.length < 5) {
      setError('Nomor RFID minimal 5 karakter');
      return;
    }

    try {
      setActivating(true);
      setError('');

      // Jika tipe CUSTOMER
      if (selectedCustomer.Type === 'customer') {
        const result = await adminApi.activateRFID(
          selectedCustomer.Customer_ID,
          rfidCode.trim(),
          adminData.adminId
        );

        if (result.success) {
          alert(`Aktivasi Berhasil!\n\nCustomer: ${result.data.customerName}\nRFID: ${result.data.rfidCode}\n\nCustomer sekarang dapat menggunakan kartu RFID!`);

          setShowActivateModal(false);
          setSelectedCustomer(null);
          setRfidCode('');

          loadPendingCustomers();

          if (onActivationSuccess) {
            onActivationSuccess();
          }
        } else {
          setError(result.error || 'Aktivasi gagal');
        }
      }
      // Jika tipe SIM
      else if (selectedCustomer.Type === 'sim') {
        const transactionId = selectedCustomer.Transaction_ID;

        const result = await adminApi.activateSimPurchase(
          transactionId,
          rfidCode.trim(),
          adminData.adminId
        );

        if (result.success) {

          console.log('Result data:', result.data);
          console.log('RFID Code:', result.data.rfidCode);
          alert(`Aktivasi SIM Berhasil!\n\nNomor: ${result.data.phoneNumber}\nRFID: ${result.data.rfidCode}`);

          setShowActivateModal(false);
          setSelectedCustomer(null);
          setRfidCode('');

          loadPendingCustomers();

          if (onActivationSuccess) {
            onActivationSuccess();
          }
        } else {
          setError(result.error || 'Aktivasi gagal');
        }
      }
    } catch (err) {
      setError(err.error || 'Terjadi kesalahan saat aktivasi');
    } finally {
      setActivating(false);
    }
  };

  // ==========================================
  // REJECT RFID (hanya untuk customer)
  // ==========================================
  const handleRejectClick = (customer) => {
    if (customer.Type !== 'customer') {
      alert('SIM purchase tidak bisa ditolak. Silakan hubungi admin.');
      return;
    }

    setSelectedCustomer(customer);
    setShowRejectModal(true);
    setError('');
  };

  const handleCloseRejectModal = () => {
    if (!rejecting) {
      setShowRejectModal(false);
      setSelectedCustomer(null);
      setError('');
    }
  };

  const handleReject = async () => {
    if (!window.confirm(`Yakin ingin menolak aktivasi RFID untuk ${selectedCustomer.Name}?`)) {
      return;
    }

    try {
      setRejecting(true);
      setError('');

      const response = await fetch('http://localhost:8000/api/admin/reject-rfid-activation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          customerId: selectedCustomer.Customer_ID,
          adminId: adminData.adminId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        alert(`Aktivasi Ditolak!\n\nCustomer: ${result.data.customerName}\n\nCustomer dapat mendaftar ulang nanti.`);

        setShowRejectModal(false);
        setSelectedCustomer(null);

        loadPendingCustomers();

        if (onActivationSuccess) {
          onActivationSuccess();
        }
      } else {
        setError(result.error || 'Penolakan gagal');
      }
    } catch (err) {
      console.error('Reject error:', err);
      setError(err.message || 'Terjadi kesalahan saat menolak');
    } finally {
      setRejecting(false);
    }
  };

  if (loading) {
    return (
      <div className="pending-customers">
        <h1>Aktivasi RFID Customer</h1>
        <div className="loading">
          <div className="spinner"></div>
          <p>Memuat data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pending-customers">
      <div className="page-header">
        <h1>Aktivasi RFID Customer</h1>
        <button onClick={loadPendingCustomers} className="btn-refresh">
          Refresh
        </button>
      </div>

      {/* ==========================================
          FILTER TABS
          ========================================== */}
      <div className="filter-tabs">
        <button
          className={`tab ${activeTab === 'customer' ? 'active' : ''}`}
          onClick={() => setActiveTab('customer')}
        >
          Aktivasi Pendaftaran RFID
          {customerCount > 0 && <span className="tab-badge">{customerCount}</span>}
        </button>
        <button
          className={`tab ${activeTab === 'sim' ? 'active' : ''}`}
          onClick={() => setActiveTab('sim')}
        >
          Intergasi SIM dengan RFID
          {simCount > 0 && <span className="tab-badge">{simCount}</span>}
        </button>
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="empty-state">
          <h2>Tidak Ada Data</h2>
          <p>
            {activeTab === 'customer'
              ? 'Semua customer sudah diaktivasi'
              : 'Semua SIM sudah diaktivasi'}
          </p>
        </div>
      ) : (
        <div className="customers-grid">
          {filteredCustomers.map((customer) => (
            <div key={customer.Customer_ID} className="customer-card">
              <div className="customer-header">
                <div className="customer-avatar">
                  {activeTab === 'sim' ? '' : customer.Name.charAt(0).toUpperCase()}
                </div>
                <div className="customer-info">
                  <h3>{customer.Name}</h3>
                  <p className="phone">{customer.Phone_Number}</p>
                  {customer.Email && (
                    <p className="email">{customer.Email}</p>
                  )}
                </div>
              </div>

              <div className="customer-meta">
                <div className="meta-item">
                  <span className="meta-label">Tanggal:</span>
                  <span className="meta-value">
                    {new Date(customer.Registration_Date).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Tipe:</span>
                  <span className="status-badge pending">
                    {activeTab === 'sim' ? 'Pembelian SIM' : 'Pendaftaran RFID'}
                  </span>
                </div>
              </div>

              <div className="action-buttons">
                <button
                  className="btn-activate"
                  onClick={() => handleActivateClick(customer)}
                >
                  {activeTab === 'sim' ? 'Integrasi SIM dengan RFID' : 'Aktivasi RFID'}
                </button>
                {activeTab === 'customer' && (
                  <button
                    className="btn-reject"
                    onClick={() => handleRejectClick(customer)}
                  >
                    Tolak
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ==========================================
          MODAL AKTIVASI RFID
          ========================================== */}
      {showActivateModal && selectedCustomer && (
        <div className="modal-overlay" onClick={handleCloseActivateModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Scan Kartu RFID</h2>
              <button
                className="btn-close"
                onClick={handleCloseActivateModal}
                disabled={activating}
              >
                ✕
              </button>
            </div>

            <div className="customer-summary">
              <div className="summary-row">
                <span className="summary-label">
                  {selectedCustomer.Type === 'sim' ? 'Nomor SIM:' : 'Nama:'}
                </span>
                <span className="summary-value">{selectedCustomer.Name}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">No. HP:</span>
                <span className="summary-value">{selectedCustomer.Phone_Number}</span>
              </div>
            </div>

            <form onSubmit={handleActivate} className="activation-form">
              <div className="form-group">
                <label>Nomor Kartu RFID</label>
                <input
                  type="text"
                  value={rfidCode}
                  onChange={(e) => {
                    setRfidCode(e.target.value);
                    setError('');
                  }}
                  placeholder="Tap kartu RFID atau masukkan nomor"
                  disabled={activating}
                  autoFocus
                />
                <p className="form-hint">
                  Tap kartu RFID ke reader atau masukkan nomor manual
                </p>
              </div>

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="submit"
                  className="btn-confirm"
                  disabled={activating || !rfidCode.trim()}
                >
                  {activating ? 'Memproses...' : 'Aktivasi Sekarang'}
                </button>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={handleCloseActivateModal}
                  disabled={activating}
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL TOLAK AKTIVASI (hanya untuk customer)
          ========================================== */}
      {showRejectModal && selectedCustomer && selectedCustomer.Type === 'customer' && (
        <div className="modal-overlay" onClick={handleCloseRejectModal}>
          <div className="modal-content modal-reject" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Tolak Aktivasi RFID</h2>
              <button
                className="btn-close"
                onClick={handleCloseRejectModal}
                disabled={rejecting}
              >
                ✕
              </button>
            </div>

            <div className="reject-content">
              <p className="reject-message">
                Anda yakin ingin menolak aktivasi RFID untuk:
              </p>

              <div className="customer-summary">
                <div className="summary-row">
                  <span className="summary-label">Nama:</span>
                  <span className="summary-value">{selectedCustomer.Name}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">No. HP:</span>
                  <span className="summary-value">{selectedCustomer.Phone_Number}</span>
                </div>
              </div>

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-confirm btn-reject-confirm"
                  onClick={handleReject}
                  disabled={rejecting}
                >
                  {rejecting ? 'Memproses...' : 'Ya, Tolak'}
                </button>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={handleCloseRejectModal}
                  disabled={rejecting}
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingCustomers;
