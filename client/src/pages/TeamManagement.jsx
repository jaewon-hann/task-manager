import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: '6px',
  border: '1px solid var(--border2)', background: 'var(--surface2)',
  color: 'var(--text)', fontSize: '13px',
};
const labelStyle = {
  display: 'block', fontSize: '12px', color: 'var(--text3)',
  marginBottom: '5px', fontFamily: 'var(--mono)',
};

export default function TeamManagement({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'member' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    const data = await api.users.list();
    setUsers(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const showMsg = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000); };

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) { showMsg('❌ 이름, 이메일, 비밀번호를 모두 입력해주세요'); return; }
    setSaving(true);
    try {
      await api.users.create(form);
      setForm({ name: '', email: '', password: '', role: 'member' });
      showMsg('✅ 팀원이 추가되었습니다');
      load();
    } catch (e) {
      try { showMsg('❌ ' + JSON.parse(e.message).error); } catch { showMsg('❌ 추가 실패'); }
    } finally { setSaving(false); }
  };

  const handleEdit = (user) => {
    setEditingId(user.id);
    setEditForm({ name: user.name, email: user.email, role: user.role, is_active: user.is_active, password: '' });
  };

  const handleUpdate = async (id) => {
    setSaving(true);
    try {
      await api.users.update(id, editForm);
      setEditingId(null);
      showMsg('✅ 수정되었습니다');
      load();
    } catch (e) {
      try { showMsg('❌ ' + JSON.parse(e.message).error); } catch { showMsg('❌ 수정 실패'); }
    } finally { setSaving(false); }
  };

  // 비활성화 (로그인 차단, 데이터 유지)
  const handleDeactivate = async (user) => {
    if (!confirm(`${user.name}님을 비활성화하시겠습니까?\n로그인이 차단되지만 데이터는 유지됩니다.`)) return;
    try {
      await api.users.update(user.id, { ...user, is_active: false });
      showMsg('✅ 비활성화되었습니다');
      load();
    } catch (e) {
      try { showMsg('❌ ' + JSON.parse(e.message).error); } catch { showMsg('❌ 실패'); }
    }
  };

  // 재활성화
  const handleActivate = async (user) => {
    if (!confirm(`${user.name}님을 다시 활성화하시겠습니까?`)) return;
    try {
      await api.users.update(user.id, { ...user, is_active: true });
      showMsg('✅ 활성화되었습니다');
      load();
    } catch (e) {
      try { showMsg('❌ ' + JSON.parse(e.message).error); } catch { showMsg('❌ 실패'); }
    }
  };

  // 완전 삭제
  const handleDelete = async (user) => {
    if (!confirm(`${user.name}님을 완전히 삭제하시겠습니까?\n⚠️ 해당 팀원의 모든 업무/프로젝트 데이터가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`)) return;
    try {
      await api.users.remove(user.id);
      showMsg('✅ 삭제되었습니다');
      load();
    } catch (e) {
      try { showMsg('❌ ' + JSON.parse(e.message).error); } catch { showMsg('❌ 삭제 실패'); }
    }
  };

  const sectionStyle = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: '12px', padding: '22px', marginBottom: '16px',
  };

  return (
    <div>
      <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: '20px', fontWeight: '700' }}>팀원 관리</div>
        <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '4px' }}>관리자만 접근 가능합니다</div>
      </div>

      <div style={{ padding: '24px 28px', maxWidth: '640px' }}>

        {msg && (
          <div style={{
            padding: '10px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px',
            background: msg.startsWith('✅') ? 'rgba(78,204,163,0.1)' : 'rgba(240,96,96,0.1)',
            border: `1px solid ${msg.startsWith('✅') ? 'rgba(78,204,163,0.3)' : 'rgba(240,96,96,0.3)'}`,
            color: msg.startsWith('✅') ? 'var(--teal)' : 'var(--danger)',
          }}>{msg}</div>
        )}

        {/* 팀원 추가 */}
        <div style={sectionStyle}>
          <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: '18px' }}>➕ 새 팀원 추가</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={labelStyle}>이름 *</label>
              <input style={inputStyle} placeholder="홍길동" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>이메일 *</label>
              <input style={inputStyle} type="email" placeholder="hong@example.com" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>임시 비밀번호 *</label>
              <input style={inputStyle} type="password" placeholder="임시 비밀번호" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>권한</label>
              <select style={inputStyle} value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="member">팀원</option>
                <option value="admin">관리자</option>
              </select>
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '14px' }}>
            💡 추가 후 팀원에게 이메일과 임시 비밀번호를 전달해주세요.
          </div>
          <button onClick={handleCreate} disabled={saving} style={{
            padding: '9px 20px', borderRadius: '6px', background: 'var(--accent)',
            color: '#fff', border: 'none', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
            opacity: saving ? 0.7 : 1,
          }}>
            {saving ? '추가 중...' : '팀원 추가'}
          </button>
        </div>

        {/* 팀원 목록 */}
        <div style={sectionStyle}>
          <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: '18px' }}>
            👥 팀원 목록 ({users.filter(u => u.is_active).length}명 활성 / 총 {users.length}명)
          </div>

          {loading ? (
            <div style={{ color: 'var(--text3)', fontSize: '13px' }}>로딩 중...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {users.map(user => (
                <div key={user.id} style={{
                  background: 'var(--surface2)', borderRadius: '10px', padding: '14px 16px',
                  border: '1px solid var(--border)',
                  opacity: user.is_active ? 1 : 0.6,
                }}>
                  {editingId === user.id ? (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                        <div>
                          <label style={labelStyle}>이름</label>
                          <input style={inputStyle} value={editForm.name}
                            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div>
                          <label style={labelStyle}>이메일</label>
                          <input style={inputStyle} value={editForm.email}
                            onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                        </div>
                        <div>
                          <label style={labelStyle}>새 비밀번호 (변경시만 입력)</label>
                          <input style={inputStyle} type="password" placeholder="변경하지 않으면 비워두세요"
                            value={editForm.password}
                            onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))} />
                        </div>
                        <div>
                          <label style={labelStyle}>권한</label>
                          <select style={inputStyle} value={editForm.role}
                            onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
                            <option value="member">팀원</option>
                            <option value="admin">관리자</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleUpdate(user.id)} disabled={saving} style={{
                          padding: '6px 14px', borderRadius: '6px', background: 'var(--accent)',
                          color: '#fff', border: 'none', fontSize: '12px', cursor: 'pointer',
                        }}>저장</button>
                        <button onClick={() => setEditingId(null)} style={{
                          padding: '6px 14px', borderRadius: '6px', background: 'transparent',
                          border: '1px solid var(--border2)', color: 'var(--text2)', fontSize: '12px', cursor: 'pointer',
                        }}>취소</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                        background: user.role === 'admin' ? 'rgba(111,106,248,0.2)' : 'rgba(78,204,163,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '14px', fontWeight: '700',
                        color: user.role === 'admin' ? 'var(--accent)' : 'var(--teal)',
                      }}>
                        {user.name[0]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '14px', fontWeight: '500' }}>{user.name}</span>
                          <span style={{
                            fontSize: '10px', padding: '2px 7px', borderRadius: '10px',
                            background: user.role === 'admin' ? 'rgba(111,106,248,0.15)' : 'rgba(78,204,163,0.12)',
                            color: user.role === 'admin' ? 'var(--accent)' : 'var(--teal)',
                          }}>
                            {user.role === 'admin' ? '관리자' : '팀원'}
                          </span>
                          {!user.is_active && (
                            <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '10px', background: 'rgba(240,96,96,0.1)', color: 'var(--danger)' }}>
                              비활성
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>{user.email}</div>
                      </div>

                      {user.id !== currentUser.id && (
                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                          <button onClick={() => handleEdit(user)} style={{
                            padding: '5px 12px', borderRadius: '6px', fontSize: '12px',
                            background: 'var(--surface)', border: '1px solid var(--border2)',
                            color: 'var(--text2)', cursor: 'pointer',
                          }}>수정</button>

                          {user.is_active ? (
                            <button onClick={() => handleDeactivate(user)} style={{
                              padding: '5px 12px', borderRadius: '6px', fontSize: '12px',
                              background: 'rgba(247,200,67,0.1)', border: '1px solid rgba(247,200,67,0.3)',
                              color: 'var(--amber)', cursor: 'pointer',
                            }}>비활성화</button>
                          ) : (
                            <button onClick={() => handleActivate(user)} style={{
                              padding: '5px 12px', borderRadius: '6px', fontSize: '12px',
                              background: 'rgba(78,204,163,0.1)', border: '1px solid rgba(78,204,163,0.3)',
                              color: 'var(--teal)', cursor: 'pointer',
                            }}>활성화</button>
                          )}

                          <button onClick={() => handleDelete(user)} style={{
                            padding: '5px 12px', borderRadius: '6px', fontSize: '12px',
                            background: 'rgba(240,96,96,0.1)', border: '1px solid rgba(240,96,96,0.2)',
                            color: 'var(--danger)', cursor: 'pointer',
                          }}>삭제</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
