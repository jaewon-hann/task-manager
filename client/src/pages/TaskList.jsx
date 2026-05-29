import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';
import TaskModal from '../components/TaskModal.jsx';

const PRIORITY_COLOR = { high: '#f06060', medium: '#f7c843', low: '#4ecca3' };
const STATUS_STYLE   = {
  todo:        { bg: 'var(--surface2)',        color: 'var(--text3)' },
  in_progress: { bg: 'rgba(111,106,248,0.15)', color: 'var(--accent)' },
  done:        { bg: 'rgba(78,204,163,0.15)',  color: '#4ecca3' },
};
const PAGE_TITLE = { all: '전체 업무', today: '오늘 할 일', week: '이번 주', month: '이번 달' };

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
  const [tasks, setTasks]           = useState([]);
  const [projects, setProjects]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(null);
  const [expanded, setExpanded]     = useState({});
  const [period, setPeriod]         = useState('1');
  const [excludeDone, setExcludeDone] = useState(false);
  const [projectMemo, setProjectMemo] = useState('');
  const [filters, setFilters]       = useState({
    project_id: params.project_id || '',
  });
  const [search, setSearch] = useState('');

  const isReadOnly = !!localStorage.getItem('targetUserId');
  const today = (() => { const d = new Date(); return new Date(d.getTime() + 9*60*60*1000).toISOString().slice(0,10); })();

  // params 변경시 filters 업데이트
  useEffect(() => {
    setFilters(f => ({ ...f, project_id: params.project_id || '' }));
  }, [params.project_id]);

  // 프로젝트 선택 시 메모 로드
  useEffect(() => {
    if (filters.project_id) {
      // projects에서 해당 프로젝트 메모 표시 (나중에 project_memo 테이블 추가 가능)
      const p = projects.find(p => String(p.id) === String(filters.project_id));
      setProjectMemo(p?.memo || '');
    } else {
      setProjectMemo('');
    }
  }, [filters.project_id, projects]);

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
      } else {
        // 전체 업무 - 완료된 프로젝트 포함, 완료 업무 토글로 제어
        const activeFilters = [];
        if (filters.project_id) activeFilters.push(['project_id', filters.project_id]);
        if (params.status)      activeFilters.push(['status', params.status]);
        if (params.overdue)     activeFilters.push(['overdue', '1']);
        if (excludeDone && !params.status && !params.overdue) {
          activeFilters.push(['exclude_done', '1']);
        }
        if (period !== '0') {
          const from = new Date();
          from.setMonth(from.getMonth() - Number(period));
          activeFilters.push(['created_from', from.toISOString().slice(0, 10)]);
        }
        taskPromise = api.tasks.list('?' + new URLSearchParams(activeFilters).toString());
      }

      // 완료된 프로젝트 포함해서 가져오기
      const [t, p] = await Promise.all([
        taskPromise,
        api.projects.list(true), // includeArchived = true
      ]);
      setTasks(t);
      setProjects(p);
    } finally {
      setLoading(false);
    }
  }, [filter, filters, period, excludeDone, params.overdue, params.status]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (data) => {
    if (modal === 'create') {
      if (filter === 'today') {
        data.due_date = today;
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

  const selectedProject = filters.project_id
    ? projects.find(p => String(p.id) === String(filters.project_id))
    : null;

  const showFilters = filter === 'all';

  return (
    <div>
      <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '20px', fontWeight: '700' }}>{PAGE_TITLE[filter] || '전체 업무'}</div>
          {filter === 'all' && (
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>
              {selectedProject ? `📁 ${selectedProject.name}` : '전체 프로젝트'}
            </div>
          )}
        </div>
        {!isReadOnly && (
          <button onClick={() => setModal('create')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--accent)', color: '#fff', border: 'none', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
            + 업무 추가
          </button>
        )}
      </div>

      {showFilters && (
        <div style={{ padding: '12px 28px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input placeholder="검색..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '13px', width: '160px' }} />

          <select value={filters.project_id} onChange={e => setFilters(f => ({ ...f, project_id: e.target.value }))}
            style={{ padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '13px' }}>
            <option value="">전체 프로젝트</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}{p.archived ? ' (완료됨)' : ''}
              </option>
            ))}
          </select>

          {/* 완료 업무 제외 토글 */}
          <button onClick={() => setExcludeDone(v => !v)}
            style={{ padding: '7px 14px', borderRadius: '20px', border: `1px solid ${excludeDone ? 'var(--accent)' : 'var(--border2)'}`, background: excludeDone ? 'rgba(111,106,248,0.15)' : 'transparent', color: excludeDone ? 'var(--accent)' : 'var(--text3)', fontSize: '12px', cursor: 'pointer', fontWeight: excludeDone ? '700' : '400', transition: 'all 0.15s' }}>
            {excludeDone ? '✓ 완료 업무 제외 중' : '완료 업무 제외'}
          </button>

          <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
            {PERIOD_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setPeriod(o.value)}
                style={{ padding: '6px 12px', borderRadius: '20px', border: period === o.value ? 'none' : '1px solid var(--border2)', background: period === o.value ? 'var(--accent)' : 'transparent', color: period === o.value ? '#fff' : 'var(--text3)', fontSize: '12px', cursor: 'pointer' }}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 프로젝트 메모 (B방식) */}
      {selectedProject && (
        <div style={{ padding: '12px 28px', borderBottom: '1px solid var(--border)', background: 'rgba(111,106,248,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: selectedProject.color || 'var(--accent)', flexShrink: 0 }} />
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>{selectedProject.name}</span>
            {selectedProject.archived && (
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: 'rgba(78,204,163,0.15)', color: 'var(--teal)' }}>완료된 프로젝트</span>
            )}
            <span style={{ fontSize: '11px', color: 'var(--text3)', marginLeft: 'auto' }}>
              전체 {selectedProject.total_count}건 · 진행중 {selectedProject.in_progress_count}건 · 완료 {selectedProject.done_count}건
            </span>
          </div>
          {projectMemo && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text2)', lineHeight: '1.7', whiteSpace: 'pre-wrap', paddingLeft: '20px' }}>
              {projectMemo}
            </div>
          )}
        </div>
      )}

      <div style={{ padding: '16px 28px' }}>
        {loading ? (
          <div style={{ color: 'var(--text3)', padding: '40px 0', textAlign: 'center' }}>로딩 중...</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: 'var(--text3)', padding: '40px 0', textAlign: 'center' }}>업무가 없습니다</div>
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
                  borderRadius: 'var(--radius)', opacity: isDone ? 0.8 : 1,
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
                        {task.due_date && !isDone && <span style={{ fontSize: '11px', color: isOverdue ? 'var(--danger)' : 'var(--text3)', fontFamily: 'var(--mono)' }}>{isOverdue ? `⚠ ${daysOverdue}일 초과` : `📅 ${task.due_date}`}</span>}
                        {isDone && <span style={{ fontSize: '11px', color: '#4ecca3' }}>✓ 완료</span>}
                      </div>
                    </div>
                    {!isReadOnly && (
                      <select value={task.status} onChange={e => handleStatusChange(task, e.target.value)}
                        style={{ padding: '4px 10px', borderRadius: '20px', border: 'none', background: ss.bg, color: ss.color, fontSize: '12px', fontFamily: 'var(--sans)', cursor: 'pointer' }}>
                        <option value="todo">할 일</option>
                        <option value="in_progress">진행 중</option>
                        <option value="done">완료</option>
                      </select>
                    )}
                    {!isReadOnly && (
                      <>
                        <button onClick={() => setModal(task)} style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '5px 10px', color: 'var(--text2)', fontSize: '12px', cursor: 'pointer' }}>수정</button>
                        <button onClick={() => handleDelete(task.id)} style={{ background: 'rgba(240,96,96,0.1)', border: '1px solid rgba(240,96,96,0.2)', borderRadius: 'var(--radius-sm)', padding: '5px 10px', color: 'var(--danger)', fontSize: '12px', cursor: 'pointer' }}>삭제</button>
                      </>
                    )}
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
