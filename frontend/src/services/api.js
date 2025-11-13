import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

const api = {
  // ✅ TAMBAH METHOD INI
  post: async (endpoint, data) => {
    try {
      const response = await apiClient.post(endpoint, data);
      return response.data;
    } catch (error) {
      console.error(`POST ${endpoint} error:`, error);
      throw error;
    }
  },

  get: async (endpoint, config) => {
    try {
      const response = await apiClient.get(endpoint, config);
      return response.data;
    } catch (error) {
      console.error(`GET ${endpoint} error:`, error);
      throw error;
    }
  },

  healthCheck: async () => {
    try {
      const response = await apiClient.get('/api/health');
      return response.data;
    } catch (error) {
      console.error('Health check error:', error);
      throw error;
    }
  },

  scanRFID: async (rfidCode = null) => {
    try {
      const response = await apiClient.post('/api/rfid/scan', { rfidCode });
      return response.data;
    } catch (error) {
      console.error('RFID scan error:', error);
      throw error;
    }
  },

  getProductsByProvider: async (provider) => {
    try {
      const response = await apiClient.get(`/api/products/pulsa/${provider}`);
      return response.data;
    } catch (error) {
      console.error('Get products error:', error);
      throw error;
    }
  },

  scanBarcode: async (barcode = null) => {
    try {
      const response = await apiClient.post('/api/sim/scan-barcode', { barcode });
      return response.data;
    } catch (error) {
      console.error('Barcode scan error:', error);
      throw error;
    }
  },

  registerCustomer: async (customerData) => {
    try {
      console.log('🔍 Sending registration data:', {
        name: customerData.name,
        phone: customerData.phone,
        email: customerData.email
      });
      
      const response = await apiClient.post('/api/customer/register', {
        name: customerData.name,
        phone: customerData.phone,
        email: customerData.email
      });
      return response.data;
    } catch (error) {
      console.error('Register customer error:', error);
      throw error;
    }
  },

  createPulsaTransaction: async (transactionData) => {
    try {
      console.log('Creating pulsa transaction:', transactionData);
      const response = await apiClient.post('/api/transactions/create-pulsa', transactionData);
      return response.data;
    } catch (error) {
      console.error('Create pulsa transaction error:', error);
      throw error;
    }
  },

  checkIAKBalance: async () => {
    try {
      const response = await apiClient.get('/api/transactions/iak-balance');
      return response.data;
    } catch (error) {
      console.error('Check IAK balance error:', error);
      throw error;
    }
  },

  getIAKPriceList: async () => {
    try {
      const response = await apiClient.get('/api/transactions/iak-pricelist');
      return response.data;
    } catch (error) {
      console.error('Get IAK price list error:', error);
      throw error;
    }
  },

  getTransactionHistory: async (customerId, limit = 10, offset = 0) => {
    try {
      const response = await apiClient.get(`/api/transactions/history/${customerId}`, {
        params: { limit, offset }
      });
      return response.data;
    } catch (error) {
      console.error('Get transaction history error:', error);
      throw error;
    }
  },

  getTransactionDetail: async (transactionId) => {
    try {
      const response = await apiClient.get(`/api/transactions/detail/${transactionId}`);
      return response.data;
    } catch (error) {
      console.error('Get transaction detail error:', error);
      throw error;
    }
  },

  checkTransactionService: async () => {
    try {
      const response = await apiClient.get('/api/transactions/health');
      return response.data;
    } catch (error) {
      console.error('Transaction service health check error:', error);
      throw error;
    }
  },

  createSaldoPayment: async (paymentData) => {
    try {
      const response = await apiClient.post('/api/payment/create-saldo-payment', paymentData);
      return response.data;
    } catch (error) {
      console.error('Create saldo payment error:', error);
      throw error;
    }
  },

  createPulsaPayment: async (paymentData) => {
    try {
      const response = await apiClient.post('/api/payment/create-pulsa-payment', paymentData);
      return response.data;
    } catch (error) {
      console.error('Create pulsa payment error:', error);
      throw error;
    }
  },

  checkPaymentStatus: async (orderId) => {
    try {
      const response = await apiClient.get(`/api/payment/status/${orderId}`);
      return response.data;
    } catch (error) {
      console.error('Check payment status error:', error);
      throw error;
    }
  },

  // =======================================
  // SIM CARD FUNCTIONS
  // =======================================

  scanSIMBarcode: async (barcode) => {
    try {
      const response = await apiClient.post('/api/sim/scan-barcode', { barcode });
      return response.data;
    } catch (error) {
      console.error('Scan SIM barcode error:', error);
      throw error;
    }
  },

  purchaseSIMQris: async (purchaseData) => {
    try {
      const response = await apiClient.post('/api/sim/purchase-qris', {
        simId: purchaseData.simId,
        phoneNumber: purchaseData.phoneNumber,
        provider: purchaseData.provider,
        integrateWithRfid: purchaseData.integrateWithRfid,
        amount: purchaseData.amount,
        customerName: purchaseData.customerName,       
        customerEmail: purchaseData.customerEmail 
      });
      return response.data;
    } catch (error) {
      console.error('Purchase SIM QRIS error:', error);
      throw error;
    }
  },

  purchaseSIMCash: async (purchaseData) => {
    try {
      const response = await apiClient.post('/api/sim/purchase-cash', {
        simId: purchaseData.simId,
        phoneNumber: purchaseData.phoneNumber,
        provider: purchaseData.provider,
        integrateWithRfid: purchaseData.integrateWithRfid,
        amount: purchaseData.amount,
        customerName: purchaseData.customerName,       
        customerEmail: purchaseData.customerEmail       
      });
      return response.data;
    } catch (error) {
      console.error('Purchase SIM Cash error:', error);
      throw error;
    }
  },

  getSIMPurchaseStatus: async (purchaseId) => {
    try {
      const response = await apiClient.get(`/api/sim/purchase/${purchaseId}`);
      return response.data;
    } catch (error) {
      console.error('Get SIM purchase status error:', error);
      throw error;
    }
  },

  // =======================================
  // UTILITY FUNCTIONS
  // =======================================

  formatPhoneNumber: (phone) => {
    let cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('62')) {
      cleaned = '0' + cleaned.substring(2);
    } else if (cleaned.startsWith('8')) {
      cleaned = '0' + cleaned;
    } else if (!cleaned.startsWith('0')) {
      cleaned = '08' + cleaned;
    }
    
    return cleaned;
  },

  validatePhoneNumber: (phone) => {
    const cleaned = api.formatPhoneNumber(phone);
    const regex = /^08[1-9][0-9]{7,10}$/;
    return regex.test(cleaned);
  },

  formatCurrency: (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  },
};

export default api;