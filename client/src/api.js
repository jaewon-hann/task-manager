const BASE = '/api';

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  tasks: {
    list:   (q = '') => apiFetch(`/tasks${q}`),
    today:  ()       => apiFetch('/tasks/today'),
    week:   ()       => apiFetch('/tasks/week'),
    month:  ()       => apiFetch('/tasks/month'),
    get:    (id)     => apiFetch(`/tasks/${id}`),
    create: (data)   => apiFetch('/tasks', { method: 'POST', body: data }),
    update: (id, d)  => apiFetch(`/tasks/${id}`, { method: 'PUT', body: d }),
    delete: (id)     => apiFetch(`/tasks/${id}`, { method: 'DELETE' }),
  },
  projects: {
    list:          (includeArchived = false) => apiFetch(`/projects${includeArchived ? '?includeArchived=true' : ''}`),
    create:        (data)  => apiFetch('/projects', { method: 'POST', body: data }),
    update:        (id, d) => apiFetch(`/projects/${id}`, { method: 'PUT', body: d }),
    delete:        (id)    => apiFetch(`/projects/${id}`, { method: 'DELETE' }),
    completeTasks: (id)    => apiFetch(`/projects/${id}/complete-tasks`, { method: 'POST' }),
  },
  stats:    () => apiFetch('/stats'),
  events: {
    list:   (q = '') => apiFetch(`/events${q}`),
    create: (data)   => apiFetch('/events', { method: 'POST', body: data }),
    update: (id, d)  => apiFetch(`/events/${id}`, { method: 'PUT', body: d }),
    delete: (id)     => apiFetch(`/events/${id}`, { method: 'DELETE' }),
  },
  settings: {
    get:  ()     => apiFetch('/settings'),
    save: (data) => apiFetch('/settings', { method: 'PUT', body: data }),
  },
};
