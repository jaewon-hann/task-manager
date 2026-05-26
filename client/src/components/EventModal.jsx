import React, { useState } from 'react';

const EVENT_COLORS = ['#e879f9','#38bdf8','#fb923c','#4ecca3','#f7c843','#f06060','#6f6af8','#a3e635'];

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: '6px',
  border: '1px solid var(--border2)', background: 'var(--surface2)',
  color: 'var(--text)', fontSize: '13px', outline: 'none',
};
const labelStyle = {
  display: 'block', fontSize: '12px', color: 'var(--text3)',
  marginBottom: '5px', fontFamily: 'var(--mono)',
};

export default function EventModal({ event, initialDate, onSave, onClose, onDelete }) {
  const [form, setForm] = useState({
    title:      event?.title      || '',
    start_date: event?.start_date || initialDate || '',
    end_date:   event?.end_date   || initialDate || '',
    color:      event?.color      || '#e879f9',
    memo:       event?.memo       || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.title.trim()) { alert('제목을 입력해주세요'); return; }
    if (!form.start_date)   { alert('시작일을 선택해주세요'); return; }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: '14px', padding: '28px', width: '440px', maxWidth: '95vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700' }}>{event ? '이벤트 수정' : '새 이벤트 추가'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: '20px', lineHeight: 1, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelStyle}>이벤트 제목 *</label>
            <input style={inputStyle} value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="예: 출장, 생일, 휴가..." autoFocus />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>시작일 *</label>
              <input type="date" style={inputStyle} value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>종료일</label>
              <input type="date" style={inputStyle} value={form.end_date} onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>색상</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {EVENT_COLORS.map(c => (
                <div key={c} onClick={() => set('color', c)}
                  style={{ width: '26px', height: '26px', borderRadius: '50%', background: c, cursor: 'pointer', border: form.color === c ? '2px solid white' : '2px solid transparent', boxShadow: form.color === c ? `0 0 0 2px ${c}` : 'none' }} />
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>메모</label>
            <textarea style={{ ...inputStyle, height: '70px', resize: 'vertical' }}
              value={form.memo} onChange={e => set('memo', e.target.value)} placeholder="선택 사항" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', marginTop: '22px' }}>
          <div>
            {event && onDelete && (
              <button onClick={() => { if(confirm('이벤트를 삭제하시겠습니까?')) onDelete(event.id); }}
                style={{ padding: '9px 20px', borderRadius: '6px', border: '1px solid rgba(240,96,96,0.3)', background: 'rgba(240,96,96,0.1)', color: 'var(--danger)', fontSize: '13px', cursor: 'pointer' }}>
                삭제
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: '6px', border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: '13px', cursor: 'pointer' }}>취소</button>
            <button onClick={handleSubmit} disabled={saving}
              style={{ padding: '9px 20px', borderRadius: '6px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: '700', opacity: saving ? 0.6 : 1, cursor: 'pointer' }}>
              {saving ? '저장 중...' : (event ? '수정 완료' : '추가')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
