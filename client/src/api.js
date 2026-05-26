const BASE = '/api';

export function showToast(message, type = 'error') {
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type } }));
}

function getToken() { return localStorage.getItem('token'); }
function getTargetUserId() { return localStorage.getItem('targetUserId'); }

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const targetUserId = getTargetUserId();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(targetUserId ? { 'x-target-user-id': targetUserId } : {}),
  };
  const res = await fetch(`${BASE}${path}`, {
    ...options, headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // 로그인 API는 401을 세션 만료로 처리하지 않음
  if (res.status === 401 && path !== '/auth/login') {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('targetUserId');
    showToast('로그인 세션이 만료되었습니다. 다시 로그인해주세요.', 'warning');
    setTimeout(() => window.location.reload(), 1500);
    return;
  }

  if (res.status === 403) {
    showToast('다른 팀원의 워크플레이스는 조회만 가능합니다.', 'error');
    throw new Error('403 Forbidden');
  }

  if (!res.ok) {
    let errMsg = '오류가 발생했습니다.';
    try { errMsg = JSON.parse(await res.text()).error || errMsg; } catch {}
    throw new Error(errMsg);
  }

  return res.json();
}

export const api = {
  auth: {
    login:          (data)     => apiFetch('/auth/login', { method: 'POST', body: data }),
    me:             ()         => apiFetch('/auth/me'),
    changePassword: (data)     => apiFetch('/auth/password', { method: 'PUT', body: data }),
  },
  users: {
    list:   ()         => apiFetch('/users'),
    create: (data)     => apiFetch('/users', { method: 'POST', body: data }),
    update: (id, data) => apiFetch(`/users/${id}`, { method: 'PUT', body: data }),
    remove: (id)       => apiFetch(`/users/${id}`, { method: 'DELETE' }),
  },
  tasks: {
    list:   (q='')  => apiFetch(`/tasks${q}`),
    today:  ()      => apiFetch('/tasks/today'),
    week:   ()      => apiFetch('/tasks/week'),
    month:  ()      => apiFetch('/tasks/month'),
    get:    (id)    => apiFetch(`/tasks/${id}`),
    create: (data)  => apiFetch('/tasks', { method: 'POST', body: data }),
    update: (id, d) => apiFetch(`/tasks/${id}`, { method: 'PUT', body: d }),
    delete: (id)    => apiFetch(`/tasks/${id}`, { method: 'DELETE' }),
  },
  projects: {
    list:          (includeArchived=false) => apiFetch(`/projects${includeArchived?'?includeArchived=true':''}`),
    create:        (data)  => apiFetch('/projects', { method: 'POST', body: data }),
    update:        (id, d) => apiFetch(`/projects/${id}`, { method: 'PUT', body: d }),
    delete:        (id)    => apiFetch(`/projects/${id}`, { method: 'DELETE' }),
    completeTasks: (id)    => apiFetch(`/projects/${id}/complete-tasks`, { method: 'POST' }),
  },
  stats:    () => apiFetch('/stats'),
  events: {
    list:   (q='')  => apiFetch(`/events${q}`),
    create: (data)  => apiFetch('/events', { method: 'POST', body: data }),
    update: (id, d) => apiFetch(`/events/${id}`, { method: 'PUT', body: d }),
    delete: (id)    => apiFetch(`/events/${id}`, { method: 'DELETE' }),
  },
  settings: {
    get:  ()     => apiFetch('/settings'),
    save: (data) => apiFetch('/settings', { method: 'PUT', body: data }),
  },
};
