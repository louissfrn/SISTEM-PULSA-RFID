const express = require('express');
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');
const iakService = require('../services/iakService');
const router = express.Router();

// ==========================================
// CREATE NEW ADMIN 
// ==========================================
router.post('/create-admin', async (req, res) => {
  let connection;

  try {
    const { username, fullName, password, confirmPassword, role } = req.body;

    if (!username || !fullName || !password || !confirmPassword || !role) {
      return res.status(400).json({
        success: false,
        error: 'Semua field wajib diisi'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Password dan konfirmasi password tidak cocok'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password minimal 6 karakter'
      });
    }

    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({
        success: false,
        error: 'Password harus mengandung minimal 1 huruf besar (A-Z)'
      });
    }

   
    if (!/[a-z]/.test(password)) {
      return res.status(400).json({
        success: false,
        error: 'Password harus mengandung minimal 1 huruf kecil (a-z)'
      });
    }

 
    if (!/[0-9]/.test(password)) {
      return res.status(400).json({
        success: false,
        error: 'Password harus mengandung minimal 1 angka (0-9)'
      });
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return res.status(400).json({
        success: false,
        error: 'Password harus mengandung minimal 1 simbol (!@#$%^&*()_+-=[]{}|;:\'",.<>/?)'
      });
    }

  
    if (!['administrator', 'kasir'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Role tidak valid. Pilih: administrator atau kasir'
      });
    }

    connection = await pool.getConnection();

    const [existingAdmin] = await connection.execute(
      'SELECT Admin_ID FROM admin WHERE Username = ?',
      [username]
    );

    if (existingAdmin.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Username sudah terdaftar'
      });
    }
  
    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await connection.execute(
      `INSERT INTO admin (Username, Password_hash, Full_Name, Role, Status, Created_at, Updated_at)
       VALUES (?, ?, ?, ?, 'active', NOW(), NOW())`,
      [username, hashedPassword, fullName, role]
    );

    console.log('Admin berhasil dibuat:', {
      adminId: result.insertId,
      username,
      fullName,
      role
    });

    res.json({
      success: true,
      message: 'Admin berhasil dibuat',
      data: {
        adminId: result.insertId,
        username,
        fullName,
        role,
        status: 'active'
      }
    });

  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({
      success: false,
      error: 'Gagal membuat admin'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// ==========================================
// GET ALL ADMINS
// ==========================================
router.get('/list', async (req, res) => {
  let connection;

  try {
    connection = await pool.getConnection();

    const [admins] = await connection.execute(
      `SELECT 
        Admin_ID,
        Username,
        Full_Name,
        Role,
        Status,
        Last_Login,
        Created_at,
        Updated_at
       FROM admin
       ORDER BY Created_at DESC`
    );

    res.json({
      success: true,
      count: admins.length,
      data: admins
    });

  } catch (error) {
    console.error('Get admins list error:', error);
    res.status(500).json({
      success: false,
      error: 'Gagal mengambil data admin'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// ==========================================
// ADMIN LOGIN
// ==========================================
router.post('/login', async (req, res) => {
  let connection;

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username dan password wajib diisi'
      });
    }

    connection = await pool.getConnection();

    const [admins] = await connection.execute(
      'SELECT * FROM admin WHERE Username = ? AND Status = "active"',
      [username]
    );

    if (admins.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Username atau password salah'
      });
    }

    const admin = admins[0];

    // Compare password dengan bcrypt
    const passwordMatch = await bcrypt.compare(password, admin.Password_hash);

    if (passwordMatch) {
      await connection.execute(
        'UPDATE admin SET Last_Login = NOW() WHERE Admin_ID = ?',
        [admin.Admin_ID]
      );

      console.log('Admin login success:', {
        adminId: admin.Admin_ID,
        username: admin.Username,
        role: admin.Role
      });

      res.json({
        success: true,
        message: 'Login berhasil',
        data: {
          adminId: admin.Admin_ID,
          username: admin.Username,
          fullName: admin.Full_Name,
          role: admin.Role
        }
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Username atau password salah'
      });
    }

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      error: 'Terjadi kesalahan saat login'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});
// ==========================================
// GET PENDING CUSTOMERS + SIM PURCHASE SUCCESS (FIXED v3)
// ==========================================
// GET /api/admin/customers/pending
router.get('/customers/pending', async (req, res) => {
  let connection;

  try {
    connection = await pool.getConnection();

    // HANYA ambil customer yang:
    // 1. Status = 'pending' (belum diaktivasi)
    // 2. TIDAK punya RFID card yang active
    const [customers] = await connection.execute(`
      SELECT 
        c.Customer_ID,
        c.Name,
        c.Phone_Number,
        c.Email,
        c.Status,
        c.Registration_Date,
        'customer' as Type
      FROM customer c
      WHERE c.Status = 'pending'
      AND c.Customer_ID NOT IN (
        SELECT DISTINCT Customer_ID 
        FROM rfid_card 
        WHERE Status = 'active'
      )
      ORDER BY c.Registration_Date DESC
    `);

    res.json({
      success: true,
      data: customers
    });
  } catch (error) {
    console.error('Get pending customers error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    if (connection) connection.release();
  }
});

// ==========================================
// GET PENDING COUNT (customer + SIM) - FIXED
// ==========================================
router.get('/customers/pending-count', async (req, res) => {
  let connection;

  try {
    connection = await pool.getConnection();

    // Count customer pending - EXCLUDE yang sudah punya RFID active
    const [customerResult] = await connection.execute(
      `SELECT COUNT(DISTINCT c.Customer_ID) as count
       FROM customer c
       WHERE c.Status = 'pending'
       AND c.Customer_ID NOT IN (
         SELECT DISTINCT Customer_ID 
         FROM rfid_card 
         WHERE Status = 'active'
       )`
    );

    // FIX: Count SIM yang payment SUCCESS tapi RFID masih PENDING
    const [simResult] = await connection.execute(
      `SELECT COUNT(DISTINCT t.Transaction_ID) as count
       FROM transaction t
       LEFT JOIN customer c ON t.Customer_ID = c.Customer_ID
       LEFT JOIN rfid_card r ON c.Customer_ID = r.Customer_ID
       WHERE t.Transaction_Type = 'beli_sim'
       AND t.Payment_Status = 'success'
       AND r.Status = 'pending'`
    );

    const customerCount = customerResult[0].count || 0;
    const simCount = simResult[0].count || 0;
    const totalCount = customerCount + simCount;

    console.log(`Pending Count: Customer=${customerCount}, SIM=${simCount}, Total=${totalCount}`);

    res.json({
      success: true,
      data: {
        customerCount,
        simCount,
        totalCount
      }
    });

  } catch (error) {
    console.error('Get pending count error:', error);
    res.status(500).json({
      success: false,
      error: 'Gagal mengambil jumlah pending'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// ==========================================
// ACTIVATE RFID (OPSI 2 - CREATE IF NOT EXISTS)
// ==========================================
router.post('/activate-rfid', async (req, res) => {
  let connection;

  try {
    const { customerId, rfidCode, adminId } = req.body;

    if (!customerId || !rfidCode || !adminId) {
      return res.status(400).json({
        success: false,
        error: 'Data tidak lengkap. Customer ID, RFID Code, dan Admin ID wajib diisi'
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // ==========================================
    // STEP 1: Validasi customer
    // ==========================================
    const [customers] = await connection.execute(
      'SELECT * FROM customer WHERE Customer_ID = ?',
      [customerId]
    );

    if (customers.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        error: 'Customer tidak ditemukan'
      });
    }

    const customer = customers[0];

    if (customer.Status !== 'pending') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: `Customer sudah berstatus ${customer.Status}`
      });
    }

    // ==========================================
    // STEP 2: Check apakah RFID code sudah terdaftar di customer lain
    // ==========================================
    const [existingRfidCode] = await connection.execute(
      'SELECT RFID_Card_ID, Customer_ID FROM rfid_card WHERE RFID_Code = ?',
      [rfidCode]
    );

    if (existingRfidCode.length > 0 && existingRfidCode[0].Customer_ID !== customerId) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: 'Nomor RFID sudah terdaftar untuk customer lain. Gunakan kartu lain.'
      });
    }

    // ==========================================
    // STEP 3: Cek apakah customer sudah punya RFID card
    // ==========================================
    const [existingRfidCards] = await connection.execute(
      'SELECT * FROM rfid_card WHERE Customer_ID = ?',
      [customerId]
    );

    let rfidCard;

    if (existingRfidCards.length === 0) {
      // OPTION 2: CREATE RFID CARD JIKA BELUM ADA
      console.log('Creating new RFID card for customer:', customerId);

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

      console.log('RFID card created:', {
        rfidCardId: rfidCard.RFID_Card_ID,
        customerId,
        rfidCode
      });

    } else {
      // RFID CARD SUDAH ADA, TINGGAL UPDATE
      rfidCard = existingRfidCards[0];
      console.log('Updating existing RFID card for customer:', customerId);

      // Check jika sudah aktif
      if (rfidCard.Status === 'active') {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: 'RFID card customer sudah aktif sebelumnya'
        });
      }

      // Update RFID card
      await connection.execute(
        `UPDATE rfid_card 
         SET RFID_Code = ?, Status = ?, Activated_At = NOW(), Activated_By = ?, Updated_at = NOW()
         WHERE RFID_Card_ID = ?`,
        [rfidCode, 'active', adminId, rfidCard.RFID_Card_ID]
      );

      console.log('RFID card updated:', {
        rfidCardId: rfidCard.RFID_Card_ID,
        customerId,
        rfidCode
      });
    }

    // ==========================================
    // STEP 4: Update customer status to ACTIVE
    // ==========================================
    await connection.execute(
      'UPDATE customer SET Status = "active", Updated_at = NOW() WHERE Customer_ID = ?',
      [customerId]
    );

    await connection.commit();

    console.log('RFID activation success:', {
      customerId,
      customerName: customer.Name,
      rfidCardId: rfidCard.RFID_Card_ID,
      rfidCode,
      activatedBy: adminId
    });

    res.json({
      success: true,
      message: 'Aktivasi RFID berhasil! Customer sekarang dapat menggunakan kartu',
      data: {
        customerId,
        customerName: customer.Name,
        phoneNumber: customer.Phone_Number,
        rfidCardId: rfidCard.RFID_Card_ID,
        rfidCode: rfidCard.RFID_Code,
        balance: rfidCard.Balance || 0,
        status: 'active',
        activatedAt: new Date()
      }
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Activate RFID error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Gagal melakukan aktivasi RFID',
      details: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// ==========================================
// REJECT RFID ACTIVATION - UPDATE
// ==========================================
router.post('/reject-rfid-activation', async (req, res) => {
  let connection;

  try {
    const { customerId, adminId } = req.body;

    if (!customerId || !adminId) {
      return res.status(400).json({
        success: false,
        error: 'Customer ID dan Admin ID diperlukan'
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Get customer
    const [customers] = await connection.execute(
      'SELECT * FROM customer WHERE Customer_ID = ?',
      [customerId]
    );

    if (customers.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        error: 'Customer tidak ditemukan'
      });
    }

    const customer = customers[0];

    if (customer.Status !== 'pending') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: 'Hanya customer dengan status pending yang bisa di-reject'
      });
    }

    // HAPUS CUSTOMER YANG DI-REJECT
    await connection.execute(
      'DELETE FROM customer WHERE Customer_ID = ?',
      [customerId]
    );

    await connection.commit();

    console.log('RFID activation rejected:', {
      customerId,
      customerName: customer.Name,
      rejectedBy: adminId
    });

    res.json({
      success: true,
      message: 'Aktivasi RFID berhasil ditolak dan data customer dihapus',
      data: {
        customerId,
        customerName: customer.Name,
        status: 'rejected',
        rejectedAt: new Date()
      }
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Reject RFID activation error:', error);
    res.status(500).json({
      success: false,
      error: 'Gagal menolak aktivasi RFID'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});
// ==========================================
// GET DASHBOARD STATISTICS
// ==========================================
router.get('/dashboard/stats', async (req, res) => {
  let connection;

  try {
    connection = await pool.getConnection();

    const [pendingCount] = await connection.execute(
      `SELECT COUNT(DISTINCT c.Customer_ID) as count 
       FROM customer c
       LEFT JOIN rfid_card r ON c.Customer_ID = r.Customer_ID
       WHERE c.Status = 'pending'
       AND (r.Status IS NULL OR r.Status != 'rejected')`
    );

    const [activeCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM customer WHERE Status = "active"'
    );

    const [rfidCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM rfid_card WHERE Status = "active"'
    );

    const [totalBalance] = await connection.execute(
      'SELECT COALESCE(SUM(Balance), 0) as total FROM rfid_card WHERE Status = "active"'
    );

    const [recentActivations] = await connection.execute(
      `SELECT 
        c.Name,
        c.Phone_Number,
        r.RFID_Code,
        r.Activated_At,
        a.Full_Name as Activated_By
      FROM rfid_card r
      JOIN customer c ON r.Customer_ID = c.Customer_ID
      LEFT JOIN admin a ON r.Activated_By = a.Admin_ID
      WHERE r.Status = 'active'
      ORDER BY r.Activated_At DESC
      LIMIT 5`
    );

    res.json({
      success: true,
      data: {
        pendingCustomers: pendingCount[0].count,
        activeCustomers: activeCount[0].count,
        totalRfidCards: rfidCount[0].count,
        totalBalance: totalBalance[0].total,
        recentActivations
      }
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Gagal mengambil statistik dashboard'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// ==========================================
// CHECK RFID AVAILABILITY
// ==========================================
router.get('/check-rfid/:rfidCode', async (req, res) => {
  let connection;

  try {
    const { rfidCode } = req.params;

    connection = await pool.getConnection();

    const [cards] = await connection.execute(
      `SELECT 
        r.*,
        c.Name as Customer_Name,
        c.Phone_Number
      FROM rfid_card r
      LEFT JOIN customer c ON r.Customer_ID = c.Customer_ID
      WHERE r.RFID_Code = ?`,
      [rfidCode]
    );

    if (cards.length === 0) {
      res.json({
        success: true,
        available: true,
        message: 'RFID tersedia untuk digunakan'
      });
    } else {
      res.json({
        success: true,
        available: false,
        message: 'RFID sudah terdaftar',
        data: cards[0]
      });
    }

  } catch (error) {
    console.error('Check RFID error:', error);
    res.status(500).json({
      success: false,
      error: 'Gagal mengecek RFID'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// ==========================================
// GET ALL TRANSACTIONS (dengan filter)
// ==========================================
router.get('/transactions', async (req, res) => {
  let connection;

  try {
    const {
      paymentStatus,
      startDate,
      endDate,
      page = 1,
      limit = 10
    } = req.query;

    connection = await pool.getConnection();

    const offset = (page - 1) * limit;

    let query = `
  SELECT 
    t.Transaction_ID,
    t.Transaction_Code,
    COALESCE(c.Name, '-') as Customer_Name,
    COALESCE(c.Phone_Number, '-') as Customer_Phone,
    COALESCE(r.RFID_Code, '-') as RFID_Code,
    COALESCE(t.Target_Phone_Number, c.Phone_Number, '-') as Target_Phones,
    t.Transaction_Type,
    CASE 
      WHEN t.Transaction_Type = 'isi_pulsa' THEN 'Isi Pulsa'
      WHEN t.Transaction_Type = 'top_up_saldo' THEN 'Isi Saldo RFID'
      WHEN t.Transaction_Type = 'beli_sim' THEN 'Beli SIM'
      ELSE t.Transaction_Type 
    END as Jenis,
    t.Total_Amount,
    t.Payment_Method,
    t.Payment_Status,
    t.Created_at
  FROM transaction t
  LEFT JOIN customer c ON t.Customer_ID = c.Customer_ID
  LEFT JOIN rfid_card r ON t.RFID_Card_ID = r.RFID_Card_ID
  WHERE 1=1
`;

    const params = [];

    if (paymentStatus) {
      query += ' AND t.Payment_Status = ?';
      params.push(paymentStatus);
    }

    if (startDate && endDate) {
      query += ' AND DATE(CONVERT_TZ(t.Created_at, "+00:00", "+07:00")) BETWEEN ? AND ?';
      params.push(startDate, endDate);
    } else if (startDate) {
      query += ' AND DATE(CONVERT_TZ(t.Created_at, "+00:00", "+07:00")) >= ?';
      params.push(startDate);
    } else if (endDate) {
      query += ' AND DATE(CONVERT_TZ(t.Created_at, "+00:00", "+07:00")) <= ?';
      params.push(endDate);
    }
    query += ' ORDER BY t.Created_at DESC';
    query += ` LIMIT ${limit} OFFSET ${offset}`;

    const [transactions] = await connection.execute(query, params);

    let countQuery = `
      SELECT COUNT(DISTINCT t.Transaction_ID) as total
      FROM transaction t
      LEFT JOIN customer c ON t.Customer_ID = c.Customer_ID
      WHERE 1=1
    `;

    const countParams = [];
    if (paymentStatus) {
      countQuery += ' AND t.Payment_Status = ?';
      countParams.push(paymentStatus);
    }
    if (startDate && endDate) {
      countQuery += ' AND DATE(CONVERT_TZ(t.Created_at, "+00:00", "+07:00")) BETWEEN ? AND ?';
      countParams.push(startDate, endDate);
    } else if (startDate) {
      countQuery += ' AND DATE(CONVERT_TZ(t.Created_at, "+00:00", "+07:00")) >= ?';
      countParams.push(startDate);
    } else if (endDate) {
      countQuery += ' AND DATE(CONVERT_TZ(t.Created_at, "+00:00", "+07:00")) <= ?';
      countParams.push(endDate);
    }

    const [countResult] = await connection.execute(countQuery, countParams);
    const total = countResult[0].total;

    console.log(`Found ${transactions.length} transactions`);

    res.json({
      success: true,
      data: transactions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      error: 'Gagal memuat transaksi'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// ==========================================
// GET TRANSACTION STATISTICS
// ==========================================
router.get('/transactions/stats', async (req, res) => {
  let connection;

  try {
    const { startDate, endDate } = req.query;

    connection = await pool.getConnection();

    let dateFilter = '';
    const params = [];

    if (startDate && endDate) {
      dateFilter = ' WHERE DATE(CONVERT_TZ(Created_at, "+00:00", "+07:00")) BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    const query = `
      SELECT 
        COUNT(*) as totalTransactions,
        SUM(CASE WHEN Payment_Status = 'pending' THEN 1 ELSE 0 END) as pendingTransactions,
        SUM(CASE WHEN Payment_Status = 'success' THEN 1 ELSE 0 END) as successTransactions,
        SUM(CASE WHEN Payment_Status = 'failed' THEN 1 ELSE 0 END) as failedTransactions,
        SUM(Total_Amount) as totalAmount,
        SUM(CASE WHEN Payment_Status = 'success' THEN Total_Amount ELSE 0 END) as successAmount
      FROM transaction
      ${dateFilter}
    `;

    const [stats] = await connection.execute(query, params);

    res.json({
      success: true,
      data: stats[0]
    });

  } catch (error) {
    console.error('Get transaction stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Gagal memuat statistik transaksi'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// ==========================================
// APPROVE CASH PAYMENT
// ==========================================
router.post('/approve-cash-payment', async (req, res) => {
  let connection;

  try {
    const { transactionId, adminId } = req.body;

    if (!transactionId || !adminId) {
      return res.status(400).json({
        success: false,
        error: 'Transaction ID dan Admin ID diperlukan'
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [transactions] = await connection.execute(`
  SELECT 
    t.*,
    c.Name as Customer_Name,
    c.Phone_Number as Customer_Phone,
    t.Target_Phone_Number,
    pd.IAK_Product_Code,
    r.RFID_Card_ID,
    r.RFID_Code,
    r.Balance
  FROM transaction t
  LEFT JOIN customer c ON t.Customer_ID = c.Customer_ID
  LEFT JOIN product_detail pd ON t.Product_Detail_ID = pd.Product_Detail_ID
  LEFT JOIN rfid_card r ON t.RFID_Card_ID = r.RFID_Card_ID
  WHERE t.Transaction_ID = ?
`, [transactionId]);

    if (transactions.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        error: 'Transaksi tidak ditemukan'
      });
    }

    const transaction = transactions[0];

    if ((transaction.Payment_Method !== 'cash') || transaction.Payment_Status !== 'pending') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: 'Hanya transaksi cash yang pending yang bisa di-approve'
      });
    }

    await connection.execute(
      'UPDATE transaction SET Payment_Status = ?, Admin_ID = ?, Updated_at = NOW() WHERE Transaction_ID = ?',
      ['success', adminId, transactionId]
    );

    console.log('Processing transaction:', {
      transactionId,
      transactionType: transaction.Transaction_Type,
      amount: transaction.Total_Amount
    });

    if (transaction.Transaction_Type === 'isi_pulsa') {

      console.log('Processing IAK for cash payment:', {
        phone: transaction.Target_Phone_Number,
        productCode: transaction.IAK_Product_Code,
        refId: transaction.Transaction_Code
      });

      const iakResult = await iakService.topUpPulsa(
        transaction.Target_Phone_Number,
        transaction.IAK_Product_Code,
        transaction.Transaction_Code
      );

      const iakResponseCode = iakResult.data?.rc;
      const iakStatus = iakResult.data?.status;

      if (iakResult.success && (iakResponseCode === '00' || iakStatus === 1 || iakStatus === 0)) {

        await connection.execute(
          'UPDATE transaction SET Payment_Status = ? WHERE Transaction_ID = ?',
          [iakStatus === 2 ? 'failed' : 'success', transactionId]
        );

        await connection.commit();

        res.json({
          success: true,
          message: iakStatus === 0
            ? 'Pembayaran berhasil dikonfirmasi! Pulsa sedang diproses ke nomor pelanggan (status: processing)'
            : 'Pembayaran berhasil dikonfirmasi! Pulsa berhasil diproses ke nomor pelanggan',
          data: {
            transactionId,
            transactionCode: transaction.Transaction_Code,
            customerName: transaction.Customer_Name,
            targetPhone: transaction.Target_Phone_Number,
            amount: transaction.Total_Amount,
            iakStatus: iakStatus === 0 ? 'PROCESSING' : iakStatus === 1 ? 'SUCCESS' : 'FAILED',
            iakResponse: iakResult.data
          }
        });
      } else {

        await connection.execute(
          'UPDATE transaction SET Payment_Status = ? WHERE Transaction_ID = ?',
          ['failed', transactionId]
        );

        await connection.commit();

        res.status(400).json({
          success: false,
          error: 'Pembayaran dikonfirmasi tapi gagal di IAK: ' + (iakResult.data?.message || iakResult.error),
          iakDetails: iakResult.data
        });
      }

    } else if (transaction.Transaction_Type === 'top_up_saldo') {

      if (transaction.RFID_Card_ID) {
        const balanceBefore = transaction.Balance || 0;
        const balanceAfter = Number(balanceBefore) + Number(transaction.Total_Amount);

        await connection.execute(
          'UPDATE rfid_card SET Balance = ?, Updated_at = NOW() WHERE RFID_Card_ID = ?',
          [balanceAfter, transaction.RFID_Card_ID]
        );

        await connection.execute(`
          INSERT INTO balance_history (
            RFID_Card_ID, Transaction_ID, Transaction_Type,
            Amount, Balance_Before, Balance_After, Created_at
          ) VALUES (?, ?, ?, ?, ?, ?, NOW())
        `, [transaction.RFID_Card_ID, transactionId, 'top_up', transaction.Total_Amount, balanceBefore, balanceAfter]);

        console.log('Balance updated:', {
          rfidCardId: transaction.RFID_Card_ID,
          transactionId,
          type: 'top-up',
          balanceBefore,
          balanceAfter,
          amount: transaction.Total_Amount
        });
      }

      await connection.commit();

      res.json({
        success: true,
        message: 'Pembayaran berhasil dikonfirmasi! Saldo telah ditambahkan ke kartu RFID',
        data: {
          transactionId,
          transactionCode: transaction.Transaction_Code,
          customerName: transaction.Customer_Name,
          rfidCode: transaction.RFID_Code,
          amount: transaction.Total_Amount,
          newBalance: Number(transaction.Balance || 0) + Number(transaction.Total_Amount)
        }
      });

    } else if (transaction.Transaction_Type === 'beli_sim') {
      console.log('DEBUG: Entering beli_sim block');
      console.log('Customer ID:', transaction.Customer_ID);

      //CREATE RFID CARD dengan status PENDING
      const customerId = transaction.Customer_ID;

      if (customerId) {
        console.log('Creating RFID card with PENDING status for SIM cash payment...');

        const [existingRfidCards] = await connection.execute(
          'SELECT * FROM rfid_card WHERE Customer_ID = ?',
          [customerId]
        );

        if (existingRfidCards.length === 0) {
          console.log('About to INSERT RFID card with customerId:', customerId);
          await connection.execute(
            `INSERT INTO rfid_card (
          Customer_ID, RFID_Code, Balance, Status, 
          Issue_Date, Created_at, Updated_at
        ) VALUES (?, ?, ?, ?, NOW(), NOW(), NOW())`,
            [customerId, null, 0, 'pending']
          );

          console.log('RFID card created (pending activation)');
        } else {
          await connection.execute(
            `UPDATE rfid_card 
         SET Status = 'pending', RFID_Code = NULL, Updated_at = NOW()
         WHERE RFID_Card_ID = ?`,
            [existingRfidCards[0].RFID_Card_ID]
          );

          console.log('RFID card updated to pending');
        }
      }

      await connection.commit();

      res.json({
        success: true,
        message: 'Pembayaran berhasil dikonfirmasi! Silakan aktivasi RFID di menu Aktivasi RFID Customer.',
        data: {
          transactionId,
          transactionCode: transaction.Transaction_Code,
          customerName: transaction.Customer_Name,
          targetPhone: transaction.Target_Phone_Number,
          amount: transaction.Total_Amount
        }
      });

    }

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Approve cash payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Gagal mengonfirmasi pembayaran',
      details: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// ==========================================
// REJECT CASH PAYMENT
// ==========================================
router.post('/reject-cash-payment', async (req, res) => {
  let connection;

  try {
    const { transactionId, adminId } = req.body;

    if (!transactionId || !adminId) {
      return res.status(400).json({
        success: false,
        error: 'Transaction ID dan Admin ID diperlukan'
      });
    }

    connection = await pool.getConnection();

    const [transactions] = await connection.execute(
      'SELECT * FROM transaction WHERE Transaction_ID = ?',
      [transactionId]
    );

    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Transaksi tidak ditemukan'
      });
    }

    const transaction = transactions[0];

    if (transaction.Payment_Method !== 'cash' || transaction.Payment_Status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Hanya transaksi cash yang pending yang bisa di-reject'
      });
    }

    await connection.execute(
      'UPDATE transaction SET Payment_Status = ?, Admin_ID = ?, Updated_at = NOW() WHERE Transaction_ID = ?',
      ['failed', adminId, transactionId]
    );

    res.json({
      success: true,
      message: 'Transaksi berhasil ditolak',
      data: {
        transactionId,
        transactionCode: transaction.Transaction_Code
      }
    });

  } catch (error) {
    console.error('Reject cash payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Gagal menolak pembayaran'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;