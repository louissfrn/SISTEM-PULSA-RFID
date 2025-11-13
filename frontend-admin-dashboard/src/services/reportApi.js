import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

const reportApi = {
  // Get report summary (KPI metrics)
  getReportSummary: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.paymentMethod) params.append('paymentMethod', filters.paymentMethod);
      if (filters.paymentStatus) params.append('paymentStatus', filters.paymentStatus);

      const response = await axios.get(
        `${API_BASE_URL}/report/summary?${params.toString()}`
      );
      return response.data;
    } catch (error) {
      console.error('Get report summary error:', error);
      throw error.response?.data || { success: false, error: 'Gagal memuat ringkasan' };
    }
  },

  // Get daily transaction chart data
  getDailyChartData: async (startDate, endDate) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/report/daily-chart`,
        {
          params: { startDate, endDate }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Get daily chart error:', error);
      throw error.response?.data || { success: false, error: 'Gagal memuat grafik' };
    }
  },

  // Get transactions list with filters and pagination
  getTransactionsList: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.paymentMethod) params.append('paymentMethod', filters.paymentMethod);
      if (filters.paymentStatus) params.append('paymentStatus', filters.paymentStatus);
      if (filters.transactionType) params.append('transactionType', filters.transactionType);
      if (filters.page) params.append('page', filters.page);
      if (filters.limit) params.append('limit', filters.limit);

      const response = await axios.get(
        `${API_BASE_URL}/report/transactions?${params.toString()}`
      );
      return response.data;
    } catch (error) {
      console.error('Get transactions list error:', error);
      throw error.response?.data || { success: false, error: 'Gagal memuat transaksi' };
    }
  },

  // Get payment method breakdown
  getPaymentBreakdown: async (startDate, endDate) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/report/payment-breakdown`,
        {
          params: { startDate, endDate }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Get payment breakdown error:', error);
      throw error.response?.data || { success: false, error: 'Gagal memuat breakdown' };
    }
  },

  // Get top products
  getTopProducts: async (startDate, endDate, limit = 10) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/report/top-products`,
        {
          params: { startDate, endDate, limit }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Get top products error:', error);
      throw error.response?.data || { success: false, error: 'Gagal memuat produk terlaris' };
    }
  },

  // Get customer statistics
  getCustomerStats: async (startDate, endDate) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/report/customer-stats`,
        {
          params: { startDate, endDate }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Get customer stats error:', error);
      throw error.response?.data || { success: false, error: 'Gagal memuat statistik pelanggan' };
    }
  },

  // Export data (for PDF/Excel generation)
  exportData: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.paymentMethod) params.append('paymentMethod', filters.paymentMethod);
      if (filters.paymentStatus) params.append('paymentStatus', filters.paymentStatus);

      const response = await axios.get(
        `${API_BASE_URL}/report/export-data?${params.toString()}`
      );
      return response.data;
    } catch (error) {
      console.error('Export data error:', error);
      throw error.response?.data || { success: false, error: 'Gagal export data' };
    }
  },

  // Format currency
  formatCurrency: (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  },

  // Format date
  formatDate: (date) => {
    return new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  },

  // Format datetime
  formatDateTime: (date) => {
    return new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
};

export default reportApi;