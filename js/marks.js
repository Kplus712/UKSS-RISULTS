/* marks.js
  - MVP marks entry using localStorage
  - Data models: classes, students, subjects, marks, report_cards
  - Functions: add student, add subject, render matrix, validate, save marks, generate reports
*/

// ---------- Utilities ----------
const $ = id => document.getElementById(id);
const toast = msg => {
  const t = document.createElement('div');
  t.innerText = msg;
  t.style.background = '#222';
  t.style.color = '#fff';
  t.style.padding = '10px 14px';
  t.style.borderRadius = '8px';
  t.style.marginTop = '6px';
  t.style.opacity = '0.95';
  $('toast').appendChild(t);
  setTimeout(()=> t.remove(), 3000);
};

const STORAGE_KEY = 'school_results_v1';

// ---------- Default Data (sample) ----------
const sample = {
  classes: [{ id: 'form1A', name: 'Form 1A' }],
  students: [
    { id: 'S001', admission_no: 'ADM001', first_name: 'Amina', last_name: 'Yusuf', class_id: 'form1A', guardian_phone: '0710000001' },
    { id: 'S002', admission_no: 'ADM002', first_name: 'David', last_name: 'Mwakyembe', class_id: 'form1A', guardian_phone: '0710000002' },
    { id: 'S003', admission_no: 'ADM003', first_name: 'Fatma', last_name: 'Hassan', class_id: 'form1A', guardian_phone: '0710000003' }
  ],
  subjects: [
    { id: 'ENG', code: 'ENG', name: 'English' },
    { id: 'MATH', code: 'MATH', name: 'Mathematics' },
    { id: 'SST', code: 'SST', name: 'Social Studies' }
  ],
  marks: {
    // structure: marks[class_id][exam_id][student_id][subject_id] = { ca: x, exam: y, total: z }
  },
  exams: [
    { id: 'term1_2025', name: 'Term 1 - 2025', term: 1, year: 2025 }
  ],
  report_cards: []
};

// ---------- Storage access ----------
function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    // initialize blank
    const base = {
      classes: [],
      students: [],
      subjects: [],
      marks: {},
      exams: [],
      report_cards: []
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(base));
    return base;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('Invalid storage JSON. Resetting.');
    localStorage.removeItem(STORAGE_KEY);
    return loadData();
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ---------- App State ----------
let store = loadData();

// ---------- Render helpers ----------
function renderClassOptions() {
  const sel = $('classSelect');
  sel.innerHTML = '';
  store.classes.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.innerText = c.name;
    sel.appendChild(opt);
  });
  if (!sel.value && store.classes.length) sel.value = store.classes[0].id;
}

function renderStudentsList() {
  const wrap = $('studentsList');
  wrap.innerHTML = '';
  const cls = $('classSelect').value;
  const list = store.students.filter(s => s.class_id === cls);
  if (list.length === 0) {
    wrap.innerText = 'Hakuna wanafunzi waliopo kwa class hii.';
    return;
  }
  const ul = document.createElement('div');
  list.forEach(s => {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.justifyContent = 'space-between';
    div.style.padding = '6px 0';
    div.innerHTML = `<div>${s.admission_no} — ${s.first_name} ${s.last_name} <span class="small">(${s.id})</span></div>
                     <div><button class="btn btn-ghost" data-id="${s.id}" onclick="removeStudent('${s.id}')">Delete</button></div>`;
    ul.appendChild(div);
  });
  wrap.appendChild(ul);
}

function renderSubjectsList() {
  const wrap = $('subjectsList');
  wrap.innerHTML = '';
  if (store.subjects.length === 0) { wrap.innerText = 'Hakuna masomo.'; return; }
  store.subjects.forEach(sub => {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.justifyContent = 'space-between';
    div.style.padding = '6px 0';
    div.innerHTML = `<div>${sub.code} — ${sub.name}</div><div><button class="btn btn-ghost" onclick="removeSubject('${sub.id}')">Delete</button></div>`;
    wrap.appendChild(div);
  });
}

// ---------- CRUD functions ----------
function addClass() {
  const name = prompt('Enter class name (e.g. Form 1A):');
  if (!name) return;
  const id = name.toLowerCase().replace(/\s+/g, '_');
  if (store.classes.some(c => c.id === id)) { toast('Class exists'); return; }
  store.classes.push({ id, name });
  saveData(store);
  render();
}

