import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';
import TaskModal from '../components/TaskModal.jsx';

const PRIORITY_COLOR = { high: '#f06060', medium: '#f7c843', low: '#4ecca3' };
const STATUS_STYLE   = {
  todo:        { bg: 'var(--surface2)',        color: 'var(--text3)' },
  active: { bg: 'rgba(111,106,248,0.15)', color: 'var(--accent)' },
  done:        { bg: 'rgba(78,204,163,0.15)',  color: '#4ecca3' },
};
const PAGE_TITLE = { all: '전체 업무', today: '오늘 할 일', week: '이번 주', month: '이번 달', archive: '아카이브' };

const PERIOD_OPTIONS = [
  { value: '1', label: '최근 1개월' },
  { value: '3', label: '최근 3개월' },
  { value: '6', label: '최근 6개월' },
  { value: '0', label: '전체' },
];

function renderMemo(text) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.split(urlRegex).map((part, i) =>
    urlRegex.test(part)
      ? <a key={i} href={part} target="_blank" rel="noreferrer"
          onClick={e => e.stopPropagation()}
          style={{ color: 'var(--accent)', textDecoration: 'underline', wordBreak: 'break-all' }}>{part}</a>
      : <span key={i}>{part}</span>
  );
}

export default function TaskList({ filter = 'all', params = {} }) {
  const [tasks, setTasks]       = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null);
  const [expanded, setExpanded] = useState({});
  const [period, setPeriod]     = useState('1'); // 기본 1개월
  const [filters, setFilters]   = useState({
    project_id: params.project_id || '',
    priority:   '',
  });
  const [search, setSearch] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let taskPromise;

      if (filter === 'today') {
        taskPromise = api.tasks.today();
      } else if (filter === 'week') {
        taskPromise = api.tasks.week();
      } else if (filter === 'month') {
        taskPromise = api.tasks.month();
      } else if (filter === 'archive') {
        // 완료 업무만
        const q = new URLSearchParams({ status: 'done' });
        if (filters.project_id) q.set('project_id', filters.project_id);
        if (period !== '0') {
          const from = new Date();
          from.setMonth(from.getMonth() - Number(period));
          q.set('due_from', from.toISOString().slice(0, 10));
        }
        taskPromise = api.tasks.list('?' + q.toString());
      } else {
        // 전체 업무 - 완료 제외, 기간 필터
        const activeFilters = [];
        if (filters.project_id) activeFilters.push(['project_id', filters.project_id]);
        if (filters.priority)   activeFilters.push(['priority', filters.priority]);
        if (params.status)      activeFilters.push(['status', params.status]);
        if (params.overdue)     activeFilters.push(['overdue', '1']);

        // 완료 제외 (overdue나 status 필터 없을 때)
        if (!params.status && !params.overdue) {
          activeFilters.push(['exclude_done', '1']);
        }

        // 기간 필터
        if (period !== '0') {
          const from = new Date();
          from.setMonth(from.getMonth() - Number(period));
          activeFilters.push(['created_from', from.toISOString().slice(0, 10)]);
        }

        taskPromise = api.tasks.list('?' + new URLSearchParams(activeFilters).toString());
      }

      const [t, p] = await Promise.all([taskPromise, api.projects.list()]);
      setTasks(t);
      setProjects(p);
    } finally {
      setLoading(false);
    }
  }, [filter, filters, period, params.overdue, params.status]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (data) => {
    if (modal === 'create') {
      // 오늘 할 일 탭에서 추가하면 당일 날짜 자동 설정
      if (filter === 'today') {
        data.due_date = new Date().toISOString().slice(0, 10);
      }
      await api.tasks.create(data);
    } else {
      await api.tasks.update(modal.id, data);
    }
    setModal(null);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await api.tasks.delete(id);
    load();
  };

  const handleStatusChange = async (task, status) => {
    await api.tasks.update(task.id, { ...task, status });
    load();
  };

  const toggleExpand = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const filtered = tasks.filter(t =>
    !search || t.title.toLowerCase().includes(search.toLowerCase())
  );

  const showPeriodFilter = filter === 'all' || filter === 'archive';

  return (
    <div>
      <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '20px', fontWeight: '700' }}>{PAGE_TITLE[filter]}</div>
          {filter === 'archive' && (
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>완료된 업무 모음</div>
          )}
          {filter === 'all' && (
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>완료 업무 제외 · 착수인 업무</div>
          )}
        </div>
        <button onClick={() => setModal('create')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--accent)', color: '#fff', border: 'none', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
          + 업무 추가
        </button>
      </div>

      {(filter === 'all' || filter === 'archive') && (
        <div style={{ padding: '12px 28px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input placeholder="검색..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '13px', width: '160px' }} />
          <select value={filters.project_id} onChange={e => setFilters(f => ({ ...f, project_id: e.target.value }))}
            style={{ padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '13px' }}>
            <option value="">전체 프로젝트</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {filter === 'all' && (
            <select value={filters.priority} onChange={e => setFilters(f => ({ ...f, priority: e.target.value }))}
              style={{ padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '13px' }}>
              <option value="">전체 우선순위</option>
              <option value="high">높음</option>
              <option value="medium">중간</option>
              <option value="low">낮음</option>
            </select>
          )}
          {showPeriodFilter && (
            <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
              {PERIOD_OPTIONS.map(o => (
                <button key={o.value} onClick={() => setPeriod(o.value)}
                  style={{ padding: '6px 12px', borderRadius: '20px', border: period === o.value ? 'none' : '1px solid var(--border2)', background: period === o.value ? 'var(--accent)' : 'transparent', color: period === o.value ? '#fff' : 'var(--text3)', fontSize: '12px', cursor: 'pointer' }}>
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ padding: '16px 28px' }}>
        {loading ? (
          <div style={{ color: 'var(--text3)', padding: '40px 0', textAlign: 'center' }}>로딩 중...</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: 'var(--text3)', padding: '40px 0', textAlign: 'center' }}>
            {filter === 'archive' ? '완료된 업무가 없습니다' : '업무가 없습니다'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filtered.map(task => {
              const isOverdue = task.due_date && task.due_date < today && task.status !== 'done';
              const daysOverdue = isOverdue ? Math.floor((new Date(today) - new Date(task.due_date)) / 86400000) : 0;
              const ss = STATUS_STYLE[task.status] || STATUS_STYLE.todo;
              const isExpanded = expanded[task.id];

              const isDone = task.status === 'done';

              return (
                <div key={task.id} style={{
                  background: isDone ? 'rgba(78,204,163,0.04)' : 'var(--surface)',
                  border: `1px solid ${isDone ? 'rgba(78,204,163,0.2)' : isOverdue ? 'rgba(240,96,96,0.3)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                  opacity: isDone ? 0.8 : 1,
                }}>
                  <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: isDone ? '#4ecca3' : PRIORITY_COLOR[task.priority] || 'var(--text3)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div onClick={() => task.memo && toggleExpand(task.id)}
                        style={{ fontSize: '14px', fontWeight: '500', color: isDone ? 'var(--text3)' : 'var(--text)', textDecoration: isDone ? 'line-through' : 'none', cursor: task.memo ? 'pointer' : 'default', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {task.memo && <span style={{ fontSize: '10px', marginRight: '6px', color: 'var(--text3)' }}>{isExpanded ? '▼' : '▶'}</span>}
                        {task.title}
                      </div>
                      <div style={{ display: 'flex', gap: '10px', marginTop: '5px', flexWrap: 'wrap' }}>
                        {task.project_name && <span style={{ fontSize: '11px', color: 'var(--text3)' }}>📁 {task.project_name}</span>}
                        {task.category     && <span style={{ fontSize: '11px', color: 'var(--text3)' }}>🏷 {task.category}</span>}
                        {task.due_date     && !isDone && <span style={{ fontSize: '11px', color: isOverdue ? 'var(--danger)' : 'var(--text3)', fontFamily: 'var(--mono)' }}>{isOverdue ? `⚠ ${daysOverdue}일 초과` : `📅 ${task.due_date}`}</span>}
                        {isDone && <span style={{ fontSize: '11px', color: '#4ecca3' }}>✓ 완료</span>}
                      </div>
                    </div>
                    {filter !== 'archive' && (
                      <select value={task.status} onChange={e => handleStatusChange(task, e.target.value)}
                        style={{ padding: '4px 10px', borderRadius: '20px', border: 'none', background: ss.bg, color: ss.color, fontSize: '12px', fontFamily: 'var(--sans)', cursor: 'pointer' }}>
                        <option value="todo">할 일</option>
                        <option value="active">착수</option>
                        <option value="done">완료</option>
                      </select>
                    )}
                    {filter === 'archive' && (
                      <span style={{ padding: '4px 10px', borderRadius: '20px', background: 'rgba(78,204,163,0.15)', color: '#4ecca3', fontSize: '12px' }}>완료</span>
                    )}
                    <button onClick={() => setModal(task)} style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '5px 10px', color: 'var(--text2)', fontSize: '12px', cursor: 'pointer' }}>수정</button>
                    <button onClick={() => handleDelete(task.id)} style={{ background: 'rgba(240,96,96,0.1)', border: '1px solid rgba(240,96,96,0.2)', borderRadius: 'var(--radius-sm)', padding: '5px 10px', color: 'var(--danger)', fontSize: '12px', cursor: 'pointer' }}>삭제</button>
                  </div>
                  {isExpanded && task.memo && (
                    <div style={{ padding: '0 18px 14px 42px', fontSize: '13px', color: 'var(--text2)', lineHeight: '1.7', borderTop: '1px solid var(--border)', paddingTop: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {renderMemo(task.memo)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal && (
        <TaskModal task={modal === 'create' ? null : modal} projects={projects} onSave={handleSave} onClose={() => setModal(null)} hideDueDate={filter === 'today' && modal === 'create'} />
      )}
    </div>
  );
}
