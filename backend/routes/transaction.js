const express = require('express');
const { pool } = require('../config/database.js');
const iakService = require('../services/iakService');

const router = express.Router();

// Create transaction untuk isi pulsa
router.post('/create-pulsa', async (req, res) => {
  let connection;

  try {
    const {
      customerId,
      rfidCardId,
      productDetailId,
      targetPhone,
      paymentMethod
    } = req.body;

    // Validation
    if (!customerId || !productDetailId || !targetPhone || !paymentMethod) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Get product detail
    const [productDetail] = await connection.execute(
      'SELECT * FROM Product_Detail WHERE Product_Detail_ID = ?',
      [productDetailId]
    );

    if (productDetail.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: 'Product not found'
      });
    }

    const product = productDetail[0];
    const transactionCode = `TRX${Date.now()}`;

    // Jika bayar dengan saldo RFID, cek saldo
    if (paymentMethod === 'saldo_rfid' && rfidCardId) {

      console.log('=== DEBUG RFID CHECK ===');
      console.log('Looking for rfidCardId:', rfidCardId);
      console.log('Customer ID:', customerId);
      console.log('Product price:', product.Selling_Price);

      const [allRfidCards] = await connection.execute(
        'SELECT * FROM RFID_Card WHERE Customer_ID = ?',
        [customerId]
      );
      console.log('All RFID Cards for customer:', allRfidCards);

      const [rfidCard] = await connection.execute(
        'SELECT * FROM RFID_Card WHERE RFID_Card_ID = ?',
        [rfidCardId]
      );

      console.log('RFID Card found:', rfidCard);

      if (rfidCard.length > 0) {
        console.log('Balance check:', {
          balance: rfidCard[0].Balance,
          balanceType: typeof rfidCard[0].Balance,
          price: product.Selling_Price,
          priceType: typeof product.Selling_Price,
          status: rfidCard[0].Status,
          numberBalance: Number(rfidCard[0].Balance),
          numberPrice: Number(product.Selling_Price),
          comparison: Number(rfidCard[0].Balance) >= Number(product.Selling_Price)
        });
      }
      console.log('=== END DEBUG ===');

      if (rfidCard.length === 0 || Number(rfidCard[0].Balance) < Number(product.Selling_Price)) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: 'Insufficient RFID balance'
        });
      }
    }

    //ISI PULSA VIA SALDO RFID
    const [transactionResult] = await connection.execute(
      `INSERT INTO Transaction (
    Customer_ID, RFID_Card_ID, Transaction_Code, Transaction_Type,
    Total_Amount, Payment_Method, Payment_Status, SIM_ID, 
    Target_Phone_Number, Product_Detail_ID
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerId, rfidCardId, transactionCode, 'isi_pulsa',
        product.Selling_Price, paymentMethod, 'pending', null,
        targetPhone, productDetailId
      ]
    );

    const transactionId = transactionResult.insertId;


    // Jika bayar dengan saldo RFID, langsung proses ke IAK
    if (paymentMethod === 'saldo_rfid') {
      console.log('Processing IAK top-up:', {
        phone: targetPhone,
        productCode: product.IAK_Product_Code,
        refId: transactionCode
      });

      // Call IAK API
      const iakResult = await iakService.topUpPulsa(
        targetPhone,
        product.IAK_Product_Code,
        transactionCode
      );

      console.log('IAK Result received:', iakResult);

      const iakResponseCode = iakResult.data?.rc;
      const iakStatus = iakResult.data?.status;

      console.log('IAK Response Code:', iakResponseCode);
      console.log('IAK Status:', iakStatus);

      // ==========================================
      // FIX: Accept status 0 (PROCESS), 1 (SUCCESS), dan '00' (SUCCESS)
      // ==========================================
      // Status IAK: 0 = processing, 1 = success, 2 = failed
      // Response Code: '00' = success
      if (iakResult.success && (iakResponseCode === '00' || iakStatus === 1 || iakStatus === 0)) {
        console.log('IAK transaction accepted - Processing or Success');

        // Update transaction status
        await connection.execute(
          'UPDATE Transaction SET Payment_Status = ? WHERE Transaction_ID = ?',
          ['success', transactionId]
        );

        ['success', iakResult.transactionId, transactionId]

        // Ambil saldo RFID untuk update
        const [rfidCard] = await connection.execute(
          'SELECT Balance FROM RFID_Card WHERE RFID_Card_ID = ?',
          [rfidCardId]
        );

        const balanceBefore = Number(rfidCard[0].Balance);
        const balanceAfter = balanceBefore - Number(product.Selling_Price);

        // Update RFID balance
        await connection.execute(
          'UPDATE RFID_Card SET Balance = ? WHERE RFID_Card_ID = ?',
          [balanceAfter, rfidCardId]
        );

        // Add balance history
        await connection.execute(
          `INSERT INTO Balance_History (
            RFID_Card_ID, Transaction_ID, Transaction_Type,
            Amount, Balance_Before, Balance_After
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [rfidCardId, transactionId, 'deduction', Number(product.Selling_Price), balanceBefore, balanceAfter]
        );

        await connection.commit();

        console.log('Transaction committed successfully');

        // ==========================================
        // Return response based on IAK status
        // ==========================================
        const message = iakStatus === 0
          ? 'Pulsa sedang diproses ke nomor tujuan...'
          : 'Pulsa berhasil diisi!';

        res.json({
          success: true,
          message: message,
          data: {
            transactionId,
            transactionCode,
            amount: product.Selling_Price,
            targetPhone,
            newBalance: balanceAfter,
            iakStatus: iakStatus === 0 ? 'PROCESSING' : 'SUCCESS',
            iakResponse: iakResult.data
          }
        });

      } else {
        // IAK failed (status 2 atau error lainnya)
        console.log('IAK transaction FAILED:', {
          rc: iakResponseCode,
          status: iakStatus,
          message: iakResult.data?.message,
          error: iakResult.error
        });

        // Update transaction status to failed
        await connection.execute(
          'UPDATE Transaction SET Payment_Status = ? WHERE Transaction_ID = ?',
          ['failed', transactionId]
        );

        await connection.execute(
          'UPDATE Transaction_Detail SET Status = ? WHERE Transaction_ID = ?',
          ['failed', transactionId]
        );

        await connection.commit();

        // Return error response
        res.status(400).json({
          success: false,
          error: iakResult.data?.message || iakResult.error || 'Gagal mengisi pulsa',
          iakResponseCode: iakResponseCode,
          iakStatus: iakStatus,
          transactionCode,
          details: iakResult.data
        });
      }

    } else {
      // Payment method lain (QRIS/cash), return pending
      await connection.commit();

      res.json({
        success: true,
        message: 'Transaction created, waiting for payment',
        data: {
          transactionId,
          transactionCode,
          amount: product.Selling_Price,
          paymentMethod,
          targetPhone: targetPhone
        }
      });
    }

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Create pulsa transaction error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Check IAK balance (untuk admin/kasir)
router.get('/iak-balance', async (req, res) => {
  try {
    const result = await iakService.checkBalance();
    res.json(result);
  } catch (error) {
    console.error('Check IAK balance error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get IAK price list
router.get('/iak-pricelist', async (req, res) => {
  try {
    const result = await iakService.getPriceList();
    res.json(result);
  } catch (error) {
    console.error('Get IAK price list error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Transaction service is healthy',
    timestamp: new Date().toISOString(),
    service: 'transaction-api'
  });
});

// Get transaction history
router.get('/history/:customerId', async (req, res) => {
  let connection;

  try {
    const { customerId } = req.params;
    const { limit = 10, offset = 0 } = req.query;

    connection = await pool.getConnection();

    const [transactions] = await connection.execute(`
  SELECT 
    t.Transaction_ID,
    t.Transaction_Code,
    t.Transaction_Type,
    t.Total_Amount,
    t.Payment_Method,
    t.Payment_Status,
    t.Created_At,
    t.Target_Phone_Number,
    pd.Detail_Name as Product_Name,
    pd.Nominal as Denomination  
  FROM Transaction t
  LEFT JOIN Product_Detail pd ON t.Product_Detail_ID = pd.Product_Detail_ID
  WHERE t.Customer_ID = ?
  ORDER BY t.Created_At DESC
  LIMIT ? OFFSET ?
`, [customerId, parseInt(limit), parseInt(offset)]);

    res.json({
      success: true,
      data: transactions,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: transactions.length
      }
    });

  } catch (error) {
    console.error('Get transaction history error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Get transaction detail by ID
router.get('/detail/:transactionId', async (req, res) => {
  let connection;

  try {
    const { transactionId } = req.params;

    connection = await pool.getConnection();

    const [transactions] = await connection.execute(`
  SELECT 
    t.*,
    c.Customer_Name,
    rc.Card_Number,
    pd.Product_Name,
    pd.Denomination,
    pd.Provider
  FROM Transaction t
  LEFT JOIN Customer c ON t.Customer_ID = c.Customer_ID
  LEFT JOIN RFID_Card rc ON t.RFID_Card_ID = rc.RFID_Card_ID
  LEFT JOIN Product_Detail pd ON t.Product_Detail_ID = pd.Product_Detail_ID
  WHERE t.Transaction_ID = ?
`, [transactionId]);

    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      data: transactions[0]
    });

  } catch (error) {
    console.error('Get transaction detail error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});


// Export router
module.exports = router;