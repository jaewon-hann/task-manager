import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import OKRView from './OKRView.jsx';

function getMondayStr() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d.toISOString().slice(0,10);
}

function WeeklyNoteInline() {
  const weekStart = getMondayStr();
  const [content, setContent] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const isReadOnly = !!localStorage.getItem('targetUserId');

  React.useEffect(() => {
    api.weeklyNotes.get(weekStart).then(d => setContent(d.content || '')).catch(() => {});
  }, [weekStart]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.weeklyNotes.save(weekStart, draft);
      setContent(draft);
      setEditing(false);
    } catch(e) {}
    setSaving(false);
  };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '14px', fontWeight: '700' }}>📝 이번 주 메모</span>
        {!isReadOnly && !editing && (
          <button onClick={() => { setDraft(content); setEditing(true); }} style={{ fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>편집</button>
        )}
        {editing && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleSave} disabled={saving} style={{ fontSize: '12px', color: '#fff', background: 'var(--accent)', border: 'none', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer' }}>{saving ? '저장 중...' : '저장'}</button>
            <button onClick={() => setEditing(false)} style={{ fontSize: '12px', color: 'var(--text2)', background: 'none', border: '1px solid var(--border2)', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer' }}>취소</button>
          </div>
        )}
      </div>
      <div style={{ padding: '14px 16px', minHeight: '70px' }}>
        {editing ? (
          <textarea autoFocus value={draft} onChange={e => setDraft(e.target.value)}
            placeholder="이번 주 계획, 목표, 메모를 자유롭게 작성하세요..."
            style={{ width: '100%', minHeight: '70px', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '13px', resize: 'vertical', lineHeight: '1.7', fontFamily: 'var(--sans)' }} />
        ) : content ? (
          <div onClick={() => { if (!isReadOnly) { setDraft(content); setEditing(true); } }}
            style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: '1.7', whiteSpace: 'pre-wrap', wordBreak: 'break-word', cursor: isReadOnly ? 'default' : 'pointer' }}>
            {content}
          </div>
        ) : (
          <div onClick={() => { if (!isReadOnly) { setDraft(''); setEditing(true); } }}
            style={{ fontSize: '13px', color: 'var(--text3)', fontStyle: 'italic', cursor: isReadOnly ? 'default' : 'pointer' }}>
            {isReadOnly ? '작성된 메모가 없습니다.' : '클릭해서 이번 주 메모를 작성하세요...'}
          </div>
        )}
      </div>
    </div>
  );
}



const PRIORITY_COLOR = { high: '#f06060', medium: '#f7c843', low: '#4ecca3' };
const STATUS_LABEL   = { todo: '할 일', in_progress: '진행 중', done: '완료' };

function renderMemo(text) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.split(urlRegex).map((part, i) =>
    urlRegex.test(part)
      ? <a key={i} href={part} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
          style={{ color: 'var(--accent)', textDecoration: 'underline', wordBreak: 'break-all' }}>{part}</a>
      : <span key={i}>{part}</span>
  );
}

