import React, { useState } from 'react';
import PaymentModal from './PaymentModal';
import api from '../services/api';
import './BuySIMCard.css';

const BuySIMCard = ({ onBack }) => {
  const [step, setStep] = useState('scan'); // scan | details | payment | success | error
  const [barcodeInput, setBarcodeInput] = useState('');
  const [simData, setSimData] = useState(null);
  
  // ✅ TAMBAH: Customer info form
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  
  const [integrateRfid, setIntegrateRfid] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('qris');
  const [loading, setLoading] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // =======================================
  // STEP 1: SCAN BARCODE
  // =======================================
  const handleScanBarcode = async () => {
    if (!barcodeInput.trim()) {
      setErrorMessage('Silakan scan atau masukkan barcode kartu SIM');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');

      const response = await api.scanSIMBarcode(barcodeInput.trim());

      if (response.success) {
        setSimData(response.data);
        setStep('details');
        setBarcodeInput('');
        // ✅ Reset form ketika scan barcode baru
        setCustomerName('');
        setCustomerEmail('');
      } else {
        setErrorMessage(response.error || 'Kartu SIM tidak ditemukan');
      }
    } catch (error) {
      setErrorMessage(error.response?.data?.error || 'Gagal memindai barcode');
    } finally {
      setLoading(false);
    }
  };

  // =======================================
  // STEP 2: CONFIRM DETAILS & PAYMENT METHOD
  // =======================================
  const handleProceedToPayment = async () => {
    if (!simData) return;

    // ✅ Validasi customer info
    if (!customerName.trim()) {
      setErrorMessage('Nama lengkap wajib diisi');
      return;
    }

    if (!customerEmail.trim()) {
      setErrorMessage('Email wajib diisi');
      return;
    }

    // Validasi email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail.trim())) {
      setErrorMessage('Format email tidak valid');
      return;
    }

    if (!integrateRfid) {
      setErrorMessage('Anda harus mengintegrasikan dengan kartu RFID');
      return;
    }

    if (!paymentMethod) {
      setErrorMessage('Pilih metode pembayaran');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');

      if (paymentMethod === 'qris') {
        // Create QRIS payment
        const response = await api.purchaseSIMQris({
          simId: simData.simId,
          phoneNumber: simData.phoneNumber,
          provider: simData.provider,
          integrateWithRfid: true,
          amount: simData.sellingPrice,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim()
        });

        if (response.success) {
          setPaymentData({
            type: 'sim',
            amount: simData.sellingPrice,
            phoneNumber: simData.phoneNumber,
             transaction_id: response.transaction_id,
            payment_token: response.payment_token,
            order_id: response.order_id,
            purchase_id: response.purchase_id
          });
          setShowPayment(true);
        }
      } else if (paymentMethod === 'cash') {
        // Create cash payment (pending di kasir)
        const response = await api.purchaseSIMCash({
          simId: simData.simId,
          phoneNumber: simData.phoneNumber,
          provider: simData.provider,
          integrateWithRfid: true,
          amount: simData.sellingPrice,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim()
        });

        if (response.success) {
          setSuccessMessage(
            `Permintaan Pembelian SIM dengan RFID Berhasil!\n\n` +
            `Nama: ${customerName}\n` +
            `Nomor: ${simData.phoneNumber}\n` +
            `Provider: ${simData.provider}\n` +
            `Harga: ${api.formatCurrency(simData.sellingPrice)}\n\n` +
            `Silakan lakukan pembayaran di kasir.\n` +
            `Kasir akan mengaktivasi RFID Anda.`
          );
          setStep('success');
        }
      }
    } catch (error) {
      setErrorMessage(error.response?.data?.error || 'Gagal memproses pembelian');
    } finally {
      setLoading(false);
    }
  };

  // =======================================
  // HANDLE PAYMENT SUCCESS (QRIS)
  // =======================================
  const handlePaymentSuccess = () => {
    setShowPayment(false);
    setSuccessMessage(
      `Pembayaran Berhasil!\n\n` +
      `Nama: ${customerName}\n` +
      `Nomor: ${simData.phoneNumber}\n` +
      `Provider: ${simData.provider}\n` +
      `Harga: ${api.formatCurrency(simData.sellingPrice)}\n\n` +
      `Silakan ambil kartu SIM dan kartu RFID Anda di kasir.\n` +
      `Kasir akan menyelesaikan aktivasi RFID.`
    );
    setStep('success');
  };

  // =======================================
  // RESET & MULAI ULANG
  // =======================================
  const handleReset = () => {
    setStep('scan');
    setSimData(null);
    setBarcodeInput('');
    setCustomerName('');
    setCustomerEmail('');
    setIntegrateRfid(false);
    setPaymentMethod('qris');
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handlePaymentCancel = async () => {
  console.log('User cancel SIM payment');
  
  try {
    // Cancel transaksi di backend
    if (paymentData?.transaction_id) {
      await api.cancelPayment(paymentData.transaction_id);
      console.log('Transaction cancelled');
    }
  } catch (error) {
    console.error('Error cancelling payment:', error);
  }
  
  // Close modal
  setShowPayment(false);
  setPaymentData(null);
};

  // =======================================
  // RENDER: SCAN PAGE
  // =======================================
  if (step === 'scan') {
    return (
      <div className="buy-sim-card">
        <div className="header">
          <button onClick={onBack} className="btn-back">← Kembali</button>
          <h1>Beli Kartu SIM</h1>
        </div>

        <div className="scan-section">
          <div className="scan-title">Scan Barcode Kartu SIM</div>
          <div className="scan-animation">
            <div className="scan-pulse"></div>
          </div>

          <div className="input-section">
            <input
              type="text"
              value={barcodeInput}
              onChange={(e) => {
                setBarcodeInput(e.target.value);
                setErrorMessage('');
              }}
              onKeyPress={(e) => e.key === 'Enter' && handleScanBarcode()}
              placeholder="Scan barcode atau masukkan nomor seri"
              className="barcode-input"
              autoFocus
              disabled={loading}
            />

            {errorMessage && (
              <div className="error-message">{errorMessage}</div>
            )}

            <button
              onClick={handleScanBarcode}
              disabled={loading || !barcodeInput.trim()}
              className="btn-scan"
            >
              {loading ? 'Memproses...' : 'Scan Barcode'}
            </button>
          </div>

          <div className="instruction">
            <p>Arahkan scanner ke barcode yang ada di kemasan kartu SIM</p>
          </div>
        </div>
      </div>
    );
  }

  // =======================================
  // RENDER: DETAILS PAGE
  // =======================================
  if (step === 'details' && simData) {
    return (
      <div className="buy-sim-card">
        <div className="header">
          <button onClick={handleReset} className="btn-back">← Kembali</button>
          <h1>Detail Kartu SIM</h1>
        </div>

        <div className="details-section">
          {/* SIM Card Details */}
          <div className="sim-details">
            <div className="detail-header">Informasi Kartu SIM</div>
            <div className="detail-grid">
              <div className="detail-item">
                <label>Nomor:</label>
                <span className="phone-number">{simData.phoneNumber}</span>
              </div>
              <div className="detail-item">
                <label>Provider:</label>
                <span className="provider-badge">{simData.provider.toUpperCase()}</span>
              </div>
              <div className="detail-item">
                <label>Harga:</label>
                <span className="price">{api.formatCurrency(simData.sellingPrice)}</span>
              </div>
            </div>
          </div>

          {/* ✅ TAMBAH: Customer Information Form */}
          <div className="customer-info-section">
            <div className="section-header">Data Diri Customer</div>
            <div className="form-group">
              <label>Nama Lengkap</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setErrorMessage('');
                }}
                placeholder="Masukkan nama lengkap"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => {
                  setCustomerEmail(e.target.value);
                  setErrorMessage('');
                }}
                placeholder="Masukkan alamat email"
                disabled={loading}
              />
            </div>
          </div>

          {/* RFID Integration - MANDATORY */}
          <div className="rfid-option">
            {!integrateRfid ? (
              <div style={{
                background: '#dbeafe',
                border: '1px solid #0284c7',
                borderRadius: '8px',
                padding: '16px',
                textAlign: 'center'
              }}>
                <p style={{
                  margin: '0 0 12px 0',
                  fontSize: '14px',
                  color: '#0369a1',
                  fontWeight: '600'
                }}>
                  Setiap pembelian kartu SIM wajib terintegrasi dengan kartu RFID
                </p>
                <button
                  onClick={() => {
                    setIntegrateRfid(true);
                    setErrorMessage('');
                  }}
                  disabled={loading}
                  style={{
                    padding: '10px 20px',
                    background: '#0284c7',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    opacity: loading ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) e.target.style.background = '#0369a1';
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) e.target.style.background = '#0284c7';
                  }}
                >
                  Ya, Integrasikan dengan RFID
                </button>
              </div>
            ) : (
              <div style={{
                background: '#ecfdf5',
                border: '1px solid #10b981',
                borderRadius: '8px',
                padding: '16px',
                textAlign: 'center',
                color: '#10b981',
                fontWeight: '600',
                fontSize: '14px'
              }}>
                Akan terintegrasi dengan kartu RFID
              </div>
            )}
          </div>

          {/* Payment Method (jika integrase dengan RFID) */}
          {integrateRfid && (
            <div className="payment-section">
              <div className="payment-title">Metode Pembayaran</div>
              <div className="payment-options">
                <label className={`payment-option ${paymentMethod === 'qris' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="sim-payment"
                    value="qris"
                    checked={paymentMethod === 'qris'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  />
                  <div className="payment-content">
                    <span className="payment-name">QRIS</span>
                    <span className="payment-desc">Bayar dengan scan QR</span>
                  </div>
                </label>
                <label className={`payment-option ${paymentMethod === 'cash' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="sim-payment"
                    value="cash"
                    checked={paymentMethod === 'cash'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  />
                  <div className="payment-content">
                    <span className="payment-name">Bayar di Kasir</span>
                    <span className="payment-desc">Tunai / Transfer</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="error-message">{errorMessage}</div>
          )}

          {/* Action Buttons */}
          <div className="action-buttons">
            <button
              onClick={handleReset}
              className="btn-cancel"
              disabled={loading}
            >
              Batal
            </button>
            <button
              onClick={handleProceedToPayment}
              disabled={loading || !integrateRfid}
              className="btn-proceed"
            >
              {loading ? 'Memproses...' : 'Lanjut'}
            </button>
          </div>
        </div>

        {/* Payment Modal untuk QRIS */}
        {showPayment && paymentData && (
  <PaymentModal
    isOpen={showPayment}
    onClose={handlePaymentCancel}
    paymentData={paymentData}
    onPaymentSuccess={handlePaymentSuccess}
  />
)}
      </div>
    );
  }

  // =======================================
  // RENDER: SUCCESS PAGE
  // =======================================
  if (step === 'success') {
    return (
      <div className="buy-sim-card success-page">
        <div className="success-container">
          <div className="success-title">Berhasil!</div>
          <div className="success-message">
            {successMessage.split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>

          <div className="success-actions">
            <button onClick={handleReset} className="btn-primary">
              Beli Kartu SIM Lagi
            </button>
            <button onClick={onBack} className="btn-secondary">
              Kembali ke Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default BuySIMCard;
