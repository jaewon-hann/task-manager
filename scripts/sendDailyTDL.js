require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const nodemailer = require('nodemailer');
const { load } = require('../server/db');

async function buildTDLContent() {
  const data = load();
  const today = new Date().toISOString().slice(0, 10);

  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(now); monday.setDate(now.getDate() + diffToMon);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const mon = monday.toISOString().slice(0, 10);
  const sun = sunday.toISOString().slice(0, 10);

  const withProject = t => ({
    ...t,
    project_name: data.projects.find(p => p.id === t.project_id)?.name || null,
  });

  const todayTasks = data.tasks
    .filter(t => t.status !== 'done' && (!t.due_date || t.due_date === today))
    .map(withProject)
    .sort((a, b) => ({ high:1, medium:2, low:3 }[a.priority]||2) - ({ high:1, medium:2, low:3 }[b.priority]||2));

  const weekTasks = data.tasks
    .filter(t => t.status !== 'done' && t.due_date && t.due_date >= mon && t.due_date <= sun)
    .map(withProject)
    .sort((a, b) => (a.due_date||'z').localeCompare(b.due_date||'z'));

  const overdue = data.tasks
    .filter(t => t.status !== 'done' && t.due_date && t.due_date < today)
    .map(withProject)
    .sort((a, b) => (a.due_date||'').localeCompare(b.due_date||''));

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
1. 반드시 HTML 코드만 반환하세요. 설명, 마크다운, 코드블록(\`\`\`) 없이 <html>태그부터 시작하세요.
2. 인라인 스타일만 사용하세요 (이메일 클라이언트 호환).
3. 오늘 할 일을 가장 상단에 강조해서 보여주세요.
4. 각 업무에 대해 한 줄 코멘트나 팁을 간결하게 추가해 주세요.
5. 이번 주 업무는 프로젝트별로 그룹핑해서 보여주세요.
6. 기한 초과 업무가 있으면 붉은색으로 강조해 주세요.
7. 전체적으로 깔끔하고 읽기 쉬운 스타일로 만들어 주세요.
8. HTML 코드 외에 어떤 텍스트도 포함하지 마세요.`;

  // OpenAI API 호출
  const openaiKey = data.settings?.openai_api_key || process.env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error('OpenAI API Key가 없습니다. 설정 화면에서 입력해 주세요.');

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
        { role: 'system', content: 'You are an email generator. You must return only valid HTML code, nothing else. No markdown, no code blocks, no explanations. Start directly with <!DOCTYPE html> or <html>.' },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API 오류: ${err}`);
  }

  const json = await res.json();
  let html = json.choices[0].message.content;

  // 혹시 코드블록이 포함됐을 경우 제거
  html = html.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();

  return html;
}

async function sendMail(htmlContent) {
  const data = load();
  const settings = data.settings || {};

  if (!settings.mail_to || !settings.mail_from) {
    throw new Error('메일 설정이 없습니다. 웹 UI 설정 화면에서 이메일을 입력해 주세요.');
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: settings.mail_from,
      pass: settings.gmail_app_password || process.env.GMAIL_APP_PASSWORD,
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  await transporter.sendMail({
    from: settings.mail_from,
    to: settings.mail_to,
    subject: `[TDL] ${today} 오늘의 업무 현황`,
    html: htmlContent,
  });

  console.log(`✅ TDL 메일 발송 완료 → ${settings.mail_to}`);
}

async function main() {
  console.log('📋 TDL 생성 중...');
  const html = await buildTDLContent();
  await sendMail(html);
}

main().catch(err => {
  console.error('❌ 오류:', err.message);
  process.exit(1);
});
