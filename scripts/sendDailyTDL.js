require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const nodemailer = require('nodemailer');
const { query } = require('../server/db');

async function buildTDLContent(userId) {
  const today = new Date().toISOString().slice(0, 10);

  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(now); monday.setDate(now.getDate() + diffToMon);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
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

  const todayTasks  = todayRes.rows;
  const weekTasks   = weekRes.rows;
  const overdue     = overdueRes.rows;

  const priorityLabel = { high: '높음', medium: '중간', low: '낮음' };
  const taskToText = t =>
    `- [${priorityLabel[t.priority]||'중간'}] ${t.title}${t.project_name ? ` (${t.project_name})` : ''}${t.due_date ? ` · 마감: ${t.due_date}` : ''}${t.memo ? `\n  메모: ${t.memo}` : ''}`;

  const prompt = `당신은 업무 관리 어시스턴트입니다. 아래 업무 목록을 바탕으로 오늘의 TDL(To-Do List) 이메일을 작성해 주세요.

오늘 날짜: ${today}

## 오늘 할 일 (${todayTasks.length}건)
${todayTasks.length ? todayTasks.map(taskToText).join('\n') : '없음'}

## 이번 주 전체 업무 (${weekTasks.length}건)
${weekTasks.length ? weekTasks.map(taskToText).join('\n') : '없음'}

## 기한 초과 업무 (${overdue.length}건)
${overdue.length ? overdue.map(taskToText).join('\n') : '없음'}

요청사항:
1. 반드시 HTML 코드만 반환하세요. 설명, 마크다운, 코드블록 없이 <html>태그부터 시작하세요.
2. 인라인 스타일만 사용하세요 (이메일 클라이언트 호환).
3. 오늘 할 일을 가장 상단에 강조해서 보여주세요.
4. 각 업무에 대해 한 줄 코멘트나 팁을 간결하게 추가해 주세요.
5. 이번 주 업무는 프로젝트별로 그룹핑해서 보여주세요.
6. 기한 초과 업무가 있으면 붉은색으로 강조해 주세요.
7. 전체적으로 깔끔하고 읽기 쉬운 스타일로 만들어 주세요.
8. HTML 코드 외에 어떤 텍스트도 포함하지 마세요.`;

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error('OPENAI_API_KEY 환경변수가 없습니다.');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 2000,
      messages: [
        { role: 'system', content: 'You are an email generator. Return only valid HTML code, nothing else.' },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!res.ok) throw new Error(`OpenAI API 오류: ${await res.text()}`);

  const json = await res.json();
  let html = json.choices[0].message.content;
  html = html.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
  return html;
}

async function sendMailToUser(user, htmlContent) {
  const settingsRes = await query('SELECT * FROM settings WHERE user_id=$1', [user.id]);
  const settings = settingsRes.rows[0] || {};

  const mailTo   = settings.mail_to   || user.email;
  const mailFrom = settings.mail_from || process.env.GMAIL_FROM;

  if (!mailTo || !mailFrom) {
    console.log(`⏭ ${user.name}: 메일 설정 없음, 건너뜀`);
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: mailFrom,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  await transporter.sendMail({
    from: mailFrom,
    to: mailTo,
    subject: `[TDL] ${todayStr} ${user.name}님의 오늘 업무`,
    html: htmlContent,
  });
  console.log(`✅ ${user.name} → ${mailTo} 발송 완료`);
}

async function main() {
  console.log('📋 전체 팀원 TDL 생성 중...');
  const usersRes = await query(
    `SELECT u.* FROM users u WHERE u.is_active = true`,
    []
  );

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

main().catch(err => {
  console.error('❌ 오류:', err.message);
  process.exit(1);
});
