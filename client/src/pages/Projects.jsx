import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const COLORS = ['#6f6af8','#4ecca3','#f7c843','#f06060','#e879f9','#38bdf8','#fb923c','#a3e635'];
const PRIORITY_COLOR = { high: '#f06060', medium: '#f7c843', low: '#4ecca3' };
const STATUS_LABEL   = { todo: '할 일', in_progress: '진행 중', done: '완료' };
const STATUS_STYLE   = {
  todo:        { bg: 'var(--surface2)',        color: 'var(--text3)' },
  in_progress: { bg: 'rgba(111,106,248,0.15)', color: 'var(--accent)' },
};

function CompleteModal({ project, onConfirm, onCancel }) {
  const [choice, setChoice] = useState('all');
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: '14px', padding: '28px', width: '420px', maxWidth: '95vw' }}>
        <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px' }}>프로젝트 완료</div>
        <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '20px' }}>
          <span style={{ color: 'var(--accent)', fontWeight: '700' }}>{project.name}</span> 프로젝트를 완료 처리합니다.<br />
          {project.task_count > 0 && `진행 중인 업무 ${project.task_count}건이 있습니다.`}
        </div>
        {project.task_count > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
            {[
              { value: 'all',  label: '하위 업무 전부 완료 처리', desc: '모든 업무를 완료로 변경합니다' },
              { value: 'keep', label: '하위 업무 상태 그대로 유지', desc: '업무 상태는 변경하지 않습니다' },
            ].map(opt => (
              <div key={opt.value} onClick={() => setChoice(opt.value)}
                style={{ padding: '12px 16px', borderRadius: '8px', border: `1px solid ${choice === opt.value ? 'var(--accent)' : 'var(--border2)'}`, background: choice === opt.value ? 'rgba(111,106,248,0.08)' : 'var(--surface2)', cursor: 'pointer' }}>
                <div style={{ fontSize: '13px', fontWeight: '500', color: choice === opt.value ? 'var(--accent)' : 'var(--text)' }}>{opt.label}</div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '3px' }}>{opt.desc}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '9px 20px', borderRadius: '6px', border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: '13px', cursor: 'pointer' }}>취소</button>
          <button onClick={() => onConfirm(choice)} style={{ padding: '9px 20px', borderRadius: '6px', border: 'none', background: '#4ecca3', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>완료 처리</button>
        </div>
      </div>
    </div>
  );
}

