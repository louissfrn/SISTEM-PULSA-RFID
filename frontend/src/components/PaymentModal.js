import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './PaymentModal.css';

const PaymentModal = ({ isOpen, onClose, paymentData, onPaymentSuccess }) => {
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [countdown, setCountdown] = useState(300); // 5 menit
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (isOpen && paymentData?.payment_token) {
      console.log('PaymentModal opened');
      console.log(`Order ID: ${paymentData.order_id}`);
      console.log(`Amount: Rp ${paymentData.amount?.toLocaleString('id-ID')}`);
      
      // Generate QR code URL
      const snapUrl = `https://app.sandbox.midtrans.com/snap/v2/vtweb/${paymentData.payment_token}`;
      setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(snapUrl)}`);
      
      // Reset state
      setPaymentStatus('pending');
      setCountdown(300);
      setSuccessMessage('');

      // Start countdown
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            console.log('⏰ Countdown finished');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Check payment status setiap 5 detik
      const statusChecker = setInterval(() => {
        checkPaymentStatus();
      }, 5000);

      console.log('✅ Interval check started every 5 seconds');

      return () => {
        clearInterval(timer);
        clearInterval(statusChecker);
        console.log('🛑 Modal cleanup - intervals cleared');
      };
    }
  }, [isOpen, paymentData]);



  const checkPaymentStatus = async () => {
    if (checkingPayment) {
      return;
    }

    if (paymentStatus !== 'pending') {
      return;
    }

    if (!paymentData?.order_id) {
      return;
    }
    
    try {
      setCheckingPayment(true);
      console.log(`🔍 Checking status for order: ${paymentData.order_id}`);
      
      const response = await api.get(`/api/payment/status/${paymentData.order_id}`);
      
      console.log(`📥 Response: ${JSON.stringify({success: response.success, status: response.data?.transaction_status})}`);

      if (response && response.success && response.data) {
        const txData = response.data;
        const txStatus = txData?.transaction_status;
        
        console.log(`✓ Transaction status: ${txStatus}`);
        
        if (txStatus === 'settlement' || txStatus === 'capture') {
          console.log('🎉 PAYMENT SUCCESS DETECTED!');
          setPaymentStatus('success');
          setSuccessMessage('Selamat! Pembayaran Anda berhasil.');
          
          // ✅ JANGAN PANGGIL CALLBACK DI SINI!
          // Biarkan user klik button dulu
          // Callback akan dipanggil dari handleSelesai() atau handleTransaksiLagi()

        } else if (txStatus === 'pending') {
          console.log('Still pending...');
        } else if (['deny', 'cancel', 'expire'].includes(txStatus)) {
          console.log(`Payment failed with status: ${txStatus}`);
          setPaymentStatus('failed');
          setSuccessMessage('Pembayaran gagal atau dibatalkan');
          
          setTimeout(() => {
            onClose();
          }, 2000);
        }
      } else {
        console.log(`❌ Response error: ${JSON.stringify(response)}`);
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    } finally {
      setCheckingPayment(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCancel = async () => {
    try {
      if (paymentData?.transaction_id) {
        await api.cancelPayment(paymentData.transaction_id);
        console.log('Transaction cancelled');
      }
      onClose();
    } catch (error) {
      console.error('Error cancelling payment:', error);
      onClose();
    }
  };

  const handleTransaksiLagi = () => {
    console.log('User clicked "Transaksi Lagi" button');
    
    if (onPaymentSuccess) {
      onPaymentSuccess({
        action: 'transaksi_lagi',
        success: true
      });
    }
    
    onClose();
  };

  const handleSelesai = () => {
  console.log('User clicked selesai button');
  if (onPaymentSuccess) {
    onPaymentSuccess({
      success: true,
      action: 'selesai'
    });
  }
  onClose();
};

  if (!isOpen) return null;

  return (
    <div className="payment-modal-overlay" onClick={paymentStatus === 'pending' ? onClose : null}>
      <div className="payment-modal-content" onClick={(e) => e.stopPropagation()}>
        {paymentStatus === 'pending' && (
          <>
            <button className="modal-close-btn" onClick={onClose}>✕</button>
            
            <h2>Scan QR Code untuk Bayar</h2>
            
            <div className="payment-info">
              <div className="payment-amount">
                <span className="label">Total Pembayaran:</span>
                <span className="amount">Rp {paymentData?.amount?.toLocaleString('id-ID')}</span>
              </div>
              
              <div className="payment-timer">
                <span>Waktu tersisa: </span>
                <span className={`timer ${countdown < 60 ? 'warning' : ''}`}>
                  {formatTime(countdown)}
                </span>
              </div>
            </div>

            {qrCodeUrl && (
              <div className="qr-code-container">
                <img src={qrCodeUrl} alt="QR Code" className="qr-code" />
                <p className="qr-instruction">
                  Scan QR Code dengan aplikasi pembayaran digital Anda
                </p>
              </div>
            )}

            <div className="payment-methods">
              <img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/QRIS_logo.svg" alt="QRIS" />
            </div>

            <div className="payment-checking">
              <div className="checking-spinner"></div>
              <p>Menunggu pembayaran...</p>
            </div>

            <button className="cancel-payment-btn" onClick={handleCancel}>
              Batal
            </button>
          </>
        )}

        {paymentStatus === 'success' && (
          <div className="payment-success-screen">
            <div className="success-animation">
              <div className="success-icon"></div>
            </div>
            
            <h2 className="success-title">Pembayaran Berhasil!</h2>
            
            <p className="success-message">
              {successMessage}
            </p>

            <div className="success-amount">
              <span>Rp {paymentData?.amount?.toLocaleString('id-ID')}</span>
            </div>

            <div className="success-actions">
              <button 
                className="btn-selesai"
                onClick={handleSelesai}
              >
                Selesai
              </button>
              <button 
                className="btn-transaksi-lagi"
                onClick={handleTransaksiLagi}
              >
                Transaksi Lagi
              </button>
            </div>
          </div>
        )}

        {paymentStatus === 'failed' && (
          <div className="payment-failed-screen">
            <h2 className="failed-title">Pembayaran Gagal</h2>
            <p className="failed-message">{successMessage}</p>
            
            <div className="failed-actions">
              <button 
                className="btn-kembali"
                onClick={onClose}
              >
                Kembali
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentModal;