import React, { useState } from 'react';
import { api } from '../api.js';

export default function Login({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.email || !form.password) { setError('이메일과 비밀번호를 입력해주세요'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await api.auth.login(form);
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify(res.user));
      onLogin(res.user);
    } catch (e) {
      try { setError(JSON.parse(e.message).error); }
      catch { setError('로그인에 실패했습니다'); }
    } finally {
      setLoading(false);
    }
  };

  const s = {
    wrap: {
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
    },
    card: {
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: '16px', padding: '40px', width: '380px', maxWidth: '95vw',
    },
    logo: { fontSize: '20px', fontWeight: '700', color: 'var(--accent)', marginBottom: '6px' },
    sub: { fontSize: '12px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: '32px' },
    label: { display: 'block', fontSize: '12px', color: 'var(--text3)', marginBottom: '6px', fontFamily: 'var(--mono)' },
    input: {
      width: '100%', padding: '10px 14px', borderRadius: '8px',
      border: '1px solid var(--border2)', background: 'var(--surface2)',
      color: 'var(--text)', fontSize: '14px', outline: 'none', marginBottom: '16px',
    },
    btn: {
      width: '100%', padding: '12px', borderRadius: '8px',
      background: 'var(--accent)', color: '#fff', border: 'none',
      fontSize: '14px', fontWeight: '700', cursor: 'pointer', marginTop: '8px',
      opacity: loading ? 0.7 : 1,
    },
    error: {
      background: 'rgba(240,96,96,0.1)', border: '1px solid rgba(240,96,96,0.3)',
      borderRadius: '8px', padding: '10px 14px', color: 'var(--danger)',
      fontSize: '13px', marginBottom: '16px',
    },
  };

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.logo}>Task Manager</div>
        <div style={s.sub}>업무 관리 자동화 시스템</div>

        {error && <div style={s.error}>{error}</div>}

        <div>
          <label style={s.label}>이메일</label>
          <input
            style={s.input} type="email" placeholder="이메일 입력"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
        </div>
        <div>
          <label style={s.label}>비밀번호</label>
          <input
            style={s.input} type="password" placeholder="비밀번호 입력"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        <button style={s.btn} onClick={handleSubmit} disabled={loading}>
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </div>
    </div>
  );
}
