// /js/marks.js (module)
import { col, getAll, getDocById, setDocById } from './database.js';

const $ = id => document.getElementById(id);
const EXAM_ID = 'annual_2025';
const TOAST_TIME = 2500;

function toast(msg, t = TOAST_TIME) {
  const el = document.createElement('div');
  el.innerText = msg;
  el.style = "background:linear-gradient(90deg,#0b61ff,#0763f7);color:#fff;padding:8px 12px;border-radius:8px;margin-top:6px";
  document.body.appendChild(el);
  setTimeout(()=> el.remove(), t);
}

async function loadAll() {
  const [classes, students, subjects] = await Promise.all([
    getAll(col.classes), getAll(col.students), getAll(col.subjects)
  ]);
  return { classes, students, subjects };
}

async function renderUI() {
  const store = await loadAll();
  const sel = $('classSelect');
  sel.innerHTML = store.classes.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  if (!sel.value && store.classes.length) sel.value = store.classes[0].id;
  renderStudents(store.students, sel.value);
  renderSubjects(store.subjects);
  await renderMatrix(store);
}

function renderStudents(students, classId) {
  const wrap = $('studentsList'); wrap.innerHTML = '';
  const arr = students.filter(s => s.class_id === classId && !s.deleted);
  if (!arr.length) { wrap.innerHTML = '<div class="small">No students in this class yet.</div>'; return; }
  arr.forEach(s=>{
    const node = document.createElement('div');
    node.style.display='flex';node.style.justifyContent='space-between';node.style.padding='8px 0';
    node.innerHTML = `<div>${s.admission_no} — <strong>${s.first_name} ${s.last_name}</strong></div>
      <div><button class="btn btn-ghost" onclick="removeStudent('${s.id}')">Delete</button></div>`;
    wrap.appendChild(node);
  });
}

function renderSubjects(subjects) {
  const wrap = document.getElementById('subjectsList'); if(!wrap) return;
  wrap.innerHTML = '';
  if (!subjects.length) { wrap.innerHTML = '<div class="small">No subjects yet.</div>'; return; }
  subjects.forEach(sub=>{
    const d = document.createElement('div'); d.style.display='flex'; d.style.justifyContent='space-between'; d.style.padding='6px 0';
    d.innerHTML = `<div>${sub.code} — ${sub.name}</div><div><button class="btn btn-ghost" onclick="removeSubject('${sub.id}')">Delete</button></div>`;
    wrap.appendChild(d);
  });
}

function docId(classId, examId, studentId){ return `${classId}__${examId}__${studentId}`; }

