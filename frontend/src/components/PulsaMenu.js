import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './PulsaMenu.css';

const PulsaMenu = ({ customerData, onBack, onCustomerUpdate }) => {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState(customerData.phone || '');
  const [paymentMethod, setPaymentMethod] = useState('saldo_rfid');
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState(null);

  // ==========================================
  // LOAD PRODUCTS BERDASARKAN PROVIDER
  // ==========================================
  useEffect(() => {
    if (customerData.detectedProvider) {
      loadProducts();
    } else {
      alert('Provider tidak terdeteksi. Silakan hubungi kasir.');
      onBack();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerData.detectedProvider]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const result = await api.getProductsByProvider(customerData.detectedProvider);
      
      if (result.success) {
        setProducts(result.data);
      } else {
        alert('Gagal memuat produk pulsa');
      }
    } catch (error) {
      console.error('Error loading products:', error);
      alert('Error loading products: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // HANDLE PRODUCT SELECTION
  // ==========================================
  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    setShowConfirmation(true);
  };

  // ==========================================
  // CONFIRM TRANSACTION
  // ==========================================
  const handleConfirmTransaction = async () => {
    if (!selectedProduct || !phoneNumber) {
      alert('Data tidak lengkap');
      return;
    }

    // Validate phone number
    if (!api.validatePhoneNumber(phoneNumber)) {
      alert('Format nomor HP tidak valid');
      return;
    }

    // Check saldo jika menggunakan saldo RFID
    if (paymentMethod === 'saldo_rfid') {
      if (Number(customerData.balance) < Number(selectedProduct.Selling_Price)) {
        alert('Saldo tidak mencukupi. Silakan top up saldo terlebih dahulu.');
        return;
      }
    }

    try {
      setLoading(true);
      setShowConfirmation(false);

      const transactionData = {
        customerId: customerData.customerId,
        rfidCardId: customerData.rfidCardId,
        productDetailId: selectedProduct.Product_Detail_ID,
        targetPhone: api.formatPhoneNumber(phoneNumber),
        paymentMethod: paymentMethod
      };

      console.log('Sending transaction data:', transactionData);

      const result = await api.createPulsaTransaction(transactionData);

      if (result.success) {
        // ==========================================
        // FIX: Handle berbeda untuk setiap payment method
        // ==========================================
        let message = '';
        
        if (paymentMethod === 'cash') {
          // Cash payment - tunggu kasir approve
          message = 'Transaksi berhasil dibuat!\n\nSilahkan melakukan pembayaran di kasir terlebih dahulu.\n\nPulsa akan masuk otomatis setelah kasir mengkonfirmasi pembayaran anda.';
        } else if (paymentMethod === 'saldo_rfid') {
          // RFID Balance - langsung diproses
          message = 'Pulsa berhasil diisi!';
        }

        setTransactionStatus({
          success: true,
          message: message,
          data: result.data,
          paymentMethod: paymentMethod
        });
        
        // ==========================================
        // Update customer data HANYA untuk saldo RFID
        // ==========================================
        // Hanya update balance jika payment method adalah saldo_rfid
        // karena hanya di sini pulsa langsung masuk
        if (paymentMethod === 'saldo_rfid' && result.data.newBalance !== undefined) {
          onCustomerUpdate({ balance: result.data.newBalance });
        }
        
        console.log('Transaction result:', {
          paymentMethod: paymentMethod,
          success: true,
          transactionCode: result.data?.transactionCode
        });
      } else {
        setTransactionStatus({
          success: false,
          message: result.error || 'Transaksi gagal'
        });
      }
    } catch (error) {
      console.error('Transaction error:', error);
      setTransactionStatus({
        success: false,
        message: error.response?.data?.error || 'Gagal memproses transaksi. Silakan coba lagi.'
      });
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // RESET TRANSACTION
  // ==========================================
  const resetTransaction = () => {
    setSelectedProduct(null);
    setShowConfirmation(false);
    setTransactionStatus(null);
    setPhoneNumber(customerData.phone || '');
  };

  // ==========================================
  // CALCULATE ADMIN FEE
  // ==========================================
  const calculateAdminFee = (nominal, sellingPrice) => {
    return Number(sellingPrice) - Number(nominal);
  };

  // ==========================================
  // TRANSACTION RESULT SCREEN
  // ==========================================
  if (transactionStatus) {
    return (
      <div className="pulsa-menu">
        <div className="transaction-result">
          <div className={`result-card ${transactionStatus.success ? 'success' : 'error'}`}>
            <div className="result-icon">
            </div>
            <h2>{transactionStatus.success ? 'Transaksi Berhasil!' : 'Transaksi Gagal!'}</h2>
            <p className="result-message">{transactionStatus.message}</p>
            
            {transactionStatus.success && transactionStatus.data && (
              <div className="transaction-details">
                <div className="detail-item">
                  <span className="detail-label">Kode Transaksi:</span>
                  <span className="detail-value">{transactionStatus.data.transactionCode}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Nomor Tujuan:</span>
                  <span className="detail-value">{transactionStatus.data.targetPhone}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Nominal:</span>
                  <span className="detail-value">{api.formatCurrency(transactionStatus.data.amount)}</span>
                </div>
                {transactionStatus.data.newBalance !== undefined && (
                  <div className="detail-item">
                    <span className="detail-label">Saldo Tersisa:</span>
                    <span className="detail-value balance-highlight">
                      {api.formatCurrency(transactionStatus.data.newBalance)}
                    </span>
                  </div>
                )}
                
                {/* ==========================================
                    INFORMASI TAMBAHAN BERDASARKAN PAYMENT METHOD
                    ========================================== */}
                {transactionStatus.paymentMethod === 'cash' && (
                  <div className="payment-info-box">
                  </div>
                )}
              </div>
            )}
            
            <div className="result-actions">
              <button onClick={resetTransaction} className="btn-primary">
                Transaksi Lagi
              </button>
              <button onClick={onBack} className="btn-secondary">
                Kembali ke Menu
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // MAIN PULSA MENU SCREEN
  // ==========================================
  return (
    <div className="pulsa-menu">
      <div className="header">
        <button onClick={onBack} className="btn-back">← Kembali</button>
        <h1>Isi Pulsa</h1>
      </div>

      <div className="customer-info">
        <h3>Informasi Pelanggan</h3>
        <div className="info-grid">
          <div className="info-item">
            <label>Nama:</label>
            <span>{customerData.name}</span>
          </div>
          <div className="info-item">
            <label>Provider:</label>
            <span className="provider">{customerData.detectedProvider?.toUpperCase()}</span>
          </div>
          <div className="info-item">
            <label>Saldo RFID:</label>
            <span className="balance">{api.formatCurrency(customerData.balance || 0)}</span>
          </div>
        </div>
      </div>

      <div className="phone-input">
        <h3>Nomor Tujuan</h3>
        <div className="input-group">
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="Masukkan nomor HP"
            maxLength="15"
            className="phone-input-field"
          />
          <button 
            onClick={() => setPhoneNumber(customerData.phone)}
            className="btn-use-registered"
          >
            Gunakan No. Terdaftar
          </button>
        </div>
        {phoneNumber && !api.validatePhoneNumber(phoneNumber) && (
          <p className="error-text">Format nomor HP tidak valid</p>
        )}
      </div>

      <div className="payment-method">
        <h3>Metode Pembayaran</h3>
        <div className="payment-options">
          <label className={`payment-option ${paymentMethod === 'saldo_rfid' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="payment"
              value="saldo_rfid"
              checked={paymentMethod === 'saldo_rfid'}
              onChange={(e) => setPaymentMethod(e.target.value)}
            />
            <div className="payment-content">
              <span className="payment-name">Saldo RFID</span>
              <span className="payment-balance">{api.formatCurrency(customerData.balance || 0)}</span>
            </div>
          </label>
          <label className={`payment-option ${paymentMethod === 'cash' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="payment"
              value="cash"
              checked={paymentMethod === 'cash'}
              onChange={(e) => setPaymentMethod(e.target.value)}
            />
            <div className="payment-content">
              <span className="payment-name">Bayar di Kasir</span>
            </div>
          </label>
        </div>
      </div>

      <div className="products-section">
        <h3>Pilih Nominal Pulsa</h3>
        {loading ? (
          <div className="loading">
            <div className="loading-spinner"></div>
            <p>Memuat produk...</p>
          </div>
        ) : (
          <div className="products-grid">
            {products.map((product) => {
              const canAfford = paymentMethod !== 'saldo_rfid' || (Number(customerData.balance) >= Number(product.Selling_Price));
              const adminFee = calculateAdminFee(product.Nominal, product.Selling_Price);
              
              return (
                <button
                  key={product.Detail_ID}
                  className={`product-card ${!canAfford ? 'disabled' : ''}`}
                  onClick={() => canAfford && handleProductSelect(product)}
                  disabled={!canAfford}
                >
                  <div className="product-nominal">
                    Pulsa {api.formatCurrency(product.Nominal)}
                  </div>
                  
                  <div className="price-breakdown">
                    <div className="price-row">
                      <span className="price-label">Nominal Pulsa:</span>
                      <span className="price-value">{api.formatCurrency(product.Nominal)}</span>
                    </div>
                    <div className="price-row">
                      <span className="price-label">Biaya Admin:</span>
                      <span className="price-value">{api.formatCurrency(adminFee)}</span>
                    </div>
                    <div className="price-divider"></div>
                    <div className="price-row total">
                      <span className="price-label">Total Bayar:</span>
                      <span className="price-value">{api.formatCurrency(product.Selling_Price)}</span>
                    </div>
                  </div>

                  {!canAfford && paymentMethod === 'saldo_rfid' && (
                    <div className="insufficient-balance">Saldo tidak cukup</div>
                  )}
                </button>
              );
            })}
          </div>
        )}
        {products.length === 0 && !loading && (
          <div className="no-products">
            <p>Tidak ada produk tersedia untuk provider ini</p>
          </div>
        )}
      </div>

      {/* ==========================================
          CONFIRMATION MODAL
          ========================================== */}
      {showConfirmation && selectedProduct && (
        <div className="modal-overlay" onClick={() => !loading && setShowConfirmation(false)}>
          <div className="confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Konfirmasi Transaksi</h3>
            <div className="confirmation-details">
              <div className="confirm-item">
                <span className="confirm-label">Nomor Tujuan:</span>
                <span className="confirm-value">{api.formatPhoneNumber(phoneNumber)}</span>
              </div>
              
              <div className="confirm-item">
                <span className="confirm-label">Nominal Pulsa:</span>
                <span className="confirm-value">{api.formatCurrency(selectedProduct.Nominal)}</span>
              </div>
              <div className="confirm-item">
                <span className="confirm-label">Biaya Admin:</span>
                <span className="confirm-value">{api.formatCurrency(calculateAdminFee(selectedProduct.Nominal, selectedProduct.Selling_Price))}</span>
              </div>
              <div className="confirm-item highlight">
                <span className="confirm-label">Total Bayar:</span>
                <span className="confirm-value">{api.formatCurrency(selectedProduct.Selling_Price)}</span>
              </div>

              <div className="confirm-item">
                <span className="confirm-label">Metode Bayar:</span>
                <span className="confirm-value">
                  {paymentMethod === 'saldo_rfid' ? 'Saldo RFID' : 'Bayar di Kasir'}
                </span>
              </div>
              
              {paymentMethod === 'saldo_rfid' && (
                <div className="confirm-item highlight">
                  <span className="confirm-label">Saldo Setelah Transaksi:</span>
                  <span className="confirm-value">
                    {api.formatCurrency(customerData.balance - selectedProduct.Selling_Price)}
                  </span>
                </div>
              )}
            </div>
            <div className="confirmation-actions">
              <button 
                onClick={handleConfirmTransaction}
                className="btn-confirm"
                disabled={loading}
              >
                {loading ? 'Memproses...' : 'Konfirmasi'}
              </button>
              <button 
                onClick={() => setShowConfirmation(false)}
                className="btn-cancel"
                disabled={loading}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          LOADING OVERLAY
          ========================================== */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <p>Memproses transaksi...</p>
            <small>Mohon tunggu, sedang menghubungi server</small>
          </div>
        </div>
      )}
    </div>
  );
};

export default PulsaMenu;