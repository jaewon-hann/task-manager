const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function getTargetUserId() {
  return localStorage.getItem('targetUserId');
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const targetUserId = getTargetUserId();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(targetUserId ? { 'x-target-user-id': targetUserId } : {}),
  };

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
    return;
  }

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  auth: {
    login:           (data)     => apiFetch('/auth/login', { method: 'POST', body: data }),
    me:              ()         => apiFetch('/auth/me'),
    changePassword:  (data)     => apiFetch('/auth/password', { method: 'PUT', body: data }),
  },
  users: {
    list:    ()         => apiFetch('/users'),
    create:  (data)     => apiFetch('/users', { method: 'POST', body: data }),
    update:  (id, data) => apiFetch(`/users/${id}`, { method: 'PUT', body: data }),
    remove:  (id)       => apiFetch(`/users/${id}`, { method: 'DELETE' }),
  },
  tasks: {
    list:    (q='')  => apiFetch(`/tasks${q}`),
    today:   ()      => apiFetch('/tasks/today'),
    week:    ()      => apiFetch('/tasks/week'),
    month:   ()      => apiFetch('/tasks/month'),
    get:     (id)    => apiFetch(`/tasks/${id}`),
    create:  (data)  => apiFetch('/tasks', { method: 'POST', body: data }),
    update:  (id, d) => apiFetch(`/tasks/${id}`, { method: 'PUT', body: d }),
    delete:  (id)    => apiFetch(`/tasks/${id}`, { method: 'DELETE' }),
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
    list:    (q='')  => apiFetch(`/events${q}`),
    create:  (data)  => apiFetch('/events', { method: 'POST', body: data }),
    update:  (id, d) => apiFetch(`/events/${id}`, { method: 'PUT', body: d }),
    delete:  (id)    => apiFetch(`/events/${id}`, { method: 'DELETE' }),
  },
  settings: {
    get:  ()     => apiFetch('/settings'),
    save: (data) => apiFetch('/settings', { method: 'PUT', body: data }),
  },
};
