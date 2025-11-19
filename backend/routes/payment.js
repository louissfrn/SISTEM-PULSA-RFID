const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const midtransService = require('../services/midtransService');
const iakService = require('../services/iakService');

// Create payment untuk top-up saldo QRIS
// ==========================================
// FIX: Terima rfidCardId dari frontend agar RFID konsisten
// ==========================================
router.post('/create-saldo-payment', async (req, res) => {
  let connection;

  try {
    const { customerId, rfidCardId, amount } = req.body;  // ← TERIMA rfidCardId

    if (!customerId || !rfidCardId || !amount || amount < 10000) {
      return res.status(400).json({
        success: false,
        error: 'Customer ID, RFID Card ID, dan amount minimal Rp 10.000 required'
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Get customer details
    const [customer] = await connection.execute(
      'SELECT * FROM customer WHERE Customer_ID = ?',
      [customerId]
    );

    if (customer.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    const customerData = customer[0];

    // Get RFID Card berdasarkan ID yang dikirim (BUKAN ambil random)
    const [rfidCard] = await connection.execute(
      `SELECT RFID_Card_ID, Balance FROM rfid_card 
       WHERE RFID_Card_ID = ? AND Customer_ID = ? AND Status = 'active'`,
      [rfidCardId, customerId]  // ← Gunakan ID yang dikirim + verify customer
    );

    if (rfidCard.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        error: 'RFID Card not found or not active'
      });
    }

    const rfidCardIdUsed = rfidCard[0].RFID_Card_ID;
    const balanceBefore = Number(rfidCard[0].Balance);
    const balanceAfter = balanceBefore + Number(amount);

    // Buat Transaction record DULUAN - sebelum Midtrans
    const transactionCode = `TOPUP-${Date.now()}`;
    const [transactionResult] = await connection.execute(
      `INSERT INTO transaction (
    Customer_ID, RFID_Card_ID, Transaction_Code, Transaction_Type,
    Total_Amount, Payment_Method, Payment_Status, SIM_ID, Product_Detail_ID
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerId, rfidCardIdUsed, transactionCode, 'top_up_saldo',
        amount, 'qris', 'pending', null, null
      ]
    );

    const transactionId = transactionResult.insertId;
    console.log('✅ Transaction created in DB first:', { transactionId, transactionCode, rfidCardId: rfidCardIdUsed });

    // ==========================================
    // CREATE BALANCE_HISTORY RECORD - QRIS ONLY
    // Untuk QRIS, langsung create balance_history karena auto-process
    // ==========================================
    await connection.execute(
      `INSERT INTO balance_history (
        RFID_Card_ID, Transaction_ID, Transaction_Type,
        Amount, Balance_Before, Balance_After, Created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [rfidCardIdUsed, transactionId, 'top_up', amount, balanceBefore, balanceAfter]
    );
    console.log('✅ Balance history created:', { transactionId, type: 'top_up', amount, rfidCardId: rfidCardIdUsed });

    // PENTING: Pass transactionId (bukan customerId) ke midtrans
    // Ini akan membuat order_id = SALDO-{transactionId}
    const paymentResult = await midtransService.createSaldoPayment(
      transactionId,  // ← HARUS transactionId, bukan customerId!
      amount,
      {
        name: customerData.Name,
        email: customerData.Email,
        phone: customerData.Phone_Number
      }
    );

    if (paymentResult.success) {
      // ✅ CONSOLIDATE: Hanya simpan ke TRANSACTION, tidak ke PAYMENT table
      // Semua data payment sudah ada di TRANSACTION table

      await connection.commit();
      console.log('✅ Saldo QRIS payment created:', {
        transactionId,
        amount,
        orderId: paymentResult.order_id,
        rfidCardId: rfidCardIdUsed
      });

      res.json({
        success: true,
        transaction_id: transactionId,
        transaction_code: transactionCode,
        payment_token: paymentResult.token,
        redirect_url: paymentResult.redirect_url,
        order_id: paymentResult.order_id
      });
    } else {
      await connection.rollback();
      res.status(400).json({
        success: false,
        error: paymentResult.error
      });
    }

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('❌ Create saldo QRIS payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    if (connection) connection.release();
  }
});

// Create payment untuk top-up saldo CASH
// ==========================================
// PENTING: CASH PAYMENT TIDAK LANGSUNG UPDATE BALANCE!
// Hanya buat TRANSACTION record, balance_history dibuat saat admin approve
// ==========================================
router.post('/create-saldo-payment-cash', async (req, res) => {
  let connection;

  try {
    const { customerId, rfidCardId, amount } = req.body;

    if (!customerId || !rfidCardId || !amount || amount < 10000) {
      return res.status(400).json({
        success: false,
        error: 'Customer ID, RFID Card ID, dan amount minimal Rp 10.000 required'
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Get customer details
    const [customer] = await connection.execute(
      'SELECT * FROM customer WHERE Customer_ID = ?',
      [customerId]
    );

    if (customer.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    const customerData = customer[0];

    // Verify RFID Card exists dan sesuai dengan customer
    const [rfidCardData] = await connection.execute(
      `SELECT RFID_Card_ID, Balance FROM rfid_card 
       WHERE RFID_Card_ID = ? AND Customer_ID = ? AND Status = 'active'`,
      [rfidCardId, customerId]  // ← Verify baik ID dan Customer ID
    );

    if (rfidCardData.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        error: 'RFID Card not found or not active'
      });
    }

    // Isi saldo via CASH
    const transactionCode = `TOPUP-${Date.now()}`;
    const [transactionResult] = await connection.execute(
      `INSERT INTO transaction (
    Customer_ID, RFID_Card_ID, Transaction_Code, Transaction_Type,
    Total_Amount, Payment_Method, Payment_Status, SIM_ID, Product_Detail_ID
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerId, rfidCardId, transactionCode, 'top_up_saldo',
        amount, 'cash', 'pending', null, null
      ]
    );

    const transactionId = transactionResult.insertId;
    console.log('Transaction created for top_up_saldo (CASH):', { transactionId, transactionCode, rfidCardId });

    // ==========================================
    // JANGAN CREATE BALANCE_HISTORY DULU!
    // Hanya buat TRANSACTION record saja
    // Balance_history akan dibuat saat admin approve di admin/approve-cash-payment
    // ==========================================

    await connection.commit();
    console.log('Saldo CASH payment created (PENDING):', { transactionId, customerId, rfidCardId, amount });

    res.json({
      success: true,
      transaction_id: transactionId,
      transaction_code: transactionCode,
      message: 'Transaksi top-up saldo cash berhasil dibuat. Silakan lakukan pembayaran di kasir.'
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Create saldo cash payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    if (connection) connection.release();
  }
});

// Create payment untuk pulsa (QRIS method)
router.post('/create-pulsa-payment', async (req, res) => {
  let connection;

  try {
    const {
      customerId,
      rfidCardId,
      productDetailId,
      targetPhone
    } = req.body;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Get customer dan product details
    const [customer] = await connection.execute(
      'SELECT * FROM customer WHERE Customer_ID = ?',
      [customerId]
    );

    const [productDetail] = await connection.execute(
      'SELECT pd.*, p.Telco_Provider FROM product_detail pd JOIN product p ON pd.Product_ID = p.Product_ID WHERE pd.Detail_ID = ?',
      [productDetailId]
    );

    if (customer.length === 0 || productDetail.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        error: 'Customer or product not found'
      });
    }

    const customerData = customer[0];
    const product = productDetail[0];

    // Create transaction record DULUAN
    const transactionCode = `TRX${Date.now()}`;
    const [transactionResult] = await connection.execute(
      `INSERT INTO transaction (
        Customer_ID, RFID_Card_ID, Transaction_Code, Transaction_Type,
        Total_Amount, Payment_Method, Payment_Status, SIM_ID
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        customerId, rfidCardId, transactionCode, 'isi_pulsa',
        product.Selling_Price, 'qris', 'pending', null
      ]
    );

    const transactionId = transactionResult.insertId;
    console.log('Transaction created for isi_pulsa:', { transactionId, transactionCode, rfidCardId });


    // Create Midtrans payment
    const paymentResult = await midtransService.createPulsaPayment(
      transactionId,
      product.Selling_Price,
      {
        name: customerData.Name,
        email: customerData.Email,
        phone: customerData.Phone_Number,
        target_phone: targetPhone
      }
    );

    if (paymentResult.success) {
      // CONSOLIDATE: Tidak perlu INSERT ke PAYMENT & PAYMENT_DETAIL
      // Semua data sudah tercakup di TRANSACTION & TRANSACTION_DETAIL

      await connection.commit();
      console.log('Pulsa QRIS payment created:', { transactionId, amount: product.Selling_Price, rfidCardId });

      res.json({
        success: true,
        transaction_id: transactionId,
        transaction_code: transactionCode,
        payment_token: paymentResult.token,
        redirect_url: paymentResult.redirect_url,
        order_id: paymentResult.order_id
      });
    } else {
      await connection.rollback();
      res.status(400).json({
        success: false,
        error: paymentResult.error
      });
    }

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('❌ Create pulsa payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    if (connection) connection.release();
  }
});

// Midtrans notification handler
router.post('/midtrans-notification', async (req, res) => {
  let connection;

  try {
    const result = await midtransService.handleNotification(req.body);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    const orderId = result.order_id;
    const paymentStatus = result.payment_status;

    // Extract transactionId dari orderId
    // Format: SALDO-{transactionId} atau TRX-{transactionId}
    const transactionId = orderId.split('-')[1] || null;

    if (!transactionId) {
      return res.status(400).json({ error: 'Invalid order ID format' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // ✅ CONSOLIDATE: Query langsung ke TRANSACTION, tidak ke PAYMENT
    const [transaction] = await connection.execute(
      `SELECT 
        t.*,
        td.Target_Phone_Number,
        pd.IAK_Product_Code
      FROM transaction t
      LEFT JOIN transaction_detail td ON t.Transaction_ID = td.Transaction_ID
      LEFT JOIN product_detail pd ON td.Product_Detail_ID = pd.Detail_ID
      WHERE t.Transaction_ID = ?`,
      [transactionId]
    );

    if (transaction.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const txData = transaction[0];

    if (paymentStatus === 'success') {
      // Update transaction status
      await connection.execute(
        'UPDATE transaction SET Payment_Status = ? WHERE Transaction_ID = ?',
        ['success', transactionId]
      );

      if (txData.Transaction_Type === 'top_up_saldo') {
        // Update RFID balance
        const [rfidCard] = await connection.execute(
          'SELECT RFID_Card_ID, Balance FROM rfid_card WHERE RFID_Card_ID = ?',
          [txData.RFID_Card_ID]
        );

        if (rfidCard.length > 0) {
          const balanceBefore = Number(rfidCard[0].Balance);
          const balanceAfter = balanceBefore + Number(txData.Total_Amount);

          await connection.execute(
            'UPDATE rfid_card SET Balance = ? WHERE RFID_Card_ID = ?',
            [balanceAfter, rfidCard[0].RFID_Card_ID]
          );

          // ==========================================
          // UPDATE balance history dengan saldo final
          // ==========================================
          await connection.execute(
            `UPDATE balance_history 
             SET Balance_Before = ?, Balance_After = ? 
             WHERE Transaction_ID = ?`,
            [balanceBefore, balanceAfter, transactionId]
          );

          console.log('RFID balance updated:', { rfidCardId: rfidCard[0].RFID_Card_ID, balanceAfter });
        }
      }
      else if (txData.Transaction_Type === 'isi_pulsa') {

        // Process dengan IAK
        if (txData.Target_Phone_Number && txData.IAK_Product_Code) {
          const iakResult = await iakService.topUpPulsa(
            txData.Target_Phone_Number,
            txData.IAK_Product_Code,
            txData.Transaction_Code
          );

          if (iakResult.success) {
          }
        }
      }
    }
    else if (paymentStatus === 'failed') {
      // Update transaction status to failed
      await connection.execute(
        'UPDATE transaction SET Payment_Status = ? WHERE Transaction_ID = ?',
        ['failed', transactionId]
      );
    }

    await connection.commit();
    res.json({ status: 'ok' });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Midtrans notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (connection) connection.release();
  }
});

// Check payment status
router.get('/status/:orderId', async (req, res) => {
  let connection;

  try {
    const { orderId } = req.params;
    console.log('🔍 Checking payment status for:', orderId);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    let transactionId = null;
    let paymentAmount = 0;
    let customerId = null;

    // CONSOLIDATE: Query langsung ke TRANSACTION, tidak ke PAYMENT & PAYMENT_DETAIL
    // Extract transactionId dari orderId
    const orderIdParts = orderId.split('-');
    if (orderIdParts.length < 2) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        error: 'Invalid order ID format'
      });
    }

    transactionId = orderIdParts[1];

    const [transaction] = await connection.execute(`
      SELECT 
        Transaction_ID,
        Total_Amount,
        Payment_Status,
        Customer_ID,
        RFID_Card_ID,
        Transaction_Type
      FROM transaction
      WHERE Transaction_ID = ?
      LIMIT 1
    `, [transactionId]);

    if (transaction.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        success: false,
        error: 'Transaction not found in database'
      });
    }

    transactionId = transaction[0].Transaction_ID;
    paymentAmount = transaction[0].Total_Amount;
    customerId = transaction[0].Customer_ID;
    console.log('Found transaction in DB:', { transactionId, orderId, amount: paymentAmount });

    // Check ke Midtrans
    let result = await midtransService.checkPaymentStatus(orderId);

    console.log('Midtrans result:', result);

    // FALLBACK: Kalau Midtrans error tapi pembayaran sudah masuk database
    if (!result.success) {
      console.log('⚠️ Midtrans API error, checking database status...');

      if (transaction[0].Payment_Status === 'success') {
        console.log('Payment already SUCCESS in database');
        result = {
          success: true,
          data: {
            transaction_status: 'settlement',
            order_id: orderId,
            status_code: '200',
            status_message: 'Success, transaction is found (from DB)'
          }
        };
      }
    }

    if (result.success) {
      const txStatus = result.data?.transaction_status;

      // JIKA SETTLEMENT/CAPTURE - AUTO UPDATE!
      if (txStatus === 'settlement' || txStatus === 'capture') {
        console.log('Payment SUCCESS - Updating status...');

        if (transaction[0].Payment_Status !== 'success') {
          // Update transaction status
          await connection.execute(
            'UPDATE transaction SET Payment_Status = ? WHERE Transaction_ID = ?',
            ['success', transactionId]
          );

          if (transaction[0].Transaction_Type === 'top_up_saldo') {
            // Update RFID balance
            const [rfidCard] = await connection.execute(
              'SELECT RFID_Card_ID, Balance FROM rfid_card WHERE RFID_Card_ID = ?',
              [transaction[0].RFID_Card_ID]
            );

            if (rfidCard.length > 0) {
              const balanceBefore = Number(rfidCard[0].Balance);
              const balanceAfter = balanceBefore + Number(paymentAmount);

              await connection.execute(
                'UPDATE rfid_card SET Balance = ? WHERE RFID_Card_ID = ?',
                [balanceAfter, rfidCard[0].RFID_Card_ID]
              );

              // ==========================================
              // UPDATE balance history dengan saldo final
              // ==========================================
              await connection.execute(
                `UPDATE balance_history 
                 SET Balance_Before = ?, Balance_After = ? 
                 WHERE Transaction_ID = ?`,
                [balanceBefore, balanceAfter, transactionId]
              );

              console.log('RFID balance updated:', { rfidCardId: rfidCard[0].RFID_Card_ID, balanceAfter });
            }
          }

          console.log('Status updated:', { transactionId, amount: paymentAmount });
        }
      }

      await connection.commit();
      connection.release();

      console.log('Sending success response');
      return res.json({
        success: true,
        data: result.data
      });
    } else {
      await connection.rollback();
      connection.release();

      console.log('Error:', result.error);
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (e) { }
      connection.release();
    }
    console.error('Check payment status error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Cancel payment
router.post('/cancel-payment', async (req, res) => {
  let connection;

  try {
    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({
        success: false,
        error: 'Transaction ID required'
      });
    }

    connection = await pool.getConnection();

    // Update transaksi ke cancelled
    await connection.execute(
      'UPDATE transaction SET Payment_Status = ? WHERE Transaction_ID = ?',
      ['cancelled', transactionId]
    );

    connection.release();
    console.log('Transaction cancelled:', transactionId);

    res.json({ success: true });
  } catch (error) {
    if (connection) connection.release();
    console.error('Cancel payment error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;