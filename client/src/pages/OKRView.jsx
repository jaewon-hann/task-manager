import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function OKRView({ embedded = false }) {
  const now = new Date();
  const [currentIdx, setCurrentIdx] = useState(0); // 0 = 이번달
  const [okrData, setOkrData] = useState({});
  const [editingMonth, setEditingMonth] = useState(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);

  // -6개월 ~ +6개월 범위
  const months = Array.from({ length: 13 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + (i - 6), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: `${d.getFullYear()}년 ${d.getMonth() + 1}월`,
      shortLabel: `${d.getMonth() + 1}월`,
      isCurrentMonth: i === 6,
      isPast: i < 6,
    };
  });

  const currentMonth = months[6 + currentIdx];

  useEffect(() => {
    api.settings.get().then(s => {
      try { setOkrData(JSON.parse(s.okr_data || '{}')); } catch { setOkrData({}); }
      setLoading(false);
    });
  }, []);

  const saveOKR = async (data) => {
    setOkrData(data);
    await api.settings.save({ okr_data: JSON.stringify(data) });
  };

  const getObjectives = (key) => okrData[key] || [];

  const toggleDone = async (monthKey, idx) => {
    const objs = [...getObjectives(monthKey)];
    objs[idx] = { ...objs[idx], done: !objs[idx].done };
    await saveOKR({ ...okrData, [monthKey]: objs });
  };

  const deleteObj = async (monthKey, idx) => {
    const objs = getObjectives(monthKey).filter((_, i) => i !== idx);
    await saveOKR({ ...okrData, [monthKey]: objs });
  };

  const startEdit = (monthKey) => {
    setEditingMonth(monthKey);
    setInputText(getObjectives(monthKey).map(o => o.text).join('\n'));
  };

  const saveEdit = async () => {
    const lines = inputText.split('\n').map(l => l.trim()).filter(Boolean);
    const existing = getObjectives(editingMonth);
    const objs = lines.map((text, i) => ({
      text,
      done: existing[i]?.text === text ? (existing[i]?.done || false) : false,
    }));
    await saveOKR({ ...okrData, [editingMonth]: objs });
    setEditingMonth(null);
    setInputText('');
  };

  if (loading) return null;

  const objs = getObjectives(currentMonth.key);
  const doneCount = objs.filter(o => o.done).length;

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>

      {/* 타임라인 헤더 */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontSize: '14px', fontWeight: '700' }}>월별 OKR</span>
          {editingMonth !== currentMonth.key && (
            <button onClick={() => startEdit(currentMonth.key)}
              style={{ fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
              {objs.length === 0 ? '+ 목표 추가' : '수정'}
            </button>
          )}
        </div>

        {/* 월 슬라이더 */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
          {months.map((m, i) => {
            const idx = i - 6;
            const isSelected = idx === currentIdx;
            const hasData = (okrData[m.key] || []).length > 0;
            return (
              <button key={m.key} onClick={() => setCurrentIdx(idx)}
                style={{
                  flexShrink: 0,
                  padding: '5px 12px',
                  borderRadius: '20px',
                  border: isSelected ? 'none' : '1px solid var(--border)',
                  background: isSelected ? 'var(--accent)' : m.isCurrentMonth ? 'rgba(111,106,248,0.1)' : 'transparent',
                  color: isSelected ? '#fff' : m.isCurrentMonth ? 'var(--accent)' : 'var(--text3)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: isSelected || m.isCurrentMonth ? '700' : '400',
                  position: 'relative',
                }}>
                {m.shortLabel}
                {hasData && !isSelected && (
                  <span style={{ position: 'absolute', top: '3px', right: '3px', width: '4px', height: '4px', borderRadius: '50%', background: 'var(--accent)' }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 목표 목록 */}
      <div style={{ padding: '14px 16px' }}>
        {editingMonth === currentMonth.key ? (
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '8px' }}>
              {currentMonth.label} 목표 (줄바꿈으로 구분)
            </div>
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              autoFocus
              placeholder={'예시:\nSF 도시계획 1단계 완료\n시애틀 현장 조사 착수\n신규 수요 리포트 발행'}
              style={{
                width: '100%', height: '120px', padding: '10px 12px',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)',
                background: 'var(--surface2)', color: 'var(--text)',
                fontSize: '13px', resize: 'vertical', fontFamily: 'var(--sans)',
                lineHeight: '1.6',
              }}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setEditingMonth(null)}
                style={{ padding: '7px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: '12px', cursor: 'pointer' }}>
                취소
              </button>
              <button onClick={saveEdit}
                style={{ padding: '7px 16px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                저장
              </button>
            </div>
          </div>
        ) : objs.length === 0 ? (
          <div style={{ padding: '16px 0', color: 'var(--text3)', fontSize: '13px', textAlign: 'center' }}>
            {currentMonth.isCurrentMonth ? '이번 달 목표를 추가해보세요' : currentMonth.isPast ? '목표가 없었던 달입니다' : '미래 목표를 미리 계획해보세요'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {objs.length > 0 && (
              <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: '2px' }}>
                {currentMonth.label} · {doneCount}/{objs.length} 완료
              </div>
            )}
            {objs.map((obj, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div onClick={() => toggleDone(currentMonth.key, i)}
                  style={{
                    width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0, marginTop: '1px',
                    border: `1.5px solid ${obj.done ? 'var(--accent)' : 'var(--border2)'}`,
                    background: obj.done ? 'var(--accent)' : 'transparent',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  {obj.done && <span style={{ color: '#fff', fontSize: '10px', lineHeight: 1 }}>✓</span>}
                </div>
                <div style={{ flex: 1, fontSize: '13px', color: obj.done ? 'var(--text3)' : 'var(--text)', textDecoration: obj.done ? 'line-through' : 'none', lineHeight: '1.5' }}>
                  {obj.text}
                </div>
                <button onClick={() => deleteObj(currentMonth.key, i)}
                  style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: '14px', cursor: 'pointer', padding: '0', lineHeight: 1, opacity: 0.5 }}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
