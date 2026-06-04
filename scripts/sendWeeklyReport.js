require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { query } = require('../server/db');

const getKSTDate = (date) => new Date(date.getTime() + 9*60*60*1000).toISOString().slice(0,10);

function getLastWeekRange() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9*60*60*1000);
  const day = kst.getUTCDay(); // 0=일, 1=월
  // 지난주 월요일
  const diffToLastMon = day === 0 ? -6 : -(day + 6);
  const lastMon = new Date(kst); lastMon.setUTCDate(kst.getUTCDate() + diffToLastMon);
  const lastSun = new Date(lastMon); lastSun.setUTCDate(lastMon.getUTCDate() + 6);
  return {
    mon: lastMon.toISOString().slice(0,10),
    sun: lastSun.toISOString().slice(0,10),
  };
}

async function buildWeeklyReport(userId, userName) {
  const { mon, sun } = getLastWeekRange();

  const [completedRes, inProgressRes, weekNoteRes, projectsRes] = await Promise.all([
    // 지난주 완료된 업무
    query(`
      SELECT t.*, p.name AS project_name FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.user_id=$1 AND t.status='done'
        AND t.updated_at::date >= $2 AND t.updated_at::date <= $3
      ORDER BY p.name ASC, t.updated_at ASC
    `, [userId, mon, sun]),
    // 현재 진행 중인 업무
    query(`
      SELECT t.*, p.name AS project_name FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.user_id=$1 AND t.status='in_progress'
      ORDER BY p.name ASC
    `, [userId]),
    // 지난주 주간 메모
    query(`SELECT content FROM weekly_notes WHERE user_id=$1 AND week_start=$2`, [userId, mon]),
    // 프로젝트 목록 (완료 안된 것)
    query(`SELECT * FROM projects WHERE user_id=$1 AND archived=false`, [userId]),
  ]);

  const completed   = completedRes.rows;
  const inProgress  = inProgressRes.rows;
  const weekNote    = weekNoteRes.rows[0]?.content || '';
  const projects    = projectsRes.rows;

  // 프로젝트별 완료 업무 그룹핑
  const byProject = {};
  completed.forEach(t => {
    const key = t.project_name || '프로젝트 없음';
    if (!byProject[key]) byProject[key] = [];
    byProject[key].push(t);
  });

  const completedText = Object.entries(byProject).map(([proj, tasks]) =>
    `[${proj}]\n${tasks.map(t => `  - ${t.title}${t.memo ? ` (메모: ${t.memo.replace(/<[^>]*>/g,'').slice(0,50)})` : ''}`).join('\n')}`
  ).join('\n\n') || '완료된 업무 없음';

  const inProgressText = inProgress.length
    ? inProgress.map(t => `  - ${t.title} (${t.project_name || '프로젝트 없음'})${t.due_date ? ` · 마감: ${t.due_date}` : ''}`).join('\n')
    : '  없음';

  const prompt = `당신은 업무 관리 어시스턴트입니다. 아래 정보를 바탕으로 주간 업무 회고 이메일을 HTML로 작성해주세요.

대상자: ${userName}
기간: ${mon} ~ ${sun} (지난주)

## 완료한 업무 (프로젝트별)
${completedText}

## 현재 진행 중인 업무
${inProgressText}

## 지난주 주간 메모
${weekNote || '없음'}

이메일 구성:
1. **지난주 완료 업무** - 프로젝트별로 깔끔하게 정리
2. **진행 중인 업무** - 현재 상태 요약
3. **AI 회고 & 제안** - 아래 3가지 포함:
   - 잘한 점 (완료한 업무 기반으로 칭찬/인정)
   - 주의할 점 (미완료/지연 업무가 있다면 원인 분석 및 조언)
   - 이번주 집중 제안 (진행 중 업무 기반으로 우선순위 제안)

디자인 규칙:
- 배경 흰색, 최대너비 600px, 중앙정렬, 폰트 Apple SD Gothic Neo/Noto Sans KR/sans-serif
- 상단 헤더: 배경 #1a1d2e, 흰색 텍스트, "주간 업무 회고" + 기간 표시
- 각 섹션 제목: 굵게, 아이콘 포함
- 완료 업무: 프로젝트별로 구분선으로 나누고, 각 업무 앞에 ✓ 체크 표시
- AI 회고 섹션: 연한 파란 배경 박스, 3가지 항목 명확히 구분
- 하단 푸터: 회색 작은 텍스트 "Task Manager · 주간 리포트"
- HTML만 반환, <html>태그부터 시작, 코드블록/설명 없음, 인라인 스타일만`;

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
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API 오류: ${await res.text()}`);
  const json = await res.json();
  let html = json.content[0].text;
  html = html.replace(/^```html\s*/i,'').replace(/^```\s*/i,'').replace(/\s*```$/,'').trim();
  return html;
}

async function sendWeeklyReportToUser(user, htmlContent) {
  const settingsRes = await query('SELECT * FROM settings WHERE user_id=$1', [user.id]);
  const settings = settingsRes.rows[0] || {};

  // 콤마로 구분된 수신자 지원
  const mailTo = settings.mail_to || user.email;
  const mailFrom = process.env.RESEND_FROM || 'onboarding@resend.dev';

  if (!mailTo) {
    console.log(`⏭ ${user.name}: 수신 이메일 없음, 건너뜀`);
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY 환경변수가 없습니다.');

  const { mon, sun } = getLastWeekRange();
  const toList = mailTo.split(',').map(e => e.trim()).filter(Boolean);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: mailFrom,
      to: toList,
      subject: `[주간 리포트] ${mon} ~ ${sun} ${user.name}님의 지난주 업무 회고`,
      html: htmlContent,
    }),
  });

  if (!res.ok) throw new Error(`Resend 오류: ${await res.text()}`);
  console.log(`✅ ${user.name} → ${toList.join(', ')} 주간 리포트 발송 완료`);
}

module.exports = { buildWeeklyReport, sendWeeklyReportToUser };

if (require.main === module) {
  async function main() {
    console.log('📋 전체 팀원 주간 리포트 생성 중...');
    const usersRes = await query('SELECT * FROM users WHERE is_active=true', []);
    for (const user of usersRes.rows) {
      try {
        console.log(`\n👤 ${user.name} 처리 중...`);
        const html = await buildWeeklyReport(user.id, user.name);
        await sendWeeklyReportToUser(user, html);
      } catch(e) {
        console.error(`❌ ${user.name} 실패:`, e.message);
      }
    }
    console.log('\n✅ 전체 발송 완료');
    process.exit(0);
  }
  main().catch(err => { console.error('❌ 오류:', err.message); process.exit(1); });
}
