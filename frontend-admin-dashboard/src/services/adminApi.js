import axios from 'axios';

const API_BASE_URL = 'https://sistem-pulsa-rfid.onrender.com/api';

const adminApi = {
  login: async (username, password) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/admin/login`, {
        username,
        password
      });
      return response.data;
    } catch (error) {
      console.error('Login error:', error);
      throw error.response?.data || { success: false, error: 'Login gagal' };
    }
  },

  createAdmin: async (adminData) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/admin/create-admin`, {
        username: adminData.username,
        fullName: adminData.fullName,
        password: adminData.password,
        confirmPassword: adminData.confirmPassword,
        role: adminData.role
      });
      return response.data;
    } catch (error) {
      console.error('Create admin error:', error);
      throw error.response?.data || { success: false, error: 'Gagal membuat admin' };
    }
  },

  getAdminList: async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/list`);
      return response.data;
    } catch (error) {
      console.error('Get admin list error:', error);
      throw error.response?.data || { success: false, error: 'Gagal memuat daftar admin' };
    }
  },

  getPendingCount: async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/customers/pending-count`);
      return response.data;
    } catch (error) {
      console.error('Get pending count error:', error);
      throw error.response?.data || { success: false, error: 'Gagal' };
    }
  },

  getPendingCustomers: async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/customers/pending`);
      return response.data;
    } catch (error) {
      console.error('Get pending customers error:', error);
      throw error.response?.data || { success: false, error: 'Gagal memuat data' };
    }
  },

  getActiveCustomers: async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/customers/active`);
      return response.data;
    } catch (error) {
      console.error('Get active customers error:', error);
      throw error.response?.data || { success: false, error: 'Gagal memuat data' };
    }
  },

  activateRFID: async (customerId, rfidCode, adminId) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/admin/activate-rfid`, {
        customerId,
        rfidCode,
        adminId
      });
      return response.data;
    } catch (error) {
      console.error('Activate RFID error:', error);
      throw error.response?.data || { success: false, error: 'Aktivasi gagal' };
    }
  },

  checkRFID: async (rfidCode) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/check-rfid/${rfidCode}`);
      return response.data;
    } catch (error) {
      console.error('Check RFID error:', error);
      throw error.response?.data || { success: false, error: 'Gagal cek RFID' };
    }
  },

  getDashboardStats: async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/dashboard/stats`);
      return response.data;
    } catch (error) {
      console.error('Get dashboard stats error:', error);
      throw error.response?.data || { success: false, error: 'Gagal memuat statistik' };
    }
  },

  getTransactions: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      
      if (filters.paymentStatus) {
        params.append('paymentStatus', filters.paymentStatus);
      }
      if (filters.startDate) {
        params.append('startDate', filters.startDate);
      }
      if (filters.endDate) {
        params.append('endDate', filters.endDate);
      }
      if (filters.page) {
        params.append('page', filters.page);
      }
      if (filters.limit) {
        params.append('limit', filters.limit);
      }

      const response = await axios.get(
        `${API_BASE_URL}/admin/transactions?${params.toString()}`
      );
      return response.data;
    } catch (error) {
      console.error('Get transactions error:', error);
      throw error.response?.data || { 
        success: false, 
        error: 'Gagal memuat transaksi' 
      };
    }
  },

  getTransactionStats: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      
      if (filters.startDate) {
        params.append('startDate', filters.startDate);
      }
      if (filters.endDate) {
        params.append('endDate', filters.endDate);
      }

      const response = await axios.get(
        `${API_BASE_URL}/admin/transactions/stats?${params.toString()}`
      );
      return response.data;
    } catch (error) {
      console.error('Get transaction stats error:', error);
      throw error.response?.data || { 
        success: false, 
        error: 'Gagal memuat statistik transaksi' 
      };
    }
  },

  approveCashPayment: async (transactionId, adminId) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/approve-cash-payment`,
        {
          transactionId,
          adminId
        }
      );
      return response.data;
    } catch (error) {
      console.error('Approve cash payment error:', error);
      throw error.response?.data || { 
        success: false, 
        error: 'Gagal mengonfirmasi pembayaran' 
      };
    }
  },

  rejectCashPayment: async (transactionId, adminId) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/reject-cash-payment`,
        {
          transactionId,
          adminId
        }
      );
      return response.data;
    } catch (error) {
      console.error('Reject cash payment error:', error);
      throw error.response?.data || { 
        success: false, 
        error: 'Gagal menolak pembayaran' 
      };
    }
  },

  getPendingSIMPurchases: async (status = 'pending') => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/sim/admin/pending-sim`,
        {
          params: { status }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Get pending SIM purchases error:', error);
      throw error.response?.data || { 
        success: false, 
        error: 'Gagal memuat pembelian SIM' 
      };
    }
  },

  // ==========================================
  // 🔧 FIXED: Kirim rfidCode ke backend
  // ==========================================
  activateSimPurchase: async (transactionId, rfidCode, adminId) => {
    try {
      console.log('📤 Sending SIM activation with RFID:', {
        transactionId,
        rfidCode,
        adminId
      });

      const response = await axios.post(
        `${API_BASE_URL}/sim/admin/confirm-sim-payment`,
        {
          transactionId,
          rfidCode,
          adminId
        }
      );
      
      console.log('✅ SIM activation response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Activate SIM purchase error:', error);
      throw error.response?.data || { 
        success: false, 
        error: 'Aktivasi SIM gagal' 
      };
    }
  },

  // ==========================================
  // 🔧 FIXED: Kirim rfidCode ke backend
  // ==========================================
  confirmSimPayment: async (transactionId, adminId) => {
  try {
    console.log('📤 Confirming SIM payment:', {
      transactionId,
      adminId
    });

    const response = await axios.post(
      `${API_BASE_URL}/sim/admin/confirm-sim-payment`,
      {
        transactionId,
        adminId
      }
    );
    
    console.log('✅ SIM payment confirmed:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Confirm SIM payment error:', error);
    throw error.response?.data || { 
      success: false, 
      error: 'Konfirmasi pembayaran gagal' 
    };
  }
},

  getSIMCards: async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/admin/sim-cards`
      );
      return response.data;
    } catch (error) {
      console.error('Get SIM cards error:', error);
      throw error.response?.data || { 
        success: false, 
        error: 'Gagal memuat kartu SIM' 
      };
    }
  },

  createSIMCard: async (simData, adminId) => {
    try {
      console.log('📤 Sending create SIM data:', {
        barcode: simData.barcode,
        phoneNumber: simData.phoneNumber,
        provider: simData.provider,
        purchasePrice: simData.purchasePrice,
        sellingPrice: simData.sellingPrice
      });

      const response = await axios.post(
        `${API_BASE_URL}/admin/sim-cards/create`,
        {
          barcode: simData.barcode,
          phoneNumber: simData.phoneNumber,
          provider: simData.provider,
          purchasePrice: simData.purchasePrice,
          sellingPrice: simData.sellingPrice,
          adminId
        }
      );
      return response.data;
    } catch (error) {
      console.error('Create SIM card error:', error);
      throw error.response?.data || { 
        success: false, 
        error: 'Gagal menambah kartu SIM' 
      };
    }
  },

  updateSIMCard: async (simId, simData, adminId) => {
    try {
      console.log('📤 Sending update SIM data:', {
        simId,
        barcode: simData.barcode,
        phoneNumber: simData.phoneNumber,
        provider: simData.provider,
        purchasePrice: simData.purchasePrice,
        sellingPrice: simData.sellingPrice
      });

      const response = await axios.post(
        `${API_BASE_URL}/admin/sim-cards/${simId}/update`,
        {
          barcode: simData.barcode,
          phoneNumber: simData.phoneNumber,
          provider: simData.provider,
          purchasePrice: simData.purchasePrice,
          sellingPrice: simData.sellingPrice,
          adminId
        }
      );
      return response.data;
    } catch (error) {
      console.error('Update SIM card error:', error);
      throw error.response?.data || { 
        success: false, 
        error: 'Gagal mengupdate kartu SIM' 
      };
    }
  },

  deleteSIMCard: async (simId, adminId) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/sim-cards/${simId}/delete`,
        { adminId }
      );
      return response.data;
    } catch (error) {
      console.error('Delete SIM card error:', error);
      throw error.response?.data || { 
        success: false, 
        error: 'Gagal menghapus kartu SIM' 
      };
    }
  }
};

export default adminApi;