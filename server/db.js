const { Pool, types } = require('pg');

// DATE 타입(OID 1082)을 문자열 그대로 반환 (UTC 변환 방지)
types.setTypeParser(1082, val => val);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
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
