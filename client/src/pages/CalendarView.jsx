import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const PRIORITY_COLOR = { high: '#f06060', medium: '#f7c843', low: '#4ecca3' };

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

export default function CalendarView() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [tasks, setTasks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    const firstDay = new Date(year, month, 1).toISOString().slice(0, 10);
    const lastDay  = new Date(year, month + 1, 0).toISOString().slice(0, 10);
    // due_date 있는 완료 업무 + due_date 없는 완료 업무(updated_at 기준) 모두 가져옴
    Promise.all([
      api.tasks.list(`?status=done&due_from=${firstDay}&due_to=${lastDay}`),
      api.tasks.list(`?status=done&created_from=${firstDay}`),
    ]).then(([withDate, all]) => {
      const noDueDate = all.filter(t => !t.due_date);
      const merged = [...withDate, ...noDueDate.filter(n => !withDate.find(x => x.id === n.id))];
      setTasks(merged);
    }).finally(() => setLoading(false));
  }, [year, month]);

  const prevMonth = () => { if (month === 0) { setYear(y => y-1); setMonth(11); } else setMonth(m => m-1); setSelected(null); };
  const nextMonth = () => { if (month === 11) { setYear(y => y+1); setMonth(0); } else setMonth(m => m+1); setSelected(null); };

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

  const tasksByDate = {};
  tasks.forEach(t => {
    // due_date 없으면 updated_at(완료 처리된 날짜) 기준으로 표시
    const dateKey = t.due_date || (t.updated_at ? t.updated_at.slice(0, 10) : null);
    if (!dateKey) return;
    if (!tasksByDate[dateKey]) tasksByDate[dateKey] = [];
    tasksByDate[dateKey].push(t);
  });

  const monthStr = `${year}년 ${month + 1}월`;
  const selectedTasks = selected ? (tasksByDate[selected] || []) : [];

  const totalDone  = tasks.length;
  const byProject  = {};
  tasks.forEach(t => {
    const k = t.project_name || '미분류';
    byProject[k] = (byProject[k] || 0) + 1;
  });

  return (
    <div>
      <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '20px', fontWeight: '700' }}>완료 캘린더</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={prevMonth} style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', color: 'var(--text2)', fontSize: '13px', cursor: 'pointer' }}>← 이전</button>
          <span style={{ fontSize: '15px', fontWeight: '700', minWidth: '100px', textAlign: 'center' }}>{monthStr}</span>
          <button onClick={nextMonth} style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', color: 'var(--text2)', fontSize: '13px', cursor: 'pointer' }}>다음 →</button>
        </div>
      </div>

      <div style={{ padding: '20px 28px' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 20px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: '4px' }}>이번 달 완료</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#4ecca3' }}>{totalDone}건</div>
          </div>
          {Object.entries(byProject).map(([name, cnt]) => (
            <div key={name} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 20px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: '4px' }}>{name}</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text)' }}>{cnt}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 320px' : '1fr', gap: '16px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid var(--border)' }}>
              {DAYS.map(d => (
                <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: '12px', color: 'var(--text3)', fontWeight: '500' }}>{d}</div>
              ))}
            </div>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)' }}>로딩 중...</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
                {Array.from({ length: firstWeekday }).map((_, i) => (
                  <div key={`empty-${i}`} style={{ minHeight: '80px', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }} />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                  const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                  const dayTasks = tasksByDate[dateStr] || [];
                  const isSelected = selected === dateStr;
                  const isToday = dateStr === new Date().toISOString().slice(0,10);
                  return (
                    <div key={day} onClick={() => setSelected(isSelected ? null : dateStr)}
                      style={{ minHeight: '80px', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '8px 6px', cursor: dayTasks.length > 0 ? 'pointer' : 'default', background: isSelected ? 'rgba(111,106,248,0.08)' : 'transparent', transition: 'background 0.1s' }}>
                      <div style={{ fontSize: '12px', fontWeight: isToday ? '700' : '400', color: isToday ? 'var(--accent)' : 'var(--text3)', marginBottom: '4px', width: '22px', height: '22px', borderRadius: '50%', background: isToday ? 'rgba(111,106,248,0.15)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {day}
                      </div>
                      {dayTasks.slice(0, 3).map(t => (
                        <div key={t.id} style={{ fontSize: '11px', padding: '2px 5px', borderRadius: '3px', background: 'rgba(78,204,163,0.15)', color: '#4ecca3', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderLeft: `2px solid ${PRIORITY_COLOR[t.priority] || '#4ecca3'}` }}>
                          {t.title}
                        </div>
                      ))}
                      {dayTasks.length > 3 && <div style={{ fontSize: '10px', color: 'var(--text3)' }}>+{dayTasks.length - 3}건</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {selected && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', alignSelf: 'start' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: '700' }}>{selected} 완료 업무</span>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: '16px', cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>
              {selectedTasks.length === 0 ? (
                <div style={{ padding: '20px 16px', color: 'var(--text3)', fontSize: '13px' }}>완료된 업무가 없습니다</div>
              ) : (
                selectedTasks.map(t => (
                  <div key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: PRIORITY_COLOR[t.priority], flexShrink: 0, marginTop: '4px' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div onClick={() => t.memo && setExpanded(e => ({ ...e, [t.id]: !e[t.id] }))}
                          style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text)', textDecoration: 'line-through', cursor: t.memo ? 'pointer' : 'default', wordBreak: 'break-word' }}>
                          {t.memo && <span style={{ fontSize: '10px', marginRight: '5px', color: 'var(--text3)' }}>{expanded[t.id] ? '▼' : '▶'}</span>}
                          {t.title}
                        </div>
                        {t.project_name && <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '3px' }}>📁 {t.project_name}</div>}
                      </div>
                    </div>
                    {expanded[t.id] && t.memo && (
                      <div style={{ padding: '0 16px 12px 34px', fontSize: '12px', color: 'var(--text2)', lineHeight: '1.7', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {renderMemo(t.memo)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
