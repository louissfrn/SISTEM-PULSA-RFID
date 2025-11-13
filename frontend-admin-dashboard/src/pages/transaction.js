import React, { useState, useEffect } from 'react';
import adminApi from '../services/adminApi';
import './transaction.css';

const Transaction = ({ adminData }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter states
  const [filters, setFilters] = useState({
    paymentStatus: '', // pending, success, failed
    startDate: '',
    endDate: '',
    page: 1,
    limit: 10
  });

  // Stats
  const [stats, setStats] = useState({
    totalTransactions: 0,
    pendingTransactions: 0,
    successTransactions: 0,
    failedTransactions: 0,
    totalAmount: 0,
    successAmount: 0
  });

  // Modal states
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalError, setApprovalError] = useState('');

  // Pagination
  const [pagination, setPagination] = useState({
    total: 0,
    pages: 1,
    currentPage: 1
  });

  useEffect(() => {
    loadTransactions();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadTransactions();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.paymentStatus, filters.startDate, filters.endDate, filters.page]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError('');

      const result = await adminApi.getTransactions({
        paymentStatus: filters.paymentStatus || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        page: filters.page,
        limit: filters.limit
      });

      if (result.success) {
        setTransactions(result.data);
        setPagination({
          total: result.pagination.total,
          pages: result.pagination.pages,
          currentPage: result.pagination.page
        });
      } else {
        setError(result.error || 'Gagal memuat transaksi');
      }
    } catch (err) {
      setError(err.error || 'Terjadi kesalahan saat memuat transaksi');
      console.error('Load transactions error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const result = await adminApi.getTransactionStats({
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined
      });

      if (result.success) {
        setStats(result.data);
      }
    } catch (err) {
      console.error('Load stats error:', err);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
      page: 1 // Reset ke halaman 1 saat filter berubah
    }));
  };

  const handleApproveClick = (transaction) => {
    setSelectedTransaction(transaction);
    setShowApprovalModal(true);
    setApprovalError('');
  };

  const handleCloseApprovalModal = () => {
    if (!approvalLoading) {
      setShowApprovalModal(false);
      setSelectedTransaction(null);
      setApprovalError('');
    }
  };

  const handleApprovePayment = async () => {
    if (!selectedTransaction) return;

    try {
      setApprovalLoading(true);
      setApprovalError('');

      const result = await adminApi.approveCashPayment(
        selectedTransaction.Transaction_ID,
        adminData.adminId
      );

      if (result.success) {
        alert(
          `Pembayaran Berhasil Dikonfirmasi!\n\n` +
          `Customer: ${result.data.customerName}\n` +
          `${result.data.rfidCode ? 'RFID: ' + result.data.rfidCode : 'Nomor: ' + (result.data.targetPhone || '-')}\n` +
          `Jumlah: Rp ${result.data.amount?.toLocaleString('id-ID')}`
        );

        setShowApprovalModal(false);
        setSelectedTransaction(null);
        loadTransactions();
        loadStats();
      } else {
        setApprovalError(result.error || 'Gagal mengonfirmasi pembayaran');
      }
    } catch (err) {
      setApprovalError(err.error || 'Terjadi kesalahan');
      console.error('Approve payment error:', err);
    } finally {
      setApprovalLoading(false);
    }
  };

  const handleRejectPayment = async () => {
    if (!selectedTransaction) return;

    if (!window.confirm('Yakin ingin menolak transaksi ini?')) {
      return;
    }

    try {
      setApprovalLoading(true);
      setApprovalError('');

      const result = await adminApi.rejectCashPayment(
        selectedTransaction.Transaction_ID,
        adminData.adminId
      );

      if (result.success) {
        alert('Transaksi berhasil ditolak');

        setShowApprovalModal(false);
        setSelectedTransaction(null);
        loadTransactions();
        loadStats();
      } else {
        setApprovalError(result.error || 'Gagal menolak transaksi');
      }
    } catch (err) {
      setApprovalError(err.error || 'Terjadi kesalahan');
      console.error('Reject payment error:', err);
    } finally {
      setApprovalLoading(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'pending': return 'pending';
      case 'success': return 'success';
      case 'failed': return 'failed';
      default: return 'default';
    }
  };

  const getPaymentMethodLabel = (method) => {
    switch (method) {
      case 'qris': return 'QRIS';
      case 'saldo_rfid': return 'Saldo RFID';
      case 'kasir':
      case 'cash':
        return 'Kasir (Cash)';
      default: return method;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="transaction-container">
        <h1>Data Transaksi</h1>
        <div className="loading">
          <div className="spinner"></div>
          <p>Memuat data transaksi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="transaction-container">
      <div className="page-header">
        <h1>Data Transaksi</h1>
        <button onClick={loadTransactions} className="btn-refresh">
          Refresh
        </button>
      </div>

      {/* STATISTICS SECTION */}
      <div className="stats-grid">
        <div className="stat-card total">
          <div className="stat-value">{stats.totalTransactions}</div>
          <div className="stat-label">Total Transaksi</div>
        </div>
        <div className="stat-card pending">
          <div className="stat-value">{stats.pendingTransactions}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card success">
          <div className="stat-value">{stats.successTransactions}</div>
          <div className="stat-label">Berhasil</div>
        </div>
        <div className="stat-card failed">
          <div className="stat-value">{stats.failedTransactions}</div>
          <div className="stat-label">Gagal</div>
        </div>
        <div className="stat-card amount">
          <div className="stat-value">{formatCurrency(stats.successAmount)}</div>
          <div className="stat-label">Total Berhasil</div>
        </div>
      </div>

      {/* FILTER SECTION */}
      <div className="filter-section">
        <div className="filter-group">
          <label>Status Pembayaran</label>
          <select
            value={filters.paymentStatus}
            onChange={(e) => handleFilterChange('paymentStatus', e.target.value)}
          >
            <option value="">Semua Status</option>
            <option value="pending">Pending</option>
            <option value="success">Berhasil</option>
            <option value="failed">Gagal</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Tanggal Mulai</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label>Tanggal Akhir</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* TRANSACTIONS TABLE */}
      <div className="table-wrapper">
        <table className="transactions-table">
          <thead>
            <tr>
              <th>ID Transaksi</th>
              <th>Nama Customer</th>
              <th>No. HP</th>
              <th>Jenis</th>
              <th>Jumlah</th>
              <th>Metode Bayar</th>
              <th>Status</th>
              <th>Tanggal</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan="9" className="empty-cell">
                  Tidak ada transaksi
                </td>
              </tr>
            ) : (
              transactions.map((transaction) => {
                console.log('Transaction row:', {
                  id: transaction.Transaction_ID,
                  code: transaction.Transaction_Code,
                  customer: transaction.Customer_Name,
                  targetPhone: transaction.Target_Phones,
                  jenis: transaction.Jenis,
                  paymentMethod: transaction.Payment_Method,
                  paymentStatus: transaction.Payment_Status,
                  showApproveBtn: (transaction.Payment_Method === 'kasir' || transaction.Payment_Method === 'cash') && transaction.Payment_Status === 'pending'
                });

                return (
                  <tr key={transaction.Transaction_ID}>
                    <td className="transaction-code">
                      {transaction.Transaction_Code || '-'}
                    </td>
                    <td>{transaction.Customer_Name || '-'}</td>
                    <td>{transaction.Target_Phones || '-'}</td>
                    <td>
                      {transaction.Jenis || transaction.Transaction_Type || '-'}
                    </td>
                    <td className="amount">
                      {formatCurrency(transaction.Total_Amount || 0)}
                    </td>
                    <td>
                      {getPaymentMethodLabel(transaction.Payment_Method || '-')}
                    </td>
                    <td>
                      <span className={`status-badge ${getStatusBadgeClass(transaction.Payment_Status)}`}>
                        {transaction.Payment_Status ? transaction.Payment_Status.charAt(0).toUpperCase() + transaction.Payment_Status.slice(1) : '-'}
                      </span>
                    </td>
                    <td className="date-small">
                      {transaction.Created_at ? formatDate(transaction.Created_at) : '-'}
                    </td>
                    <td className="action-cell">
                      {(transaction.Payment_Method === 'kasir' || transaction.Payment_Method === 'cash') && transaction.Payment_Status === 'pending' ? (
                        <button
                          className="btn-action btn-approve"
                          onClick={() => handleApproveClick(transaction)}
                          title="Konfirmasi pembayaran cash"
                        >
                          Konfirmasi
                        </button>
                      ) : (
                        <span className="action-disabled">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      {pagination.pages > 1 && (
        <div className="pagination">
          <button
            onClick={() => handleFilterChange('page', filters.page - 1)}
            disabled={filters.page === 1}
            className="btn-pagination"
          >
            Sebelumnya
          </button>

          <span className="pagination-info">
            Halaman {pagination.currentPage} dari {pagination.pages}
          </span>

          <button
            onClick={() => handleFilterChange('page', filters.page + 1)}
            disabled={filters.page === pagination.pages}
            className="btn-pagination"
          >
            Selanjutnya
          </button>
        </div>
      )}

      {/* APPROVAL MODAL */}
      {showApprovalModal && selectedTransaction && (
        <div className="modal-overlay" onClick={handleCloseApprovalModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Konfirmasi Pembayaran</h2>
              <button
                className="btn-close"
                onClick={handleCloseApprovalModal}
                disabled={approvalLoading}
              >
                ✕
              </button>
            </div>

            <div className="approval-details">
              <div className="detail-row">
                <span className="detail-label">ID Transaksi:</span>
                <span className="detail-value">{selectedTransaction.Transaction_Code || '-'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Customer:</span>
                <span className="detail-value">{selectedTransaction.Customer_Name || '-'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">RFID Code:</span>
                <span className="detail-value">{selectedTransaction.RFID_Code || '-'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Jenis Transaksi:</span>
                <span className="detail-value">
                  {selectedTransaction.Jenis || selectedTransaction.Transaction_Type || '-'}
                </span>
              </div>
              {/* ✅ TAMPILKAN Target Nomor HANYA untuk ISI PULSA & BELI SIM */}
              {(selectedTransaction.Jenis === 'Isi Pulsa' || selectedTransaction.Jenis === 'Beli SIM') && (
                <div className="detail-row">
                  <span className="detail-label">Target Nomor:</span>
                  <span className="detail-value">{selectedTransaction.Target_Phones || '-'}</span>
                </div>
              )}
              <div className="detail-row highlight">
                <span className="detail-label">Jumlah:</span>
                <span className="detail-value">
                  {formatCurrency(selectedTransaction.Total_Amount || 0)}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Metode Pembayaran:</span>
                <span className="detail-value">
                  {getPaymentMethodLabel(selectedTransaction.Payment_Method || '-')}
                </span>
              </div>
            </div>

            {approvalError && (
              <div className="error-message">
                {approvalError}
              </div>
            )}

            <p className="confirmation-text">
              Apakah Anda yakin customer sudah melakukan pembayaran?
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-confirm"
                onClick={handleApprovePayment}
                disabled={approvalLoading}
              >
                {approvalLoading ? 'Memproses...' : 'Ya, Konfirmasi'}
              </button>
              <button
                type="button"
                className="btn-reject"
                onClick={handleRejectPayment}
                disabled={approvalLoading}
              >
                {approvalLoading ? 'Memproses...' : 'Tolak Transaksi'}
              </button>
              <button
                type="button"
                className="btn-cancel"
                onClick={handleCloseApprovalModal}
                disabled={approvalLoading}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transaction;