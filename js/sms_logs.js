// /js/sms_logs.js
import { col, getAll } from './database.js';
const $ = id => document.getElementById(id);

async function load(){
  const logs = await getAll(col.sms_logs);
  const tbody = $('logsTable').querySelector('tbody'); tbody.innerHTML = '';
  logs.sort((a,b)=> new Date(b.timestamp||0)-new Date(a.timestamp||0)).forEach((l,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td>${l.student_id||'-'}</td><td>${l.phone||'-'}</td><td>${(l.sms||'').slice(0,120)}</td><td>${l.exam_id||'-'}</td><td>${new Date(l.timestamp||Date.now()).toLocaleString()}</td>`;
    tbody.appendChild(tr);
  });
}
window.addEventListener('load', load);
