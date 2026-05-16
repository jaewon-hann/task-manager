import React, { useState } from 'react';
import Dashboard from './pages/Dashboard.jsx';
import TaskList from './pages/TaskList.jsx';
import Projects from './pages/Projects.jsx';
import Settings from './pages/Settings.jsx';
import CalendarView from './pages/CalendarView.jsx';
import WeeklyView from './pages/WeeklyView.jsx';

const NAV = [
  { id: 'dashboard', label: '대시보드',   icon: '▦' },
  { id: 'tasks',     label: '전체 업무',  icon: '☰' },
  { id: 'today',     label: '오늘 할 일', icon: '◎' },
  { id: 'week',      label: '주차별',     icon: '□' },
  { id: 'month',     label: '이번 달',    icon: '◫' },
  { id: 'archive',   label: '아카이브',   icon: '◻' },
  { id: 'calendar',  label: '완료 캘린더', icon: '▤' },
  { id: 'projects',  label: '프로젝트',   icon: '◈' },
  { id: 'settings',  label: '설정',       icon: '⚙' },
];

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [pageParams, setPageParams] = useState({});

  const navigate = (pageId, params = {}) => {
    setPage(pageId);
    setPageParams(params);
  };

  const s = {
    layout: { display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: '100vh' },
    sidebar: {
      background: 'var(--surface)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
    },
    logoArea: { padding: '24px 20px 18px', borderBottom: '1px solid var(--border)' },
    logo: { fontSize: '17px', fontWeight: '700', color: 'var(--accent)', letterSpacing: '-0.3px' },
    logoSub: { fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: '3px' },
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
    footer: { padding: '14px 20px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--mono)' },
    main: { display: 'flex', flexDirection: 'column', minHeight: '100vh', overflow: 'hidden' },
  };

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard onNavigate={navigate} />;
      case 'tasks':     return <TaskList filter="all"   params={pageParams} />;
      case 'today':     return <TaskList filter="today" params={pageParams} />;
      case 'week':      return <WeeklyView />;
      case 'month':     return <TaskList filter="month" params={pageParams} />;
      case 'archive':   return <TaskList filter="archive" params={pageParams} />;
      case 'calendar':  return <CalendarView />;
      case 'projects':  return <Projects />;
      case 'settings':  return <Settings />;
      default:          return <Dashboard onNavigate={navigate} />;
    }
  };

  return (
    <div style={s.layout}>
      <aside style={s.sidebar}>
        <div style={s.logoArea}>
          <div style={s.logo}>Task Manager</div>
          <div style={s.logoSub}>업무 관리 자동화 시스템</div>
        </div>
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
        </nav>
        <div style={s.footer}>v1.1.0 · 개인용</div>
      </aside>
      <main style={s.main}>{renderPage()}</main>
    </div>
  );
}
