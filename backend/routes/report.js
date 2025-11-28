const express = require('express');
const { pool } = require('../config/database');
const router = express.Router();

// ==========================================
// GET LAPORAN SUMMARY (KPI METRICS)
// ==========================================
router.get('/summary', async (req, res) => {
  let connection;

  try {
    const { startDate, endDate, paymentMethod, paymentStatus } = req.query;

    connection = await pool.getConnection();

    let whereClauses = [];
    let params = [];

    if (startDate && endDate) {
      whereClauses.push('DATE(t.Created_At) >= ? AND DATE(t.Created_At) <= ?');
      params.push(startDate, endDate);
    }

    if (paymentMethod) {
      whereClauses.push('t.Payment_Method = ?');
      params.push(paymentMethod);
    }

    if (paymentStatus) {
      whereClauses.push('t.Payment_Status = ?');
      params.push(paymentStatus);
    }

    const whereClause = whereClauses.length > 0 
      ? 'WHERE ' + whereClauses.join(' AND ')
      : '';

    // Query untuk total revenue
    const queryRevenue = `
      SELECT 
        COUNT(*) as totalTransactions,
        SUM(CASE WHEN t.Payment_Status = 'success' THEN t.Total_Amount ELSE 0 END) as totalRevenue,
        SUM(CASE WHEN t.Payment_Status = 'pending' THEN t.Total_Amount ELSE 0 END) as pendingAmount,
        SUM(CASE WHEN t.Payment_Status = 'failed' THEN t.Total_Amount ELSE 0 END) as failedAmount,
        AVG(CASE WHEN t.Payment_Status = 'success' THEN t.Total_Amount ELSE NULL END) as avgTransaction,
        COUNT(DISTINCT t.Customer_ID) as uniqueCustomers,
        COUNT(CASE WHEN t.Transaction_Type = 'isi_pulsa' THEN 1 END) as pulsaCount,
        COUNT(CASE WHEN t.Transaction_Type = 'top_up_saldo' THEN 1 END) as topupCount
      FROM transaction t
      ${whereClause}
    `;

    const [revenue] = await connection.execute(queryRevenue, params);

    // Query untuk breakdown by payment method
    const queryPaymentBreakdown = `
      SELECT 
        t.Payment_Method,
        COUNT(*) as count,
        SUM(CASE WHEN t.Payment_Status = 'success' THEN t.Total_Amount ELSE 0 END) as amount
      FROM transaction t
      ${whereClause}
      GROUP BY t.Payment_Method
    `;

    const [paymentBreakdown] = await connection.execute(queryPaymentBreakdown, params);

    // Query untuk breakdown by status
    const queryStatusBreakdown = `
      SELECT 
        t.Payment_Status as status,
        COUNT(*) as count,
        SUM(t.Total_Amount) as amount
      FROM transaction t
      ${whereClause}
      GROUP BY t.Payment_Status
    `;

    const [statusBreakdown] = await connection.execute(queryStatusBreakdown, params);

    // Query untuk pending cash payments count
    const [pendingCash] = await connection.execute(
      `SELECT COUNT(*) as pendingCashCount
       FROM transaction t
       WHERE t.Payment_Method IN ('kasir', 'cash') AND t.Payment_Status = 'pending'`
    );

    // Query untuk new customers
    let newCustomersQuery = 'SELECT COUNT(*) as newCustomersCount FROM customer';
    let customerParams = [];

    if (startDate && endDate) {
      newCustomersQuery += ' WHERE DATE(Registration_Date) >= ? AND DATE(Registration_Date) <= ?';
      customerParams = [startDate, endDate];
    }

    const [newCustomers] = await connection.execute(newCustomersQuery, customerParams);

    res.json({
      success: true,
      data: {
        summary: revenue[0] || {},
        paymentBreakdown: paymentBreakdown || [],
        statusBreakdown: statusBreakdown || [],
        pendingCashCount: pendingCash[0]?.pendingCashCount || 0,
        newCustomersCount: newCustomers[0]?.newCustomersCount || 0
      }
    });

  } catch (error) {
    console.error('❌ Get report summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Gagal memuat ringkasan laporan',
      details: error.message
    });
  } finally {
    if (connection) connection.release();
  }
});

// ==========================================
// GET DAILY TRANSACTION CHART DATA
// ==========================================
router.get('/daily-chart', async (req, res) => {
  let connection;

  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate dan endDate diperlukan'
      });
    }

    connection = await pool.getConnection();

    const query = `
      SELECT 
        DATE(t.Created_At) as date,
        COUNT(*) as transactionCount,
        SUM(CASE WHEN t.Payment_Status = 'success' THEN t.Total_Amount ELSE 0 END) as revenue,
        COUNT(CASE WHEN t.Payment_Status = 'success' THEN 1 END) as successCount,
        COUNT(CASE WHEN t.Payment_Status = 'pending' THEN 1 END) as pendingCount,
        COUNT(CASE WHEN t.Payment_Status = 'failed' THEN 1 END) as failedCount
      FROM transaction t
      WHERE DATE(t.Created_At) >= ? AND DATE(t.Created_At) <= ?
      GROUP BY DATE(t.Created_At)
      ORDER BY date ASC
    `;

    const [chartData] = await connection.execute(query, [startDate, endDate]);

    res.json({
      success: true,
      data: chartData || []
    });

  } catch (error) {
    console.error('❌ Get daily chart error:', error);
    res.status(500).json({
      success: false,
      error: 'Gagal memuat data grafik',
      details: error.message
    });
  } finally {
    if (connection) connection.release();
  }
});