function addStudent() {
  const adm = $('stuAdmission').value.trim();
  const first = $('stuFirst').value.trim();
  const last = $('stuLast').value.trim();
  const phone = $('stuPhone').value.trim();
  const cls = $('classSelect').value;

  if (!adm || !first || !last) { toast('Complete admission, first and last name'); return; }

  const id = adm;
  if (store.students.some(s => s.id === id)) { toast('Student with that admission already exists'); return; }

  store.students.push({ id, admission_no: adm, first_name: first, last_name: last, class_id: cls, guardian_phone: phone });
  saveData(store);
  $('stuAdmission').value = ''; $('stuFirst').value = ''; $('stuLast').value = ''; $('stuPhone').value = '';
  renderStudentsList();
  renderMatrix(); // matrix needs update
}

function addSubject() {
  const code = $('subCode').value.trim().toUpperCase();
  const name = $('subName').value.trim();
  if (!code || !name) { toast('Fill subject code & name'); return; }
  if (store.subjects.some(s => s.id === code)) { toast('Subject exists'); return; }
  store.subjects.push({ id: code, code, name });
  saveData(store);
  $('subCode').value = ''; $('subName').value = '';
  renderSubjectsList();
  renderMatrix();
}

function removeStudent(id) {
  if (!confirm('Delete student?')) return;
  store.students = store.students.filter(s => s.id !== id);
  // Also remove marks
  for (const clsId in store.marks) {
    for (const examId in store.marks[clsId]) {
      delete store.marks[clsId][examId][id];
    }
  }
  saveData(store);
  render();
}

function removeSubject(id) {
  if (!confirm('Delete subject?')) return;
  store.subjects = store.subjects.filter(s => s.id !== id);
  // Also remove subject marks
  for (const clsId in store.marks) {
    for (const examId in store.marks[clsId]) {
      for (const sid in store.marks[clsId][examId]) {
        delete store.marks[clsId][examId][sid][id];
      }
    }
  }
  saveData(store);
  render();
}

