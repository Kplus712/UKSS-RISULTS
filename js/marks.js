// /js/marks.js
// Marks entry for UKSS — Voting Green UI

import {
  col,
  getAll,
  getDocById,
  setDocById,
  onAuthChange,
  firebaseSignOut
} from "./database.js";

const EXAM_ID = "annual_2025";
const byId = id => document.getElementById(id);

let store = {
  classes: [],
  students: [],
  subjects: []
};

// ============ AUTH GUARD ============ //
onAuthChange(user => {
  // kama hakuna user → rudisha login
  if (!user) {
    window.location.href = "index.html";
  }
});

// ============ SIMPLE TOAST ============ //
function toast(text){
  console.log(text);
  const el = document.createElement("div");
  el.textContent = text;
  el.style.cssText =
    "position:fixed;right:16px;bottom:16px;background:#11b86a;color:#00150b;" +
    "padding:8px 12px;border-radius:8px;font-size:13px;z-index:9999;";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

// ============ LOAD DATA ============ //
async function refreshStore(){
  const [classes, students, subjects] = await Promise.all([
    getAll(col.classes),
    getAll(col.students),
    getAll(col.subjects)
  ]);
  store.classes  = classes;
  store.students = students;
  store.subjects = subjects;
}

// ============ RENDER HELPERS ============ //
function renderClassSelect(){
  const sel = byId("classSelect");
  if (!store.classes.length){
    sel.innerHTML = `<option value="">No classes yet</option>`;
    return;
  }
  sel.innerHTML = store.classes
    .map(c => `<option value="${c.id}">${c.name}</option>`)
    .join("");
}

function renderSubjectsList(){
  const box = byId("subjectsList");
  if (!store.subjects.length){
    box.innerHTML = "No subjects yet.";
    return;
  }
  box.innerHTML = store.subjects
    .map(s => `${s.code || s.id} — ${s.name}`)
    .join("<br>");
}

function renderStudentsList(){
  const classId = byId("classSelect").value;
  const box = byId("studentsList");
  const list = store.students.filter(s => s.class_id === classId);
  if (!list.length){
    box.innerHTML = "No students in this class.";
    return;
  }
  box.innerHTML = list
    .map(s => `${s.admission_no} — ${s.first_name} ${s.last_name}`)
    .join("<br>");
}

// ============ MARKS TABLE ============ //
async function renderMatrix(){
  const classId   = byId("classSelect").value;
  const container = byId("marksMatrixWrap");
  container.innerHTML = "";

  const students = store.students.filter(s => s.class_id === classId);
  const subjects = store.subjects;

  if (!classId || !students.length || !subjects.length){
    container.innerHTML = "<p class='small'>Add class, students and subjects to start entering marks.</p>";
    return;
  }

  const table = document.createElement("table");
  table.className = "table";

  const thead = document.createElement("thead");
  const hr    = document.createElement("tr");
  hr.innerHTML = `
    <th>Adm</th>
    <th>Student</th>
    ${subjects.map(s => `<th>${s.code || s.id}<br><span class="small">${s.name}</span></th>`).join("")}
    <th>Total</th>
    <th>Mean</th>
  `;
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  for (const stu of students){
    const row = document.createElement("tr");
    row.innerHTML = `<td>${stu.admission_no}</td><td>${stu.first_name} ${stu.last_name}</td>`;

    let sum = 0;

    for (const sub of subjects){
      const cell  = document.createElement("td");
      const docId = `${EXAM_ID}_${classId}_${stu.id}`;
      const markDoc = await getDocById(col.marks, docId);

      const subj = markDoc && markDoc.subject_marks && markDoc.subject_marks[sub.id]
        ? markDoc.subject_marks[sub.id]
        : { ca:"", exam:"", total:0 };

      const caInput = document.createElement("input");
      caInput.className  = "input-inline";
      caInput.placeholder= "CA";
      caInput.value      = subj.ca === null ? "" : subj.ca;

      const exInput = document.createElement("input");
      exInput.className  = "input-inline";
      exInput.placeholder= "EX";
      exInput.value      = subj.exam === null ? "" : subj.exam;

      caInput.onchange = () =>
        saveMark(classId, stu.id, sub.id, caInput.value, exInput.value);
      exInput.onchange = () =>
        saveMark(classId, stu.id, sub.id, caInput.value, exInput.value);

      cell.appendChild(caInput);
      cell.appendChild(document.createElement("br"));
      cell.appendChild(exInput);

      row.appendChild(cell);
      sum += subj.total || 0;
    }

    const totalCell = document.createElement("td");
    const meanCell  = document.createElement("td");

    const subjectsCount = subjects.length || 1;
    const mean = sum / subjectsCount;

    totalCell.textContent = sum.toFixed(0);
    meanCell.textContent  = mean.toFixed(2);

    row.appendChild(totalCell);
    row.appendChild(meanCell);
    tbody.appendChild(row);
  }

  table.appendChild(tbody);
  container.appendChild(table);
}

// ============ SAVE MARK ============ //
async function saveMark(classId, studentId, subjectId, caVal, exVal){
  let ca = caVal === "" ? null : Number(caVal);
  let ex = exVal === "" ? null : Number(exVal);

  if (ca !== null && (isNaN(ca) || ca < 0 || ca > 100)){
    toast("CA must be 0–100");
    return;
  }
  if (ex !== null && (isNaN(ex) || ex < 0 || ex > 100)){
    toast("EX must be 0–100");
    return;
  }

  const total = (ca || 0) + (ex || 0);
  if (total > 100){
    toast("CA + EX must not exceed 100");
    return;
  }

  const id        = `${EXAM_ID}_${classId}_${studentId}`;
  const existing  = await getDocById(col.marks, id);
  const subjMarks = existing && existing.subject_marks ? existing.subject_marks : {};

  subjMarks[subjectId] = { ca, exam: ex, total };

  await setDocById(col.marks, id, {
    id,
    exam_id:   EXAM_ID,
    class_id:  classId,
    student_id: studentId,
    subject_marks: subjMarks,
    updated_at: new Date().toISOString()
  });

  toast("Mark saved");
  await renderMatrix();
}

// ============ ADD / SAMPLE / REPORTS ============ //
async function addClass(){
  const name = prompt("Andika jina la darasa (mf. Form 1A):");
  if (!name) return;
  const id = name.toLowerCase().replace(/\s+/g,"_");
  await setDocById(col.classes, id, { id, name });
  toast("Class added");
  await refreshStore();
  renderClassSelect();
  renderStudentsList();
  await renderMatrix();
}

async function addStudent(){
  const cls   = byId("classSelect").value;
  const adm   = byId("stuAdmission").value.trim();
  const first = byId("stuFirst").value.trim();
  const last  = byId("stuLast").value.trim();
  const phone = byId("stuPhone").value.trim();

  if (!cls){ toast("Chagua darasa kwanza"); return; }
  if (!adm || !first || !last){ toast("Jaza admission, first na last name"); return; }

  const id = adm; // tumia admission kama unique ID
  await setDocById(col.students, id, {
    id,
    admission_no: adm,
    first_name:   first,
    last_name:    last,
    class_id:     cls,
    guardian_phone: phone
  });

  byId("stuAdmission").value = "";
  byId("stuFirst").value     = "";
  byId("stuLast").value      = "";
  byId("stuPhone").value     = "";

  toast("Student added");
  await refreshStore();
  renderStudentsList();
  await renderMatrix();
}

async function addSubject(){
  const code = byId("subCode").value.trim().toUpperCase();
  const name = byId("subName").value.trim();
  if (!code || !name){
    toast("Jaza subject code na name");
    return;
  }

  await setDocById(col.subjects, code, { id:code, code, name });

  byId("subCode").value = "";
  byId("subName").value = "";

  toast("Subject added");
  await refreshStore();
  renderSubjectsList();
  await renderMatrix();
}

function gradeFromMean(m){
  if (m >= 80) return "A";
  if (m >= 65) return "B";
  if (m >= 50) return "C";
  if (m >= 35) return "D";
  return "E";
}

async function generateReports(){
  await refreshStore();
  const subjects = store.subjects;
  const classes  = store.classes;
  const students = store.students;

  for (const cls of classes){
    const studs = students.filter(s => s.class_id === cls.id);
    for (const s of studs){
      const markId  = `${EXAM_ID}_${cls.id}_${s.id}`;
      const markDoc = await getDocById(col.marks, markId);
      if (!markDoc || !markDoc.subject_marks) continue;

      let sum  = 0;
      let weak = [];
      for (const sub of subjects){
        const t = markDoc.subject_marks[sub.id]?.total || 0;
        sum += t;
        if (t < 50) weak.push(sub.code || sub.id);
      }

      const mean  = subjects.length ? sum / subjects.length : 0;
      const grade = gradeFromMean(mean);

      const repId = `${s.id}_${EXAM_ID}`;
      await setDocById(col.report_cards, repId, {
        id: repId,
        exam_id: EXAM_ID,
        class_id: cls.id,
        student_id: s.id,
        admission_no: s.admission_no,
        total_marks: sum,
        mean_score: Number(mean.toFixed(2)),
        grade,
        weak_subjects: weak,
        generated_at: new Date().toISOString()
      });
    }
  }
  toast("Reports generated for all classes");
}

async function loadSample(){
  if (!confirm("Load sample data into Firestore?")) return;
  const cid = "form1a";
  await setDocById(col.classes, cid, { id:cid, name:"Form 1A" });

  await setDocById(col.subjects, "ENG",  { id:"ENG",  code:"ENG",  name:"English" });
  await setDocById(col.subjects, "MATH", { id:"MATH", code:"MATH", name:"Mathematics" });
  await setDocById(col.subjects, "BS",   { id:"BS",   code:"BS",   name:"Business Studies" });

  await setDocById(col.students, "ADM001", {
    id:"ADM001", admission_no:"ADM001", first_name:"Kelvin",
    last_name:"Deogratias", class_id:cid, guardian_phone:"0671866932"
  });
  await setDocById(col.students, "ADM002", {
    id:"ADM002", admission_no:"ADM002", first_name:"Amina",
    last_name:"Yusuf", class_id:cid, guardian_phone:"0710000002"
  });

  toast("Sample data loaded");
  await refreshStore();
  renderClassSelect();
  renderStudentsList();
  renderSubjectsList();
  await renderMatrix();
}

// ============ INIT ============ //
window.addEventListener("load", async () => {
  await refreshStore();
  renderClassSelect();
  renderSubjectsList();
  renderStudentsList();
  await renderMatrix();

  byId("classSelect").onchange         = async () => { renderStudentsList(); await renderMatrix(); };
  byId("addClassBtn").onclick          = addClass;
  byId("addStudentBtn").onclick        = addStudent;
  byId("addSubjectBtn").onclick        = addSubject;
  byId("generateReportsBtn").onclick   = generateReports;
  byId("loadSampleBtn").onclick        = loadSample;

  const logoutBtn = byId("logoutBtn");
  if (logoutBtn){
    logoutBtn.onclick = async () => {
      await firebaseSignOut();
      window.location.href = "index.html";
    };
  }
});
