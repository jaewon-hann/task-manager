require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const { query, initDB } = require('./db');

const app  = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'taskmanager-secret-key-change-in-production';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/dist')));

initDB();

const today = () => new Date().toISOString().slice(0, 10);

// ── 인증 미들웨어 ──────────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: '인증이 만료되었습니다. 다시 로그인해주세요.' });
  }
}

function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '관리자만 접근 가능합니다' });
  next();
}

function getTargetUserId(req) {
  const target = req.headers['x-target-user-id'];
  return target ? parseInt(target, 10) : req.user.id;
}

function isReadOnly(req) {
  const target = req.headers['x-target-user-id'];
  if (!target) return false;
  return parseInt(target, 10) !== req.user.id;
}

// ── 로그인 ─────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요' });
    const result = await query('SELECT * FROM users WHERE email=$1 AND is_active=true', [email]);
    if (!result.rows.length) return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' });
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' });
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET, { expiresIn: '30d' }
    );
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const result = await query('SELECT id,name,email,role FROM users WHERE id=$1', [req.user.id]);
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/auth/password', authMiddleware, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const result = await query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
    const valid = await bcrypt.compare(current_password, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: '현재 비밀번호가 올바르지 않습니다' });
    const hash = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);
    res.json({ message: '비밀번호가 변경되었습니다' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 팀원 관리 ──────────────────────────────────────────────
app.get('/api/users', authMiddleware, async (req, res) => {
  try {
    const result = await query('SELECT id,name,email,role,is_active,created_at FROM users ORDER BY role DESC,name ASC', []);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name||!email||!password) return res.status(400).json({ error: '이름, 이메일, 비밀번호를 입력해주세요' });
    const exists = await query('SELECT id FROM users WHERE email=$1', [email]);
    if (exists.rows.length) return res.status(400).json({ error: '이미 사용 중인 이메일입니다' });
    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4) RETURNING id',
      [name, email, hash, role||'member']
    );
    await query('INSERT INTO settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [result.rows[0].id]);
    res.status(201).json({ id: result.rows[0].id, message: '팀원이 추가되었습니다' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, email, role, is_active, password } = req.body;
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await query('UPDATE users SET name=$1,email=$2,role=$3,is_active=$4,password_hash=$5 WHERE id=$6', [name,email,role,is_active,hash,req.params.id]);
    } else {
      await query('UPDATE users SET name=$1,email=$2,role=$3,is_active=$4 WHERE id=$5', [name,email,role,is_active,req.params.id]);
    }
    res.json({ message: '수정되었습니다' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (parseInt(req.params.id)===req.user.id) return res.status(400).json({ error: '본인 계정은 삭제할 수 없습니다' });
    await query('UPDATE users SET is_active=false WHERE id=$1', [req.params.id]);
    res.json({ message: '비활성화되었습니다' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Tasks ──────────────────────────────────────────────────
app.get('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const userId = getTargetUserId(req);
    const { project_id, status, priority, due_from, due_to, overdue, exclude_done, created_from } = req.query;
    const todayStr = today();
    let sql = `SELECT t.*,p.name AS project_name,p.color AS project_color FROM tasks t LEFT JOIN projects p ON p.id=t.project_id WHERE t.user_id=$1`;
    const params = [userId]; let i = 2;
    if (project_id)           { sql+=` AND t.project_id=$${i++}`;                       params.push(project_id); }
    if (status)               { sql+=` AND t.status=$${i++}`;                           params.push(status); }
    if (priority)             { sql+=` AND t.priority=$${i++}`;                         params.push(priority); }
    if (due_from)             { sql+=` AND t.due_date>=$${i++}`;                        params.push(due_from); }
    if (due_to)               { sql+=` AND t.due_date<=$${i++}`;                        params.push(due_to); }
    if (overdue==='1')        { sql+=` AND t.due_date<$${i++} AND t.status!='done'`;    params.push(todayStr); }
    if (exclude_done==='1')   { sql+=` AND t.status!='done'`; }
    if (created_from)         { sql+=` AND t.created_at>=$${i++}`;                      params.push(created_from); }
    sql+=` ORDER BY CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,t.due_date ASC NULLS LAST`;
    res.json((await query(sql, params)).rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tasks/today', authMiddleware, async (req, res) => {
  try {
    const userId = getTargetUserId(req);
    const todayStr = today();
    const result = await query(`
      SELECT t.*,p.name AS project_name FROM tasks t LEFT JOIN projects p ON p.id=t.project_id
      WHERE t.user_id=$1 AND (t.due_date=$2 OR (t.due_date IS NULL AND t.status!='done') OR (t.status='done' AND t.updated_at::date=$2::date))
      ORDER BY CASE WHEN t.status='done' THEN 1 ELSE 0 END, CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
    `, [userId, todayStr]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tasks/week', authMiddleware, async (req, res) => {
  try {
    const userId = getTargetUserId(req);
    const now2=new Date(); const monday=new Date(now2); monday.setDate(now2.getDate()-now2.getDay()+1);
    const sunday=new Date(monday); sunday.setDate(monday.getDate()+6);
    const mon=monday.toISOString().slice(0,10); const sun=sunday.toISOString().slice(0,10);
    const result = await query(`
      SELECT t.*,p.name AS project_name FROM tasks t LEFT JOIN projects p ON p.id=t.project_id
      WHERE t.user_id=$1 AND t.status!='done' AND ((t.due_date>=$2 AND t.due_date<=$3) OR t.due_date IS NULL OR t.status='in_progress')
      ORDER BY t.due_date ASC NULLS LAST, CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
    `, [userId, mon, sun]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tasks/month', authMiddleware, async (req, res) => {
  try {
    const userId = getTargetUserId(req);
    const n=new Date();
    const firstDay=new Date(n.getFullYear(),n.getMonth(),1).toISOString().slice(0,10);
    const lastDay=new Date(n.getFullYear(),n.getMonth()+1,0).toISOString().slice(0,10);
    const result = await query(`
      SELECT t.*,p.name AS project_name FROM tasks t LEFT JOIN projects p ON p.id=t.project_id
      WHERE t.user_id=$1 AND t.status!='done' AND ((t.due_date>=$2 AND t.due_date<=$3) OR t.due_date IS NULL OR t.status='in_progress')
      ORDER BY t.due_date ASC NULLS LAST, CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
    `, [userId, firstDay, lastDay]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const userId = getTargetUserId(req);
    const result = await query(`SELECT t.*,p.name AS project_name FROM tasks t LEFT JOIN projects p ON p.id=t.project_id WHERE t.id=$1 AND t.user_id=$2`, [req.params.id, userId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tasks', authMiddleware, async (req, res) => {
  try {
    if (isReadOnly(req)) return res.status(403).json({ error: '다른 팀원의 워크플레이스는 수정할 수 없습니다' });
    const { title, project_id, category, priority, status, due_date, memo } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    const result = await query(`INSERT INTO tasks (user_id,title,memo,category,project_id,priority,status,due_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [req.user.id, title, memo||null, category||null, project_id||null, priority||'medium', status||'todo', due_date||null]);
    res.status(201).json({ id: result.rows[0].id, message: 'Created' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    if (isReadOnly(req)) return res.status(403).json({ error: '다른 팀원의 워크플레이스는 수정할 수 없습니다' });
    const { title, project_id, category, priority, status, due_date, memo } = req.body;
    const result = await query(`UPDATE tasks SET title=$1,memo=$2,category=$3,project_id=$4,priority=$5,status=$6,due_date=$7,updated_at=NOW() WHERE id=$8 AND user_id=$9`,
      [title, memo||null, category||null, project_id||null, priority, status, due_date||null, req.params.id, req.user.id]);
    if (result.rowCount===0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    if (isReadOnly(req)) return res.status(403).json({ error: '다른 팀원의 워크플레이스는 수정할 수 없습니다' });
    await query('DELETE FROM tasks WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Projects ───────────────────────────────────────────────
app.get('/api/projects', authMiddleware, async (req, res) => {
  try {
    const userId = getTargetUserId(req);
    const includeArchived = req.query.includeArchived==='true';
    const sql = `SELECT p.*,COUNT(t.id) FILTER (WHERE t.status!='done') AS task_count,COUNT(t.id) FILTER (WHERE t.status='in_progress') AS in_progress_count,COUNT(t.id) AS total_count,COUNT(t.id) FILTER (WHERE t.status='done') AS done_count FROM projects p LEFT JOIN tasks t ON t.project_id=p.id WHERE p.user_id=$1 ${!includeArchived?"AND p.archived=false":""} GROUP BY p.id ORDER BY p.created_at ASC`;
    res.json((await query(sql, [userId])).rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/projects', authMiddleware, async (req, res) => {
  try {
    if (isReadOnly(req)) return res.status(403).json({ error: '다른 팀원의 워크플레이스는 수정할 수 없습니다' });
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const result = await query('INSERT INTO projects (user_id,name,color) VALUES ($1,$2,$3) RETURNING id', [req.user.id, name, color||'#6f6af8']);
    res.status(201).json({ id: result.rows[0].id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/projects/:id', authMiddleware, async (req, res) => {
  try {
    if (isReadOnly(req)) return res.status(403).json({ error: '다른 팀원의 워크플레이스는 수정할 수 없습니다' });
    const { name, color, archived, archived_at, memo } = req.body;
    await query('UPDATE projects SET name=$1,color=$2,archived=$3,archived_at=$4,memo=$5 WHERE id=$6 AND user_id=$7', [name,color,archived??false,archived_at||null,memo||null,req.params.id,req.user.id]);
    res.json({ message: 'Updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/projects/:id/complete-tasks', authMiddleware, async (req, res) => {
  try {
    if (isReadOnly(req)) return res.status(403).json({ error: '다른 팀원의 워크플레이스는 수정할 수 없습니다' });
    await query(`UPDATE tasks SET status='done',updated_at=NOW() WHERE project_id=$1 AND user_id=$2`, [req.params.id, req.user.id]);
    res.json({ message: 'Tasks completed' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/projects/:id', authMiddleware, async (req, res) => {
  try {
    if (isReadOnly(req)) return res.status(403).json({ error: '다른 팀원의 워크플레이스는 수정할 수 없습니다' });
    await query('UPDATE tasks SET project_id=NULL WHERE project_id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    await query('DELETE FROM projects WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Events ─────────────────────────────────────────────────
app.get('/api/events', authMiddleware, async (req, res) => {
  try {
    const userId=getTargetUserId(req); const {from,to}=req.query;
    let sql=`SELECT * FROM events WHERE user_id=$1`; const params=[userId]; let i=2;
    if (from) { sql+=` AND end_date>=$${i++}`; params.push(from); }
    if (to)   { sql+=` AND start_date<=$${i++}`; params.push(to); }
    res.json((await query(sql+' ORDER BY start_date ASC', params)).rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/events', authMiddleware, async (req, res) => {
  try {
    if (isReadOnly(req)) return res.status(403).json({ error: '다른 팀원의 워크플레이스는 수정할 수 없습니다' });
    const {title,start_date,end_date,color,memo}=req.body;
    if (!title||!start_date) return res.status(400).json({ error: 'title, start_date required' });
    const result=await query('INSERT INTO events (user_id,title,start_date,end_date,color,memo) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [req.user.id,title,start_date,end_date||start_date,color||'#e879f9',memo||null]);
    res.status(201).json({ id: result.rows[0].id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/events/:id', authMiddleware, async (req, res) => {
  try {
    if (isReadOnly(req)) return res.status(403).json({ error: '다른 팀원의 워크플레이스는 수정할 수 없습니다' });
    const {title,start_date,end_date,color,memo}=req.body;
    await query('UPDATE events SET title=$1,start_date=$2,end_date=$3,color=$4,memo=$5 WHERE id=$6 AND user_id=$7',
      [title,start_date,end_date,color,memo||null,req.params.id,req.user.id]);
    res.json({ message: 'Updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/events/:id', authMiddleware, async (req, res) => {
  try {
    if (isReadOnly(req)) return res.status(403).json({ error: '다른 팀원의 워크플레이스는 수정할 수 없습니다' });
    await query('DELETE FROM events WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Settings ───────────────────────────────────────────────
app.get('/api/settings', authMiddleware, async (req, res) => {
  try {
    const result=await query('SELECT * FROM settings WHERE user_id=$1',[req.user.id]);
    if (!result.rows.length) {
      await query('INSERT INTO settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING',[req.user.id]);
      return res.json({mail_to:'',mail_from:'',mail_time:'08:00'});
    }
    const s=result.rows[0];
    res.json({mail_to:s.mail_to,mail_from:s.mail_from,mail_time:s.mail_time});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/settings', authMiddleware, async (req, res) => {
  try {
    const {mail_to,mail_from,mail_time}=req.body;
    await query(`INSERT INTO settings (user_id,mail_to,mail_from,mail_time) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id) DO UPDATE SET mail_to=$2,mail_from=$3,mail_time=$4,updated_at=NOW()`,
      [req.user.id,mail_to||'',mail_from||'',mail_time||'08:00']);
    res.json({ message: 'Saved' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Stats ──────────────────────────────────────────────────
app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const userId=getTargetUserId(req); const todayStr=today();
    const result=await query(`SELECT
      COUNT(*) FILTER (WHERE status!='done') AS total,
      COUNT(*) FILTER (WHERE status='in_progress') AS in_progress,
      COUNT(*) FILTER (WHERE status!='done' AND (due_date IS NULL OR due_date=$2)) AS today,
      COUNT(*) FILTER (WHERE due_date<$2 AND status!='done') AS overdue
      FROM tasks WHERE user_id=$1`,
      [userId,todayStr]);
    const r=result.rows[0];
    res.json({total:parseInt(r.total),today:parseInt(r.today),in_progress:parseInt(r.in_progress),overdue:parseInt(r.overdue)});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 자동 메일 발송 (cron-job.org에서 호출) ───────────────
app.post('/api/send-daily-mail', async (req, res) => {
  const secret = req.headers['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ message: 'started' });
  (async () => {
    try {
      const { buildTDLContent, sendMailToUser } = require('../scripts/sendDailyTDL.js');
      const usersRes = await query('SELECT * FROM users WHERE is_active=true', []);
      for (const user of usersRes.rows) {
        try {
          const html = await buildTDLContent(user.id);
          await sendMailToUser(user, html);
        } catch (e) { console.error(`❌ ${user.name} 실패:`, e.message); }
      }
      console.log('✅ 전체 메일 발송 완료');
    } catch (e) { console.error('❌ 메일 발송 오류:', e.message); }
  })();
});

// ── 테스트 메일 (본인에게만) ───────────────────────────────
app.post('/api/test-mail', authMiddleware, async (req, res) => {
  console.log('📧 테스트 메일 요청 받음:', req.user.name);
  res.json({ message: 'ok' });
  setImmediate(async () => {
    try {
      console.log('📧 메일 생성 시작...');
      const { buildTDLContent, sendMailToUser } = require('../scripts/sendDailyTDL.js');
      console.log('📧 DB에서 유저 조회 중...');
      const userRes = await query('SELECT * FROM users WHERE id=$1', [req.user.id]);
      const user = userRes.rows[0];
      console.log(`📧 ${user.name} TDL 생성 중...`);
      const html = await buildTDLContent(user.id);
      console.log(`📧 메일 발송 중...`);
      await sendMailToUser(user, html);
      console.log(`✅ 테스트 메일 발송 완료: ${user.name}`);
    } catch (e) {
      console.error('❌ 테스트 메일 실패:', e.message);
      console.error(e.stack);
    }
  });
});


// ── Weekly Notes ───────────────────────────────────────────
app.get('/api/weekly-notes/:weekStart', authMiddleware, async (req, res) => {
  try {
    const userId = getTargetUserId(req);
    const result = await query('SELECT * FROM weekly_notes WHERE user_id=$1 AND week_start=$2', [userId, req.params.weekStart]);
    res.json(result.rows[0] || { content: '' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/weekly-notes/:weekStart', authMiddleware, async (req, res) => {
  try {
    if (isReadOnly(req)) return res.status(403).json({ error: '다른 팀원의 워크플레이스는 수정할 수 없습니다' });
    const { content } = req.body;
    await query(`INSERT INTO weekly_notes (user_id, week_start, content) VALUES ($1,$2,$3) ON CONFLICT (user_id, week_start) DO UPDATE SET content=$3, updated_at=NOW()`,
      [req.user.id, req.params.weekStart, content || '']);
    res.json({ message: 'Saved' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(PORT, () => console.log(`서버 실행 중: http://localhost:${PORT}`));