// ---------- Marks Matrix ----------
function renderMatrix() {
  const wrap = $('marksMatrixWrap');
  wrap.innerHTML = '';
  const cls = $('classSelect').value;
  const students = store.students.filter(s => s.class_id === cls);
  const subs = store.subjects;
  if (students.length === 0 || subs.length === 0) {
    wrap.innerHTML = '<div class="small">Ili kuanza, ongeza angalau mwanafunzi mmoja na somo moja.</div>';
    return;
  }

  // current exam id (take first exam or create one)
  const examId = store.exams.length ? store.exams[0].id : 'term1_2025';
  if (!store.exams.length) {
    store.exams.push({ id: examId, name: 'Term 1 - 2025', term:1, year:2025 });
  }

  // ensure marks structure exists
  store.marks[cls] = store.marks[cls] || {};
  store.marks[cls][examId] = store.marks[cls][examId] || {};

  // table header
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  trh.innerHTML = `<th>Admission</th><th>Student</th>`;
  subs.forEach(sub => {
    trh.innerHTML += `<th>${sub.code}<div style="font-size:11px">${sub.name}</div></th>`;
  });
  trh.innerHTML += `<th>Total</th><th>Mean</th>`;
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  students.forEach(stu => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${stu.admission_no}</td><td>${stu.first_name} ${stu.last_name}</td>`;
    let totalAll = 0;
    let subjCount = 0;

    // ensure student marks object exists
    store.marks[cls][examId][stu.id] = store.marks[cls][examId][stu.id] || {};

    subs.forEach(sub => {
      const markObj = store.marks[cls][examId][stu.id][sub.id] || { ca: '', exam: '', total: '' };
      const cell = document.createElement('td');

      // Create inputs for CA and EXAM inside cell
      const caInp = document.createElement('input');
      caInp.className = 'input-inline';
      caInp.placeholder = 'CA';
      caInp.value = markObj.ca;
      caInp.onchange = (e) => handleMarkChange(cls, examId, stu.id, sub.id, e.target.value, null);

      const exInp = document.createElement('input');
      exInp.className = 'input-inline';
      exInp.placeholder = 'EX';
      exInp.value = markObj.exam;
      exInp.onchange = (e) => handleMarkChange(cls, examId, stu.id, sub.id, null, e.target.value);

      cell.appendChild(caInp);
      cell.appendChild(document.createElement('br'));
      cell.appendChild(exInp);

      tr.appendChild(cell);

      // for summary calc, use numeric if available
      const tot = parseFloat(markObj.total);
      if (!isNaN(tot)) { totalAll += tot; subjCount++; }
      else { subjCount++; } // count subject even if blank to compute mean once filled
    });

    // Totals & Mean cells
    const totalCell = document.createElement('td');
    const meanCell = document.createElement('td');
    const stuMarks = store.marks[cls][examId][stu.id];
    // compute sum of totals for present subjects
    let sum = 0; let count = 0;
    subs.forEach(sub => {
      const m = stuMarks[sub.id];
      if (m && m.total !== '') {
        const t = parseFloat(m.total);
        if (!isNaN(t)) { sum += t; count++; }
      }
    });
    totalCell.innerText = (count>0) ? sum.toFixed(2) : '-';
    meanCell.innerText = (count>0) ? (sum / subs.length).toFixed(2) : '-'; // mean = sum / number_of_subjects
    tr.appendChild(totalCell);
    tr.appendChild(meanCell);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  wrap.appendChild(table);

  // Save interim store
  saveData(store);
}

// handle change
function handleMarkChange(classId, examId, studentId, subjectId, caVal, exVal) {
  store.marks[classId] = store.marks[classId] || {};
  store.marks[classId][examId] = store.marks[classId][examId] || {};
  store.marks[classId][examId][studentId] = store.marks[classId][examId][studentId] || {};

  const rec = store.marks[classId][examId][studentId][subjectId] || { ca: '', exam: '', total: '' };
  // parse and validate values
  const safeNum = v => {
    if (v === null || v === undefined || v === '') return '';
    // remove spaces, force numeric
    const cleaned = v.toString().trim();
    if (cleaned === '') return '';
    const n = Number(cleaned);
    return isNaN(n) ? '' : n;
  };
  const ca = (caVal !== null) ? safeNum(caVal) : rec.ca;
  const ex = (exVal !== null) ? safeNum(exVal) : rec.exam;

  // compute total if both provided (or sum existing)
  let total = '';
  const cnum = (ca === '') ? 0 : Number(ca);
  const exnum = (ex === '') ? 0 : Number(ex);
  // Validation: CA and EX must be between 0 and 100 and CA+EX <= 100
  const isValidNumber = v => v === '' ? true : (typeof v === 'number' && v >= 0 && v <= 100);
  if (!isValidNumber(ca) || !isValidNumber(ex)) {
    toast('Marks should be numbers between 0 and 100');
    return;
  }
  if (ca !== '' || ex !== '') {
    total = cnum + exnum;
    // If total > 100 show warning and don't save that value
    if (total > 100) {
      toast('CA + EX must not exceed 100 for a subject');
      // do not save the invalid values; return
      return;
    }
  } else {
    total = '';
  }

  rec.ca = (ca === '') ? '' : Number(ca);
  rec.exam = (ex === '') ? '' : Number(ex);
  rec.total = (total === '') ? '' : Number(total);
  store.marks[classId][examId][studentId][subjectId] = rec;
  saveData(store);
  renderMatrix(); // re-render to update totals/means
}

// ---------- Save All / Generate Reports ----------
function saveAllMarks() {
  saveData(store);
  toast('Marks saved to browser storage.');
}

function generateReports() {
  // For each class, exam, compute report_cards for each student
  const generated = [];
  const gradeFromMean = (mean) => {
    // Example grade rules (editable)
    if (mean >= 80) return 'A';
    if (mean >= 65) return 'B';
    if (mean >= 50) return 'C';
    if (mean >= 35) return 'D';
    return 'E';
  };
  const remarkFromMean = (mean, weakSubjects) => {
    if (mean >= 80) return `Hongera! Wastani ${mean.toFixed(2)}. Endelea hivyo.`;
    if (mean >= 65) return `Stadi nzuri. Wastani ${mean.toFixed(2)}. Bainisha masomo ya kuboresha: ${weakSubjects.join(', ')}`;
    if (mean >= 50) return `Wastani ${mean.toFixed(2)}. Tafadhali endelea kufanya kazi za ziada.`;
    if (mean >= 35) return `Wastani ${mean.toFixed(2)}. Anahitaji msaada wa ziada.`;
    return `Tuna wasiwasi. Wastani ${mean.toFixed(2)}. Tafadhali wasiliana na shule.`;
  };

  const subs = store.subjects;
  const subjectsCount = subs.length || 1;
  for (const cls of store.classes) {
    const clsId = cls.id;
    const examIds = store.exams.map(e => e.id);
    examIds.forEach(exId => {
      const classMarks = (store.marks[clsId] && store.marks[clsId][exId]) ? store.marks[clsId][exId] : {};
      for (const stuId of Object.keys(classMarks)) {
        const stuRec = store.students.find(s => s.id === stuId);
        if (!stuRec) continue;
        // compute sum and mean
        let sum = 0;
        const weak = [];
        subs.forEach(sub => {
          const m = classMarks[stuId][sub.id];
          const t = (m && m.total !== '') ? Number(m.total) : 0;
          sum += t;
          // consider weak if subject score < 50
          if (t < 50) weak.push(sub.code);
        });
        const mean = sum / subjectsCount;
        const grade = gradeFromMean(mean);
        const remark = remarkFromMean(mean, weak);

        const report = {
          id: `${stuId}_${exId}`,
          student_id: stuId,
          admission_no: stuRec.admission_no,
          class_id: clsId,
          exam_id: exId,
          total_marks: sum,
          mean_score: Number(mean.toFixed(2)),
          grade,
          remark,
          weak_subjects: weak,
          generated_at: (new Date()).toISOString()
        };
        // store/update report
        // remove previous if exists
        store.report_cards = store.report_cards.filter(r => r.id !== report.id);
        store.report_cards.push(report);
        generated.push(report);
      }
    });
  }

  saveData(store);
  toast(`Generated ${generated.length} report(s).`);
  // store generated in a place accessible by results page (we already saved in store.report_cards)
}

// ---------- Export / Import / Clear ----------
function exportData() {
  const dataStr = JSON.stringify(store, null, 2);
  const blob = new Blob([dataStr], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'school_results_export.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importData() {
  const raw = prompt('Paste JSON data to import (this will overwrite current store).');
  if (!raw) return;
  try {
    const obj = JSON.parse(raw);
    if (!obj) throw new Error('Invalid');
    store = obj;
    saveData(store);
    render();
    toast('Data imported');
  } catch (e) {
    alert('Invalid JSON');
  }
}

function clearAll() {
  if (!confirm('Clear all data? This will reset everything.')) return;
  localStorage.removeItem(STORAGE_KEY);
  store = loadData();
  render();
  toast('All cleared');
}

// ---------- Load sample ----------
function loadSampleData() {
  if (!confirm('Load sample data? This will add sample classes, students and subjects to your current store.')) return;
  // Be careful not to duplicate ids
  // Add classes
  sample.classes.forEach(c => {
    if (!store.classes.some(x => x.id === c.id)) store.classes.push(c);
  });
  // students
  sample.students.forEach(s => {
    if (!store.students.some(x => x.id === s.id)) store.students.push(s);
  });
  // subjects
  sample.subjects.forEach(sub => {
    if (!store.subjects.some(x => x.id === sub.id)) store.subjects.push(sub);
  });
  // exams
  sample.exams.forEach(e => {
    if (!store.exams.some(x => x.id === e.id)) store.exams.push(e);
  });

  saveData(store);
  render();
  toast('Sample data loaded');
}

// ---------- Navigation ----------
function gotoResults() {
  // open results.html in same origin; if not exist, alert
  window.location.href = 'results.html';
}

// ---------- Initial render ----------
function render() {
  renderClassOptions();
  renderStudentsList();
  renderSubjectsList();
  renderMatrix();
}

// ---------- Attach events ----------
window.addEventListener('load', () => {
  render();

  $('addClassBtn').onclick = addClass;
  $('addStudentBtn').onclick = addStudent;
  $('addSubjectBtn').onclick = addSubject;
  $('loadSample').onclick = loadSampleData;
  $('saveAll').onclick = saveAllMarks;
  $('generateReports').onclick = generateReports;
  $('exportJson').onclick = exportData;
  $('importJsonBtn').onclick = importData;
  $('clearAll').onclick = clearAll;
  $('gotoResults').onclick = gotoResults;

  // when class select changes re-render
  $('classSelect').onchange = () => {
    renderStudentsList();
    renderMatrix();
  };
});

// expose some functions to window for inline onclick usage
window.removeStudent = removeStudent;
window.removeSubject = removeSubject;
