// /js/sms_logs.js
import { getAll, col } from './database.js';
const $ = id => document.getElementById(id);

async function loadLogs() {
  const logs = await getAll(col.sms_logs);
  const tbody = $('logsTable').querySelector('tbody');
  tbody.innerHTML = '';
  logs.sort((a,b)=> new Date(b.timestamp||b.sent_at||0) - new Date(a.timestamp||a.sent_at||0));
  logs.forEach((l, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td>${l.student_id||'-'}</td><td>${l.phone||l.guardian_phone||'-'}</td><td>${(l.sms||l.message||'').slice(0,120)}</td><td>${l.exam_id||'-'}</td><td>${new Date(l.timestamp||l.sent_at||l.created_at||Date.now()).toLocaleString()}</td>`;
    tbody.appendChild(tr);
  });
}

window.addEventListener('load', loadLogs);
