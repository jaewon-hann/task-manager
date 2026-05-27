require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { query } = require('../server/db');

const getKSTToday = () => {
  const d = new Date();
  return new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
};

async function buildTDLContent(userId) {
  const today = getKSTToday();
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(now); monday.setDate(now.getDate() + diffToMon);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const mon = new Date(monday.getTime() + 9*60*60*1000).toISOString().slice(0, 10);
  const sun = new Date(sunday.getTime() + 9*60*60*1000).toISOString().slice(0, 10);

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
  const taskToText = t =>
    `- [${priorityLabel[t.priority]||'중간'}] ${t.title}${t.project_name ? ` (${t.project_name})` : ''}${t.due_date ? ` · 마감: ${t.due_date}` : ''}${t.memo ? `\n  메모: ${t.memo}` : ''}`;

  const prompt = `당신은 업무 관리 어시스턴트입니다. 아래 업무 목록을 바탕으로 오늘의 TDL 이메일을 HTML로 작성해 주세요.

오늘 날짜: ${today}

## 오늘 할 일 (${todayTasks.length}건)
${todayTasks.length ? todayTasks.map(taskToText).join('\n') : '없음'}

## 이번 주 전체 업무 (${weekTasks.length}건)
${weekTasks.length ? weekTasks.map(taskToText).join('\n') : '없음'}

## 기한 초과 업무 (${overdue.length}건)
${overdue.length ? overdue.map(taskToText).join('\n') : '없음'}

디자인 요구사항:
- 배경: 흰색, 최대 너비 600px, 중앙 정렬
- 상단 헤더: 진한 남색(#1a1d2e) 배경, 흰색 텍스트로 날짜와 이름 표시
- 섹션 구분: "📌 오늘 할 일", "📅 이번 주 업무", "⚠️ 기한 초과" 순서
- 각 업무 카드: 흰색 배경, 연한 회색 테두리, 둥근 모서리(8px), 여백 넉넉히
- 우선순위 뱃지: 높음=빨강(#ff4444), 중간=주황(#ff9500), 낮음=초록(#34c759)
- 기한 초과 업무: 카드 왼쪽 빨간 테두리(3px) 강조
- 메모는 회색 박스 안에 일반 텍스트로만 표시 (HTML 태그 절대 그대로 출력 금지, 태그 제거 후 텍스트만)
- 각 업무마다 한 줄 팁을 연한 파란 박스에 표시
- 하단 푸터: 회색 텍스트로 "Task Manager에서 발송됨"

규칙:
1. HTML 코드만 반환. <html>태그부터 시작, 설명/마크다운/코드블록 없음
2. 인라인 스타일만 사용
3. 메모 내용의 HTML 태그는 반드시 제거하고 텍스트만 표시
4. 업무가 없는 섹션은 "없음" 대신 해당 섹션 자체를 생략`;

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
        const html = await buildTDLContent(user.id);
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
