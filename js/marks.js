// /js/marks.js
// Modern marks entry (Firestore) — Exam ID: annual_2025
import {
  col,
  getAll,
  getDocById,
  setDocById,
  queryCollection,
  addCollectionDoc
} from './database.js';

const $ = id => document.getElementById(id);
const STORAGE_KEY = 'ui_last_class'; // optional local UI cache

const EXAM_ID = 'annual_2025';

// small toast
function toast(msg, time = 2500) {
  const t = document.createElement('div');
  t.innerText = msg;
  t.style = "background:#072b6a;color:#fff;padding:10px 14px;border-radius:10px;margin-top:6px;box-shadow:0 6px 18px rgba(3,63,145,0.12)";
  $('toast').appendChild(t);
  setTimeout(()=> t.remove(), time);
}

// --- load/store data helpers (Firestore)
async function loadAllCollections() {
  const [classes, students, subjects, exams] = await Promise.all([
    getAll(col.classes),
    getAll(col.students),
    getAll(col.subjects),
    getAll(col.exams)
  ]);
  return { classes, students, subjects, exams };
}

// --- renderers
async function renderUI() {
  const store = await loadAllCollections();
  renderClassOptions(store.classes);
  renderStudentsList(store.students, store.classes);
  renderSubjectsList(store.subjects);
  await renderMatrix(store);
}

function renderClassOptions(classes) {
  const sel = $('classSelect');
  sel.innerHTML = '';
  classes.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.innerText = c.name;
    sel.appendChild(opt);
  });
  if (!sel.value && classes.length) {
    sel.value = localStorage.getItem(STORAGE_KEY) || classes[0].id;
  }
}

function renderStudentsList(students, classes) {
  const wrap = $('studentsList');
  wrap.innerHTML = '';
  const cls = $('classSelect').value;
  const list = students.filter(s => s.class_id === cls);
  if (!list.length) {
    wrap.innerHTML = '<div class="small">No students in this class yet.</div>';
    return;
  }
  list.forEach(s => {
    const div = document.createElement('div');
    div.style.display='flex';
    div.style.justifyContent='space-between';
    div.style.padding='8px 0';
    div.innerHTML = `<div>${s.admission_no} — <strong>${s.first_name} ${s.last_name}</strong></div>
      <div><button class="btn btn-ghost" onclick="removeStudent('${s.id}')">Delete</button></div>`;
    wrap.appendChild(div);
  });
}

function renderSubjectsList(subjects) {
  const wrap = $('subjectsList');
  wrap.innerHTML = '';
  if (!subjects.length) { wrap.innerHTML = '<div class="small">No subjects yet.</div>'; return; }
  subjects.forEach(sub => {
    const div = document.createElement('div');
    div.style.display='flex'; div.style.justifyContent='space-between'; div.style.padding='8px 0';
    div.innerHTML = `<div>${sub.code} — ${sub.name}</div><div><button class="btn btn-ghost" onclick="removeSubject('${sub.id}')">Delete</button></div>`;
    wrap.appendChild(div);
  });
}

// --- marks doc id helper
function marksDocId(classId, examId, studentId) {
  return `${classId}__${examId}__${studentId}`;
}

