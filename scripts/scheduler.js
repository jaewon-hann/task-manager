require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const cron = require('node-cron');
const { execSync } = require('child_process');
const { getDB } = require('../server/db');
const path = require('path');

function getMailTime() {
  const db = getDB();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'mail_time'").get();
  return row ? row.value : '08:00';
}

function startScheduler() {
  const mailTime = getMailTime();
  const [hour, minute] = mailTime.split(':');
  const cronExpr = `${minute} ${hour} * * *`;

  console.log(`⏰ 스케줄러 시작 — 매일 ${mailTime} TDL 메일 발송`);

  cron.schedule(cronExpr, () => {
    console.log(`[${new Date().toLocaleString('ko-KR')}] TDL 메일 발송 시작`);
    try {
      const script = path.join(__dirname, 'sendDailyTDL.js');
      execSync(`node ${script}`, { stdio: 'inherit' });
    } catch (e) {
      console.error('메일 발송 실패:', e.message);
    }
  }, { timezone: 'Asia/Seoul' });
}

startScheduler();
