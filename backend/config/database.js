const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '', 
  database: 'sistem_rfid_lijaya', 
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 60000
});

const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Database pool connected successfully');
    connection.release();
  } catch (error) {
    console.error('Database pool connection failed:', error.message);
  }
};

testConnection();

module.exports = { 
  pool,
  testConnection 
};