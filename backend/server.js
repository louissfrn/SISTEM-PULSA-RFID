// =======================================
// Backend Foundation Setup - ROBUST VERSION
// File: backend/server.js
// =======================================

const express = require('express');
const cors = require('cors');
const { pool: db } = require('./config/database');

const app = express();
const PORT = 8000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =======================================
// ROUTES SETUP - PENTING: LETAKKAN DI ATAS
// =======================================
const transactionRoutes = require('./routes/transaction');
const registrationRoutes = require('./routes/registration');
const adminRoutes = require('./routes/admin');
const reportRoutes = require('./routes/report');
const paymentRoutes = require('./routes/payment');
const simCardRoutes = require('./routes/simCard');

app.use('/api/transactions', transactionRoutes);
app.use('/api/customer', registrationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/sim', simCardRoutes);

// =======================================
// BASIC ENDPOINTS
// =======================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend berjalan', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({ message: 'Backend Sistem Pulsa RFID OK!', status: 'OK' });
});

// =======================================
// GET ALL SIM CARDS
// =======================================
app.get('/api/admin/sim-cards', async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const [sims] = await connection.execute(
      `SELECT * FROM sim_card ORDER BY Created_at DESC`
    );
    res.json({ success: true, data: sims });
  } catch (error) {
    console.error('Get SIM cards error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// =======================================
// CREATE SIM CARD
// =======================================
app.post('/api/admin/sim-cards/create', async (req, res) => {
  let connection;
  try {
    const { barcode, phoneNumber, provider, purchasePrice, sellingPrice } = req.body;

    console.log('CREATE SIM REQUEST:', { barcode, phoneNumber, provider, purchasePrice, sellingPrice });

    // Validation
    if (!barcode?.trim()) return res.status(400).json({ success: false, error: 'Nomor Seri wajib diisi' });
    if (!phoneNumber?.trim()) return res.status(400).json({ success: false, error: 'Nomor SIM wajib diisi' });
    if (!provider) return res.status(400).json({ success: false, error: 'Provider wajib dipilih' });
    if (!purchasePrice || purchasePrice < 10000) return res.status(400).json({ success: false, error: 'Harga Beli minimal Rp 10.000' });
    if (!sellingPrice || sellingPrice < 10000) return res.status(400).json({ success: false, error: 'Harga Jual minimal Rp 10.000' });
    if (sellingPrice < purchasePrice) return res.status(400).json({ success: false, error: 'Harga Jual harus ≥ Harga Beli' });

    connection = await db.getConnection();
    await connection.beginTransaction();

    // Check barcode exists
    const [existing] = await connection.execute(
      'SELECT SIM_ID FROM sim_card WHERE Barcode = ?',
      [barcode]
    );

    if (existing.length > 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'Nomor Seri sudah ada' });
    }

    // INSERT - gunakan nama kolom dari database
    let insertQuery = `INSERT INTO sim_card 
      (Barcode, Phone_Number, Provider, Purchase_Price, Selling_Price, Status, Created_At, Updated_At) 
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`;

    try {
      const [result] = await connection.execute(insertQuery, [
        barcode,
        phoneNumber,
        provider.toLowerCase(),
        parseInt(purchasePrice),
        parseInt(sellingPrice),
        'available'
      ]);

      await connection.commit();

      console.log('SIM CREATED:', result.insertId);

      res.json({
        success: true,
        data: {
          simId: result.insertId,
          barcode,
          phoneNumber,
          provider,
          purchasePrice,
          sellingPrice,
          status: 'available'
        }
      });

    } catch (queryError) {
      if (queryError.message.includes('Selling_Price')) {
        console.log('Trying lowercase selling_price...');

        insertQuery = `INSERT INTO sim_card 
          (Barcode, Phone_Number, Provider, Purchase_Price, selling_price, Status, Created_At, Updated_At) 
          VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`;

        const [result] = await connection.execute(insertQuery, [
          barcode,
          phoneNumber,
          provider.toLowerCase(),
          parseInt(purchasePrice),
          parseInt(sellingPrice),
          'available'
        ]);

        await connection.commit();

        console.log('SIM CREATED (lowercase):', result.insertId);

        res.json({
          success: true,
          data: {
            simId: result.insertId,
            barcode,
            phoneNumber,
            provider,
            purchasePrice,
            sellingPrice,
            status: 'available'
          }
        });
      } else {
        throw queryError;
      }
    }

  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (e) { }
    }
    console.error('Create SIM error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Gagal membuat SIM'
    });
  } finally {
    if (connection) connection.release();
  }
});

