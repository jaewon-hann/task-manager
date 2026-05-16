const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/tasks.json');

const DEFAULT_DATA = {
  tasks: [],
  projects: [
    { id: 1, name: '샌프란시스코 도시관리', color: '#6f6af8', created_at: new Date().toISOString() },
    { id: 2, name: '시애틀 도시개발',       color: '#4ecca3', created_at: new Date().toISOString() },
    { id: 3, name: '신규 수요 발굴',         color: '#f7c843', created_at: new Date().toISOString() },
  ],
  settings: {
    mail_to: '', mail_from: '', mail_time: '08:00', openai_api_key: '', gmail_app_password: '',
  },
  _seq: { tasks: 0, projects: 3 },
};

function load() {
  if (!fs.existsSync(DATA_PATH)) return JSON.parse(JSON.stringify(DEFAULT_DATA));
  try { return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')); }
  catch { return JSON.parse(JSON.stringify(DEFAULT_DATA)); }
}

function save(data) {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function nextId(data, type) {
  data._seq[type] = (data._seq[type] || 0) + 1;
  return data._seq[type];
}

function initDB() {
  if (!fs.existsSync(DATA_PATH)) save(DEFAULT_DATA);
}

module.exports = { load, save, nextId, initDB };
