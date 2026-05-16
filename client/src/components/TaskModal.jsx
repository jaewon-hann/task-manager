import React, { useState } from 'react';

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: '6px',
  border: '1px solid var(--border2)',
  background: 'var(--surface2)',
  color: 'var(--text)',
  fontSize: '13px',
  outline: 'none',
};

const labelStyle = {
  display: 'block',
  fontSize: '12px',
  color: 'var(--text3)',
  marginBottom: '5px',
  fontFamily: 'var(--mono)',
};

export default function TaskModal({ task, projects, onSave, onClose, hideDueDate = false }) {
  const [form, setForm] = useState({
    title:      task?.title      || '',
    project_id: task?.project_id || '',
    category:   task?.category   || '',
    priority:   task?.priority   || 'medium',
    status:     task?.status     || 'todo',
    due_date:   task?.due_date   || '',
    memo:       task?.memo       || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.title.trim()) { alert('제목을 입력해주세요'); return; }
    setSaving(true);
    await onSave({ ...form, project_id: form.project_id || null });
    setSaving(false);
  };

  const overlay = {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  };

  const modal = {
    background: 'var(--surface)',
    border: '1px solid var(--border2)',
    borderRadius: '14px',
    padding: '28px',
    width: '480px',
    maxWidth: '95vw',
    maxHeight: '90vh',
    overflowY: 'auto',
  };

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700' }}>{task ? '업무 수정' : '새 업무 추가'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: '20px', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>제목 *</label>
            <input style={inputStyle} value={form.title} onChange={e => set('title', e.target.value)} placeholder="업무 제목을 입력하세요" autoFocus />
          </div>

          <div>
            <label style={labelStyle}>상위 프로젝트</label>
            <select style={inputStyle} value={form.project_id} onChange={e => set('project_id', e.target.value)}>
              <option value="">프로젝트 없음</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>우선순위</label>
              <select style={inputStyle} value={form.priority} onChange={e => set('priority', e.target.value)}>
                <option value="high">🔴 높음</option>
                <option value="medium">🟡 중간</option>
                <option value="low">🟢 낮음</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>진행 상태</label>
              <select style={inputStyle} value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="todo">할 일</option>
                <option value="in_progress">진행 중</option>
                <option value="done">완료</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: hideDueDate ? '1fr' : '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>카테고리 / 태그</label>
              <input style={inputStyle} value={form.category} onChange={e => set('category', e.target.value)} placeholder="예: 미팅, 보고서" />
            </div>
            {!hideDueDate && (
              <div>
                <label style={labelStyle}>마감일</label>
                <input type="date" style={inputStyle} value={form.due_date} onChange={e => set('due_date', e.target.value)} />
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>메모</label>
            <textarea
              style={{ ...inputStyle, height: '80px', resize: 'vertical' }}
              value={form.memo}
              onChange={e => set('memo', e.target.value)}
              placeholder="상세 내용이나 메모를 입력하세요"
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: '6px', border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: '13px' }}>
            취소
          </button>
          <button onClick={handleSubmit} disabled={saving} style={{ padding: '9px 20px', borderRadius: '6px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: '700', opacity: saving ? 0.6 : 1 }}>
            {saving ? '저장 중...' : (task ? '수정 완료' : '추가')}
          </button>
        </div>
      </div>
    </div>
  );
}