// =======================================
// UPDATE SIM CARD
// =======================================
app.post('/api/admin/sim-cards/:simId/update', async (req, res) => {
  let connection;
  try {
    const { simId } = req.params;
    const { barcode, phoneNumber, provider, purchasePrice, sellingPrice } = req.body;

    // Validation
    if (!barcode?.trim()) return res.status(400).json({ success: false, error: 'Nomor Seri wajib diisi' });
    if (!phoneNumber?.trim()) return res.status(400).json({ success: false, error: 'Nomor SIM wajib diisi' });
    if (!purchasePrice || purchasePrice < 10000) return res.status(400).json({ success: false, error: 'Harga Beli minimal Rp 10.000' });
    if (!sellingPrice || sellingPrice < 10000) return res.status(400).json({ success: false, error: 'Harga Jual minimal Rp 10.000' });
    if (sellingPrice < purchasePrice) return res.status(400).json({ success: false, error: 'Harga Jual harus ≥ Harga Beli' });

    connection = await db.getConnection();
    await connection.beginTransaction();

    // Check SIM exists
    const [sim] = await connection.execute('SELECT * FROM sim_card WHERE SIM_ID = ?', [simId]);
    if (sim.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'SIM tidak ditemukan' });
    }

    // Check barcode conflict
    if (sim[0].Barcode !== barcode) {
      const [duplicate] = await connection.execute(
        'SELECT SIM_ID FROM sim_card WHERE Barcode = ? AND SIM_ID != ?',
        [barcode, simId]
      );
      if (duplicate.length > 0) {
        await connection.rollback();
        return res.status(400).json({ success: false, error: 'Nomor Seri sudah ada' });
      }
    }

    // UPDATE
    let updateQuery = `UPDATE sim_card SET 
      Barcode = ?, Phone_Number = ?, Provider = ?, Purchase_Price = ?, Selling_Price = ?, Updated_At = NOW() 
      WHERE SIM_ID = ?`;

    try {
      await connection.execute(updateQuery, [
        barcode,
        phoneNumber,
        provider.toLowerCase(),
        parseInt(purchasePrice),
        parseInt(sellingPrice),
        simId
      ]);

      await connection.commit();

      console.log('SIM UPDATED:', simId);

      res.json({
        success: true,
        data: { simId, barcode, phoneNumber, provider, purchasePrice, sellingPrice }
      });

    } catch (queryError) {
      if (queryError.message.includes('Selling_Price')) {
        console.log('Trying lowercase selling_price...');

        updateQuery = `UPDATE sim_card SET 
          Barcode = ?, Phone_Number = ?, Provider = ?, Purchase_Price = ?, selling_price = ?, Updated_At = NOW() 
          WHERE SIM_ID = ?`;

        await connection.execute(updateQuery, [
          barcode,
          phoneNumber,
          provider.toLowerCase(),
          parseInt(purchasePrice),
          parseInt(sellingPrice),
          simId
        ]);

        await connection.commit();

        res.json({
          success: true,
          data: { simId, barcode, phoneNumber, provider, purchasePrice, sellingPrice }
        });
      } else {
        throw queryError;
      }
    }

  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (e) { }
    }
    console.error('Update SIM error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// =======================================
// DELETE SIM CARD
// =======================================
app.post('/api/admin/sim-cards/:simId/delete', async (req, res) => {
  let connection;
  try {
    const { simId } = req.params;

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [sim] = await connection.execute('SELECT * FROM sim_card WHERE SIM_ID = ?', [simId]);
    if (sim.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'SIM tidak ditemukan' });
    }

    if (sim[0].Status !== 'available') {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'Hanya SIM tersedia yang bisa dihapus' });
    }

    await connection.execute('DELETE FROM sim_card WHERE SIM_ID = ?', [simId]);
    await connection.commit();

    console.log('SIM DELETED:', simId);

    res.json({ success: true, message: 'SIM berhasil dihapus' });

  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (e) { }
    }
    console.error('Delete SIM error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// =======================================
// Scan RFID Pelanggan
// =======================================
app.post('/api/rfid/scan', async (req, res) => {
  try {
    const { rfidCode } = req.body;
    console.log('RFID Scan:', rfidCode);

    const [results] = await db.execute(`
      SELECT rc.RFID_Card_ID, rc.RFID_Code, rc.Balance, rc.Status as Card_Status,
             c.Customer_ID, c.Name, c.Phone_Number, c.Email
      FROM rfid_card rc
      JOIN customer c ON rc.Customer_ID = c.Customer_ID
      WHERE rc.RFID_Code = ? AND rc.Status = 'active'
    `, [rfidCode]);

    if (results.length === 0) {
      return res.status(404).json({ success: false, error: 'RFID card not found' });
    }

    const cardInfo = results[0];
    const phonePrefix = cardInfo.Phone_Number.substring(0, 4);
    const providerMap = {
      '0811': 'telkomsel', '0812': 'telkomsel', '0813': 'telkomsel', '0822': 'telkomsel', '0821': 'telkomsel', '0853': 'telkomsel',
      '0817': 'XL', '0818': 'XL', '0819': 'XL', '0878': 'XL',
      '0814': 'indosat', '0815': 'indosat', '0816': 'indosat',
      '0895': 'tri', '0896': 'tri', '0897': 'tri',
      '0881': 'smartfren', '0882': 'smartfren', '0883': 'smartfren'
    };

    res.json({
      success: true,
      data: {
        rfidCode: cardInfo.RFID_Code,
        customerId: cardInfo.Customer_ID,
        rfidCardId: cardInfo.RFID_Card_ID,
        name: cardInfo.Name,
        phone: cardInfo.Phone_Number,
        balance: cardInfo.Balance,
        detectedProvider: providerMap[phonePrefix] || 'unknown'
      }
    });

  } catch (error) {
    console.error('RFID scan error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// =======================================
// tampilkan produk pulsa berdasarkan provider
// =======================================
app.get('/api/products/pulsa/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const [products] = await db.execute(`
      SELECT pd.Product_Detail_ID, pd.Detail_Name, pd.Nominal, pd.Selling_Price, pd.IAK_Product_Code
      FROM product_detail pd
      JOIN product p ON pd.Product_ID = p.Product_ID
      WHERE p.Telco_Provider = ? AND p.Category = 'pulsa' AND pd.Status = 'active'
      ORDER BY pd.Nominal ASC
    `, [provider]);
    res.json({ success: true, data: products });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// =======================================
// Scan Barcode pada kemasan kartu SIM
// =======================================
app.post('/api/sim/scan-barcode', async (req, res) => {
  try {
    const { barcode } = req.body;
    console.log('Barcode Scan:', barcode);

    const [simCards] = await db.execute(
      'SELECT * FROM sim_card WHERE Barcode = ? AND Status = "available"',
      [barcode]
    );

    if (simCards.length === 0) {
      return res.status(404).json({ success: false, error: 'SIM card not found' });
    }

    const simCard = simCards[0];

    console.log('SIM Card found:', {
      id: simCard.SIM_ID,
      barcode: simCard.Barcode,
      phone: simCard.Phone_Number,
      purchasePrice: simCard.Purchase_Price,
      sellingPrice: simCard.Selling_Price
    });

    res.json({
      success: true,
      data: {
        simId: simCard.SIM_ID,
        phoneNumber: simCard.Phone_Number,
        provider: simCard.Provider,
        barcode: simCard.Barcode,
        purchasePrice: parseInt(simCard.Purchase_Price) || 0,
        sellingPrice: parseInt(simCard.Selling_Price) || parseInt(simCard.selling_price) || 0,
        productDetailId: null,
        productType: 'Beli SIM'
      }
    });

  } catch (error) {
    console.error('Barcode scan error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n Backend running on http://localhost:${PORT}`);
  console.log(`Ready to accept requests!\n`);
});