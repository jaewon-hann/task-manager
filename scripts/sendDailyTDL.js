require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { query } = require('../server/db');

const getKSTToday = () => {
  const d = new Date();
  return new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
};

const getKSTDate = (date) => {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
};

async function buildTDLContent(userId, userName) {
  const today = getKSTToday();
  // KST 기준 날짜 계산
  const nowKST = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
  const dayKST = nowKST.getUTCDay();
  const diffToMon = dayKST === 0 ? -6 : 1 - dayKST;
  const monday = new Date(nowKST); monday.setUTCDate(nowKST.getUTCDate() + diffToMon);
  const sunday = new Date(monday); sunday.setUTCDate(monday.getUTCDate() + 6);
  const mon = monday.toISOString().slice(0, 10);
  const sun = sunday.toISOString().slice(0, 10);

  const [todayRes, weekRes, overdueRes] = await Promise.all([
    query(`
      SELECT t.*, p.name AS project_name FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.user_id=$1 AND t.status != 'done'
        AND (t.due_date IS NULL OR t.due_date = $2)
      ORDER BY CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
    `, [userId, today]),
    query(`
      SELECT t.*, p.name AS project_name FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.user_id=$1 AND t.status != 'done'
        AND t.due_date >= $2 AND t.due_date <= $3
      ORDER BY t.due_date ASC
    `, [userId, mon, sun]),
    query(`
      SELECT t.*, p.name AS project_name FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.user_id=$1 AND t.status != 'done' AND t.due_date < $2
      ORDER BY t.due_date ASC
    `, [userId, today]),
  ]);

  const todayTasks = todayRes.rows;
  const weekTasks  = weekRes.rows;
  const overdue    = overdueRes.rows;

  const priorityLabel = { high: '높음', medium: '중간', low: '낮음' };
  const stripHtml = (str) => str ? str.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim() : '';
  const taskToText = t =>
    `- [${priorityLabel[t.priority]||'중간'}] ${stripHtml(t.title)}${t.project_name ? ` (${stripHtml(t.project_name)})` : ''}${t.due_date ? ` · 마감: ${t.due_date}` : ''}${t.memo ? `\n  메모: ${stripHtml(t.memo)}` : ''}`;

  const prompt = `당신은 업무 관리 어시스턴트입니다. 아래 업무 목록으로 TDL 이메일을 HTML로 작성하세요.

오늘 날짜: ${today}
이름: ${userName || ''}

## 오늘 할 일 (${todayTasks.length}건)
${todayTasks.length ? todayTasks.map(taskToText).join('\n') : '없음'}

## 이번 주 업무 (${weekTasks.length}건, 오늘 제외)
${weekTasks.length ? weekTasks.map(taskToText).join('\n') : '없음'}

## 기한 초과 (${overdue.length}건)
${overdue.length ? overdue.map(taskToText).join('\n') : '없음'}

HTML 디자인 규칙:
- 배경 흰색, 최대너비 600px, 중앙정렬, 폰트 맑은고딕/Apple SD Gothic Neo/sans-serif
- 상단 헤더: 배경 #1a1d2e, 흰색 텍스트, 날짜와 이름 표시
- 섹션 제목: 굵게, 아이콘 포함 (오늘할일📌, 이번주📅, 기한초과⚠️)
- 각 업무: 흰 배경, 테두리 #e5e7eb, 둥근모서리, 패딩 16px
- 우선순위 뱃지: 높음=빨강 #ff4444, 중간=주황 #ff9500, 낮음=초록 #34c759, 흰글자, 둥근모서리
- 기한초과: 카드 왼쪽 빨간 테두리 3px
- 메모: 연회색 배경 박스, 일반 텍스트만 (HTML태그 없음)
- 팁/코멘트 박스 절대 추가하지 말것
- 하단 푸터: 회색 작은 텍스트 "Task Manager"
- HTML만 반환, <html>부터 시작, 코드블록/설명 없음, 인라인스타일만 사용
- 업무 없는 섹션은 생략`;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY 환경변수가 없습니다.');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API 오류: ${await res.text()}`);
  const json = await res.json();
  let html = json.content[0].text;
  html = html.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
  return html;
}

async function sendMailToUser(user, htmlContent) {
  const settingsRes = await query('SELECT * FROM settings WHERE user_id=$1', [user.id]);
  const settings = settingsRes.rows[0] || {};
  const mailTo = settings.mail_to || user.email;
  const mailFrom = process.env.RESEND_FROM || 'onboarding@resend.dev';

  if (!mailTo) {
    console.log(`⏭ ${user.name}: 수신 이메일 없음, 건너뜀`);
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY 환경변수가 없습니다.');

  const todayStr = getKSTToday();
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: mailFrom,
      to: mailTo,
      subject: `[TDL] ${todayStr} ${user.name}님의 오늘 업무`,
      html: htmlContent,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend 오류: ${err}`);
  }
  console.log(`✅ ${user.name} → ${mailTo} 발송 완료`);
}

module.exports = { buildTDLContent, sendMailToUser };

if (require.main === module) {
  async function main() {
    console.log('📋 전체 팀원 TDL 생성 중...');
    const usersRes = await query(`SELECT * FROM users WHERE is_active = true`, []);
    for (const user of usersRes.rows) {
      try {
        console.log(`\n👤 ${user.name} 처리 중...`);
        const html = await buildTDLContent(user.id, user.name);
        await sendMailToUser(user, html);
      } catch (e) {
        console.error(`❌ ${user.name} 실패:`, e.message);
      }
    }
    console.log('\n✅ 전체 발송 완료');
    process.exit(0);
  }
  main().catch(err => { console.error('❌ 오류:', err.message); process.exit(1); });
}
