require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { load, save, nextId, initDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

initDB();

const today = () => new Date().toISOString().slice(0, 10);
const now   = () => new Date().toISOString();

// ── Tasks ──────────────────────────────────────────

app.get('/api/tasks', (req, res) => {
  const data = load();
  const { project_id, status, priority, due_from, due_to, overdue, exclude_done, created_from } = req.query;
  const todayStr = today();

  let tasks = data.tasks.map(t => ({
    ...t,
    project_name:  data.projects.find(p => p.id === t.project_id)?.name  || null,
    project_color: data.projects.find(p => p.id === t.project_id)?.color || null,
  }));

  if (project_id)          tasks = tasks.filter(t => String(t.project_id) === String(project_id));
  if (status)              tasks = tasks.filter(t => t.status === status);
  if (priority)            tasks = tasks.filter(t => t.priority === priority);
  if (due_from)            tasks = tasks.filter(t => t.due_date && t.due_date >= due_from);
  if (due_to)              tasks = tasks.filter(t => t.due_date && t.due_date <= due_to);
  if (overdue === '1')     tasks = tasks.filter(t => t.due_date && t.due_date < todayStr && t.status !== 'done');
  if (exclude_done === '1') tasks = tasks.filter(t => t.status !== 'done');
  if (created_from)        tasks = tasks.filter(t => (t.created_at || '') >= created_from);

  const pri = { high: 1, medium: 2, low: 3 };
  tasks.sort((a, b) => (pri[a.priority] || 2) - (pri[b.priority] || 2) || (a.due_date || 'z').localeCompare(b.due_date || 'z'));
  res.json(tasks);
});

app.get('/api/tasks/today', (req, res) => {
  const data = load();
  const todayStr = today();
  let tasks = data.tasks
    .filter(t => t.status !== 'done' && (!t.due_date || t.due_date === todayStr))
    .map(t => ({ ...t, project_name: data.projects.find(p => p.id === t.project_id)?.name || null }));
  const pri = { high: 1, medium: 2, low: 3 };
  tasks.sort((a, b) => (t => (pri[a.priority]||2) - (pri[b.priority]||2))(0) || (a.due_date ? 0 : 1) - (b.due_date ? 0 : 1));
  res.json(tasks);
});

app.get('/api/tasks/week', (req, res) => {
  const data = load();
  const now2 = new Date();
  const monday = new Date(now2); monday.setDate(now2.getDate() - now2.getDay() + 1);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const fmt = d => d.toISOString().slice(0, 10);
  const [mon, sun] = [fmt(monday), fmt(sunday)];

  let tasks = data.tasks
    .filter(t => t.status !== 'done' && (!t.due_date || (t.due_date >= mon && t.due_date <= sun) || t.status === 'in_progress'))
    .map(t => ({ ...t, project_name: data.projects.find(p => p.id === t.project_id)?.name || null }));
  const pri = { high: 1, medium: 2, low: 3 };
  tasks.sort((a, b) => (a.due_date || 'z').localeCompare(b.due_date || 'z') || (pri[a.priority]||2) - (pri[b.priority]||2));
  res.json(tasks);
});

app.get('/api/tasks/month', (req, res) => {
  const data = load();
  const n = new Date();
  const firstDay = new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0, 10);
  const lastDay  = new Date(n.getFullYear(), n.getMonth() + 1, 0).toISOString().slice(0, 10);

  let tasks = data.tasks
    .filter(t => t.status !== 'done' && (!t.due_date || (t.due_date >= firstDay && t.due_date <= lastDay) || t.status === 'in_progress'))
    .map(t => ({ ...t, project_name: data.projects.find(p => p.id === t.project_id)?.name || null }));
  const pri = { high: 1, medium: 2, low: 3 };
  tasks.sort((a, b) => (a.due_date || 'z').localeCompare(b.due_date || 'z') || (pri[a.priority]||2) - (pri[b.priority]||2));
  res.json(tasks);
});

app.get('/api/tasks/:id', (req, res) => {
  const data = load();
  const task = data.tasks.find(t => t.id === Number(req.params.id));
  if (!task) return res.status(404).json({ error: 'Not found' });
  res.json({ ...task, project_name: data.projects.find(p => p.id === task.project_id)?.name || null });
});

