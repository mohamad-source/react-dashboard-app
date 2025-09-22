const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

// Load environment variables
const dotenv = require('dotenv');
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: path.resolve(__dirname, envFile) });

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'API funktioniert!', auth: 'disabled for testing' });
});

// Basic akten route (without auth for now)
app.get('/api/akten', async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'test'
    });

    const [rows] = await connection.execute('SELECT * FROM akte LIMIT 10');
    await connection.end();

    res.json(rows || []);
  } catch (error) {
    console.error('DB Error:', error.message);
    res.status(500).json({ error: 'Database connection failed', details: error.message });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Minimal API Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test API: http://localhost:${PORT}/api/test`);
  console.log(`📋 Akten API: http://localhost:${PORT}/api/akten`);
  console.log('⚠️  Authentication temporarily disabled for testing');
});