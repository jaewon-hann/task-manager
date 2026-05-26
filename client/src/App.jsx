import React, { useState, useEffect, useRef } from 'react';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import TaskList from './pages/TaskList.jsx';
import Projects from './pages/Projects.jsx';
import Settings from './pages/Settings.jsx';
import CalendarView from './pages/CalendarView.jsx';
import WeeklyView from './pages/WeeklyView.jsx';
import MonthView from './pages/MonthView.jsx';
import TeamManagement from './pages/TeamManagement.jsx';
import { api } from './api.js';

const NAV = [
  { id: 'dashboard', label: '대시보드',   icon: '▦' },
  { id: 'tasks',     label: '전체 업무',  icon: '☰' },
  { id: 'today',     label: '오늘 할 일', icon: '◎' },
  { id: 'week',      label: '주차별',     icon: '□' },
  { id: 'month',     label: '이번 달',    icon: '◫' },
  { id: 'archive',   label: '아카이브',   icon: '◻' },
  { id: 'calendar',  label: '완료 캘린더', icon: '▤' },
  { id: 'projects',  label: '프로젝트',   icon: '◈' },
];

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [page, setPage] = useState('dashboard');
  const [pageParams, setPageParams] = useState({});
  const [users, setUsers] = useState([]);
  const [targetUser, setTargetUser] = useState(null); // null = 내 워크플레이스
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // 외부 클릭시 드롭다운 닫기
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 팀원 목록 로드
  useEffect(() => {
    if (user) {
      api.users.list().then(data => setUsers(data.filter(u => u.is_active))).catch(() => {});
    }
  }, [user]);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('targetUserId');
    setUser(null);
    setTargetUser(null);
  };

  const handleSelectWorkspace = (selectedUser) => {
    if (!selectedUser || selectedUser.id === user.id) {
      // 내 워크플레이스
      localStorage.removeItem('targetUserId');
      setTargetUser(null);
    } else {
      localStorage.setItem('targetUserId', String(selectedUser.id));
      setTargetUser(selectedUser);
    }
    setDropdownOpen(false);
    setPage('dashboard');
  };

  const navigate = (pageId, params = {}) => {
    setPage(pageId);
    setPageParams(params);
  };

  if (!user) return <Login onLogin={handleLogin} />;

  const isViewingOther = targetUser !== null;
  const displayUser = targetUser || user;

  const s = {
    layout: { display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: '100vh' },
    sidebar: {
      background: 'var(--surface)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
    },
    logoArea: { padding: '20px 16px 16px', borderBottom: '1px solid var(--border)' },
    logo: { fontSize: '16px', fontWeight: '700', color: 'var(--accent)', letterSpacing: '-0.3px' },
    nav: { padding: '12px 10px', flex: 1 },
    navItem: (active) => ({
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '9px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
      fontSize: '13px', color: active ? 'var(--accent)' : 'var(--text2)',
      background: active ? 'rgba(111,106,248,0.12)' : 'transparent',
      transition: 'all 0.15s', userSelect: 'none', border: 'none',
      width: '100%', textAlign: 'left', fontFamily: 'var(--sans)',
    }),
    navIcon: { fontSize: '15px', width: '18px', textAlign: 'center' },
    footer: {
      padding: '12px 16px', borderTop: '1px solid var(--border)',
    },
    main: { display: 'flex', flexDirection: 'column', minHeight: '100vh', overflow: 'hidden' },
  };

  const renderPage = () => {
    if (isViewingOther) {
      // 다른 팀원 워크플레이스 - 읽기 전용
      switch (page) {
        case 'dashboard': return <Dashboard onNavigate={navigate} />;
        case 'tasks':     return <TaskList filter="all" params={pageParams} />;
        case 'today':     return <TaskList filter="today" params={pageParams} />;
        case 'week':      return <WeeklyView />;
        case 'month':     return <MonthView />;
        case 'archive':   return <TaskList filter="archive" params={pageParams} />;
        case 'calendar':  return <CalendarView />;
        case 'projects':  return <Projects />;
        default:          return <Dashboard onNavigate={navigate} />;
      }
    }
    switch (page) {
      case 'dashboard': return <Dashboard onNavigate={navigate} />;
      case 'tasks':     return <TaskList filter="all" params={pageParams} />;
      case 'today':     return <TaskList filter="today" params={pageParams} />;
      case 'week':      return <WeeklyView />;
      case 'month':     return <MonthView />;
      case 'archive':   return <TaskList filter="archive" params={pageParams} />;
      case 'calendar':  return <CalendarView />;
      case 'projects':  return <Projects />;
      case 'settings':  return <Settings />;
      case 'team':      return <TeamManagement currentUser={user} />;
      default:          return <Dashboard onNavigate={navigate} />;
    }
  };

  return (
    <div style={s.layout}>
      <aside style={s.sidebar}>
        <div style={s.logoArea}>
          <div style={s.logo}>Task Manager</div>

          {/* 워크플레이스 드롭다운 */}
          <div ref={dropdownRef} style={{ position: 'relative', marginTop: '12px' }}>
            <button
              onClick={() => setDropdownOpen(v => !v)}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: '8px',
                background: isViewingOther ? 'rgba(247,200,67,0.1)' : 'var(--surface2)',
                border: `1px solid ${isViewingOther ? 'rgba(247,200,67,0.3)' : 'var(--border2)'}`,
                color: isViewingOther ? 'var(--amber)' : 'var(--text)',
                fontSize: '12px', cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontFamily: 'var(--sans)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '7px', overflow: 'hidden' }}>
                <span style={{
                  width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                  background: isViewingOther ? 'rgba(247,200,67,0.2)' : 'rgba(111,106,248,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: '700',
                  color: isViewingOther ? 'var(--amber)' : 'var(--accent)',
                }}>
                  {displayUser.name[0]}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {isViewingOther ? `${displayUser.name}의 워크플레이스` : '내 워크플레이스'}
                </span>
              </span>
              <span style={{ fontSize: '10px', flexShrink: 0, marginLeft: '4px' }}>
                {dropdownOpen ? '▲' : '▼'}
              </span>
            </button>

            {dropdownOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                background: 'var(--surface)', border: '1px solid var(--border2)',
                borderRadius: '10px', zIndex: 100, overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                {/* 내 워크플레이스 */}
                <div
                  onClick={() => handleSelectWorkspace(null)}
                  style={{
                    padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                    background: !isViewingOther ? 'rgba(111,106,248,0.1)' : 'transparent',
                    borderBottom: '1px solid var(--border)',
                  }}
                  onMouseEnter={e => { if (isViewingOther) e.currentTarget.style.background = 'var(--surface2)'; }}
                  onMouseLeave={e => { if (isViewingOther) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{
                    width: '26px', height: '26px', borderRadius: '50%',
                    background: 'rgba(111,106,248,0.2)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: 'var(--accent)',
                    flexShrink: 0,
                  }}>{user.name[0]}</div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: !isViewingOther ? 'var(--accent)' : 'var(--text)' }}>
                      {user.name} (나)
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text3)' }}>내 워크플레이스</div>
                  </div>
                  {!isViewingOther && <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: '12px' }}>✓</span>}
                </div>

                {/* 팀원 목록 */}
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {users.filter(u => u.id !== user.id).map(u => (
                    <div
                      key={u.id}
                      onClick={() => handleSelectWorkspace(u)}
                      style={{
                        padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                        background: targetUser?.id === u.id ? 'rgba(247,200,67,0.08)' : 'transparent',
                      }}
                      onMouseEnter={e => { if (targetUser?.id !== u.id) e.currentTarget.style.background = 'var(--surface2)'; }}
                      onMouseLeave={e => { if (targetUser?.id !== u.id) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{
                        width: '26px', height: '26px', borderRadius: '50%',
                        background: 'rgba(78,204,163,0.15)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: 'var(--teal)',
                        flexShrink: 0,
                      }}>{u.name[0]}</div>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: '500', color: targetUser?.id === u.id ? 'var(--amber)' : 'var(--text)' }}>
                          {u.name}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text3)' }}>{u.email}</div>
                      </div>
                      {targetUser?.id === u.id && <span style={{ marginLeft: 'auto', color: 'var(--amber)', fontSize: '12px' }}>✓</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 읽기 전용 배너 */}
          {isViewingOther && (
            <div style={{
              marginTop: '8px', padding: '6px 10px', borderRadius: '6px',
              background: 'rgba(247,200,67,0.08)', border: '1px solid rgba(247,200,67,0.2)',
              fontSize: '11px', color: 'var(--amber)', textAlign: 'center',
            }}>
              👁 조회 전용
            </div>
          )}
        </div>

        {/* 네비게이션 */}
        <nav style={s.nav}>
          {NAV.map(n => (
            <button key={n.id} style={s.navItem(page === n.id)}
              onClick={() => navigate(n.id)}
              onMouseEnter={e => { if (page !== n.id) e.currentTarget.style.background = 'var(--surface2)'; }}
              onMouseLeave={e => { if (page !== n.id) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={s.navIcon}>{n.icon}</span>
              {n.label}
            </button>
          ))}

          {/* 내 워크플레이스일 때만 설정/팀원관리 표시 */}
          {!isViewingOther && (
            <>
              <button style={s.navItem(page === 'settings')}
                onClick={() => navigate('settings')}
                onMouseEnter={e => { if (page !== 'settings') e.currentTarget.style.background = 'var(--surface2)'; }}
                onMouseLeave={e => { if (page !== 'settings') e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={s.navIcon}>⚙</span>
                설정
              </button>
              {user.role === 'admin' && (
                <button style={s.navItem(page === 'team')}
                  onClick={() => navigate('team')}
                  onMouseEnter={e => { if (page !== 'team') e.currentTarget.style.background = 'var(--surface2)'; }}
                  onMouseLeave={e => { if (page !== 'team') e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={s.navIcon}>👥</span>
                  팀원 관리
                </button>
              )}
            </>
          )}
        </nav>

        {/* 하단 유저 정보 */}
        <div style={s.footer}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: 'rgba(111,106,248,0.2)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: 'var(--accent)',
              flexShrink: 0,
            }}>{user.name[0]}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <div style={{ fontSize: '10px', color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: '6px', borderRadius: '6px', fontSize: '11px',
              background: 'transparent', border: '1px solid var(--border)', color: 'var(--text3)',
              cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text3)'; }}
          >
            로그아웃
          </button>
        </div>
      </aside>

      <main style={s.main}>{renderPage()}</main>
    </div>
  );
}
