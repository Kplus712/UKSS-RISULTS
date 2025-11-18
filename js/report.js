// /js/report.js
import { col, getAll } from './database.js';
const $ = id => document.getElementById(id);

let store = { classes:[], students:[], reports:[] };

async function loadAll(){
  [store.classes, store.students, store.reports] = await Promise.all([ getAll(col.classes), getAll(col.students), getAll(col.report_cards) ]);
}

function fillFilter(){
  $('classFilter').innerHTML = `<option value="">All Classes</option>` + store.classes.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
}

function render(list){
  const tbody = $('resultsTable').querySelector('tbody'); tbody.innerHTML = '';
  if(!list.length){ tbody.innerHTML = `<tr><td colspan="9">No reports found.</td></tr>`; return; }
  list.forEach(r=>{
    const stu = store.students.find(s=>s.id===r.student_id) || {};
    const cls = store.classes.find(c=>c.id===r.class_id) || {};
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.admission_no}</td><td>${stu.first_name||''} ${stu.last_name||''}</td><td>${cls.name||'-'}</td><td>${r.total_marks}</td><td>${r.mean_score}</td><td>${r.grade}</td><td>${(r.weak_subjects||[]).join(', ')}</td><td>${r.remark}</td><td><button class="btn btn-ghost" onclick="printSingle('${r.id}')">Print</button></td>`;
    tbody.appendChild(tr);
  });
}

window.printSingle = function(id){
  const r = store.reports.find(x=>x.id===id);
  const stu = store.students.find(s=>s.id===r.student_id)||{};
  const cls = store.classes.find(c=>c.id===r.class_id)||{};
  const html = `<html><head><title>Report</title></head><body style="font-family:Inter;padding:20px"><h2>STUDENT REPORT CARD</h2><p><strong>Name:</strong> ${stu.first_name||''} ${stu.last_name||''}</p><p><strong>Admission:</strong> ${r.admission_no}</p><p><strong>Class:</strong> ${cls.name||'-'}</p><p>Total: ${r.total_marks}</p><p>Mean: ${r.mean_score}</p><p>Grade: ${r.grade}</p><p>Weak: ${(r.weak_subjects||[]).join(', ')}</p><p>Remark: ${r.remark}</p><p>Printed: ${new Date().toLocaleString()}</p></body></html>`;
  const w = window.open('','_blank'); w.document.write(html); w.document.close(); w.print();
};

function applyFilters(){
  const q = $('searchBox').value.trim().toLowerCase();
  const cls = $('classFilter').value;
  const list = store.reports.filter(r=>{
    const s = store.students.find(x=>x.id===r.student_id)||{};
    const matchesQ = !q || (s.first_name||'').toLowerCase().includes(q) || (s.last_name||'').toLowerCase().includes(q) || (r.admission_no||'').toLowerCase().includes(q);
    const matchesC = !cls || r.class_id===cls;
    return matchesQ && matchesC;
  });
  render(list);
}

window.addEventListener('load', async ()=>{
  await loadAll();
  fillFilter();
  render(store.reports);
  $('searchBox').oninput = applyFilters;
  $('classFilter').onchange = applyFilters;
  $('printAll').onclick = ()=> window.print();
});
