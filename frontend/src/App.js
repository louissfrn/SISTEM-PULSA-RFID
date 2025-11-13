import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import api from './services/api';
import PulsaMenu from './components/PulsaMenu';
import TopUpSaldo from './components/TopUpSaldo';
import BuySIMCard from './components/BuySIMCard';

function App() {
  const [currentPage, setCurrentPage] = useState('splash');
  const [customerData, setCustomerData] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [rfidInput, setRfidInput] = useState('');
  const rfidInputRef = useRef(null);

  // Check backend health saat app load
  useEffect(() => {
    checkBackendHealth();
  }, []);

  // Auto-focus pada RFID input saat scanning
  useEffect(() => {
    if (isScanning && rfidInputRef.current) {
      rfidInputRef.current.focus();
    }
  }, [isScanning]);

  // Session timeout untuk keamanan (auto logout setelah 2 menit idle)
  useEffect(() => {
    let timeout;
    
    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (currentPage !== 'splash' && currentPage !== 'home') {
          alert('Sesi berakhir karena tidak ada aktivitas. Silakan tap kartu RFID lagi.');
          setCustomerData(null);
          setCurrentPage('home');
        }
      }, 600000); // 10 menit
    };
    
    window.addEventListener('click', resetTimer);
    window.addEventListener('keypress', resetTimer);
    window.addEventListener('touchstart', resetTimer);
    
    resetTimer();
    
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('keypress', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
    };
  }, [currentPage]);

  const checkBackendHealth = async () => {
    try {
      const response = await api.healthCheck();
      console.log('Backend status:', response);
      setBackendStatus('connected');
    } catch (error) {
      console.error('Backend not available:', error);
      setBackendStatus('disconnected');
    }
  };

  const handleStartSystem = () => {
    setCurrentPage('home');
  };

  // Handler untuk RFID scan dengan real input
  const handleRFIDScan = async () => {
    setCurrentPage('rfid-scan');
    setIsScanning(true);
    setRfidInput('');
    
    // Auto-focus input untuk capture RFID
    setTimeout(() => {
      if (rfidInputRef.current) {
        rfidInputRef.current.focus();
      }
    }, 100);
  };

  // Handler saat RFID code berubah
  const handleRfidInputChange = async (e) => {
    const value = e.target.value.trim();
    setRfidInput(value);
  };

  // Handler saat Enter ditekan (RFID reader selesai input)
  const handleRfidKeyPress = async (e) => {
    if (e.key === 'Enter') {
      const rfidCode = rfidInput.trim();
      if (rfidCode && rfidCode.length >= 3) {
        console.log('RFID Code detected:', rfidCode);
        await processRfidScan(rfidCode);
      }
    }
  };

  // Auto-focus ulang jika input kehilangan fokus
  const handleInputBlur = () => {
    if (isScanning && rfidInputRef.current) {
      setTimeout(() => {
        rfidInputRef.current.focus();
      }, 100);
    }
  };

  // Process RFID scan dengan backend
  const processRfidScan = async (rfidCode) => {
    try {
      console.log('Processing RFID:', rfidCode);
      const response = await api.scanRFID(rfidCode);
      
      if (response.success) {
        console.log('RFID scan result:', response.data);
        setCustomerData(response.data);
        
        // Get products berdasarkan provider yang terdeteksi
        if (response.data.detectedProvider) {
          const productsResponse = await api.getProductsByProvider(
            response.data.detectedProvider
          );
          
          if (productsResponse.success) {
          }
        }
        
        setIsScanning(false);
        setRfidInput('');
        setCurrentPage('customer-menu');
      }
    } catch (error) {
      console.error('RFID scan failed:', error);
      setIsScanning(false);
      setRfidInput('');
      
      let errorMessage = 'Kartu RFID tidak terdaftar atau tidak aktif.';
      if (error.response && error.response.data && error.response.data.error) {
        errorMessage = error.response.data.error;
      }
      
      alert(errorMessage + ' Silakan daftar terlebih dahulu atau hubungi kasir.');
      setCurrentPage('home');
    }
  };

  // FIXED: handleRegistration dengan flow yang benar
  const handleRegistration = async (formData) => {
    try {
      const response = await api.registerCustomer(formData);
      
      if (response.success) {
        console.log('Registration successful:', response.data);
        
        // Tampilkan pesan sukses
        alert(
          `Pendaftaran Berhasil!\n\n` +
          `Nama: ${response.data.name}\n` +
          `No. HP: ${response.data.phone}\n\n` +
          `Silakan ambil kartu RFID anda di kasir.`
        );
        
        // Kembali ke home
        setCurrentPage('home');
      }
    } catch (error) {
      console.error('Registration failed:', error);
      alert('Gagal mendaftar. ' + (error.response?.data?.error || error.message));
    }
  };

  // Update customer data (untuk update balance setelah transaksi)
  const handleCustomerUpdate = (updatedData) => {
    setCustomerData(prev => ({
      ...prev,
      ...updatedData
    }));
  };

  // FIXED: Handle saat user selesai top up saldo
  const handleTopUpComplete = async (amount, action) => {
  console.log('Top Up Complete:', { amount, action });
  
  if (action === 'transaksi_lagi') {
    console.log('User pilih Transaksi Lagi - fetch ulang data customer...');
    
    try {
      // FETCH ULANG DATA CUSTOMER DARI API
      const response = await api.get(`/api/customer/${customerData.customerId}`);
      if (response.success) {
        setCustomerData(response.data);
        console.log('Customer data refreshed:', response.data);
      }
    } catch (error) {
      console.error('Error refreshing customer data:', error);
    }
    
    // Kembali ke customer-menu dengan data ter-update
    setCurrentPage('customer-menu');
    
  } else if (action === 'selesai') {
    console.log('User pilih Selesai - kembali ke splash');
    
    setTimeout(() => {
      console.log('📱 Navigating to splash screen...');
      setCustomerData(null);
      setCurrentPage('splash');
    }, 1000);
  }
};
  // Splash Screen Component
  const SplashScreen = () => (
    <div className="splash-screen" onClick={handleStartSystem}>
      <div className="splash-content">
        <h1 className="splash-title">Sistem Pulsa RFID</h1>
        <h2 className="splash-subtitle">UD. LIJAYA</h2>
        <div className="tap-indicator">
          <p className="tap-text">SENTUH LAYAR UNTUK MEMULAI</p>
          <div className="tap-animation"></div>
        </div>
      </div>
    </div>
  );

  // HomePage Component
  const HomePage = () => (
    <div className="container">
      <div className="header">
        <h1>Sistem Pulsa RFID<br />UD. LIJAYA</h1>
      </div>
      
      <div className="status-bar">
        <div className={`status-dot ${backendStatus === 'connected' ? '' : 'disconnected'}`}></div>
        <span className="status-text">
          Backend: {backendStatus === 'connected' ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <div className="button-container">
        <button 
          className="main-button green"
          onClick={handleRFIDScan}
          disabled={backendStatus !== 'connected'}
        >
          SUDAH PUNYA KARTU RFID
        </button>

        <button 
          className="main-button blue"
          onClick={() => setCurrentPage('register')}
          disabled={backendStatus !== 'connected'}
        >
          BELUM PUNYA KARTU RFID
        </button>

        <button 
          className="main-button orange"
          onClick={() => setCurrentPage('buy-sim')}
          disabled={backendStatus !== 'connected'}
        >
          BELI KARTU SIM
        </button>
      </div>
    </div>
  );

  // RFID Scanning Page
  const RFIDScanPage = () => (
    <div className="container">
      <div className="rfid-scan-container">
        <h2 className="scan-title">Tap Kartu RFID Anda</h2>
        <div className="scan-animation">
          <div className="scan-pulse"></div>
        </div>
        <p className="scan-instruction">Dekatkan kartu RFID ke reader</p>
        
        <input
          ref={rfidInputRef}
          type="text"
          value={rfidInput}
          onChange={handleRfidInputChange}
          onKeyPress={handleRfidKeyPress}
          onBlur={handleInputBlur}
          style={{
            position: 'absolute',
            left: '-9999px',
            opacity: 0,
            width: '1px',
            height: '1px'
          }}
          autoFocus
        />
        
        {rfidInput && (
          <div style={{ 
            marginTop: '20px', 
            color: 'white', 
            fontSize: '16px',
            background: 'rgba(0,0,0,0.3)',
            padding: '15px',
            borderRadius: '8px',
            maxWidth: '400px',
            margin: '20px auto',
            wordBreak: 'break-all'
          }}>
            RFID Code: {rfidInput}
            <br />
            <small>Tekan Enter jika belum otomatis terproses</small>
          </div>
        )}

        <button 
          className="back-button"
          onClick={() => {
            setIsScanning(false);
            setRfidInput('');
            setTimeout(() => {
              setCurrentPage('home');
            }, 100);
          }}
          style={{ marginTop: '30px' }}
        >
          BATAL
        </button>
      </div>
    </div>
  );

  // Customer Menu Page
  const CustomerMenuPage = () => (
    <div className="container">
      <div className="customer-info-page">
        <h2 className="welcome-title">Selamat Datang!</h2>
        <div className="customer-info">
          <p><strong>Nama:</strong> <span>{customerData?.name}</span></p>
          <p><strong>No HP:</strong> <span>{customerData?.phone}</span></p>
          <p><strong>Saldo:</strong> <span>Rp {parseFloat(customerData?.balance || 0).toLocaleString('id-ID')}</span></p>
          <p><strong>Provider:</strong> <span>{customerData?.detectedProvider}</span></p>
          <p><strong>RFID Code:</strong> <span>{customerData?.rfidCode}</span></p>
        </div>

        <h3 style={{ textAlign: 'center', marginBottom: '20px', fontSize: '20px', fontWeight: '600' }}>
          Pilih Layanan:
        </h3>
        <div className="service-buttons">
          <button 
            className="service-button"
            onClick={() => setCurrentPage('pulsa-menu')}
          >
            ISI PULSA
          </button>
          <button 
            className="service-button"
            onClick={() => setCurrentPage('topup-saldo')}
          >
            ISI SALDO
          </button>
        </div>

        <button 
          className="back-button"
          onClick={() => {
            setCustomerData(null);
            setCurrentPage('home');
          }}
        >
          KEMBALI
        </button>
      </div>
    </div>
  );

  // Registration Page - FIXED
  const RegisterPage = () => {
    const [formData, setFormData] = useState({ 
      name: '', 
      phone: '',
      email: '' 
    });

    const handleSubmit = (e) => {
      e.preventDefault();
      if (formData.name && formData.phone) {
        handleRegistration(formData);
      } else {
        alert('Nama dan nomor HP wajib diisi!');
      }
    };

    return (
      <div className="container">
        <div className="form-container">
          <h2 className="form-title">Pendaftaran Kartu RFID</h2>
          <form onSubmit={handleSubmit} className="register-form">
            <div className="form-group">
              <label>NAMA LENGKAP</label>
              <input
                type="text"
                placeholder="Masukkan nama lengkap"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>NOMOR HP</label>
              <input
                type="tel"
                placeholder="Masukkan nomor HP"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>EMAIL (OPSIONAL)</label>
              <input
                type="email"
                placeholder="Masukkan email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <button type="submit" className="submit-button">
              DAFTAR
            </button>
          </form>
          <button 
            className="back-button"
            onClick={() => setCurrentPage('home')}
          >
            KEMBALI
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="App">
      {currentPage === 'splash' && <SplashScreen />}
      {currentPage === 'home' && <HomePage />}
      {currentPage === 'rfid-scan' && <RFIDScanPage />}
      {currentPage === 'customer-menu' && <CustomerMenuPage />}
      {currentPage === 'register' && <RegisterPage />}
      
      {/* Beli Kartu SIM */}
      {currentPage === 'buy-sim' && (
        <BuySIMCard onBack={() => setCurrentPage('home')} />
      )}
      
      {/* Menu Pulsa */}
      {currentPage === 'pulsa-menu' && customerData && (
        <PulsaMenu
          customerData={customerData}
          onBack={() => setCurrentPage('customer-menu')}
          onCustomerUpdate={handleCustomerUpdate}
        />
      )}
      
      {/* Menu Top Up Saldo */}
      {currentPage === 'topup-saldo' && customerData && (
        <TopUpSaldo
          customerData={customerData}
          onBack={() => setCurrentPage('customer-menu')}
          onBalanceUpdated={handleTopUpComplete}
        />
      )}
    </div>
  );
}

export default App;