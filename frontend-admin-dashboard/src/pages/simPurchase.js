import React, { useState, useEffect } from 'react';
import adminApi from '../services/adminApi';
import './simPurchase.css';

const SimPurchase = ({ adminData }) => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [rfidCode, setRfidCode] = useState('');
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSIMPurchases();
  }, []);

  const loadSIMPurchases = async () => {
    try {
      setLoading(true);
      const result = await adminApi.getPendingSIMPurchases();
      
      if (result.success) {
        setPurchases(result.data);
      }
    } catch (error) {
      console.error('Load SIM purchases error:', error);
      setError('Gagal memuat data pembelian SIM');
    } finally {
      setLoading(false);
    }
  };

  const handleActivateClick = (purchase) => {
    setSelectedPurchase(purchase);
    setShowModal(true);
    setRfidCode('');
    setError('');
  };

  const handleCloseModal = () => {
    if (!activating) {
      setShowModal(false);
      setSelectedPurchase(null);
      setRfidCode('');
      setError('');
    }
  };

  const handleActivateSIM = async (e) => {
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

      const result = await adminApi.activateSimPurchase(
        selectedPurchase.Transaction_ID,
        rfidCode.trim(),
        adminData.Admin_ID
      );

      if (result.success) {
        alert(`Aktivasi SIM Berhasil!\n\nNomor: ${result.data.phoneNumber}\nRFID: ${result.data.rfidCode}`);
        
        setShowModal(false);
        setSelectedPurchase(null);
        setRfidCode('');
        
        loadSIMPurchases();
      } else {
        setError(result.error || 'Aktivasi gagal');
      }
    } catch (err) {
      setError(err.error || 'Terjadi kesalahan saat aktivasi');
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <div className="sim-purchase">
        <h1>Integrasi Kartu SIM dengan RFID</h1>
        <div className="loading">
          <div className="spinner"></div>
          <p>Memuat data pembelian...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sim-purchase">
      <div className="page-header">
        <h1>Integrasi Kartu SIM dengan RFID</h1>
        <button onClick={loadSIMPurchases} className="btn-refresh">
          Refresh
        </button>
      </div>

      <div className="info-banner">
        <p>
          📋 Daftar kartu SIM yang sudah dibayar dan siap diintegrasikan dengan kartu RFID.
          Tap kartu RFID ke reader atau masukkan nomor RFID manual untuk melanjutkan.
        </p>
      </div>

      {error && (
        <div className="error-message">{error}</div>
      )}

      {purchases.length === 0 ? (
        <div className="empty-state">
          <h2>Tidak Ada Data</h2>
          <p>Semua pembelian SIM sudah diintegrasikan dengan RFID</p>
        </div>
      ) : (
        <div className="purchases-table">
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Nomor SIM</th>
                <th>Provider</th>
                <th>Jumlah</th>
                <th>Metode Bayar</th>
                <th>Status Pembayaran</th>
                <th>Tanggal</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((purchase) => (
                <tr key={purchase.Transaction_ID}>
                  <td className="order-id">{purchase.Transaction_Code}</td>
                  <td className="phone-number">{purchase.Phone_Number || '-'}</td>
                  <td>
                    <span className="provider-badge">
                      {purchase.Provider?.toUpperCase() || 'N/A'}
                    </span>
                  </td>
                  <td className="amount">
                    Rp {purchase.Total_Amount?.toLocaleString('id-ID')}
                  </td>
                  <td>
                    <span className="payment-badge">
                      {purchase.Payment_Method === 'qris' ? 'QRIS' : 'Kasir (Cash)'}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge status-${purchase.Payment_Status}`}>
                      {purchase.Payment_Status === 'success' ? '✅ Sudah Dibayar' : 'Pending'}
                    </span>
                  </td>
                  <td className="date-small">
                    {new Date(purchase.Created_At).toLocaleDateString('id-ID')}
                  </td>
                  <td>
                    <button 
                      className="btn-activate-sim"
                      onClick={() => handleActivateClick(purchase)}
                    >
                      Aktivasi RFID
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && selectedPurchase && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Aktivasi Kartu SIM + RFID</h2>
              <button 
                className="btn-close" 
                onClick={handleCloseModal}
                disabled={activating}
              >
                ✕
              </button>
            </div>

            <div className="purchase-summary">
              <div className="summary-row">
                <span className="summary-label">Nomor SIM:</span>
                <span className="summary-value">{selectedPurchase.Phone_Number}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Provider:</span>
                <span className="summary-value">{selectedPurchase.Provider?.toUpperCase()}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Harga:</span>
                <span className="summary-value">
                  Rp {selectedPurchase.Total_Amount?.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Metode Pembayaran:</span>
                <span className="summary-value">
                  {selectedPurchase.Payment_Method === 'qris' ? 'QRIS' : 'Tunai di Kasir'}
                </span>
              </div>
            </div>

            <form onSubmit={handleActivateSIM} className="activation-form">
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
                  onClick={handleCloseModal}
                  disabled={activating}
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimPurchase;