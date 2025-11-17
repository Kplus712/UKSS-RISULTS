/*
  report.js
  - Reads report_cards from localStorage
  - Search filter
  - Class filter
  - Print PDF (browser print)
  - Table render
*/

const STORAGE_KEY = 'school_results_v1';
const $ = (id) => document.getElementById(id);

// Load dataset
let store = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
  classes: [],
  students: [],
  subjects: [],
  marks: {},
  exams: [],
  report_cards: []
};

let filteredList = store.report_cards || [];

// Initialize page
window.onload = () => {
  fillClassFilter();
  renderTable(store.report_cards);

  $('searchBox').oninput = applyFilters;
  $('classFilter').onchange = applyFilters;

  $('printAll').onclick = () => {
    window.print();
  };
};

// Fill class filter dropdown
function fillClassFilter() {
  const sel = $('classFilter');
  sel.innerHTML = `<option value="">All Classes</option>`;
  store.classes.forEach(c => {
    sel.innerHTML += `<option value="${c.id}">${c.name}</option>`;
  });
}

// Apply search + class filters
function applyFilters() {
  let text = $('searchBox').value.toLowerCase();
  let cls = $('classFilter').value;

  filteredList = store.report_cards.filter(r => {
    const stu = store.students.find(s => s.id === r.student_id);
    if (!stu) return false;

    let matchesText =
      stu.first_name.toLowerCase().includes(text) ||
      stu.last_name.toLowerCase().includes(text) ||
      stu.admission_no.toLowerCase().includes(text);

    let matchesClass = cls ? r.class_id === cls : true;

    return matchesText && matchesClass;
  });

  renderTable(filteredList);
}

// Render table
function renderTable(list) {
  const tbody = $('resultsTable').querySelector('tbody');
  tbody.innerHTML = '';

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="9">No results found.</td></tr>`;
    return;
  }

  list.forEach(r => {
    const stu = store.students.find(s => s.id === r.student_id);
    const cls = store.classes.find(c => c.id === r.class_id);

    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${r.admission_no}</td>
      <td>${stu.first_name} ${stu.last_name}</td>
      <td>${cls ? cls.name : '-'}</td>
      <td>${r.total_marks}</td>
      <td>${r.mean_score}</td>
      <td>${r.grade}</td>
      <td>${r.weak_subjects.join(', ')}</td>
      <td>${r.remark}</td>
      <td><button class="btn btn-ghost" onclick="printSingle('${r.id}')">Print</button></td>
    `;

    tbody.appendChild(tr);
  });
}

// Print individual report (opens printable window)
function printSingle(reportId) {
  const r = store.report_cards.find(x => x.id === reportId);
  const stu = store.students.find(s => s.id === r.student_id);
  const cls = store.classes.find(c => c.id === r.class_id);

  let html = `
    <html>
    <head>
      <title>Report Card - ${stu.first_name}</title>
      <style>
        body{ font-family:Arial; padding:20px; }
        .box{ border:1px solid #999; padding:20px; border-radius:10px; }
        h2{ text-align:center; }
        table{ width:100%; border-collapse:collapse; margin-top:20px; }
        td, th{ border:1px solid #ccc; padding:8px; text-align:left; }
        .footer{ margin-top:20px; }
      </style>
    </head>
    <body>
      <div class="box">
        <h2>STUDENT REPORT CARD</h2>
        <p><strong>Name:</strong> ${stu.first_name} ${stu.last_name}</p>
        <p><strong>Admission:</strong> ${r.admission_no}</p>
        <p><strong>Class:</strong> ${cls ? cls.name : '-'}</p>

        <table>
          <tr><th>Total Marks</th><td>${r.total_marks}</td></tr>
          <tr><th>Mean Score</th><td>${r.mean_score}</td></tr>
          <tr><th>Grade</th><td>${r.grade}</td></tr>
          <tr><th>Weak Subjects</th><td>${r.weak_subjects.join(', ')}</td></tr>
          <tr><th>Teacher Remark</th><td>${r.remark}</td></tr>
        </table>

        <div class="footer">
          <p>Printed on: ${new Date().toLocaleString()}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}
