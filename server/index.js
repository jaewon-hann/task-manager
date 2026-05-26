require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { query, initDB } = require('./db');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── 정적 파일 서빙 (프론트엔드 빌드) ──────────────────────
app.use(express.static(path.join(__dirname, '../client/dist')));

initDB();

const today = () => new Date().toISOString().slice(0, 10);
const now   = () => new Date().toISOString();

// ── 임시 인증 미들웨어 ─────────────────────────────────────
// 나중에 JWT로 교체 예정. 지금은 헤더 x-user-id로 유저 식별
// 헤더 없으면 user_id = 1 (관리자) 사용
function getUser(req) {
  return parseInt(req.headers['x-user-id'] || '1', 10);
}

// ── Tasks ──────────────────────────────────────────────────

app.get('/api/tasks', async (req, res) => {
  try {
    const userId = getUser(req);
    const { project_id, status, priority, due_from, due_to, overdue, exclude_done, created_from } = req.query;
    const todayStr = today();

    let sql = `
      SELECT t.*, p.name AS project_name, p.color AS project_color
      FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.user_id = $1
    `;
    const params = [userId];
    let i = 2;

    if (project_id)   { sql += ` AND t.project_id = $${i++}`;          params.push(project_id); }
    if (status)       { sql += ` AND t.status = $${i++}`;              params.push(status); }
    if (priority)     { sql += ` AND t.priority = $${i++}`;            params.push(priority); }
    if (due_from)     { sql += ` AND t.due_date >= $${i++}`;           params.push(due_from); }
    if (due_to)       { sql += ` AND t.due_date <= $${i++}`;           params.push(due_to); }
    if (overdue === '1')      { sql += ` AND t.due_date < $${i++} AND t.status != 'done'`; params.push(todayStr); }
    if (exclude_done === '1') { sql += ` AND t.status != 'done'`; }
    if (created_from) { sql += ` AND t.created_at >= $${i++}`;         params.push(created_from); }

    sql += ` ORDER BY CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, t.due_date ASC NULLS LAST`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/tasks/today', async (req, res) => {
  try {
    const userId   = getUser(req);
    const todayStr = today();
    const result = await query(`
      SELECT t.*, p.name AS project_name FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.user_id = $1
        AND (
          t.due_date = $2
          OR (t.due_date IS NULL AND t.status != 'done')
          OR (t.status = 'done' AND t.updated_at::date = $2::date)
        )
      ORDER BY
        CASE WHEN t.status = 'done' THEN 1 ELSE 0 END,
        CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
    `, [userId, todayStr]);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/tasks/week', async (req, res) => {
  try {
    const userId = getUser(req);
    const now2   = new Date();
    const monday = new Date(now2); monday.setDate(now2.getDate() - now2.getDay() + 1);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const mon = monday.toISOString().slice(0, 10);
    const sun = sunday.toISOString().slice(0, 10);

    const result = await query(`
      SELECT t.*, p.name AS project_name FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.user_id = $1
        AND t.status != 'done'
        AND (t.due_date IS NULL OR (t.due_date >= $2 AND t.due_date <= $3) OR t.status = 'in_progress')
      ORDER BY t.due_date ASC NULLS LAST,
        CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
    `, [userId, mon, sun]);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/tasks/month', async (req, res) => {
  try {
    const userId = getUser(req);
    const n = new Date();
    const firstDay = new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0, 10);
    const lastDay  = new Date(n.getFullYear(), n.getMonth() + 1, 0).toISOString().slice(0, 10);

    const result = await query(`
      SELECT t.*, p.name AS project_name FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.user_id = $1
        AND t.status != 'done'
        AND (t.due_date IS NULL OR (t.due_date >= $2 AND t.due_date <= $3) OR t.status = 'in_progress')
      ORDER BY t.due_date ASC NULLS LAST,
        CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
    `, [userId, firstDay, lastDay]);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/tasks/:id', async (req, res) => {
  try {
    const userId = getUser(req);
    const result = await query(`
      SELECT t.*, p.name AS project_name FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.id = $1 AND t.user_id = $2
    `, [req.params.id, userId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const userId = getUser(req);
    const { title, project_id, category, priority, status, due_date, memo } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const result = await query(`
      INSERT INTO tasks (user_id, title, memo, category, project_id, priority, status, due_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id
    `, [userId, title, memo || null, category || null, project_id || null,
        priority || 'medium', status || 'todo', due_date || null]);
    res.status(201).json({ id: result.rows[0].id, message: 'Created' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const userId = getUser(req);
    const { title, project_id, category, priority, status, due_date, memo } = req.body;
    const result = await query(`
      UPDATE tasks
      SET title=$1, memo=$2, category=$3, project_id=$4, priority=$5, status=$6, due_date=$7, updated_at=NOW()
      WHERE id=$8 AND user_id=$9
    `, [title, memo || null, category || null, project_id || null,
        priority, status, due_date || null, req.params.id, userId]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Updated' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const userId = getUser(req);
    await query('DELETE FROM tasks WHERE id=$1 AND user_id=$2', [req.params.id, userId]);
    res.json({ message: 'Deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Projects ───────────────────────────────────────────────

app.get('/api/projects', async (req, res) => {
  try {
    const userId = getUser(req);
    const includeArchived = req.query.includeArchived === 'true';

    let sql = `
      SELECT p.*,
        COUNT(t.id) FILTER (WHERE t.status != 'done') AS task_count,
        COUNT(t.id) FILTER (WHERE t.status = 'in_progress') AS in_progress_count,
        COUNT(t.id) AS total_count,
        COUNT(t.id) FILTER (WHERE t.status = 'done') AS done_count
      FROM projects p
      LEFT JOIN tasks t ON t.project_id = p.id
      WHERE p.user_id = $1
    `;
    if (!includeArchived) sql += ` AND p.archived = false`;
    sql += ` GROUP BY p.id ORDER BY p.created_at ASC`;

    const result = await query(sql, [userId]);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const userId = getUser(req);
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const result = await query(
      'INSERT INTO projects (user_id, name, color) VALUES ($1,$2,$3) RETURNING id',
      [userId, name, color || '#6f6af8']
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/projects/:id', async (req, res) => {
  try {
    const userId = getUser(req);
    const { name, color, archived, archived_at } = req.body;
    await query(
      'UPDATE projects SET name=$1, color=$2, archived=$3, archived_at=$4 WHERE id=$5 AND user_id=$6',
      [name, color, archived ?? false, archived_at || null, req.params.id, userId]
    );
    res.json({ message: 'Updated' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/projects/:id/complete-tasks', async (req, res) => {
  try {
    const userId = getUser(req);
    await query(
      `UPDATE tasks SET status='done', updated_at=NOW() WHERE project_id=$1 AND user_id=$2`,
      [req.params.id, userId]
    );
    res.json({ message: 'Tasks completed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    const userId = getUser(req);
    await query('UPDATE tasks SET project_id=NULL WHERE project_id=$1 AND user_id=$2', [req.params.id, userId]);
    await query('DELETE FROM projects WHERE id=$1 AND user_id=$2', [req.params.id, userId]);
    res.json({ message: 'Deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Events ─────────────────────────────────────────────────

app.get('/api/events', async (req, res) => {
  try {
    const userId = getUser(req);
    const { from, to } = req.query;
    let sql = `SELECT * FROM events WHERE user_id = $1`;
    const params = [userId];
    let i = 2;
    if (from) { sql += ` AND end_date >= $${i++}`;   params.push(from); }
    if (to)   { sql += ` AND start_date <= $${i++}`; params.push(to); }
    sql += ' ORDER BY start_date ASC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/events', async (req, res) => {
  try {
    const userId = getUser(req);
    const { title, start_date, end_date, color, memo } = req.body;
    if (!title || !start_date) return res.status(400).json({ error: 'title, start_date required' });
    const result = await query(
      'INSERT INTO events (user_id, title, start_date, end_date, color, memo) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [userId, title, start_date, end_date || start_date, color || '#e879f9', memo || null]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/events/:id', async (req, res) => {
  try {
    const userId = getUser(req);
    const { title, start_date, end_date, color, memo } = req.body;
    await query(
      'UPDATE events SET title=$1, start_date=$2, end_date=$3, color=$4, memo=$5 WHERE id=$6 AND user_id=$7',
      [title, start_date, end_date, color, memo || null, req.params.id, userId]
    );
    res.json({ message: 'Updated' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  try {
    const userId = getUser(req);
    await query('DELETE FROM events WHERE id=$1 AND user_id=$2', [req.params.id, userId]);
    res.json({ message: 'Deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Settings ───────────────────────────────────────────────

app.get('/api/settings', async (req, res) => {
  try {
    const userId = getUser(req);
    const result = await query('SELECT * FROM settings WHERE user_id=$1', [userId]);
    if (!result.rows.length) {
      // 없으면 기본값 생성
      await query('INSERT INTO settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
      return res.json({ mail_to: '', mail_from: '', mail_time: '08:00' });
    }
    const s = result.rows[0];
    // 보안: API 키는 응답에 포함하지 않음 (서버 환경변수로만 관리)
    res.json({ mail_to: s.mail_to, mail_from: s.mail_from, mail_time: s.mail_time });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const userId = getUser(req);
    const { mail_to, mail_from, mail_time } = req.body;
    await query(`
      INSERT INTO settings (user_id, mail_to, mail_from, mail_time)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (user_id) DO UPDATE
        SET mail_to=$2, mail_from=$3, mail_time=$4, updated_at=NOW()
    `, [userId, mail_to || '', mail_from || '', mail_time || '08:00']);
    res.json({ message: 'Saved' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Stats ──────────────────────────────────────────────────

app.get('/api/stats', async (req, res) => {
  try {
    const userId   = getUser(req);
    const todayStr = today();
    const result = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
        COUNT(*) FILTER (WHERE status != 'done' AND (due_date IS NULL OR due_date = $2)) AS today,
        COUNT(*) FILTER (WHERE due_date < $2 AND status != 'done') AS overdue
      FROM tasks
      WHERE user_id = $1
    `, [userId, todayStr]);
    const r = result.rows[0];
    res.json({
      total:       parseInt(r.in_progress),
      today:       parseInt(r.today),
      in_progress: parseInt(r.in_progress),
      overdue:     parseInt(r.overdue),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 팀원 목록 조회 (드롭다운용) ────────────────────────────

app.get('/api/users', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, email, role FROM users WHERE is_active = true ORDER BY role DESC, name ASC',
      []
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 테스트 메일 ────────────────────────────────────────────

app.post('/api/test-mail', async (req, res) => {
  try {
    const { execSync } = require('child_process');
    const scriptPath = path.join(__dirname, '../scripts/sendDailyTDL.js');
    execSync(`node ${scriptPath}`, { stdio: 'pipe', timeout: 30000 });
    res.json({ message: 'ok' });
  } catch (e) {
    res.status(500).json({ error: e.stderr?.toString() || e.message });
  }
});

// ── SPA 폴백 (React Router 대응) ──────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(PORT, () => console.log(`서버 실행 중: http://localhost:${PORT}`));
