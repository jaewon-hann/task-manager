import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Settings() {
  const [settings, setSettings] = useState({
    mail_to: '', mail_from: '', mail_time: '08:00', openai_api_key: '',
  });
  const [saved, setSaved] = useState(false);
  const [sending, setSending] = useState(false);
  const [mailResult, setMailResult] = useState(null); // null | 'ok' | 'fail'
  const [mailError, setMailError] = useState('');

  const handleTestMail = async () => {
    setSending(true);
    setMailResult(null);
    setMailError('');
    try {
      await api.settings.save(settings); // 먼저 저장
      const res = await fetch('/api/test-mail', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setMailResult('ok');
        setTimeout(() => setMailResult(null), 4000);
      } else {
        setMailResult('fail');
        setMailError(data.error || '알 수 없는 오류');
      }
    } catch (e) {
      setMailResult('fail');
      setMailError(e.message);
    } finally {
      setSending(false);
    }
  };
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.settings.get().then(s => { setSettings(s); setLoading(false); });
  }, []);

  const handleSave = async () => {
    await api.settings.save(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: '6px',
    border: '1px solid var(--border2)', background: 'var(--surface2)',
    color: 'var(--text)', fontSize: '13px',
  };
  const labelStyle = { display: 'block', fontSize: '12px', color: 'var(--text3)', marginBottom: '5px', fontFamily: 'var(--mono)' };
  const sectionStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '22px', marginBottom: '16px' };
  const sectionTitle = { fontSize: '15px', fontWeight: '700', marginBottom: '18px' };

  if (loading) return <div style={{ padding: '40px', color: 'var(--text3)' }}>로딩 중...</div>;

  return (
    <div>
      <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: '20px', fontWeight: '700' }}>설정</div>
      </div>
      <div style={{ padding: '24px 28px', maxWidth: '560px' }}>

        <div style={sectionStyle}>
          <div style={sectionTitle}>📧 메일 설정</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={labelStyle}>수신 이메일</label>
              <input style={inputStyle} type="email" value={settings.mail_to} placeholder="받을 이메일 주소"
                onChange={e => setSettings(s => ({ ...s, mail_to: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>발신 Gmail 주소</label>
              <input style={inputStyle} type="email" value={settings.mail_from} placeholder="Gmail 주소"
                onChange={e => setSettings(s => ({ ...s, mail_from: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>발송 시각</label>
              <input style={{ ...inputStyle, width: '140px' }} type="time" value={settings.mail_time}
                onChange={e => setSettings(s => ({ ...s, mail_time: e.target.value }))} />
            </div>
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={sectionTitle}>🤖 OpenAI API</div>
          <div>
            <label style={labelStyle}>OpenAI API Key</label>
            <input style={inputStyle} type="password" value={settings.openai_api_key || ''} placeholder="AIza..."
              onChange={e => setSettings(s => ({ ...s, openai_api_key: e.target.value }))} />
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '6px' }}>
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>platform.openai.com/api-keys</a>에서 발급받을 수 있습니다.
            </div>
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={sectionTitle}>⚙ Gmail 앱 비밀번호</div>
          <div>
            <label style={labelStyle}>Gmail 앱 비밀번호 (16자리)</label>
            <input style={inputStyle} type="password" value={settings.gmail_app_password || ''} placeholder="xxxx xxxx xxxx xxxx"
              onChange={e => setSettings(s => ({ ...s, gmail_app_password: e.target.value }))} />
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '6px', lineHeight: '1.7' }}>
              발급 방법: Google 계정 → 보안 → 2단계 인증 활성화 →{' '}
              <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>앱 비밀번호</a> → 앱: 메일 → 기기: 기타 → 16자리 복사
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={handleSave} style={{ padding: '10px 28px', borderRadius: '8px', background: saved ? '#4ecca3' : 'var(--accent)', color: '#fff', border: 'none', fontSize: '14px', fontWeight: '700', transition: 'background 0.3s', cursor: 'pointer' }}>
            {saved ? '✓ 저장됨' : '설정 저장'}
          </button>
          <button onClick={handleTestMail} disabled={sending}
            style={{ padding: '10px 28px', borderRadius: '8px', background: mailResult === 'ok' ? '#4ecca3' : mailResult === 'fail' ? 'var(--danger)' : 'var(--surface2)', color: mailResult ? '#fff' : 'var(--text2)', border: '1px solid var(--border2)', fontSize: '14px', fontWeight: '700', cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1, transition: 'background 0.3s' }}>
            {sending ? '발송 중...' : mailResult === 'ok' ? '✓ 발송 완료!' : mailResult === 'fail' ? '✗ 발송 실패' : '📧 테스트 메일 발송'}
          </button>
          {mailResult === 'fail' && mailError && (
            <div style={{ fontSize: '12px', color: 'var(--danger)', marginTop: '4px', width: '100%' }}>오류: {mailError}</div>
          )}
        </div>
      </div>
    </div>
  );
}
