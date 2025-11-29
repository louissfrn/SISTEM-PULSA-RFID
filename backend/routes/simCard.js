const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const midtransService = require('../services/midtransService');

// POST /api/sim/purchase-qris
router.post('/purchase-qris', async (req, res) => {
  let connection;
  try {
    const { simId, phoneNumber, provider, integrateWithRfid, amount, customerName, customerEmail } = req.body;

    if (!simId || !amount || amount < 10000) {
      return res.status(400).json({
        success: false,
        error: 'Data tidak valid atau jumlah minimal Rp 10.000'
      });
    }

    // Validasi customer info
    if (!customerName || !customerEmail) {
      return res.status(400).json({
        success: false,
        error: 'Nama customer dan email wajib diisi'
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [simCheck] = await connection.execute(
      'SELECT * FROM sim_card WHERE SIM_ID = ? AND Status = ?',
      [simId, 'available']
    );

    if (simCheck.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: 'Kartu SIM sudah terjual atau tidak tersedia'
      });
    }

    // ==========================================
    // STEP 1: Insert atau cek customer
    // ==========================================
    const [existingCustomer] = await connection.execute(
      'SELECT Customer_ID FROM customer WHERE Phone_Number = ? AND Email = ?',
      [phoneNumber, customerEmail]
    );

    let customerId;
    if (existingCustomer.length > 0) {
      customerId = existingCustomer[0].Customer_ID;
      console.log('Customer sudah ada:', customerId);
    } else {
      const [customerResult] = await connection.execute(
        `INSERT INTO customer (Name, Phone_Number, Email, Status, Registration_Date, Updated_at)
         VALUES (?, ?, ?, 'active', NOW(), NOW())`,
        [customerName.trim(), phoneNumber, customerEmail.trim()]
      );
      customerId = customerResult.insertId;
      console.log('Customer baru dibuat:', { customerId, customerName, phoneNumber, customerEmail });
    }

    const transactionCode = `SIM${Date.now()}`;
    const transactionType = 'beli_sim';

    // ==========================================
    // STEP 2: INSERT ke transaction dengan Customer_ID
    // ==========================================
    const [txResult] = await connection.execute(
  `INSERT INTO transaction (
    Customer_ID, Transaction_Code, Transaction_Type, Total_Amount,
    Payment_Method, Payment_Status, SIM_ID, Target_Phone_Number, Product_Detail_ID, Created_at, Updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
  [customerId, transactionCode, transactionType, amount, 'qris', 'pending', simId, phoneNumber, null]
);
const transactionId = txResult.insertId;

const [rfidResult] = await connection.execute(
  `INSERT INTO rfid_card (
    Customer_ID, RFID_Code, Balance, Status, 
    Issue_Date, Created_at, Updated_at
  ) VALUES (?, ?, ?, ?, NOW(), NOW(), NOW())`,
  [customerId, null, 0, 'pending']
);

const rfidCardId = rfidResult.insertId;

await connection.execute(
  'UPDATE transaction SET RFID_Card_ID = ? WHERE Transaction_ID = ?',
  [rfidCardId, transactionId]
);

const paymentResult = await midtransService.createSimPayment(
  transactionId,
  amount,
  {
    simId,
    phoneNumber,
    provider,
    customerName,
    customerEmail
  }
);

if (paymentResult.success) {
  await connection.commit();
  console.log('SIM QRIS Purchase created:', {
    transactionId,
    rfidCardId,
    customerId,
    customerName,
    simId,
    phoneNumber
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
    console.error('Create SIM QRIS payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    if (connection) connection.release();
  }
});

// POST /api/sim/purchase-cash
router.post('/purchase-cash', async (req, res) => {
  let connection;
  try {
    const { simId, phoneNumber, provider, integrateWithRfid, amount, customerName, customerEmail } = req.body;

    if (!simId || !amount || amount < 10000) {
      return res.status(400).json({
        success: false,
        error: 'Data tidak valid atau jumlah minimal Rp 10.000'
      });
    }

    // Validasi customer info
    if (!customerName || !customerEmail) {
      return res.status(400).json({
        success: false,
        error: 'Nama customer dan email wajib diisi'
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [simCheck] = await connection.execute(
      'SELECT * FROM sim_card WHERE SIM_ID = ? AND Status = ?',
      [simId, 'available']
    );

    if (simCheck.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: 'Kartu SIM sudah terjual atau tidak tersedia'
      });
    }

    // ==========================================
    // STEP 1: Insert atau cek customer
    // ==========================================
    const [existingCustomer] = await connection.execute(
      'SELECT Customer_ID FROM customer WHERE Phone_Number = ? AND Email = ?',
      [phoneNumber, customerEmail]
    );

    let customerId;
    if (existingCustomer.length > 0) {
      customerId = existingCustomer[0].Customer_ID;
      console.log('Customer sudah ada:', customerId);
    } else {
      const [customerResult] = await connection.execute(
        `INSERT INTO customer (Name, Phone_Number, Email, Status, Registration_Date, Updated_at)
         VALUES (?, ?, ?, 'active', NOW(), NOW())`,
        [customerName.trim(), phoneNumber, customerEmail.trim()]
      );
      customerId = customerResult.insertId;
      console.log('Customer baru dibuat:', { customerId, customerName, phoneNumber, customerEmail });
    }

    const transactionCode = `SIM${Date.now()}`;
    const transactionType = 'beli_sim';

    // ==========================================
    // STEP 2: INSERT ke transaction dengan Customer_ID
    // ==========================================
  const [txResult] = await connection.execute(
  `INSERT INTO transaction (
    Customer_ID, Transaction_Code, Transaction_Type, Total_Amount,
    Payment_Method, Payment_Status, SIM_ID, Target_Phone_Number, Product_Detail_ID, Created_at, Updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
  [customerId, transactionCode, transactionType, amount, 'cash', 'pending', simId, phoneNumber, null]
);

const transactionId = txResult.insertId;

const [rfidResult] = await connection.execute(
  `INSERT INTO rfid_card (
    Customer_ID, RFID_Code, Balance, Status, 
    Issue_Date, Created_at, Updated_at
  ) VALUES (?, ?, ?, ?, NOW(), NOW(), NOW())`,
  [customerId, null, 0, 'pending']
);

const rfidCardId = rfidResult.insertId;

await connection.execute(
  'UPDATE transaction SET RFID_Card_ID = ? WHERE Transaction_ID = ?',
  [rfidCardId, transactionId]
);

await connection.execute(
  'UPDATE sim_card SET Status = ?, Updated_at = NOW() WHERE SIM_ID = ?',
  ['reserved', simId]
);

await connection.commit();

console.log('SIM Cash Purchase created:', {
  transactionId,
  rfidCardId,
  customerId,
  customerName,
  simId,
  phoneNumber
});

res.json({
  success: true,
  transaction_id: transactionId,
  transaction_code: transactionCode,
  rfid_card_id: rfidCardId,
  message: 'Silakan lakukan pembayaran di kasir dan ambil kartu SIM Anda'
});
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Create SIM cash payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    if (connection) connection.release();
  }
});

// GET /api/sim/transaction/:transactionId
router.get('/transaction/:transactionId', async (req, res) => {
  let connection;
  try {
    const { transactionId } = req.params;
    connection = await pool.getConnection();

    const [transaction] = await connection.execute(
      'SELECT * FROM transaction WHERE Transaction_ID = ?',
      [transactionId]
    );

    if (transaction.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Transaksi tidak ditemukan'
      });
    }

    res.json({
      success: true,
      data: transaction[0]
    });
  } catch (error) {
    console.error('Get SIM transaction error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    if (connection) connection.release();
  }
});

// POST /api/sim/payment-notification
router.post('/payment-notification', async (req, res) => {
  let connection;
  try {
    const notification = req.body;
    const result = await midtransService.handleNotification(notification);

    if (result.success) {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const orderId = result.order_id;
      const paymentStatus = result.payment_status;

      const transactionIdMatch = orderId.match(/SIM-(\d+)-/);
      if (!transactionIdMatch) {
        await connection.rollback();
        return res.status(400).json({ error: 'Invalid order ID format' });
      }

      const transactionId = transactionIdMatch[1];

      if (paymentStatus === 'success') {
        // Update transaction status
        await connection.execute(
          'UPDATE transaction SET Payment_Status = ?, Updated_at = NOW() WHERE Transaction_ID = ?',
          ['success', transactionId]
        );

        // Get transaction details with customer info
        const [txData] = await connection.execute(
          `SELECT 
            t.*,
            c.Customer_ID,
            c.Name as Customer_Name,
            c.Phone_Number as Customer_Phone,
            c.Email as Customer_Email,
            t.SIM_ID,
            t.Target_Phone_Number as Phone_Number
          FROM transaction t
          LEFT JOIN customer c ON t.Customer_ID = c.Customer_ID
          WHERE t.Transaction_ID = ?`,
          [transactionId]
        );

        if (txData.length > 0) {
          const tx = txData[0];

          // Update SIM status jadi sold
          if (tx.SIM_ID) {
            await connection.execute(
              'UPDATE sim_card SET Status = ?, Updated_at = NOW() WHERE SIM_ID = ?',
              ['sold', tx.SIM_ID]
            );
            console.log('SIM card status updated to sold:', tx.SIM_ID);
          }

          // CREATE RFID CARD dengan status "pending" (waiting admin activation)
          const customerId = tx.Customer_ID;

          if (customerId) {
            console.log('🔄 Creating RFID card for QRIS payment...');

            // Check existing RFID card
            const [existingRfidCards] = await connection.execute(
              'SELECT * FROM rfid_card WHERE Customer_ID = ?',
              [customerId]
            );

            if (existingRfidCards.length === 0) {
              // Create new RFID card with status "pending"
              const [insertResult] = await connection.execute(
                `INSERT INTO rfid_card (
                  Customer_ID, RFID_Code, Balance, Status, 
                  Issue_Date, Created_at, Updated_at
                ) VALUES (?, ?, ?, ?, NOW(), NOW(), NOW())`,
                [customerId, null, 0, 'pending']
              );

              console.log('RFID card created (pending activation):', {
                rfidCardId: insertResult.insertId,
                customerId,
                customerName: tx.Customer_Name
              });
            } else {
              // Update existing RFID card to pending if not active
              const rfidCard = existingRfidCards[0];
              if (rfidCard.Status !== 'active') {
                await connection.execute(
                  `UPDATE rfid_card 
                   SET Status = 'pending', Updated_at = NOW()
                   WHERE RFID_Card_ID = ?`,
                  [rfidCard.RFID_Card_ID]
                );

                console.log('RFID card updated to pending:', {
                  rfidCardId: rfidCard.RFID_Card_ID,
                  customerId
                });
              }
            }
          }
        }
      } else if (paymentStatus === 'failed') {
        await connection.execute(
          'UPDATE transaction SET Payment_Status = ?, Updated_at = NOW() WHERE Transaction_ID = ?',
          ['failed', transactionId]
        );

        // Kembalikan SIM status jadi available
        const [txDetail] = await connection.execute(
          'SELECT SIM_ID FROM transaction WHERE Transaction_ID = ?',
          [transactionId]
        );

        if (txDetail.length > 0 && txDetail[0].SIM_ID) {
          await connection.execute(
            'UPDATE sim_card SET Status = ?, Updated_at = NOW() WHERE SIM_ID = ?',
            ['available', txDetail[0].SIM_ID]
          );
        }
      }

      await connection.commit();
      res.json({ status: 'ok' });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('SIM payment notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (connection) connection.release();
  }
});

// GET /api/sim/admin/pending-sim
router.get('/admin/pending-sim', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    // Get both: 
    // 1. Cash payment (pending in transaction)
    // 2. QRIS payment (success transaction but pending RFID activation)
    const [purchases] = await connection.execute(
      `SELECT 
  t.Transaction_ID,
  t.Transaction_Code,
  t.Transaction_Type,
  t.Total_Amount,
  t.Payment_Method,
  t.Payment_Status,
  c.Name as Customer_Name,
  c.Phone_Number as Customer_Phone,
  c.Customer_ID,
  c.Email as Customer_Email,
  t.Target_Phone_Number as Phone_Number,
  r.RFID_Card_ID,
  r.Status as RFID_Status,
  'Beli SIM' as Product_Type,
  t.Created_at
 FROM transaction t
 LEFT JOIN customer c ON t.Customer_ID = c.Customer_ID
 LEFT JOIN rfid_card r ON c.Customer_ID = r.Customer_ID
 WHERE t.Transaction_Type = 'beli_sim'
 AND t.Payment_Status = 'success'
 AND (r.Status = 'pending' OR r.Status IS NULL)
 ORDER BY t.Created_at DESC`
    );

    console.log('Raw purchases from DB:', purchases);
    console.log('Total rows:', purchases.length);

    const formattedData = purchases.map(p => ({
      Customer_ID: p.Customer_ID,
      Type: 'sim',
      Name: p.Customer_Name,
      Phone_Number: p.Phone_Number,
      Email: p.Customer_Email,
      Registration_Date: p.Created_at,
      Transaction_ID: p.Transaction_ID,
      Transaction_Code: p.Transaction_Code,
      Payment_Method: p.Payment_Method,
      Payment_Status: p.Payment_Status,
      RFID_Status: p.RFID_Status
    }));

    console.log('Formatted data:', formattedData);

    res.json({
      success: true,
      data: formattedData
    });
  } catch (error) {
    console.error('Get pending SIM transactions error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    if (connection) connection.release();
  }
});

// POST /api/sim/admin/confirm-sim-payment
router.post('/admin/confirm-sim-payment', async (req, res) => {
  let connection;
  try {
    const { transactionId, rfidCode, adminId } = req.body;

    if (!transactionId || !adminId) {
      return res.status(400).json({
        success: false,
        error: 'Transaction ID dan Admin ID wajib diisi'
      });
    }

    if (!rfidCode) {
      return res.status(400).json({
        success: false,
        error: 'RFID Code diperlukan untuk integrasi SIM dengan RFID'
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [transaction] = await connection.execute(`
      SELECT 
        t.*,
        c.Customer_ID,
        c.Name as Customer_Name,
        c.Phone_Number as Customer_Phone,
        c.Email as Customer_Email,
        t.SIM_ID,
        t.Target_Phone_Number as Phone_Number
      FROM transaction t
      LEFT JOIN customer c ON t.Customer_ID = c.Customer_ID
      WHERE t.Transaction_ID = ?
    `, [transactionId]);

    if (transaction.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        error: 'Transaksi tidak ditemukan'
      });
    }

    const txData = transaction[0];
    const customerId = txData.Customer_ID;

    if (!customerId) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: 'Customer data tidak lengkap di transaksi'
      });
    }

    console.log('Processing SIM payment confirmation:', {
      transactionId,
      customerId,
      customerName: txData.Customer_Name,
      simId: txData.SIM_ID,
      rfidCode
    });

    // Update transaction status (for cash payment)
    if (txData.Payment_Status === 'pending') {
      await connection.execute(
        'UPDATE transaction SET Payment_Status = ?, Updated_at = NOW() WHERE Transaction_ID = ?',
        ['success', transactionId]
      );
    }

    if (txData.SIM_ID) {
      await connection.execute(
        'UPDATE sim_card SET Status = ?, Updated_at = NOW() WHERE SIM_ID = ?',
        ['sold', txData.SIM_ID]
      );
      console.log('SIM card status updated to sold:', txData.SIM_ID);
    }

    console.log('Checking existing RFID card for customer:', customerId);

    const [existingRfidCards] = await connection.execute(
      'SELECT * FROM rfid_card WHERE Customer_ID = ?',
      [customerId]
    );

    let rfidCard;

    if (existingRfidCards.length === 0) {
      console.log('Creating new RFID card for SIM purchase...');

      const [insertResult] = await connection.execute(
        `INSERT INTO rfid_card (
      Customer_ID, RFID_Code, Balance, Status, 
      Issue_Date, Activated_At, Activated_By, Created_at, Updated_at
    ) VALUES (?, ?, ?, ?, NOW(), NOW(), ?, NOW(), NOW())`,
        [customerId, rfidCode, 0, 'active', adminId]
      );

      rfidCard = {
        RFID_Card_ID: insertResult.insertId,
        RFID_Code: rfidCode,
        Balance: 0,
        Status: 'active'
      };

      console.log('RFID card created for SIM purchase:', {
        rfidCardId: rfidCard.RFID_Card_ID,
        customerId,
        rfidCode
      });

    } else {
      console.log('Updating existing RFID card for SIM purchase...');

      rfidCard = existingRfidCards[0];

      // FIX #2: CEK apakah status sudah 'active' → REJECT!
      if (rfidCard.Status === 'active') {
        await connection.rollback();
        console.error('RFID card sudah aktif:', {
          rfidCardId: rfidCard.RFID_Card_ID,
          status: rfidCard.Status
        });

        return res.status(400).json({
          success: false,
          error: 'RFID card sudah aktif sebelumnya. Tidak bisa di-aktivasi lagi!'
        });
      }

      // UPDATE RFID card
      await connection.execute(
        `UPDATE rfid_card 
     SET RFID_Code = ?, Status = 'active', Activated_At = NOW(), Activated_By = ?, Updated_at = NOW()
     WHERE RFID_Card_ID = ?`,
        [rfidCode, adminId, rfidCard.RFID_Card_ID]
      );

      // FIX #1: UPDATE object rfidCard dengan RFID_Code baru
      rfidCard.RFID_Code = rfidCode;
      rfidCard.Status = 'active';

      console.log('RFID card updated for SIM purchase:', {
        rfidCardId: rfidCard.RFID_Card_ID,
        customerId,
        rfidCode,
        status: 'active'
      });
    }

    const [customerData] = await connection.execute(
      'SELECT Status FROM customer WHERE Customer_ID = ?',
      [customerId]
    );

    if (customerData.length > 0 && customerData[0].Status !== 'active') {
      await connection.execute(
        'UPDATE customer SET Status = "active", Updated_at = NOW() WHERE Customer_ID = ?',
        [customerId]
      );
      console.log('Customer status updated to active');
    }

    await connection.commit();

    console.log('SIM payment confirmation success:', {
      transactionId,
      customerId,
      rfidCardId: rfidCard.RFID_Card_ID,
      rfidCode: rfidCard.RFID_Code
    });

    res.json({
      success: true,
      message: 'Pembayaran SIM berhasil dikonfirmasi! RFID card telah dibuat dan terintegrasi.',
      data: {
        transactionId,
        transactionCode: txData.Transaction_Code,
        customerName: txData.Customer_Name,
        phoneNumber: txData.Phone_Number,
        rfidCardId: rfidCard.RFID_Card_ID,
        rfidCode: rfidCard.RFID_Code,
        balance: rfidCard.Balance,
        status: 'active',
        activatedAt: new Date()
      }
    });

  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError);
      }
    }
    console.error('Confirm SIM payment error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Gagal mengonfirmasi pembayaran SIM',
      details: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }

});

module.exports = router;