async function renderMatrix(storeOverride=null) {
  const { classes, students, subjects } = storeOverride || await loadAll();
  const wrap = $('marksMatrixWrap'); wrap.innerHTML = '';
  const classId = $('classSelect').value || (classes[0] && classes[0].id);
  if (!classId || !subjects.length) { wrap.innerHTML = '<div class="small">Add class & subject to start.</div>'; return; }
  const studs = students.filter(s=>s.class_id===classId && !s.deleted);
  if (!studs.length){ wrap.innerHTML = '<div class="small">No students in this class yet.</div>'; return; }

  // build table
  const table = document.createElement('table'); table.className='table';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.innerHTML = `<th>Adm</th><th>Student</th>` + subjects.map(s=>`<th>${s.code}<div class="small">${s.name}</div></th>`).join('') + `<th>Total</th><th>Mean</th>`;
  thead.appendChild(headRow); table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const stu of studs) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${stu.admission_no}</td><td>${stu.first_name} ${stu.last_name}</td>`;
    let sum=0;
    for (const sub of subjects) {
      const td = document.createElement('td');
      const docKey = docId(classId, EXAM_ID, stu.id);
      const markDoc = await getDocById(col.marks, docKey);
      const subj = markDoc && markDoc.subject_marks && markDoc.subject_marks[sub.id] ? markDoc.subject_marks[sub.id] : {ca:'',exam:'',total:0};

      const ca = document.createElement('input'); ca.className='input-inline'; ca.placeholder='CA'; ca.value = subj.ca===null? '': subj.ca;
      ca.onchange = async (e)=> {
        try { await saveMark(classId, EXAM_ID, stu.id, sub.id, e.target.value, subj.exam); await renderMatrix(); } catch(err){ toast(err.message || 'Err'); }
      };
      const ex = document.createElement('input'); ex.className='input-inline'; ex.placeholder='EX'; ex.value = subj.exam===null? '': subj.exam;
      ex.onchange = async (e)=> {
        try { await saveMark(classId, EXAM_ID, stu.id, sub.id, subj.ca, e.target.value); await renderMatrix(); } catch(err){ toast(err.message || 'Err'); }
      };
      td.appendChild(ca); td.appendChild(document.createElement('br')); td.appendChild(ex);
      tr.appendChild(td);
      sum += (subj.total||0);
    }
    const totalCell = document.createElement('td'); totalCell.innerText = sum.toFixed(2);
    const meanCell = document.createElement('td'); meanCell.innerText = (subjects.length? (sum/subjects.length).toFixed(2) : '-');
    tr.appendChild(totalCell); tr.appendChild(meanCell);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
}

async function saveMark(classId, examId, studentId, subjectId, caVal, exVal){
  const ca = (caVal===''||caVal==null)? null : Number(caVal);
  const ex = (exVal===''||exVal==null)? null : Number(exVal);
  if (ca!==null && (isNaN(ca)||ca<0||ca>100)) throw new Error('CA 0-100');
  if (ex!==null && (isNaN(ex)||ex<0||ex>100)) throw new Error('EX 0-100');
  const total = (Number(ca||0)+Number(ex||0));
  if (total>100) throw new Error('CA+EX must not exceed 100');
  const id = docId(classId, examId, studentId);
  const existing = await getDocById(col.marks, id);
  const subject_marks = (existing && existing.subject_marks) ? existing.subject_marks : {};
  subject_marks[subjectId] = { ca: (ca===null?null:ca), exam: (ex===null?null:ex), total };
  await setDocById(col.marks, id, { id, class_id: classId, exam_id: examId, student_id: studentId, subject_marks, updated_at: new Date().toISOString() });
}

// CRUD helpers
async function addClass(){
  const name = prompt('Class name e.g. Form 1A'); if(!name) return;
  const id = name.toLowerCase().replace(/\s+/g,'_');
  await setDocById(col.classes,id,{id,name}); toast('Class added'); await renderUI();
}
async function addStudent(){
  const adm = $('stuAdmission').value.trim(), first=$('stuFirst').value.trim(), last=$('stuLast').value.trim(), phone=$('stuPhone').value.trim(), cls=$('classSelect').value;
  if(!adm||!first||!last){toast('Fill fields'); return}
  await setDocById(col.students, adm, { id:adm, admission_no:adm, first_name:first, last_name:last, class_id:cls, guardian_phone:phone});
  $('stuAdmission').value='';$('stuFirst').value='';$('stuLast').value='';$('stuPhone').value='';
  toast('Student saved'); await renderUI();
}
async function addSubject(){ const code=$('subCode').value.trim().toUpperCase(), name=$('subName').value.trim(); if(!code||!name){toast('fill subject');return} await setDocById(col.subjects, code, { id:code, code, name}); $('subCode').value='';$('subName').value=''; toast('Subject added'); await renderUI(); }
async function removeStudent(id){ if(!confirm('Delete?')) return; await setDocById(col.students, id, { deleted:true }); toast('Student removed'); await renderUI(); }
async function removeSubject(id){ if(!confirm('Delete?')) return; await setDocById(col.subjects, id, { deleted:true }); toast('Subject removed'); await renderUI(); }

// generate reports
function gradeFromMean(m){ if(m>=80) return 'A'; if(m>=65) return 'B'; if(m>=50) return 'C'; if(m>=35) return 'D'; return 'E'; }
function remarkFromMean(m,w){ if(m>=80) return `Hongera! Wastani ${m.toFixed(2)}`; if(m>=65) return `Stadi nzuri. Wastani ${m.toFixed(2)}`; if(m>=50) return `Wastani ${m.toFixed(2)}`; if(m>=35) return `Anahitaji msaada.`; return `Tuna wasiwasi.`; }

async function generateReports(){
  toast('Generating reports...');
  const { classes, students, subjects } = await loadAll();
  const subs = subjects.filter(s=>!s.deleted);
  for(const cls of classes){
    const studs = students.filter(s=>s.class_id===cls.id && !s.deleted);
    for(const s of studs){
      const docIdKey = docId(cls.id, EXAM_ID, s.id);
      const markDoc = await getDocById(col.marks, docIdKey);
      const sm = markDoc && markDoc.subject_marks ? markDoc.subject_marks : {};
      let sum=0; const weak=[];
      subs.forEach(sub=>{ const t = sm[sub.id] ? (sm[sub.id].total||0) : 0; sum += t; if(t<50) weak.push(sub.code); });
      const mean = subs.length ? (sum/subs.length) : 0;
      const grade = gradeFromMean(mean); const remark = remarkFromMean(mean, weak);
      const reportId = `${s.id}_${EXAM_ID}`;
      await setDocById(col.report_cards, reportId, { id:reportId, student_id:s.id, admission_no:s.admission_no, class_id:cls.id, exam_id:EXAM_ID, total_marks:sum, mean_score:Number(mean.toFixed(2)), grade, remark, weak_subjects: weak, generated_at:new Date().toISOString() });
    }
  }
  toast('Reports saved.');
}

// load sample
async function loadSample(){
  if(!confirm('Create sample data in Firestore?')) return;
  const c='form1A';
  await setDocById(col.classes,c,{id:c,name:'Form 1A'});
  await setDocById(col.subjects,'ENG',{id:'ENG',code:'ENG',name:'English'});
  await setDocById(col.subjects,'MATH',{id:'MATH',code:'MATH',name:'Mathematics'});
  await setDocById(col.subjects,'BS',{id:'BS',code:'BS',name:'Business Studies'});
  await setDocById(col.exams, EXAM_ID, { id: EXAM_ID, name:'Annual 2025', term:'annual', year:2025});
  await setDocById(col.students,'S001',{id:'S001',admission_no:'ADM001',first_name:'Kelvin',last_name:'Deogratias',class_id:c,guardian_phone:'0671866932'});
  await setDocById(col.students,'S002',{id:'S002',admission_no:'ADM002',first_name:'Amina',last_name:'Yusuf',class_id:c,guardian_phone:'0710000002'});
  toast('Sample created');
  await renderUI();
}

// events
window.addEventListener('load', async ()=>{
  $('addClassBtn').onclick = addClass;
  $('addStudentBtn').onclick = addStudent;
  $('addSubjectBtn').onclick = addSubject;
  $('loadSampleBtn').onclick = loadSample;
  $('saveAll').onclick = ()=>toast('All changes saved live to Firestore');
  $('genReports').onclick = generateReports;
  $('classSelect').onchange = renderUI;
  await renderUI();

  // sign out link
  const s = document.getElementById('signOutLink');
  s.onclick = async (e)=>{ e.preventDefault(); try{ const mod = await import('./database.js'); await mod.firebaseSignOut(); window.location.href='index.html'; } catch(err){ console.error(err);} }
});

// expose delete functions globally
window.removeStudent = removeStudent;
window.removeSubject = removeSubject;
