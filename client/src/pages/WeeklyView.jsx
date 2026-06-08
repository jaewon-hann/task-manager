import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';
import TaskModal from '../components/TaskModal.jsx';
import EventModal from '../components/EventModal.jsx';

const PRIORITY_COLOR = { high: '#f06060', medium: '#f7c843', low: '#4ecca3' };
const PROJECT_COLORS = ['#6f6af8','#4ecca3','#f7c843','#f06060','#e879f9','#38bdf8','#fb923c','#a3e635'];
const STATUS_STYLE = {
  todo:        { bg: 'var(--surface2)',        color: 'var(--text3)' },
  in_progress: { bg: 'rgba(111,106,248,0.15)', color: 'var(--accent)' },
  active:      { bg: 'rgba(247,200,67,0.15)',  color: 'var(--amber)' },
  done:        { bg: 'rgba(78,204,163,0.15)',  color: '#4ecca3' },
};
const DAY_LABEL = ['월', '화', '수', '목', '금', '토', '일'];

function getMondayOf(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekLabel(monday) {
  const month = monday.getMonth() + 1;
  const weekOfMonth = Math.ceil(monday.getDate() / 7);
  return `${month}월 ${weekOfMonth}주`;
}

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

export default function WeeklyView() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [tasks, setTasks]           = useState([]);
  const [events, setEvents]         = useState([]);
  const [projects, setProjects]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(null);
  const [eventModal, setEventModal] = useState(null);
  const [selected, setSelected]     = useState(null);
  const [expanded, setExpanded]     = useState({});

  const today = new Date().toISOString().slice(0, 10);

  const weeks = Array.from({ length: 9 }, (_, i) => {
    const offset = i - 4;
    const monday = getMondayOf(new Date());
    monday.setDate(monday.getDate() + offset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      offset,
      monday,
      sunday,
      label: getWeekLabel(monday),
      monStr: monday.toISOString().slice(0, 10),
      sunStr: sunday.toISOString().slice(0, 10),
      isCurrentWeek: offset === 0,
    };
  });

  const currentWeek = weeks.find(w => w.offset === weekOffset);

  const days = currentWeek ? Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeek.monday);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  }) : [];

  const load = useCallback(async () => {
    if (!currentWeek) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ due_from: currentWeek.monStr, due_to: currentWeek.sunStr });
      const [t, p, ev] = await Promise.all([
        api.tasks.list('?' + q.toString()),
        api.projects.list(),
        api.events.list(`?from=${currentWeek.monStr}&to=${currentWeek.sunStr}`),
      ]);
      const noDate = (await api.tasks.list('?exclude_done=1')).filter(t => !t.due_date);
      const merged = [...t, ...noDate.filter(n => !t.find(x => x.id === n.id))];
      setTasks(merged);
      setProjects(p);
      setEvents(ev);
    } finally {
      setLoading(false);
    }
  }, [weekOffset]);

  useEffect(() => { load(); setSelected(null); }, [load]);

  const grouped = {};
  tasks.forEach(t => {
    const key = t.due_date || 'nodate';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });

  const getProjectColor = (task) => {
    const p = projects.find(p => p.id === task.project_id);
    return p?.color || PRIORITY_COLOR[task.priority] || '#8b8fa8';
  };

  const handleStatusChange = async (task, status) => {
    await api.tasks.update(task.id, { ...task, status });
    load();
    if (selected?.task?.id === task.id) setSelected(s => ({ ...s, task: { ...s.task, status } }));
  };

  const handleDelete = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await api.tasks.delete(id);
    load();
    setSelected(null);
  };

  const [createDate, setCreateDate] = useState(null);

  const handleSave = async (data) => {
    if (modal === 'create') {
      if (createDate) data.due_date = createDate;
      await api.tasks.create(data);
    } else {
      await api.tasks.update(modal.id, data);
    }
    setModal(null);
    load();
  };

  const handleEventSave = async (data) => {
    if (eventModal === 'create') await api.events.create(data);
    else await api.events.update(eventModal.id, data);
    setEventModal(null);
    load();
  };

  const getEventsForDate = (dateStr) => events.filter(e => e.start_date <= dateStr && e.end_date >= dateStr);

  return (
    <div>
      <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '20px', fontWeight: '700' }}>주차별 업무</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setEventModal('create')} style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border2)', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
            🗓 이벤트 추가
          </button>
          <button onClick={() => setModal('create')} style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--accent)', color: '#fff', border: 'none', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
            + 업무 추가
          </button>
        </div>
      </div>

      {/* 주차 슬라이더 */}
      <div style={{ padding: '12px 28px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button onClick={() => setWeekOffset(o => Math.max(o - 1, -4))}
          style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '5px 10px', color: 'var(--text2)', fontSize: '13px', cursor: weekOffset <= -4 ? 'not-allowed' : 'pointer', opacity: weekOffset <= -4 ? 0.4 : 1 }}>←</button>
        <div style={{ display: 'flex', gap: '5px', flex: 1, overflowX: 'auto' }}>
          {weeks.map(w => (
            <button key={w.offset} onClick={() => setWeekOffset(w.offset)}
              style={{ flexShrink: 0, padding: '5px 12px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', border: w.offset === weekOffset ? 'none' : '1px solid var(--border)', background: w.offset === weekOffset ? 'var(--accent)' : w.isCurrentWeek ? 'rgba(111,106,248,0.1)' : 'transparent', color: w.offset === weekOffset ? '#fff' : w.isCurrentWeek ? 'var(--accent)' : 'var(--text3)', fontWeight: w.offset === weekOffset || w.isCurrentWeek ? '700' : '400' }}>
              {w.label}{w.isCurrentWeek && w.offset !== weekOffset && ' ●'}
            </button>
          ))}
        </div>
        <button onClick={() => setWeekOffset(o => Math.min(o + 1, 4))}
          style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '5px 10px', color: 'var(--text2)', fontSize: '13px', cursor: weekOffset >= 4 ? 'not-allowed' : 'pointer', opacity: weekOffset >= 4 ? 0.4 : 1 }}>→</button>
      </div>

      <div style={{ padding: '20px 28px' }}>
        {loading ? (
          <div style={{ color: 'var(--text3)', padding: '40px 0', textAlign: 'center' }}>로딩 중...</div>
        ) : (
          <div style={{ position: 'relative' }}>
            {/* 요일 헤더 + 날짜 그리드 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
              {days.map((dateStr, i) => {
                const dayTasks = grouped[dateStr] || [];
                const isToday = dateStr === today;
                const isPast = dateStr < today;
                const extraCount = dayTasks.length > 4 ? dayTasks.length - 3 : 0;
                const visibleTasks = extraCount > 0 ? dayTasks.slice(0, 3) : dayTasks;

                return (
                  <div key={dateStr} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {/* 요일 헤더 - 클릭 시 해당 날짜로 업무 추가 */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '6px', cursor: 'pointer' }}
                      onClick={() => { setCreateDate(dateStr); setModal('create'); }}>
                      <div style={{ fontSize: '12px', color: isPast ? 'var(--text3)' : 'var(--text2)', marginBottom: '4px' }}>{DAY_LABEL[i]}</div>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isToday ? 'var(--accent)' : 'transparent',
                        fontSize: '12px', fontWeight: isToday ? '700' : '400',
                        color: isToday ? '#fff' : isPast ? 'var(--text3)' : 'var(--text)',
                      }}>
                        {parseInt(dateStr.slice(8))}
                      </div>
                    </div>

                    {/* 이벤트 바 자리 확보 (실제 이벤트는 아래 absolute로) */}
                    {events.filter(e => e.start_date <= dateStr && e.end_date >= dateStr).length > 0 && (
                      <div style={{ height: '22px' }} />
                    )}

                    {/* 업무 바 */}
                    {visibleTasks.map(task => (
                      <div key={task.id}
                        onClick={() => setSelected(selected?.task?.id === task.id ? null : { task, dateStr })}
                        style={{
                          padding: '5px 8px', borderRadius: '5px',
                          background: task.status === 'done' ? 'var(--surface2)' : `${getProjectColor(task)}22`,
                          borderLeft: `3px solid ${task.status === 'done' ? 'var(--border2)' : getProjectColor(task)}`,
                          cursor: 'pointer', opacity: task.status === 'done' ? 0.5 : 1,
                          outline: selected?.task?.id === task.id ? `2px solid ${getProjectColor(task)}` : 'none',
                          transition: 'all 0.1s',
                        }}>
                        <div style={{ fontSize: '11px', color: task.status === 'done' ? 'var(--text3)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>
                          {task.title}
                        </div>
                        {task.project_name && (
                          <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {task.project_name}
                          </div>
                        )}
                      </div>
                    ))}

                    {extraCount > 0 && (
                      <div style={{ fontSize: '11px', color: 'var(--text3)', padding: '3px 8px', textAlign: 'center', cursor: 'pointer' }}
                        onClick={() => setSelected({ task: null, dateStr, showAll: true, tasks: dayTasks })}>
                        +{extraCount}건 더보기
                      </div>
                    )}

                    {dayTasks.length === 0 && (
                      <div style={{ height: '32px', borderRadius: '5px', border: '1px dashed var(--border)', opacity: 0.3 }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* 이벤트 연속 바 오버레이 */}
            {events.map((ev, ei) => {
              const colWidth = 100 / 7;
              const startIdx = days.findIndex(d => d >= ev.start_date);
              const endIdx   = [...days].reverse().findIndex(d => d <= ev.end_date);
              const startCol = startIdx === -1 ? 0 : startIdx;
              const endCol   = endIdx   === -1 ? 6 : 6 - endIdx;
              const spanCols = endCol - startCol + 1;
              const isStart = days[startCol] === ev.start_date;
              const isEnd   = days[endCol]   === ev.end_date;

              return (
                <div key={ev.id}
                  onClick={() => setEventModal(ev)}
                  style={{
                    position: 'absolute',
                    top: `${56 + ei * 24}px`,
                    left: `calc(${startCol * colWidth}% + 4px)`,
                    width: `calc(${spanCols * colWidth}% - 8px)`,
                    height: '20px',
                    background: ev.color,
                    opacity: 0.9,
                    borderRadius: isStart && isEnd ? '4px' : isStart ? '4px 0 0 4px' : isEnd ? '0 4px 4px 0' : '0',
                    display: 'flex', alignItems: 'center', paddingLeft: isStart ? '8px' : '4px',
                    fontSize: '11px', color: '#fff', fontWeight: '500',
                    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                    cursor: 'pointer', zIndex: 2,
                  }}>
                  {isStart ? ev.title : ''}
                </div>
              );
            })}
          </div>
        )}

        {/* 마감일 없는 업무 */}
        {(grouped['nodate'] || []).length > 0 && (
          <div style={{ marginTop: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '10px' }}>마감일 없는 업무 · {grouped['nodate'].length}건</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {grouped['nodate'].map(task => (
                <div key={task.id} onClick={() => setSelected(selected?.task?.id === task.id ? null : { task, dateStr: 'nodate' })}
                  style={{ padding: '5px 10px', borderRadius: '5px', background: `${getProjectColor(task)}22`, borderLeft: `3px solid ${getProjectColor(task)}`, cursor: 'pointer', outline: selected?.task?.id === task.id ? `2px solid ${getProjectColor(task)}` : 'none' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text)' }}>{task.title}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 업무 상세 패널 */}
        {selected && selected.task && (
          <div style={{ marginTop: '16px', background: 'var(--surface)', border: `1px solid ${getProjectColor(selected.task)}44`, borderRadius: 'var(--radius)', padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', marginBottom: '8px' }}>{selected.task.title}</div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: selected.task.memo ? '12px' : '0' }}>
                  {selected.task.project_name && <span style={{ fontSize: '12px', color: 'var(--text3)' }}>📁 {selected.task.project_name}</span>}
                  {selected.task.category     && <span style={{ fontSize: '12px', color: 'var(--text3)' }}>🏷 {selected.task.category}</span>}
                  {selected.task.due_date     && <span style={{ fontSize: '12px', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>📅 {selected.task.due_date}</span>}
                  <span style={{ fontSize: '12px', color: 'var(--text3)' }}>
                    {selected.task.priority === 'high' ? '🔴 높음' : selected.task.priority === 'medium' ? '🟡 중간' : '🟢 낮음'}
                  </span>
                </div>
                {selected.task.memo && (
                  <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: '1.7', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'var(--surface2)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
                    {renderMemo(selected.task.memo)}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center' }}>
                <select value={selected.task.status} onChange={e => handleStatusChange(selected.task, e.target.value)}
                  style={{ padding: '5px 10px', borderRadius: '20px', border: 'none', background: STATUS_STYLE[selected.task.status]?.bg, color: STATUS_STYLE[selected.task.status]?.color, fontSize: '12px', fontFamily: 'var(--sans)', cursor: 'pointer' }}>
                  <option value="todo">할 일</option>
                  <option value="in_progress">진행 중</option>
                  <option value="active">착수</option>
                  <option value="done">완료</option>
                </select>
                <button onClick={() => setModal(selected.task)} style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '5px 12px', color: 'var(--text2)', fontSize: '12px', cursor: 'pointer' }}>수정</button>
                <button onClick={() => handleDelete(selected.task.id)} style={{ background: 'rgba(240,96,96,0.1)', border: '1px solid rgba(240,96,96,0.2)', borderRadius: 'var(--radius-sm)', padding: '5px 12px', color: 'var(--danger)', fontSize: '12px', cursor: 'pointer' }}>삭제</button>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {modal && (
        <TaskModal
          task={modal === 'create' ? null : modal}
          projects={projects}
          onSave={handleSave}
          onClose={() => { setModal(null); setCreateDate(null); }}
          initialDueDate={modal === 'create' ? createDate : undefined}
        />
      )}
      {eventModal && (
        <EventModal
          event={eventModal === 'create' ? null : eventModal}
          initialDate={createDate}
          onSave={handleEventSave}
          onClose={() => setEventModal(null)}
          onDelete={async (id) => { await api.events.delete(id); setEventModal(null); load(); }}
        />
      )}
    </div>
  );
}
