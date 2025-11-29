const express = require('express');
const { pool } = require('../config/database');

const router = express.Router();

// Register customer - SIMPLIFIED VERSION
// Flow: Customer register → Status PENDING → Kasir scan RFID → Status ACTIVE
router.post('/register', async (req, res) => {
  let connection;

  try {
    const { name, phone, email } = req.body;

    // Validation
    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Nama dan Nomor HP wajib diisi'
      });
    }

    // Validate phone number format
    const phoneRegex = /^(08|628)\d{8,11}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        error: 'Format nomor HP tidak valid. Gunakan format: 08xxxxxxxxxx'
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // ==========================================
    // Check if phone number already registered
    // ==========================================
    const [existingCustomer] = await connection.execute(
      'SELECT Customer_ID, Status FROM customer WHERE Phone_Number = ?',
      [phone]
    );

    if (existingCustomer.length > 0) {
      const customer = existingCustomer[0];

      if (customer.Status === 'pending') {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: 'Nomor HP sudah terdaftar dan menunggu aktivasi di kasir'
        });
      }
      else if (customer.Status === 'active') {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: 'Nomor HP sudah terdaftar dan aktif'
        });
      }
    }

    // ==========================================
    // NEW REGISTRATION: Insert new customer ONLY
    // RFID card akan dibuat saat kasir activate
    // ==========================================
    const [result] = await connection.execute(
      `INSERT INTO customer (Name, Phone_Number, Email, Status, Registration_Date, Created_at, Updated_at) 
       VALUES (?, ?, ?, 'pending', NOW(), NOW(), NOW())`,
      [name, phone, email || null]
    );

    const customerId = result.insertId;

    await connection.commit();

    console.log('New customer created:', {
      customerId,
      name,
      phone,
      status: 'pending'
    });

    // ==========================================
    // Response - SIMPLE, NO RFID CARD YET
    // ==========================================
    res.json({
      success: true,
      message: 'Pendaftaran berhasil! Silakan ke kasir untuk aktivasi kartu RFID',
      data: {
        customerId,
        name,
        phone,
        email,
        status: 'pending',
        registrationDate: new Date()
      }
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Registration error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Terjadi kesalahan saat mendaftar. Silakan coba lagi.',
      details: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Check registration status by phone number
router.get('/check-status/:phone', async (req, res) => {
  let connection;

  try {
    const { phone } = req.params;

    connection = await pool.getConnection();

    const [customers] = await connection.execute(
      `SELECT 
        c.Customer_ID,
        c.Name,
        c.Phone_Number,
        c.Email,
        c.Status,
        c.Registration_Date,
        r.RFID_Card_ID,
        r.RFID_Code,
        r.Balance,
        r.Status as RFID_Status,
        r.Issue_Date,
        r.Activated_At,
        r.Activated_By
      FROM customer c
      LEFT JOIN rfid_card r ON c.Customer_ID = r.Customer_ID
      WHERE c.Phone_Number = ?`,
      [phone]
    );

    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Nomor HP tidak terdaftar'
      });
    }

    const customer = customers[0];

    res.json({
      success: true,
      data: {
        customerId: customer.Customer_ID,
        name: customer.Name,
        phone: customer.Phone_Number,
        email: customer.Email,
        status: customer.Status,
        registrationDate: customer.Registration_Date,
        rfidCard: {
          rfidCardId: customer.RFID_Card_ID,
          rfidCode: customer.RFID_Code,
          balance: customer.Balance || 0,
          status: customer.RFID_Status,
          issueDate: customer.Issue_Date,
          activatedAt: customer.Activated_At,
          activatedBy: customer.Activated_By
        }
      }
    });

  } catch (error) {
    console.error('Check status error:', error);
    res.status(500).json({
      success: false,
      error: 'Terjadi kesalahan saat mengecek status'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;