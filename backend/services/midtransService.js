const midtransClient = require('midtrans-client');
require('dotenv').config();

class MidtransService {
  constructor() {
    console.log('Midtrans Keys loaded:', {
      serverKey: process.env.MIDTRANS_SERVER_KEY ? 'Available' : 'Missing',
      clientKey: process.env.MIDTRANS_CLIENT_KEY ? 'Available' : 'Missing'
    });
    
    // Snap API instance
    this.snap = new midtransClient.Snap({
      isProduction: false, // Sandbox
      serverKey: process.env.MIDTRANS_SERVER_KEY,
      clientKey: process.env.MIDTRANS_CLIENT_KEY
    });

    // Core API instance (untuk notifikasi & status check)
    this.coreApi = new midtransClient.CoreApi({
      isProduction: false,
      serverKey: process.env.MIDTRANS_SERVER_KEY,
      clientKey: process.env.MIDTRANS_CLIENT_KEY
    });
  }

  formatDateForMidtrans(date = new Date()) {
  // Add 1 hour buffer untuk expiry
  const expiryDate = new Date(date.getTime() + 60 * 60 * 1000);
  
  const year = expiryDate.getFullYear();
  const month = String(expiryDate.getMonth() + 1).padStart(2, '0');
  const day = String(expiryDate.getDate()).padStart(2, '0');
  const hours = String(expiryDate.getHours()).padStart(2, '0');
  const minutes = String(expiryDate.getMinutes()).padStart(2, '0');
  const seconds = String(expiryDate.getSeconds()).padStart(2, '0');
  
  // Format: yyyy-MM-dd hh:mm:ss Z
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} +0000`;
}
  async createSaldoPayment(transactionId, amount, customerDetails) {
    try {
      const timestamp = Date.now();
      const orderId = `SALDO-${transactionId}-${timestamp}`;
      
      const parameter = {
        transaction_details: {
          order_id: orderId,
          gross_amount: amount
        },
        credit_card: {
          secure: true
        },
        customer_details: {
          first_name: customerDetails.name,
          email: customerDetails.email || 'customer@example.com',
          phone: customerDetails.phone
        },
        item_details: [{
          id: 'RFID_TOPUP',
          price: amount,
          quantity: 1,
          name: `Top Up Saldo RFID - ${customerDetails.name}`
        }],
        callbacks: {
          finish: `${process.env.FRONTEND_URL}/payment/finish`
        },
        expiry: {
          start_time: this.formatDateForMidtrans(),
          unit: "minutes",
          duration: 15
        }
      };

      console.log('📤 Creating Midtrans transaction:', { orderId, amount, transactionId });
      const transaction = await this.snap.createTransaction(parameter);
      
      console.log('✅ Midtrans transaction created:', { orderId, token: transaction.token });
      
      return {
        success: true,
        token: transaction.token,
        redirect_url: transaction.redirect_url,
        order_id: orderId
      };
    } catch (error) {
      console.error('❌ Midtrans create payment error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createPulsaPayment(transactionId, amount, customerDetails, pulsaDetails) {
    try {
      const orderId = `PULSA-${transactionId}`;
      
      const parameter = {
        transaction_details: {
          order_id: orderId,
          gross_amount: amount
        },
        credit_card: {
          secure: true
        },
        customer_details: {
          first_name: customerDetails.name,
          email: customerDetails.email || 'customer@example.com',
          phone: customerDetails.phone
        },
        item_details: [{
          id: pulsaDetails.productCode,
          price: amount,
          quantity: 1,
          name: `Pulsa ${pulsaDetails.nominal} - ${pulsaDetails.targetPhone}`
        }],
        callbacks: {
          finish: `${process.env.FRONTEND_URL}/payment/finish`
        },
        expiry: {
          start_time: this.formatDateForMidtrans(),
          unit: "minutes",
          duration: 10
        }
      };

      console.log('📤 Creating Midtrans PULSA transaction:', { orderId, amount, transactionId });
      const transaction = await this.snap.createTransaction(parameter);
      
      console.log('✅ Midtrans PULSA transaction created:', { orderId, token: transaction.token });
      
      return {
        success: true,
        token: transaction.token,
        redirect_url: transaction.redirect_url,
        order_id: orderId
      };
    } catch (error) {
      console.error('❌ Midtrans create pulsa payment error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createSimPayment(purchaseId, amount, simDetails) {
    try {
      const timestamp = Date.now();
      const orderId = `SIM-${purchaseId}-${timestamp}`;
      
      const parameter = {
        transaction_details: {
          order_id: orderId,
          gross_amount: amount
        },
        credit_card: {
          secure: true
        },
        customer_details: {
          first_name: simDetails.customerName || `SIM ${simDetails.provider}`,
          email: simDetails.customerEmail || 'customer@example.com',
          phone: simDetails.phoneNumber
        },
        item_details: [{
          id: `SIM_${simDetails.provider}`,
          price: amount,
          quantity: 1,
          name: `Kartu SIM ${simDetails.provider} - ${simDetails.phoneNumber}`
        }],
        callbacks: {
          finish: `${process.env.FRONTEND_URL}/payment/finish`
        },
        expiry: {
          start_time: this.formatDateForMidtrans(),
          unit: "minutes",
          duration: 15
        }
      };

      console.log('📤 Creating Midtrans SIM transaction:', { orderId, amount, purchaseId });
      const transaction = await this.snap.createTransaction(parameter);
      
      console.log('✅ Midtrans SIM transaction created:', { orderId, token: transaction.token });
      
      return {
        success: true,
        token: transaction.token,
        redirect_url: transaction.redirect_url,
        order_id: orderId
      };
    } catch (error) {
      console.error('❌ Midtrans create SIM payment error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async handleNotification(notification) {
    try {
      const statusResponse = await this.coreApi.transaction.notification(notification);
      
      const orderId = statusResponse.order_id;
      const transactionStatus = statusResponse.transaction_status;
      const fraudStatus = statusResponse.fraud_status;

      console.log(`✅ Notification received - Order: ${orderId}, Status: ${transactionStatus}`);

      let paymentStatus = 'pending';

      if (transactionStatus == 'capture') {
        if (fraudStatus == 'challenge') {
          paymentStatus = 'challenge';
        } else if (fraudStatus == 'accept') {
          paymentStatus = 'success';
        }
      } else if (transactionStatus == 'settlement') {
        paymentStatus = 'success';
      } else if (transactionStatus == 'cancel' || 
                transactionStatus == 'deny' || 
                transactionStatus == 'expire') {
        paymentStatus = 'failed';
      } else if (transactionStatus == 'pending') {
        paymentStatus = 'pending';
      }

      return {
        success: true,
        order_id: orderId,
        payment_status: paymentStatus,
        transaction_status: transactionStatus,
        fraud_status: fraudStatus,
        raw_notification: statusResponse
      };

    } catch (error) {
      console.error('❌ Midtrans notification error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async checkPaymentStatus(orderId) {
    try {
      console.log('📡 [Midtrans] Checking status for order:', orderId);
      
      const statusResponse = await this.coreApi.transaction.status(orderId);
      
      console.log('✅ [Midtrans] Response received:', {
        order_id: statusResponse.order_id,
        transaction_status: statusResponse.transaction_status,
        fraud_status: statusResponse.fraud_status
      });

      return {
        success: true,
        data: statusResponse
      };
    } catch (error) {
      console.error('❌ [Midtrans] Check payment error:', {
        orderId,
        message: error.message,
        statusCode: error.httpStatusCode,
        apiResponse: error.ApiResponse
      });

      return {
        success: false,
        error: error.message || 'Midtrans API error'
      };
    }
  }
}

module.exports = new MidtransService();