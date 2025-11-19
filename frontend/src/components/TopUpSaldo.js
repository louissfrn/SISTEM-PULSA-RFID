import React, { useState } from 'react';
import PaymentModal from './PaymentModal';
import api from '../services/api';
import './TopUpSaldo.css';

const TopUpSaldo = ({ customerData, onBack, onBalanceUpdated }) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('qris');

  const predefinedAmounts = [10000, 20000, 50000, 100000, 200000, 500000];

  const handleAmountSelect = (selectedAmount) => {
    setAmount(selectedAmount.toString());
  };

  const handleAmountInput = (e) => {
    const value = e.target.value.replace(/\D/g, '');
    setAmount(value);
  };

  const handleCreatePayment = async () => {
    const numAmount = parseInt(amount);
    
    if (!amount || numAmount < 10000) {
      alert('❌ Minimal top up Rp 10.000');
      return;
    }

    if (numAmount > 10000000) {
      alert('❌ Maksimal top up Rp 10.000.000');
      return;
    }

    try {
      setLoading(true);
      
      if (paymentMethod === 'qris') {
        // ✅ QRIS Payment
        const response = await api.createSaldoPayment({
          customerId: customerData.customerId,
          rfidCardId: customerData.rfidCardId,
          amount: numAmount
        });

        if (response.success) {
          setPaymentData({
            type: 'saldo',
            amount: numAmount,
            transaction_id: response.transaction_id,
            payment_token: response.payment_token,
            order_id: response.order_id
          });
          setShowPayment(true);
        } else {
          alert('Gagal membuat pembayaran: ' + response.error);
        }
      } else if (paymentMethod === 'cash') {
        // ✅ Cash Payment
        console.log('Creating cash payment:', {
          customerId: customerData.customerId,
          rfidCardId: customerData.rfidCardId,
          amount: numAmount
        });

        const response = await api.post('/api/payment/create-saldo-payment-cash', {
          customerId: customerData.customerId,
          rfidCardId: customerData.rfidCardId,
          amount: numAmount
        });

        console.log('Cash payment response:', response);

        if (response && response.success) {
          alert(
            `Permintaan Top Up Berhasil!\n\n` +
            `Nominal: ${api.formatCurrency(numAmount)}\n\n` +
            `Silakan lakukan pembayaran di kasir.\n` +
            `Saldo akan bertambah setelah kasir mengkonfirmasi pembayaran.`
          );
          setAmount('');
        } else {
          alert('Gagal membuat pembayaran: ' + (response?.error || 'Unknown error'));
        }
      }
    } catch (error) {
      console.error('Create payment error:', error);
      alert('Error: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIXED: Handle payment success dari PaymentModal
  const handlePaymentSuccess = (result) => {
    console.log('Payment Success Result dari PaymentModal:', result);
    
    // ✅ PaymentModal sudah emit callback dengan action
    // TopUpSaldo hanya pass ke App.js via onBalanceUpdated
    const amountInt = parseInt(amount);
    
    if (result?.action === 'transaksi_lagi') {
      console.log('User memilih TRANSAKSI LAGI');
      setAmount('');
      setShowPayment(false);
      setPaymentData(null);
      
      if (onBalanceUpdated) {
        onBalanceUpdated(amountInt, 'transaksi_lagi');
      }
    } else if (result?.success) {
      console.log('User memilih SELESAI');
      setAmount('');
      setShowPayment(false);
      setPaymentData(null);
      
      if (onBalanceUpdated) {
        onBalanceUpdated(amountInt, 'selesai');
      }
    }
  };
  const handlePaymentCancel = () => {
    console.log('User cancel payment');
    setShowPayment(false); 
    setPaymentData(null);  
    // ✅ HANYA close modal, JANGAN reset state
    // Biarkan PaymentModal handle cleanup-nya
  };

  return (
    <div className="topup-saldo">
      <div className="header">
        <button onClick={onBack} className="btn-back">← Kembali</button>
        <h1>Top Up Saldo RFID</h1>
      </div>

      <div className="customer-info">
        <h3>Informasi Akun</h3>
        <div className="info-grid">
          <div className="info-item">
            <label>Nama:</label>
            <span>{customerData.name}</span>
          </div>
          <div className="info-item">
            <label>Nomor HP:</label>
            <span>{customerData.phone}</span>
          </div>
          <div className="info-item full-width">
            <label>Saldo Saat Ini:</label>
            <span className="balance-large">
              {api.formatCurrency(customerData.balance || 0)}
            </span>
          </div>
        </div>
      </div>

      <div className="amount-section">
        <h3>Pilih Nominal Top Up</h3>
        <div className="predefined-amounts">
          {predefinedAmounts.map(preAmount => (
            <button
              key={preAmount}
              onClick={() => handleAmountSelect(preAmount)}
              className={`amount-btn ${amount === preAmount.toString() ? 'selected' : ''}`}
            >
              {api.formatCurrency(preAmount)}
            </button>
          ))}
        </div>

        <div className="custom-amount">
          <h4>Atau Masukkan Nominal Lain</h4>
          <div className="input-group">
            <span className="currency">Rp</span>
            <input
              type="text"
              value={amount ? parseInt(amount).toLocaleString('id-ID') : ''}
              onChange={handleAmountInput}
              placeholder="10.000"
            />
          </div>
          {amount && parseInt(amount) < 10000 && (
            <p className="error-text">⚠️ Minimal top up Rp 10.000</p>
          )}
          {amount && parseInt(amount) > 10000000 && (
            <p className="error-text">⚠️ Maksimal top up Rp 10.000.000</p>
          )}
        </div>

        <div className="payment-method-section">
          <h4>Metode Pembayaran</h4>
          <div className="payment-options">
            <label className={`payment-option ${paymentMethod === 'qris' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="topup-payment"
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
                name="topup-payment"
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

        <button
          onClick={handleCreatePayment}
          disabled={loading || !amount || parseInt(amount) < 10000 || parseInt(amount) > 10000000}
          className="pay-button"
        >
          {loading ? (
            <>
              <div className="btn-spinner"></div>
              Memproses...
            </>
          ) : (
            `Bayar ${amount ? api.formatCurrency(parseInt(amount)) : 'Rp 0'}`
          )}
        </button>
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
};

export default TopUpSaldo;