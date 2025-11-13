const axios = require('axios');
const crypto = require('crypto');

class IAKService {
  constructor() {
    // ✅ Username menggunakan nomor HP (sesuai dokumentasi)
    this.username = '082145255949'; // Sesuai dengan yang terlihat di log
    this.apiKey = '89068d7a087d6744YuGy';
    // ✅ Base URL production tanpa /api (akan ditambahkan di endpoint)
    this.baseURL = 'https://prepaid.iak.id';
  }

  // Generate MD5 signature sesuai dokumentasi: md5(username+api_key+ref_id)
  generateSignature(params) {
    const signString = `${this.username}${this.apiKey}${params.ref_id}`;
    return crypto.createHash('md5').update(signString).digest('hex');
  }

  // Generate unique reference ID
  generateRefId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `TRX${timestamp}${random}`;
  }

  // Top-up pulsa function
  async topUpPulsa(phoneNumber, productCode, refId = null) {
    try {
      const transactionId = refId || this.generateRefId();
      
      // Format request sesuai dokumentasi resmi IAK
      const requestData = {
        username: this.username,
        ref_id: transactionId,
        customer_id: phoneNumber,    // Phone Number / MSISDN untuk pulsa
        product_code: productCode,
        sign: this.generateSignature({ ref_id: transactionId })
      };

      // ✅ URL endpoint yang benar (tanpa duplikasi path)
      const fullURL = `${this.baseURL}/api/top-up`;
      
      console.log('=== IAK REQUEST (FINAL FORMAT) ===');
      console.log('Full URL:', fullURL);
      console.log('Method: POST');
      console.log('Headers:', { 'Content-Type': 'application/json' });
      console.log('Request Body:', requestData);
      console.log('Signature String:', `${this.username}${this.apiKey}${transactionId}`);
      console.log('==================================');

      const response = await axios.post(fullURL, requestData, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      console.log('=== IAK RESPONSE SUCCESS ===');
      console.log('Status:', response.status);
      console.log('Response Data:', response.data);
      
      // Parse status sesuai dokumentasi
      const status = response.data.data?.status;
      let statusText = 'UNKNOWN';
      if (status === 0) statusText = 'PROCESSING';
      else if (status === 1) statusText = 'SUCCESS';
      else if (status === 2) statusText = 'FAILED';
      
      console.log('Transaction Status:', statusText);
      console.log('Balance After:', response.data.data?.balance);
      console.log('Message:', response.data.data?.message);
      console.log('============================');

      return {
        success: true,
        data: response.data.data,
        transactionId: transactionId,
        status: status,
        statusText: statusText,
        message: response.data.data?.message,
        balance: response.data.data?.balance
      };

    } catch (error) {
      console.log('=== IAK ERROR DETAILS ===');
      console.log('Error Type:', error.name);
      console.log('Error Message:', error.message);
      
      if (error.response) {
        console.log('Status:', error.response.status);
        console.log('Response:', error.response.data);
        
        // Parse error response dari IAK
        const errorData = error.response.data;
        if (errorData && errorData.data) {
          console.log('IAK Error Code:', errorData.data.rc);
          console.log('IAK Error Message:', errorData.data.message);
        }
      } else if (error.request) {
        console.log('No Response Received');
        console.log('Request Config:', error.config);
      } else {
        console.log('Request Setup Error:', error.message);
      }
      
      console.log('Stack Trace:', error.stack);
      console.log('=========================');
      
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        details: error.response?.data,
        statusCode: error.response?.status
      };
    }
  }

  // Check balance
  async checkBalance() {
    try {
      const requestData = {
        username: this.username,
        sign: crypto.createHash('md5').update(`${this.username}${this.apiKey}`).digest('hex')
      };

      const response = await axios.post(`${this.baseURL}/api/balance`, requestData, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      console.log('=== BALANCE CHECK ===');
      console.log('Current Balance:', response.data.data?.balance);
      console.log('=====================');

      return {
        success: true,
        balance: response.data.data?.balance || 0,
        data: response.data.data
      };

    } catch (error) {
      console.error('Check balance error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  // Check transaction status
  async checkTransactionStatus(refId) {
    try {
      const requestData = {
        username: this.username,
        ref_id: refId,
        sign: this.generateSignature({ ref_id: refId })
      };

      const response = await axios.post(`${this.baseURL}/api/check-status`, requestData, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      console.log('=== STATUS CHECK ===');
      console.log('Ref ID:', refId);
      console.log('Status:', response.data.data?.status);
      console.log('Message:', response.data.data?.message);
      console.log('====================');

      return {
        success: true,
        data: response.data.data
      };

    } catch (error) {
      console.error('Check status error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  // Get price list
  async getPriceList() {
    try {
      const requestData = {
        username: this.username,
        sign: crypto.createHash('md5').update(`${this.username}${this.apiKey}`).digest('hex')
      };

      const response = await axios.post(`${this.baseURL}/api/pricelist`, requestData, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      console.log('=== PRICELIST ===');
      console.log('Products Count:', response.data.data?.length || 0);
      console.log('=================');

      return {
        success: true,
        data: response.data.data || []
      };

    } catch (error) {
      console.error('Get price list error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }
}

module.exports = new IAKService();