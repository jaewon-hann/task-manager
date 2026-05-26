import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';
import TaskModal from '../components/TaskModal.jsx';
import EventModal from '../components/EventModal.jsx';

const PRIORITY_COLOR = { high: '#f06060', medium: '#f7c843', low: '#4ecca3' };
const STATUS_STYLE = {
  todo:        { bg: 'var(--surface2)',        color: 'var(--text3)' },
  in_progress: { bg: 'rgba(111,106,248,0.15)', color: 'var(--accent)' },
  done:        { bg: 'rgba(78,204,163,0.15)',  color: '#4ecca3' },
};

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

export default function MonthView() {
  const now = new Date();
  const [year, setYear]     = useState(now.getFullYear());
  const [month, setMonth]   = useState(now.getMonth());
  const [tasks, setTasks]   = useState([]);
  const [events, setEvents] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null);
  const [eventModal, setEventModal] = useState(null); // null | 'create' | event_object
  const [selected, setSelected] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const today = (() => { const d = new Date(); return new Date(d.getTime() + 9*60*60*1000).toISOString().slice(0,10); })();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const firstDay = new Date(year, month, 1).toISOString().slice(0, 10);
      const lastDay  = new Date(year, month + 1, 0).toISOString().slice(0, 10);
      const q = new URLSearchParams({ due_from: firstDay, due_to: lastDay });
      const noDateQ = new URLSearchParams({ exclude_done: '1' });
      const [t, noDate, p, ev] = await Promise.all([
        api.tasks.list('?' + q.toString()),
        api.tasks.list('?' + noDateQ.toString()),
        api.projects.list(),
        api.events.list(`?from=${firstDay}&to=${lastDay}`),
      ]);
      const nodateTasks = noDate.filter(n => !n.due_date);
      const merged = [...t, ...nodateTasks.filter(n => !t.find(x => x.id === n.id))];
      setTasks(merged);
      setProjects(p);
      setEvents(ev);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { load(); setSelected(null); }, [load]);

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const pcolor = (pid) => projects.find(p => p.id === pid)?.color || 'var(--accent)';
  const pname  = (pid) => projects.find(p => p.id === pid)?.name || null;

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

  const grouped = {};
  tasks.forEach(t => {
    const key = t.due_date || 'nodate';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });

  // 드래그앤드롭
  const handleDragStart = (e, task) => {
    setDragging(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, dateStr) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(dateStr);
  };

  const handleDrop = async (e, dateStr) => {
    e.preventDefault();
    if (!dragging) return;
    setDragOver(null);
    if (dragging.due_date === dateStr) return;
    await api.tasks.update(dragging.id, { ...dragging, due_date: dateStr === 'nodate' ? null : dateStr });
    setDragging(null);
    load();
  };

  const handleDragEnd = () => { setDragging(null); setDragOver(null); };

  const handleStatusChange = async (task, status) => {
    await api.tasks.update(task.id, { ...task, status });
    load();
  };

  const handleEventSave = async (data) => {
    if (eventModal === 'create') await api.events.create(data);
    else await api.events.update(eventModal.id, data);
    setEventModal(null);
    load();
  };

  const handleEventDelete = async (id) => {
    if (!confirm('이벤트를 삭제하시겠습니까?')) return;
    await api.events.delete(id);
    load();
  };

  // 날짜별 이벤트 계산
  const getEventsForDate = (dateStr) => {
    return events.filter(e => e.start_date <= dateStr && e.end_date >= dateStr);
  };

  const handleDelete = async (id) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await api.tasks.delete(id);
    setSelected(null);
    load();
  };

  const handleSave = async (data) => {
    if (modal === 'create') {
      if (selected) data.due_date = selected;
      await api.tasks.create(data);
    } else {
      await api.tasks.update(modal.id, data);
    }
    setModal(null);
    load();
  };

  const monthStr = `${year}년 ${month + 1}월`;
  const selectedTasks = selected ? (grouped[selected] || []) : [];

  return (
    <div>
      <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '20px', fontWeight: '700' }}>이번 달</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setEventModal('create')} style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border2)', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
            🗓 이벤트 추가
          </button>
          <button onClick={() => setModal('create')} style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--accent)', color: '#fff', border: 'none', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
            + 업무 추가
          </button>
        </div>
      </div>

      {/* 월 네비게이션 */}
      <div style={{ padding: '12px 28px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={prevMonth} style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', color: 'var(--text2)', fontSize: '13px', cursor: 'pointer' }}>←</button>
        <span style={{ fontSize: '15px', fontWeight: '700', minWidth: '100px', textAlign: 'center' }}>{monthStr}</span>
        <button onClick={nextMonth} style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', color: 'var(--text2)', fontSize: '13px', cursor: 'pointer' }}>→</button>
        <button onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }}
          style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', color: 'var(--text3)', fontSize: '12px', cursor: 'pointer' }}>
          오늘
        </button>
        <span style={{ fontSize: '11px', color: 'var(--text3)', marginLeft: 'auto' }}>💡 업무를 드래그해서 날짜를 변경할 수 있어요</span>
      </div>

      <div style={{ padding: '16px 28px' }}>
        {loading ? (
          <div style={{ color: 'var(--text3)', padding: '40px', textAlign: 'center' }}>로딩 중...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 300px' : '1fr', gap: '16px' }}>
            <div>
              {/* 요일 헤더 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: '4px' }}>
                {DAYS.map(d => (
                  <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: '12px', color: 'var(--text3)', fontWeight: '500' }}>{d}</div>
                ))}
              </div>

              {/* 날짜 그리드 - 주차별 행으로 렌더링 */}
              {(() => {
                // 전체 날짜 배열 (빈 칸 포함)
                const cells = [
                  ...Array(firstWeekday).fill(null),
                  ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
                ];
                // 7개씩 주차 행으로 분할
                const weeks = [];
                for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

                return weeks.map((week, wi) => {
                  // 이 주에 표시할 이벤트 계산
                  const weekDates = week.map(day => day ? `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}` : null);
                  const weekStart = weekDates.find(Boolean);
                  const weekEnd   = [...weekDates].reverse().find(Boolean);

                  // 이 주에 걸치는 이벤트
                  const weekEvents = events.filter(e =>
                    weekStart && weekEnd && e.start_date <= weekEnd && e.end_date >= weekStart
                  );

                  return (
                    <div key={wi} style={{ position: 'relative', marginBottom: '2px' }}>
                      {/* 날짜 셀 행 */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px' }}>
                        {week.map((day, di) => {
                          if (!day) return <div key={`e-${di}`} style={{ minHeight: '110px' }} />;
                          const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                          const dayTasks = grouped[dateStr] || [];
                          const isToday = dateStr === today;
                          const isSelected = selected === dateStr;
                          const isDragOver = dragOver === dateStr;

                          return (
                            <div key={day}
                              onClick={() => setSelected(isSelected ? null : dateStr)}
                              onDragOver={e => handleDragOver(e, dateStr)}
                              onDrop={e => handleDrop(e, dateStr)}
                              style={{
                                minHeight: '110px',
                                background: isDragOver ? 'rgba(111,106,248,0.1)' : isSelected ? 'rgba(111,106,248,0.06)' : 'var(--surface)',
                                border: `1px solid ${isDragOver ? 'var(--accent)' : isSelected ? 'rgba(111,106,248,0.3)' : 'var(--border)'}`,
                                borderRadius: 'var(--radius-sm)', padding: '8px 6px 6px', cursor: 'pointer', transition: 'all 0.1s',
                              }}>
                              <div style={{
                                fontSize: '12px', fontWeight: isToday ? '700' : '400',
                                color: isToday ? '#fff' : dateStr < today ? 'var(--text3)' : 'var(--text)',
                                width: '22px', height: '22px', borderRadius: '50%',
                                background: isToday ? 'var(--accent)' : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                marginBottom: weekEvents.length > 0 ? '22px' : '4px',
                              }}>
                                {day}
                              </div>
                              {dayTasks.slice(0, 2).map(t => (
                                <div key={t.id} draggable
                                  onDragStart={e => handleDragStart(e, t)} onDragEnd={handleDragEnd}
                                  onClick={e => { e.stopPropagation(); setSelected(dateStr); }}
                                  style={{
                                    fontSize: '11px', padding: '3px 6px', borderRadius: '3px', marginBottom: '2px',
                                    background: t.status === 'done' ? 'var(--surface2)' : `${pcolor(t.project_id)}22`,
                                    borderLeft: `2px solid ${t.status === 'done' ? 'var(--border2)' : pcolor(t.project_id)}`,
                                    color: t.status === 'done' ? 'var(--text3)' : 'var(--text)',
                                    textDecoration: t.status === 'done' ? 'line-through' : 'none',
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'grab',
                                    opacity: t.status === 'done' ? 0.6 : 1,
                                  }}>
                                  {t.title}
                                </div>
                              ))}
                              {dayTasks.length > 2 && <div style={{ fontSize: '10px', color: 'var(--text3)', padding: '1px 4px' }}>+{dayTasks.length - 2}건</div>}
                            </div>
                          );
                        })}
                      </div>

                      {/* 이벤트 바 오버레이 - 주차 행 위에 absolute */}
                      {weekEvents.map((ev, ei) => {
                        const colWidth = 100 / 7;
                        // 이 주에서 시작 컬럼
                        const startInWeek = weekDates.findIndex(d => d && d >= ev.start_date);
                        const endInWeek   = [...weekDates].reverse().findIndex(d => d && d <= ev.end_date);
                        const startCol = startInWeek === -1 ? 0 : startInWeek;
                        const endCol   = endInWeek   === -1 ? 6 : 6 - endInWeek;
                        const spanCols = endCol - startCol + 1;
                        const isStart = weekDates[startCol] === ev.start_date;
                        const isEnd   = weekDates[endCol]   === ev.end_date;

                        return (
                          <div key={ev.id}
                            onClick={() => setEventModal(ev)}
                            style={{
                              position: 'absolute',
                              top: `${30 + ei * 22}px`,
                              left: `calc(${startCol * colWidth}% + 3px)`,
                              width: `calc(${spanCols * colWidth}% - 6px)`,
                              height: '18px',
                              background: ev.color,
                              opacity: 0.85,
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
                  );
                });
              })()}

              {/* 마감일 없는 업무 */}
              {(grouped['nodate'] || []).length > 0 && (
                <div
                  onDragOver={e => handleDragOver(e, 'nodate')}
                  onDrop={e => handleDrop(e, 'nodate')}
                  style={{
                    marginTop: '12px', background: dragOver === 'nodate' ? 'rgba(111,106,248,0.08)' : 'var(--surface)',
                    border: `1px solid ${dragOver === 'nodate' ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)', padding: '14px 16px',
                  }}>
                  <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '8px' }}>📌 마감일 없는 업무 · {grouped['nodate'].length}건</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {grouped['nodate'].map(t => (
                      <div key={t.id}
                        draggable
                        onDragStart={e => handleDragStart(e, t)}
                        onDragEnd={handleDragEnd}
                        style={{
                          padding: '5px 10px', borderRadius: '5px', cursor: 'grab',
                          background: `${pcolor(t.project_id)}22`,
                          borderLeft: `3px solid ${pcolor(t.project_id)}`,
                          fontSize: '12px', color: 'var(--text)',
                        }}>
                        {t.title}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 날짜 상세 패널 */}
            {selected && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', alignSelf: 'start' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700' }}>{selected}</span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button onClick={() => setModal('create')} style={{ fontSize: '11px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>+ 추가</button>
                    <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: '16px', cursor: 'pointer' }}>×</button>
                  </div>
                </div>
                {selectedTasks.length === 0 ? (
                  <div style={{ padding: '20px 16px', color: 'var(--text3)', fontSize: '13px', textAlign: 'center' }}>
                    업무 없음<br />
                    <button onClick={() => setModal('create')} style={{ marginTop: '8px', fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>+ 업무 추가</button>
                  </div>
                ) : selectedTasks.map(task => {
                  const ss = STATUS_STYLE[task.status] || STATUS_STYLE.todo;
                  const isExp = expanded[task.id];
                  return (
                    <div key={task.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: PRIORITY_COLOR[task.priority], flexShrink: 0, marginTop: '4px' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div onClick={() => task.memo && setExpanded(e => ({ ...e, [task.id]: !e[task.id] }))}
                            style={{ fontSize: '13px', fontWeight: '500', color: task.status === 'done' ? 'var(--text3)' : 'var(--text)', textDecoration: task.status === 'done' ? 'line-through' : 'none', cursor: task.memo ? 'pointer' : 'default', wordBreak: 'break-word' }}>
                            {task.memo && <span style={{ fontSize: '10px', marginRight: '5px', color: 'var(--text3)' }}>{isExp ? '▼' : '▶'}</span>}
                            {task.title}
                          </div>
                          {pname(task.project_id) && <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '3px' }}>📁 {pname(task.project_id)}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexDirection: 'column', alignItems: 'flex-end' }}>
                          <select value={task.status} onChange={e => handleStatusChange(task, e.target.value)}
                            style={{ padding: '3px 8px', borderRadius: '20px', border: 'none', background: ss.bg, color: ss.color, fontSize: '11px', fontFamily: 'var(--sans)', cursor: 'pointer' }}>
                            <option value="todo">할 일</option>
                            <option value="in_progress">진행 중</option>
                            <option value="done">완료</option>
                          </select>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => setModal(task)} style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '3px 8px', color: 'var(--text2)', fontSize: '11px', cursor: 'pointer' }}>수정</button>
                            <button onClick={() => handleDelete(task.id)} style={{ background: 'rgba(240,96,96,0.1)', border: '1px solid rgba(240,96,96,0.2)', borderRadius: 'var(--radius-sm)', padding: '3px 8px', color: 'var(--danger)', fontSize: '11px', cursor: 'pointer' }}>삭제</button>
                          </div>
                        </div>
                      </div>
                      {isExp && task.memo && (
                        <div style={{ padding: '0 16px 12px 34px', fontSize: '12px', color: 'var(--text2)', lineHeight: '1.7', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {renderMemo(task.memo)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {modal && (
        <TaskModal
          task={modal === 'create' ? null : modal}
          projects={projects}
          onSave={handleSave}
          onClose={() => setModal(null)}
          initialDueDate={modal === 'create' && selected ? selected : undefined}
        />
      )}
      {eventModal && (
        <EventModal
          event={eventModal === 'create' ? null : eventModal}
          initialDate={selected}
          onSave={handleEventSave}
          onClose={() => setEventModal(null)}
          onDelete={(id) => { handleEventDelete(id); setEventModal(null); }}
        />
      )}
    </div>
  );
}
