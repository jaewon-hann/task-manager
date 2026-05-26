const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// 쿼리 헬퍼
async function query(text, params) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

async function initDB() {
  try {
    await pool.connect();
    console.log('✅ DB 연결 성공');
  } catch (e) {
    console.error('❌ DB 연결 실패:', e.message);
    process.exit(1);
  }
}

module.exports = { query, initDB };