// --- render matrix (reads marks per student)
async function renderMatrix(storeOverride = null) {
  // fetch latest
  const { classes, students, subjects, exams } = storeOverride || await loadAllCollections();
  const wrap = $('marksMatrixWrap');
  wrap.innerHTML = '';

  const cls = $('classSelect').value || (classes[0] && classes[0].id);
  if (!cls || !subjects.length) {
    wrap.innerHTML = '<div class="small">Add a class and at least one subject to start entering marks.</div>';
    return;
  }

  const studentsInClass = students.filter(s => s.class_id === cls);
  if (!studentsInClass.length) {
    wrap.innerHTML = '<div class="small">No students in this class yet.</div>';
    return;
  }

  // header
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  trh.innerHTML = `<th>Admission</th><th>Student</th>`;
  subjects.forEach(sub => trh.innerHTML += `<th>${sub.code}<div style="font-size:11px">${sub.name}</div></th>`);
  trh.innerHTML += `<th>Total</th><th>Mean</th>`;
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  // build rows
  for (const stu of studentsInClass) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${stu.admission_no}</td><td>${stu.first_name} ${stu.last_name}</td>`;

    let sum = 0;

    // for each subject, get mark doc for this student
    for (const sub of subjects) {
      const cell = document.createElement('td');

      // attempt to read marks doc (single doc per student-class-exam)
      const docId = marksDocId(cls, EXAM_ID, stu.id);
      const doc = await getDocById(col.marks, docId);
      const subj = (doc && doc.subject_marks && doc.subject_marks[sub.id]) ? doc.subject_marks[sub.id] : { ca: '', exam: '', total: '' };

      const caInp = document.createElement('input');
      caInp.className = 'input-inline';
      caInp.placeholder = 'CA';
      caInp.value = (subj.ca === null || subj.ca === undefined) ? '' : subj.ca;
      caInp.onchange = async (e) => {
        try {
          await saveMarkEntry(cls, EXAM_ID, stu.id, sub.id, e.target.value, subj.exam);
          toast('Saved');
          await renderMatrix(); // re-render to update totals
        } catch (err) {
          toast(err.message || 'Error saving');
        }
      };

      const exInp = document.createElement('input');
      exInp.className = 'input-inline';
      exInp.placeholder = 'EX';
      exInp.value = (subj.exam === null || subj.exam === undefined) ? '' : subj.exam;
      exInp.onchange = async (e) => {
        try {
          await saveMarkEntry(cls, EXAM_ID, stu.id, sub.id, subj.ca, e.target.value);
          toast('Saved');
          await renderMatrix();
        } catch (err) {
          toast(err.message || 'Error saving');
        }
      };

      cell.appendChild(caInp);
      cell.appendChild(document.createElement('br'));
      cell.appendChild(exInp);
      tr.appendChild(cell);

      sum += (subj.total || 0);
    }

    const totalCell = document.createElement('td');
    const meanCell = document.createElement('td');
    totalCell.innerText = sum.toFixed(2);
    meanCell.innerText = (subjects.length ? (sum / subjects.length).toFixed(2) : '-');
    tr.appendChild(totalCell);
    tr.appendChild(meanCell);

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  wrap.appendChild(table);
}

// --- save single mark entry (merge into marks doc)
async function saveMarkEntry(classId, examId, studentId, subjectId, caVal, exVal) {
  // parse
  const ca = (caVal === '' || caVal === null || caVal === undefined) ? null : Number(caVal);
  const ex = (exVal === '' || exVal === null || exVal === undefined) ? null : Number(exVal);

  if (ca !== null && (isNaN(ca) || ca < 0 || ca > 100)) throw new Error('CA must be 0–100');
  if (ex !== null && (isNaN(ex) || ex < 0 || ex > 100)) throw new Error('Exam must be 0–100');

  const total = (Number(ca || 0) + Number(ex || 0));
  if (total > 100) throw new Error('CA + EX must not exceed 100');

  const docId = marksDocId(classId, examId, studentId);
  const existing = await getDocById(col.marks, docId);
  const subject_marks = (existing && existing.subject_marks) ? existing.subject_marks : {};

  subject_marks[subjectId] = { ca: (ca === null ? null : ca), exam: (ex === null ? null : ex), total: total };

  await setDocById(col.marks, docId, {
    id: docId,
    class_id: classId,
    exam_id: examId,
    student_id: studentId,
    subject_marks,
    updated_at: new Date().toISOString()
  });
}

// --- add / remove functions
async function addClass() {
  const name = prompt('Enter class name (e.g. Form 1A):');
  if (!name) return;
  const id = name.toLowerCase().replace(/\s+/g, '_');
  await setDocById(col.classes, id, { id, name });
  toast('Class added');
  await renderUI();
}

async function addStudent() {
  const adm = $('stuAdmission').value.trim();
  const first = $('stuFirst').value.trim();
  const last = $('stuLast').value.trim();
  const phone = $('stuPhone').value.trim();
  const cls = $('classSelect').value;
  if (!adm || !first || !last) { toast('Complete admission & names'); return; }
  const id = adm;
  await setDocById(col.students, id, { id, admission_no: adm, first_name: first, last_name: last, class_id: cls, guardian_phone: phone });
  $('stuAdmission').value = ''; $('stuFirst').value = ''; $('stuLast').value = ''; $('stuPhone').value = '';
  toast('Student added');
  await renderUI();
}

async function addSubject() {
  const code = $('subCode').value.trim().toUpperCase();
  const name = $('subName').value.trim();
  if (!code || !name) { toast('Fill subject'); return; }
  await setDocById(col.subjects, code, { id: code, code, name });
  $('subCode').value = ''; $('subName').value = '';
  toast('Subject added');
  await renderUI();
}

async function removeStudent(id) {
  if (!confirm('Delete student?')) return;
  // soft delete: set `deleted: true`
  await setDocById(col.students, id, { deleted: true });
  toast('Student removed (soft)');
  await renderUI();
}

async function removeSubject(id) {
  if (!confirm('Delete subject?')) return;
  await setDocById(col.subjects, id, { deleted: true });
  toast('Subject removed (soft)');
  await renderUI();
}

// --- generate report cards
function gradeFromMean(mean) {
  if (mean >= 80) return 'A';
  if (mean >= 65) return 'B';
  if (mean >= 50) return 'C';
  if (mean >= 35) return 'D';
  return 'E';
}
function remarkFromMean(mean, weakSubjects) {
  if (mean >= 80) return `Hongera! Wastani ${mean.toFixed(2)}. Endelea hivyo.`;
  if (mean >= 65) return `Stadi nzuri. Wastani ${mean.toFixed(2)}. Bainisha masomo ya kuboresha: ${weakSubjects.join(', ')}`;
  if (mean >= 50) return `Wastani ${mean.toFixed(2)}. Tafadhali endelea kufanya kazi za ziada.`;
  if (mean >= 35) return `Wastani ${mean.toFixed(2)}. Anahitaji msaada wa ziada.`;
  return `Tuna wasiwasi. Wastani ${mean.toFixed(2)}. Tafadhali wasiliana na shule.`;
}

async function generateReports() {
  toast('Generating reports (this may take a few seconds)...', 4000);
  const { classes, students, subjects } = await loadAllCollections();
  const subs = subjects.filter(s=>!s.deleted);

  for (const cls of classes) {
    const studs = (await getAllClassesStudents(cls.id)) || [];
    for (const stu of studs) {
      // read marks doc
      const docId = marksDocId(cls.id, EXAM_ID, stu.id);
      const markDoc = await getDocById(col.marks, docId);
      const sm = (markDoc && markDoc.subject_marks) ? markDoc.subject_marks : {};

      let sum = 0; const weak = [];
      subs.forEach(sub => {
        const t = sm[sub.id] ? (sm[sub.id].total || 0) : 0;
        sum += t;
        if (t < 50) weak.push(sub.code);
      });
      const mean = subs.length ? (sum / subs.length) : 0;
      const grade = gradeFromMean(mean);
      const remark = remarkFromMean(mean, weak);
      const reportId = `${stu.id}_${EXAM_ID}`;

      await setDocById(col.report_cards, reportId, {
        id: reportId,
        student_id: stu.id,
        admission_no: stu.admission_no,
        class_id: cls.id,
        exam_id: EXAM_ID,
        total_marks: sum,
        mean_score: Number(mean.toFixed(2)),
        grade,
        remark,
        weak_subjects: weak,
        generated_at: new Date().toISOString()
      });
    }
  }

  toast('Reports generated and saved to Firestore.');
}

// helper to get students for a class via query
async function getAllClassesStudents(classId) {
  // simple approach: fetch all students and filter
  const all = await getAll(col.students);
  return all.filter(s => s.class_id === classId && !s.deleted);
}

// export all to JSON (for backup)
async function exportAll() {
  const [classes, students, subjects, exams, marks, reports] = await Promise.all([
    getAll(col.classes), getAll(col.students), getAll(col.subjects), getAll(col.exams), getAll(col.marks), getAll(col.report_cards)
  ]);
  const payload = { classes, students, subjects, exams, marks, reports };
  const blob = new Blob([JSON.stringify(payload, null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'export_school_results.json'; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast('Export created');
}

// load sample data (creates docs in Firestore)
async function loadSampleData() {
  if (!confirm('This will create sample classes, students and subjects in Firestore. Continue?')) return;
  const cId = 'form1A';
  await setDocById(col.classes, cId, { id: cId, name: 'Form 1A' });
  await setDocById(col.subjects, 'ENG', { id:'ENG', code:'ENG', name:'English' });
  await setDocById(col.subjects, 'MATH', { id:'MATH', code:'MATH', name:'Mathematics' });
  await setDocById(col.subjects, 'SST', { id:'SST', code:'SST', name:'Social Studies' });
  await setDocById(col.exams, EXAM_ID, { id: EXAM_ID, name: 'Annual 2025', term:'annual', year:2025 });

  await setDocById(col.students, 'S001', { id:'S001', admission_no:'ADM001', first_name:'Amina', last_name:'Yusuf', class_id:cId, guardian_phone:'0710000001' });
  await setDocById(col.students, 'S002', { id:'S002', admission_no:'ADM002', first_name:'David', last_name:'Mwakyembe', class_id:cId, guardian_phone:'0710000002' });
  await setDocById(col.students, 'S003', { id:'S003', admission_no:'ADM003', first_name:'Fatma', last_name:'Hassan', class_id:cId, guardian_phone:'0710000003' });

  toast('Sample data added to Firestore');
  await renderUI();
}

// --- Attach events
window.addEventListener('load', async () => {
  // Buttons
  $('addClassBtn').onclick = addClass;
  $('addStudentBtn').onclick = addStudent;
  $('addSubjectBtn').onclick = addSubject;
  $('loadSample').onclick = loadSampleData;
  $('saveAll').onclick = () => toast('All saves are live as you edit (Firestore).');
  $('generateReports').onclick = generateReports;
  $('exportBtn').onclick = exportAll;
  $('clearBtn').onclick = () => { $('marksMatrixWrap').innerHTML = ''; toast('Local view cleared'); };

  $('classSelect').onchange = (e) => {
    localStorage.setItem(STORAGE_KEY, e.target.value);
    renderUI();
  };
  $('searchStudent').oninput = async (e) => {
    // simple client-side filter: re-render and hide rows not matching
    await renderUI();
    const q = e.target.value.trim().toLowerCase();
    if (!q) return;
    const rows = document.querySelectorAll('#marksMatrixWrap table tbody tr');
    rows.forEach(r => {
      const studentCell = r.children[1].innerText.toLowerCase();
      const admission = r.children[0].innerText.toLowerCase();
      if (studentCell.includes(q) || admission.includes(q)) r.style.display = '';
      else r.style.display = 'none';
    });
  };

  // initial render
  await renderUI();
});

// expose delete helpers to global for inline use
window.removeStudent = removeStudent;
window.removeSubject = removeSubject;