// ==========================================
// GET TRANSACTIONS LIST - COMPLETELY FIXED
// ==========================================
router.get('/transactions', async (req, res) => {
  let connection;

  try {
    const {
      startDate,
      endDate,
      paymentMethod,
      paymentStatus,
      transactionType,
      page = 1,
      limit = 20
    } = req.query;

    const limitNum = parseInt(limit);
    const offsetNum = (parseInt(page) - 1) * limitNum;

    connection = await pool.getConnection();

    // Build WHERE conditions
    let whereClauses = [];
    let countParams = [];
    let queryParams = [];

    if (startDate && endDate) {
      whereClauses.push('DATE(t.Created_At) >= ? AND DATE(t.Created_At) <= ?');
      countParams.push(startDate, endDate);
      queryParams.push(startDate, endDate);
    }

    if (paymentMethod) {
      whereClauses.push('t.Payment_Method = ?');
      countParams.push(paymentMethod);
      queryParams.push(paymentMethod);
    }

    if (paymentStatus) {
      whereClauses.push('t.Payment_Status = ?');
      countParams.push(paymentStatus);
      queryParams.push(paymentStatus);
    }

    if (transactionType) {
      whereClauses.push('t.Transaction_Type = ?');
      countParams.push(transactionType);
      queryParams.push(transactionType);
    }

    const whereClause = whereClauses.length > 0 
      ? 'WHERE ' + whereClauses.join(' AND ') 
      : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM transaction t ${whereClause}`;
    const [countResult] = await connection.execute(countQuery, countParams);
    const totalCount = countResult[0]?.total || 0;

    // Get transactions
    const transactionQuery = `
      SELECT 
        t.Transaction_ID,
        t.Transaction_Code,
        t.Transaction_Type,
        t.Total_Amount,
        t.Payment_Method,
        t.Payment_Status,
        t.Created_At,
        COALESCE(c.Name, '-') as Customer_Name,
        COALESCE(c.Phone_Number, '-') as Customer_Phone,
        t.Target_Phone_Number,
        pd.Detail_Name,
        pd.Nominal
      FROM transaction t
      LEFT JOIN customer c ON t.Customer_ID = c.Customer_ID
      LEFT JOIN product_detail pd ON t.Product_Detail_ID = pd.Product_Detail_ID
      ${whereClause}
      ORDER BY t.Created_At DESC
      LIMIT ? OFFSET ?
    `;

    queryParams.push(limitNum, offsetNum);

    const [transactions] = await connection.execute(transactionQuery, queryParams);

    res.json({
      success: true,
      data: {
        transactions: transactions || [],
        pagination: {
          page: parseInt(page),
          limit: limitNum,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limitNum)
        }
      }
    });

  } catch (error) {
    console.error('❌ Get transactions error:', error);
    res.status(500).json({
      success: false,
      error: 'Gagal memuat data transaksi',
      details: error.message
    });
  } finally {
    if (connection) connection.release();
  }
});

// ==========================================
// GET PAYMENT METHOD BREAKDOWN
// ==========================================
router.get('/payment-breakdown', async (req, res) => {
  let connection;

  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate dan endDate diperlukan'
      });
    }

    connection = await pool.getConnection();

    const query = `
      SELECT 
        t.Payment_Method,
        COUNT(*) as totalCount,
        COUNT(CASE WHEN t.Payment_Status = 'success' THEN 1 END) as successCount,
        COUNT(CASE WHEN t.Payment_Status = 'pending' THEN 1 END) as pendingCount,
        COUNT(CASE WHEN t.Payment_Status = 'failed' THEN 1 END) as failedCount,
        SUM(t.Total_Amount) as totalAmount,
        SUM(CASE WHEN t.Payment_Status = 'success' THEN t.Total_Amount ELSE 0 END) as successAmount,
        AVG(t.Total_Amount) as avgAmount
      FROM transaction t
      WHERE DATE(t.Created_At) >= ? AND DATE(t.Created_At) <= ?
      GROUP BY t.Payment_Method
      ORDER BY totalAmount DESC
    `;

    const [breakdown] = await connection.execute(query, [startDate, endDate]);

    res.json({
      success: true,
      data: breakdown || []
    });

  } catch (error) {
    console.error('❌ Get payment breakdown error:', error);
    res.status(500).json({
      success: false,
      error: 'Gagal memuat breakdown pembayaran',
      details: error.message
    });
  } finally {
    if (connection) connection.release();
  }
});

// ==========================================
// GET TOP PRODUCTS
// ==========================================
router.get('/top-products', async (req, res) => {
  let connection;

  try {
    const { startDate, endDate, limit = 10 } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate dan endDate diperlukan'
      });
    }

    connection = await pool.getConnection();

    const query = `
      SELECT 
        pd.Product_Detail_ID,
        pd.Detail_Name,
        pd.Nominal,
        COUNT(t.Transaction_ID) as totalSales,
        SUM(CASE WHEN t.Payment_Status = 'success' THEN t.Total_Amount ELSE 0 END) as totalRevenue,
        AVG(t.Total_Amount) as avgPrice
      FROM transaction t
      JOIN product_detail pd ON t.Product_Detail_ID = pd.Product_Detail_ID
      WHERE DATE(t.Created_At) >= ? AND DATE(t.Created_At) <= ?
      GROUP BY pd.Product_Detail_ID, pd.Detail_Name, pd.Nominal
      ORDER BY totalSales DESC
      LIMIT ?
    `;

    const [topProducts] = await connection.execute(query, [startDate, endDate, parseInt(limit)]);

    res.json({
      success: true,
      data: topProducts || []
    });

  } catch (error) {
    console.error('❌ Get top products error:', error);
    res.status(500).json({
      success: false,
      error: 'Gagal memuat produk terlaris',
      details: error.message
    });
  } finally {
    if (connection) connection.release();
  }
});

// ==========================================
// GET CUSTOMER STATISTICS
// ==========================================
router.get('/customer-stats', async (req, res) => {
  let connection;

  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate dan endDate diperlukan'
      });
    }

    connection = await pool.getConnection();

    // Total customers
    const [totalCustomers] = await connection.execute(
      'SELECT COUNT(*) as total FROM customer'
    );

    // Active customers
    const [activeCustomers] = await connection.execute(
      'SELECT COUNT(*) as total FROM customer WHERE Status = "active"'
    );

    // New customers in period
    const [newCustomers] = await connection.execute(
      `SELECT COUNT(*) as total FROM customer 
       WHERE DATE(Registration_Date) >= ? AND DATE(Registration_Date) <= ?`,
      [startDate, endDate]
    );

    // Top spending customers
    const [topSpending] = await connection.execute(
      `SELECT 
        c.Customer_ID,
        c.Name,
        c.Phone_Number,
        COUNT(t.Transaction_ID) as transactionCount,
        SUM(CASE WHEN t.Payment_Status = 'success' THEN t.Total_Amount ELSE 0 END) as totalSpent
      FROM customer c
      LEFT JOIN transaction t ON c.Customer_ID = t.Customer_ID 
        AND DATE(t.Created_At) >= ? AND DATE(t.Created_At) <= ?
        AND t.Payment_Status = 'success'
      GROUP BY c.Customer_ID, c.Name, c.Phone_Number
      ORDER BY totalSpent DESC
      LIMIT 10`,
      [startDate, endDate]
    );

    res.json({
      success: true,
      data: {
        totalCustomers: totalCustomers[0]?.total || 0,
        activeCustomers: activeCustomers[0]?.total || 0,
        newCustomersInPeriod: newCustomers[0]?.total || 0,
        topSpendingCustomers: topSpending || []
      }
    });

  } catch (error) {
    console.error('❌ Get customer stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Gagal memuat statistik pelanggan',
      details: error.message
    });
  } finally {
    if (connection) connection.release();
  }
});

// ==========================================
// EXPORT DETAILED REPORT
// ==========================================
router.get('/export-data', async (req, res) => {
  let connection;

  try {
    const { startDate, endDate, paymentMethod, paymentStatus, format = 'json' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate dan endDate diperlukan'
      });
    }

    connection = await pool.getConnection();

    let whereClauses = ['DATE(t.Created_At) >= ? AND DATE(t.Created_At) <= ?'];
    let params = [startDate, endDate];

    if (paymentMethod) {
      whereClauses.push('t.Payment_Method = ?');
      params.push(paymentMethod);
    }

    if (paymentStatus) {
      whereClauses.push('t.Payment_Status = ?');
      params.push(paymentStatus);
    }

    const whereClause = 'WHERE ' + whereClauses.join(' AND ');

    const query = `
      SELECT 
        t.Transaction_Code,
        t.Transaction_Type,
        t.Created_At,
        c.Name as Customer_Name,
        c.Phone_Number as Customer_Phone,
        t.Payment_Method,
        t.Payment_Status,
        t.Total_Amount,
        t.Target_Phone_Number,
        pd.Detail_Name,
        pd.Nominal
      FROM transaction t
      LEFT JOIN customer c ON t.Customer_ID = c.Customer_ID
      LEFT JOIN product_detail pd ON t.Product_Detail_ID = pd.Product_Detail_ID
      ${whereClause}
      ORDER BY t.Created_At DESC
    `;

    const [transactions] = await connection.execute(query, params);

    res.json({
      success: true,
      data: {
        exportDate: new Date().toISOString(),
        startDate,
        endDate,
        totalRecords: transactions.length,
        transactions: transactions || []
      }
    });

  } catch (error) {
    console.error('❌ Export data error:', error);
    res.status(500).json({
      success: false,
      error: 'Gagal export data',
      details: error.message
    });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;