function StatCard({ label, value, color, sub, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ background: 'var(--surface)', border: `1px solid ${hovered && onClick ? color : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '16px 18px', borderTop: `2px solid ${color}`, cursor: onClick ? 'pointer' : 'default', transform: hovered && onClick ? 'translateY(-2px)' : 'none', transition: 'all 0.15s' }}>
      <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '6px', fontFamily: 'var(--mono)' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '5px' }}>{sub}</div>}
      {onClick && <div style={{ fontSize: '11px', color, marginTop: '5px', opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}>클릭해서 보기 →</div>}
    </div>
  );
}

function TaskRow({ task }) {
  const [expanded, setExpanded] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = task.due_date && task.due_date < today && task.status !== 'done';
  const isDone = task.status === 'done';
  return (
    <div style={{ borderBottom: '1px solid var(--border)', opacity: isDone ? 0.75 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 16px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? '#4ecca3' : PRIORITY_COLOR[task.priority] || 'var(--text3)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div onClick={() => task.memo && setExpanded(e => !e)}
            style={{ fontSize: '13px', color: isDone ? 'var(--text3)' : 'var(--text)', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: task.memo ? 'pointer' : 'default', textDecoration: isDone ? 'line-through' : 'none' }}>
            {task.memo && <span style={{ fontSize: '10px', marginRight: '5px', color: 'var(--text3)' }}>{expanded ? '▼' : '▶'}</span>}
            {task.title}
          </div>
          {task.project_name && <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>{task.project_name}</div>}
        </div>
        {isDone
          ? <span style={{ fontSize: '11px', color: '#4ecca3', flexShrink: 0 }}>✓ 완료</span>
          : task.due_date && <div style={{ fontSize: '11px', color: isOverdue ? 'var(--danger)' : 'var(--text3)', fontFamily: 'var(--mono)', flexShrink: 0 }}>{isOverdue ? '⚠ ' : ''}{task.due_date}</div>
        }
        {!isDone && (
          <div style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: task.status === 'in_progress' ? 'rgba(111,106,248,0.15)' : 'var(--surface2)', color: task.status === 'in_progress' ? 'var(--accent)' : 'var(--text3)', flexShrink: 0 }}>
            {STATUS_LABEL[task.status]}
          </div>
        )}
      </div>
      {expanded && task.memo && (
        <div style={{ padding: '0 16px 12px 36px', fontSize: '12px', color: 'var(--text2)', lineHeight: '1.7', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {renderMemo(task.memo)}
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ onNavigate }) {
  const [stats, setStats]         = useState({ total: 0, today: 0, in_progress: 0, overdue: 0 });
  const [todayTasks, setTodayTasks] = useState([]);
  const [weekTasks, setWeekTasks]   = useState([]);
  const [projects, setProjects]     = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([api.stats(), api.tasks.today(), api.tasks.week(), api.projects.list()])
      .then(([s, t, w, p]) => { setStats(s); setTodayTasks(t); setWeekTasks(w); setProjects(p); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text3)' }}>로딩 중...</div>;

  const today_str = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

  return (
    <div>
      <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: '20px', fontWeight: '700' }}>대시보드</div>
        <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px', fontFamily: 'var(--mono)' }}>{today_str}</div>
      </div>

      <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* 1. 월별 OKR - 맨 위 */}
        <OKRView />
        <WeeklyNoteInline />

        {/* 2. 통계 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px' }}>
          <StatCard label="전체 업무"    value={stats.total}       color="var(--accent)" sub="진행 중 업무"       onClick={() => onNavigate('tasks')} />
          <StatCard label="오늘 할 일"   value={stats.today}       color="#4ecca3"        sub="오늘 마감"      onClick={() => onNavigate('today')} />
          <StatCard label="진행 중"      value={stats.in_progress} color="#f7c843"        sub="작업 중인 업무" onClick={() => onNavigate('tasks', { status: 'in_progress' })} />
          <StatCard label="기한 초과"    value={stats.overdue}     color="var(--danger)"  sub="즉시 처리 필요" onClick={() => onNavigate('tasks', { overdue: true })} />
        </div>

        {/* 3. 오늘 할 일 + 이번 주 업무 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: '700' }}>오늘 할 일</span>
              <button onClick={() => onNavigate('today')} style={{ fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>전체 보기 →</button>
            </div>
            {todayTasks.length === 0
              ? <div style={{ padding: '20px 16px', color: 'var(--text3)', fontSize: '13px' }}>오늘 마감 업무 없음 🎉</div>
              : todayTasks.slice(0, 5).map(t => <TaskRow key={t.id} task={t} />)}
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: '700' }}>이번 주 업무</span>
              <button onClick={() => onNavigate('week')} style={{ fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>전체 보기 →</button>
            </div>
            {weekTasks.length === 0
              ? <div style={{ padding: '20px 16px', color: 'var(--text3)', fontSize: '13px' }}>이번 주 예정 업무 없음</div>
              : weekTasks.slice(0, 5).map(t => <TaskRow key={t.id} task={t} />)}
          </div>
        </div>

        {/* 4. 프로젝트별 현황 - 맨 아래 */}
        {projects.filter(p => !p.archived).length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px' }}>
            <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '14px' }}>프로젝트별 현황</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {projects.filter(p => !p.archived).map(p => {
                const progressPct = p.total_count > 0 ? Math.round((p.in_progress_count / p.total_count) * 100) : 0;
                return (
                  <div key={p.id} style={{ cursor: 'pointer' }} onClick={() => onNavigate('tasks', { project_id: String(p.id) })}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text)' }}>{p.name}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                        진행 중 {p.in_progress_count} / 전체 {p.total_count}건 ({progressPct}%) →
                      </span>
                    </div>
                    <div style={{ height: '5px', background: 'var(--surface2)', borderRadius: '3px' }}>
                      <div style={{ height: '5px', background: p.color || 'var(--accent)', borderRadius: '3px', width: `${progressPct}%`, minWidth: progressPct > 0 ? '5px' : '0', transition: 'width 0.5s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
