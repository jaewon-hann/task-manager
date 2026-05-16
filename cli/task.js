#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Command } = require('commander');
const { initDB, getDB } = require('../server/db');

initDB();
const db = getDB();

const program = new Command();
program.name('task').description('업무 관리 CLI').version('1.0.0');

const priorityLabel = { high: '🔴 높음', medium: '🟡 중간', low: '🟢 낮음' };
const statusLabel   = { todo: '📋 할 일', in_progress: '⚡ 진행 중', done: '✅ 완료' };

function printTask(t) {
  console.log(`\n  #${t.id} ${t.title}`);
  console.log(`     ${statusLabel[t.status] || t.status}  ${priorityLabel[t.priority] || t.priority}`);
  if (t.project_name) console.log(`     📁 ${t.project_name}`);
  if (t.category)     console.log(`     🏷  ${t.category}`);
  if (t.due_date)     console.log(`     📅 마감: ${t.due_date}`);
  if (t.memo)         console.log(`     💬 ${t.memo}`);
}

// ── task add ───────────────────────────────────────
program
  .command('add <title>')
  .description('업무 추가')
  .option('-p, --project <name>', '프로젝트 이름')
  .option('-c, --category <category>', '카테고리')
  .option('--priority <level>', '우선순위 (high/medium/low)', 'medium')
  .option('-d, --due <date>', '마감일 (YYYY-MM-DD)')
  .option('-m, --memo <memo>', '메모')
  .action((title, opts) => {
    let projectId = null;
    if (opts.project) {
      const proj = db.prepare('SELECT id FROM projects WHERE name LIKE ?').get(`%${opts.project}%`);
      if (!proj) { console.log(`❌ 프로젝트 "${opts.project}"를 찾을 수 없습니다.`); return; }
      projectId = proj.id;
    }
    const result = db.prepare(
      'INSERT INTO tasks (title, project_id, category, priority, due_date, memo) VALUES (?,?,?,?,?,?)'
    ).run(title, projectId, opts.category || null, opts.priority, opts.due || null, opts.memo || null);
    console.log(`✅ 업무 추가됨 #${result.lastInsertRowid}: ${title}`);
  });

// ── task today ─────────────────────────────────────
program
  .command('today')
  .description('오늘 할 일 조회')
  .action(() => {
    const today = new Date().toISOString().slice(0, 10);
    const rows = db.prepare(`
      SELECT t.*, p.name as project_name FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.due_date = ? AND t.status != 'done'
      ORDER BY CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
    `).all(today);

    console.log(`\n📅 오늘 할 일 (${today}) — ${rows.length}건`);
    if (!rows.length) { console.log('  없음 🎉'); return; }
    rows.forEach(printTask);
    console.log('');
  });

// ── task list ──────────────────────────────────────
program
  .command('list')
  .description('업무 목록 조회')
  .option('-p, --project <name>', '프로젝트 필터')
  .option('-s, --status <status>', '상태 필터 (todo/in_progress/done)')
  .option('--priority <level>', '우선순위 필터')
  .action((opts) => {
    let sql = `
      SELECT t.*, p.name as project_name FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id WHERE 1=1
    `;
    const params = [];
    if (opts.project)  { sql += ' AND p.name LIKE ?'; params.push(`%${opts.project}%`); }
    if (opts.status)   { sql += ' AND t.status = ?';  params.push(opts.status); }
    if (opts.priority) { sql += ' AND t.priority = ?'; params.push(opts.priority); }
    sql += ' ORDER BY CASE t.priority WHEN "high" THEN 1 WHEN "medium" THEN 2 ELSE 3 END, t.due_date ASC NULLS LAST';

    const rows = db.prepare(sql).all(...params);
    console.log(`\n📋 업무 목록 — ${rows.length}건`);
    if (!rows.length) { console.log('  없음'); return; }
    rows.forEach(printTask);
    console.log('');
  });

// ── task done ──────────────────────────────────────
program
  .command('done <id>')
  .description('업무 완료 처리')
  .action((id) => {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) { console.log(`❌ #${id} 없음`); return; }
    db.prepare("UPDATE tasks SET status='done' WHERE id=?").run(id);
    console.log(`✅ 완료: #${id} ${task.title}`);
  });

// ── task status ────────────────────────────────────
program
  .command('status <id> <status>')
  .description('상태 변경 (todo/in_progress/done)')
  .action((id, status) => {
    if (!['todo', 'in_progress', 'done'].includes(status)) {
      console.log('❌ 상태는 todo / in_progress / done 중 하나여야 합니다.'); return;
    }
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) { console.log(`❌ #${id} 없음`); return; }
    db.prepare('UPDATE tasks SET status=? WHERE id=?').run(status, id);
    console.log(`📝 #${id} 상태 변경: ${statusLabel[status]}`);
  });

// ── task projects ──────────────────────────────────
program
  .command('projects')
  .description('프로젝트 목록 조회')
  .action(() => {
    const rows = db.prepare(`
      SELECT p.*, COUNT(t.id) as task_count FROM projects p
      LEFT JOIN tasks t ON t.project_id = p.id AND t.status != 'done'
      GROUP BY p.id ORDER BY p.name
    `).all();
    console.log(`\n📁 프로젝트 (${rows.length}개)`);
    rows.forEach(p => console.log(`  ${p.name}  (진행 중 ${p.task_count}건)`));
    console.log('');
  });

// ── task delete ────────────────────────────────────
program
  .command('delete <id>')
  .description('업무 삭제')
  .action((id) => {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) { console.log(`❌ #${id} 없음`); return; }
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    console.log(`🗑  삭제됨: #${id} ${task.title}`);
  });

program.parse();
