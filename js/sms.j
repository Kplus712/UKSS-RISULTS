// /js/sms.js
import { col, getAll, getDocById, setDocById } from './database.js';
const $ = id => document.getElementById(id);
const EXAM_ID = 'annual_2025';
let recipients = [];

async function loadClasses(){ const cs = await getAll(col.classes); $('classSelect').innerHTML = cs.map(c=>`<option value="${c.id}">${c.name}</option>`).join(''); }
function setTemplate(){
  const t = $('templateSelect').value;
  if(t==='simple') $('msgBox').value = "Matokeo ya {FirstName} ({Admission}): Mean {Mean}, Grade {Grade}.";
  else if(t==='detail') $('msgBox').value = "Matokeo: {FirstName} — Mean {Mean}, Grade {Grade}. Weak: {Weak}.";
  else $('msgBox').value = "{FirstName}: Mean {Mean}, Grade {Grade}. Remark: {Remark}.";
}

window.addEventListener('load', ()=>{ loadClasses(); setTemplate(); $('templateSelect').onchange = setTemplate; $('loadRecipients').onclick = loadRecipients; $('sendAll').onclick = sendAll; });

async function loadRecipients(){
  const cls = $('classSelect').value; if(!cls) return alert('Select class');
  const students = (await getAll(col.students)).filter(s=>s.class_id===cls && !s.deleted);
  const tbody = $('recTable').querySelector('tbody'); tbody.innerHTML=''; recipients=[];
  for(const s of students){
    const repId = `${s.id}_${EXAM_ID}`; const rep = await getDocById(col.report_cards, repId);
    if(!rep) continue;
    const sms = buildMessage(s, rep);
    recipients.push({s,rep,sms});
    const tr = document.createElement('tr'); tr.innerHTML = `<td>${s.first_name} ${s.last_name}<div class="small">${s.admission_no}</div></td><td>${s.guardian_phone||'-'}</td><td>${sms}</td>`;
    tbody.appendChild(tr);
  }
  if(!recipients.length) tbody.innerHTML = `<tr><td colspan="3">No recipients found (generate reports first)</td></tr>`;
}

function buildMessage(s, r){
  return $('msgBox').value.replace(/{FirstName}/g, s.first_name).replace(/{Admission}/g, s.admission_no).replace(/{Mean}/g, r.mean_score).replace(/{Grade}/g, r.grade).replace(/{Weak}/g, (r.weak_subjects||[]).join(', ')).replace(/{Remark}/g, r.remark);
}

async function sendAll(){
  if(!recipients.length) return alert('Load recipients first');
  $('smsStatus').innerText = 'Sending...';
  for(const row of recipients){
    await new Promise(r=>setTimeout(r,350)); // mock delay
    // save log
    const logId = `${row.s.id}_${Date.now()}`;
    await setDocById(col.sms_logs, logId, { id: logId, student_id: row.s.id, phone: row.s.guardian_phone, sms: row.sms, exam_id: EXAM_ID, delivered:true, timestamp: new Date().toISOString() });
    $('smsStatus').innerText = `Sent to ${row.s.first_name} ${row.s.last_name}`;
  }
  $('smsStatus').innerText = 'All messages sent (mock)';
}