app.post('/api/tasks', (req, res) => {
  const data = load();
  const { title, project_id, category, priority, status, due_date, memo } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const task = {
    id: nextId(data, 'tasks'),
    title, memo: memo || null, category: category || null,
    project_id: project_id ? Number(project_id) : null,
    priority: priority || 'medium', status: status || 'todo',
    due_date: due_date || null,
    created_at: now(), updated_at: now(),
  };
  data.tasks.push(task);
  save(data);
  res.status(201).json({ id: task.id, message: 'Created' });
});

app.put('/api/tasks/:id', (req, res) => {
  const data = load();
  const idx = data.tasks.findIndex(t => t.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const { title, project_id, category, priority, status, due_date, memo } = req.body;
  data.tasks[idx] = { ...data.tasks[idx], title, memo: memo || null, category: category || null, project_id: project_id ? Number(project_id) : null, priority, status, due_date: due_date || null, updated_at: now() };
  save(data);
  res.json({ message: 'Updated' });
});

app.delete('/api/tasks/:id', (req, res) => {
  const data = load();
  data.tasks = data.tasks.filter(t => t.id !== Number(req.params.id));
  save(data);
  res.json({ message: 'Deleted' });
});

// ── Projects ───────────────────────────────────────

app.get('/api/projects', (req, res) => {
  const data = load();
  const includeArchived = req.query.includeArchived === 'true';
  const projects = data.projects
    .filter(p => includeArchived || !p.archived)
    .map(p => ({
      ...p,
      task_count: data.tasks.filter(t => t.project_id === p.id && t.status !== 'done').length,
    }));
  res.json(projects);
});

app.post('/api/projects', (req, res) => {
  const data = load();
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const project = { id: nextId(data, 'projects'), name, color: color || '#6f6af8', created_at: now() };
  data.projects.push(project);
  save(data);
  res.status(201).json({ id: project.id });
});

app.put('/api/projects/:id', (req, res) => {
  const data = load();
  const idx = data.projects.findIndex(p => p.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data.projects[idx] = { ...data.projects[idx], ...req.body };
  save(data);
  res.json({ message: 'Updated' });
});

app.post('/api/projects/:id/complete-tasks', (req, res) => {
  const data = load();
  const id = Number(req.params.id);
  data.tasks = data.tasks.map(t =>
    t.project_id === id ? { ...t, status: 'done', updated_at: now() } : t
  );
  save(data);
  res.json({ message: 'Tasks completed' });
});

app.delete('/api/projects/:id', (req, res) => {
  const data = load();
  data.projects = data.projects.filter(p => p.id !== Number(req.params.id));
  data.tasks = data.tasks.map(t => t.project_id === Number(req.params.id) ? { ...t, project_id: null } : t);
  save(data);
  res.json({ message: 'Deleted' });
});

app.post('/api/test-mail', async (req, res) => {
  try {
    const { execSync } = require('child_process');
    const path = require('path');
    const script = path.join(__dirname, '../scripts/sendDailyTDL.js');
    execSync(`node ${script}`, { stdio: 'pipe', timeout: 30000 });
    res.json({ message: 'ok' });
  } catch (e) {
    res.status(500).json({ error: e.stderr?.toString() || e.message });
  }
});

// ── Settings ───────────────────────────────────────

app.get('/api/settings', (req, res) => {
  res.json(load().settings);
});

app.put('/api/settings', (req, res) => {
  const data = load();
  data.settings = { ...data.settings, ...req.body };
  save(data);
  res.json({ message: 'Saved' });
});

// ── Stats ──────────────────────────────────────────

app.get('/api/stats', (req, res) => {
  const data = load();
  const todayStr = today();
  res.json({
    total:       data.tasks.filter(t => t.status !== 'done').length,
    today:       data.tasks.filter(t => t.status !== 'done' && (!t.due_date || t.due_date === todayStr)).length,
    in_progress: data.tasks.filter(t => t.status === 'in_progress').length,
    overdue:     data.tasks.filter(t => t.due_date && t.due_date < todayStr && t.status !== 'done').length,
  });
});

app.listen(PORT, () => console.log(`서버 실행 중: http://localhost:${PORT}`));