export default function Projects() {
  const [projects, setProjects]         = useState([]);
  const [archived, setArchived]         = useState([]);
  const [form, setForm]                 = useState({ name: '', color: '#6f6af8' });
  const [editing, setEditing]           = useState(null);
  const [loading, setLoading]           = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [expandedProject, setExpandedProject] = useState(null);
  const [projectTasks, setProjectTasks] = useState({});

  const load = async () => {
    setLoading(true);
    const all = await api.projects.list(true);
    setProjects(all.filter(p => !p.archived));
    setArchived(all.filter(p => p.archived));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleProjectClick = async (projectId) => {
    if (expandedProject === projectId) { setExpandedProject(null); return; }
    setExpandedProject(projectId);
    if (!projectTasks[projectId]) {
      const tasks = await api.tasks.list(`?project_id=${projectId}&exclude_done=1`);
      setProjectTasks(pt => ({ ...pt, [projectId]: tasks }));
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    await api.projects.create(form);
    setForm({ name: '', color: '#6f6af8' });
    load();
  };

  const handleUpdate = async (p) => {
    await api.projects.update(p.id, { name: p.name, color: p.color });
    setEditing(null);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('프로젝트를 삭제하면 해당 업무의 프로젝트가 해제됩니다. 계속하시겠습니까?')) return;
    await api.projects.delete(id);
    load();
  };

  const handleComplete = async (choice) => {
    const p = completeTarget;
    await api.projects.update(p.id, { name: p.name, color: p.color, archived: true, archived_at: new Date().toISOString() });
    if (choice === 'all') await api.projects.completeTasks(p.id);
    setCompleteTarget(null);
    load();
  };

  const handleRestore = async (p) => {
    await api.projects.update(p.id, { name: p.name, color: p.color, archived: false, archived_at: null });
    load();
  };

  const handleStatusChange = async (task, status) => {
    await api.tasks.update(task.id, { ...task, status });
    const tasks = await api.tasks.list(`?project_id=${task.project_id}&exclude_done=1`);
    setProjectTasks(pt => ({ ...pt, [task.project_id]: tasks }));
    load();
  };

  const inputStyle = { padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '13px' };
  const btnStyle = (variant) => ({
    padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
    ...(variant === 'done'    ? { background: 'rgba(78,204,163,0.12)', border: '1px solid rgba(78,204,163,0.3)', color: '#4ecca3' } :
        variant === 'edit'    ? { background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text2)' } :
        variant === 'delete'  ? { background: 'rgba(240,96,96,0.1)', border: '1px solid rgba(240,96,96,0.2)', color: 'var(--danger)' } :
        variant === 'restore' ? { background: 'rgba(111,106,248,0.1)', border: '1px solid rgba(111,106,248,0.2)', color: 'var(--accent)' } : {})
  });

  return (
    <div>
      <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: '20px', fontWeight: '700' }}>프로젝트 관리</div>
      </div>

      <div style={{ padding: '24px 28px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '14px' }}>새 프로젝트 추가</div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input style={{ ...inputStyle, flex: 1, minWidth: '200px' }} placeholder="프로젝트 이름"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleCreate()} />
            <div style={{ display: 'flex', gap: '6px' }}>
              {COLORS.map(c => (
                <div key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                  style={{ width: '24px', height: '24px', borderRadius: '50%', background: c, cursor: 'pointer', border: form.color === c ? '2px solid white' : '2px solid transparent' }} />
              ))}
            </div>
            <button onClick={handleCreate} style={{ padding: '9px 18px', borderRadius: '6px', background: 'var(--accent)', color: '#fff', border: 'none', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>추가</button>
          </div>
        </div>

        {loading ? (
          <div style={{ color: 'var(--text3)', padding: '40px', textAlign: 'center' }}>로딩 중...</div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              {projects.length === 0 && <div style={{ color: 'var(--text3)', fontSize: '13px', padding: '20px 0' }}>진행 중인 프로젝트가 없습니다</div>}
              {projects.map(p => (
                <div key={p.id} style={{ background: 'var(--surface)', border: `1px solid ${expandedProject === p.id ? 'rgba(111,106,248,0.3)' : 'var(--border)'}`, borderRadius: '10px', overflow: 'hidden' }}>
                  {editing === p.id ? (
                    <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                      <input style={{ ...inputStyle, flex: 1 }} defaultValue={p.name}
                        onChange={e => setProjects(ps => ps.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))} />
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {COLORS.map(c => (
                          <div key={c} onClick={() => setProjects(ps => ps.map(x => x.id === p.id ? { ...x, color: c } : x))}
                            style={{ width: '20px', height: '20px', borderRadius: '50%', background: c, cursor: 'pointer', border: p.color === c ? '2px solid white' : '2px solid transparent' }} />
                        ))}
                      </div>
                      <button onClick={() => handleUpdate(p)} style={{ padding: '6px 14px', borderRadius: '6px', background: 'var(--accent)', color: '#fff', border: 'none', fontSize: '12px', cursor: 'pointer' }}>저장</button>
                      <button onClick={() => setEditing(null)} style={{ padding: '6px 14px', borderRadius: '6px', background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text2)', fontSize: '12px', cursor: 'pointer' }}>취소</button>
                    </div>
                  ) : (
                    <>
                      {/* 프로젝트 헤더 - 클릭 시 업무 토글 */}
                      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }}
                        onClick={() => handleProjectClick(p.id)}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {p.name}
                            <span style={{ fontSize: '11px', color: 'var(--text3)' }}>{expandedProject === p.id ? '▼' : '▶'}</span>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>진행 중 업무 {p.task_count}건</div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => setCompleteTarget(p)} style={btnStyle('done')}>완료</button>
                          <button onClick={() => setEditing(p.id)} style={btnStyle('edit')}>수정</button>
                          <button onClick={() => handleDelete(p.id)} style={btnStyle('delete')}>삭제</button>
                        </div>
                      </div>

                      {/* 업무 목록 */}
                      {expandedProject === p.id && (
                        <div style={{ borderTop: '1px solid var(--border)' }}>
                          {!projectTasks[p.id] ? (
                            <div style={{ padding: '14px 20px', color: 'var(--text3)', fontSize: '13px' }}>로딩 중...</div>
                          ) : projectTasks[p.id].length === 0 ? (
                            <div style={{ padding: '14px 20px', color: 'var(--text3)', fontSize: '13px' }}>진행 중인 업무가 없습니다</div>
                          ) : projectTasks[p.id].map(task => {
                            const ss = STATUS_STYLE[task.status] || STATUS_STYLE.todo;
                            return (
                              <div key={task.id} style={{ padding: '11px 20px 11px 46px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: PRIORITY_COLOR[task.priority], flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '13px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
                                  <div style={{ display: 'flex', gap: '8px', marginTop: '3px' }}>
                                    {task.due_date && <span style={{ fontSize: '11px', color: task.due_date < new Date().toISOString().slice(0,10) ? 'var(--danger)' : 'var(--text3)', fontFamily: 'var(--mono)' }}>📅 {task.due_date}</span>}
                                    {task.category && <span style={{ fontSize: '11px', color: 'var(--text3)' }}>🏷 {task.category}</span>}
                                  </div>
                                </div>
                                <select value={task.status} onChange={e => handleStatusChange(task, e.target.value)}
                                  style={{ padding: '3px 8px', borderRadius: '20px', border: 'none', background: ss.bg, color: ss.color, fontSize: '11px', fontFamily: 'var(--sans)', cursor: 'pointer' }}>
                                  <option value="todo">할 일</option>
                                  <option value="in_progress">진행 중</option>
                                  <option value="done">완료</option>
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* 아카이브된 프로젝트 */}
            {archived.length > 0 && (
              <div>
                <button onClick={() => setShowArchived(v => !v)}
                  style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: '13px', cursor: 'pointer', padding: '0', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {showArchived ? '▼' : '▶'} 완료된 프로젝트 ({archived.length}개)
                </button>
                {showArchived && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {archived.map(p => (
                      <div key={p.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '14px', opacity: 0.7 }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text2)', textDecoration: 'line-through' }}>{p.name}</div>
                          {p.archived_at && <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>완료일: {p.archived_at.slice(0, 10)}</div>}
                        </div>
                        <button onClick={() => handleRestore(p)} style={btnStyle('restore')}>복원</button>
                        <button onClick={() => handleDelete(p.id)} style={btnStyle('delete')}>삭제</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {completeTarget && (
        <CompleteModal project={completeTarget} onConfirm={handleComplete} onCancel={() => setCompleteTarget(null)} />
      )}
    </div>
  );
}

