import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Settings({ currentUser }) {
  const [settings, setSettings] = useState({ mail_to: '', mail_from: '', mail_time: '08:00' });
  const [saved, setSaved] = useState(false);
  const [sending, setSending] = useState(false);
  const [mailResult, setMailResult] = useState(null);
  const [mailError, setMailError] = useState('');
  const [loading, setLoading] = useState(true);

  // 비밀번호 변경
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    api.settings.get().then(s => { setSettings(s); setLoading(false); });
  }, []);

  const handleSave = async () => {
    await api.settings.save(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestMail = async () => {
    setSending(true); setMailResult(null); setMailError('');
    try {
      await api.settings.save(settings);
      const res = await fetch('/api/test-mail', { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
      const data = await res.json();
      if (res.ok) { setMailResult('ok'); setTimeout(() => setMailResult(null), 4000); }
      else { setMailResult('fail'); setMailError(data.error || '알 수 없는 오류'); }
    } catch (e) { setMailResult('fail'); setMailError(e.message); }
    finally { setSending(false); }
  };

  const handlePasswordChange = async () => {
    if (!pwForm.current_password || !pwForm.new_password) { setPwMsg('❌ 모든 항목을 입력해주세요'); return; }
    if (pwForm.new_password !== pwForm.confirm_password) { setPwMsg('❌ 새 비밀번호가 일치하지 않습니다'); return; }
    if (pwForm.new_password.length < 6) { setPwMsg('❌ 비밀번호는 6자 이상이어야 합니다'); return; }
    setPwSaving(true); setPwMsg('');
    try {
      await api.auth.changePassword({ current_password: pwForm.current_password, new_password: pwForm.new_password });
      setPwMsg('✅ 비밀번호가 변경되었습니다');
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (e) {
      try { setPwMsg('❌ ' + JSON.parse(e.message).error); } catch { setPwMsg('❌ 변경 실패'); }
    } finally { setPwSaving(false); }
  };

  const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '13px' };
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

        {/* 비밀번호 변경 */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>🔒 비밀번호 변경</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={labelStyle}>현재 비밀번호</label>
              <input style={inputStyle} type="password" placeholder="현재 비밀번호"
                value={pwForm.current_password} onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>새 비밀번호</label>
              <input style={inputStyle} type="password" placeholder="새 비밀번호 (6자 이상)"
                value={pwForm.new_password} onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>새 비밀번호 확인</label>
              <input style={inputStyle} type="password" placeholder="새 비밀번호 다시 입력"
                value={pwForm.confirm_password} onChange={e => setPwForm(f => ({ ...f, confirm_password: e.target.value }))} />
            </div>
            {pwMsg && (
              <div style={{
                padding: '8px 12px', borderRadius: '6px', fontSize: '12px',
                background: pwMsg.startsWith('✅') ? 'rgba(78,204,163,0.1)' : 'rgba(240,96,96,0.1)',
                border: `1px solid ${pwMsg.startsWith('✅') ? 'rgba(78,204,163,0.3)' : 'rgba(240,96,96,0.3)'}`,
                color: pwMsg.startsWith('✅') ? 'var(--teal)' : 'var(--danger)',
              }}>{pwMsg}</div>
            )}
            <button onClick={handlePasswordChange} disabled={pwSaving} style={{ padding: '9px 20px', borderRadius: '6px', background: 'var(--accent)', color: '#fff', border: 'none', fontSize: '13px', fontWeight: '700', cursor: 'pointer', alignSelf: 'flex-start', opacity: pwSaving ? 0.7 : 1 }}>
              {pwSaving ? '변경 중...' : '비밀번호 변경'}
            </button>
          </div>
        </div>

        {/* 메일 설정 */}
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

        {/* OpenAI API */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>🤖 OpenAI API</div>
          <div>
            <label style={labelStyle}>OpenAI API Key</label>
            <input style={inputStyle} type="password" placeholder="sk-..." />
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '6px' }}>
              <a href="https://ai-tools.myrealtrip.net/" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>https://ai-tools.myrealtrip.net/</a>에서 GPT API 키를 신청 후 입력해주세요.
            </div>
          </div>
        </div>

        {/* Gmail 앱 비밀번호 */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>⚙ Gmail 앱 비밀번호</div>
          <div>
            <label style={labelStyle}>Gmail 앱 비밀번호 (16자리)</label>
            <input style={inputStyle} type="password" placeholder="xxxx xxxx xxxx xxxx" />
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
          <button onClick={handleTestMail} disabled={sending} style={{ padding: '10px 28px', borderRadius: '8px', background: mailResult==='ok' ? '#4ecca3' : mailResult==='fail' ? 'var(--danger)' : 'var(--surface2)', color: mailResult ? '#fff' : 'var(--text2)', border: '1px solid var(--border2)', fontSize: '14px', fontWeight: '700', cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1, transition: 'background 0.3s' }}>
            {sending ? '발송 중...' : mailResult==='ok' ? '✓ 발송 완료!' : mailResult==='fail' ? '✗ 발송 실패' : '📧 테스트 메일 발송'}
          </button>
          {mailResult==='fail' && mailError && (
            <div style={{ fontSize: '12px', color: 'var(--danger)', marginTop: '4px', width: '100%' }}>오류: {mailError}</div>
          )}
        </div>
      </div>
    </div>
  );
}
