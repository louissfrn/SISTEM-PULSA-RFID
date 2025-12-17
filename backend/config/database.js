const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'interchange.proxy.rlwy.net',
  user: 'root',
  password: 'GuNRzsposwpMYpJnUXplXpzTvKkbJbJi',
  database: 'railway',
  port: 19399,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  connectTimeout: 60000, 
  reconnect: true
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