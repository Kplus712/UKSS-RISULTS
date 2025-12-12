// js/marks.js
// Robust Marks & Students controller — waits for Firebase auth, checks role, then loads data.
// Works with the early/post-load guards on marks.html and auth.js (index.html).

"use strict";

const M_PREFIX = "[MARKS]";
function mlog(){ console.log(M_PREFIX, ...arguments); }
function mwarn(){ console.warn(M_PREFIX, ...arguments); }
function merror(){ console.error(M_PREFIX, ...arguments); }

// DOM refs (may be null until DOMContentLoaded)
let classSelect, examSelect, addClassBtn, addExamBtn;
let statStudents, statSubjects, statExamName;
let studentsMiniBody, subjectsMiniBody;
let stepClassPill, stepStudentsPill, stepExamPill, stepMarksPill;
let tabButtons, studentsTab, marksTab, pillExamLabel, marksMatrixWrap;
let generateReportsBtn, loadSampleBtn;
let stuAdmission, stuFirst, stuLast, stuPhone, stuSex, addStudentBtn;
let subCode, subName, addSubjectBtn;
let navAdminLink, loadIndicator;

// State
let currentUser = null;
let currentRole = null;
let currentClassId = null;
let currentExamId = null;
let subjects = [];
let exams = [];
let students = [];

// Short helpers
function el(id){ return document.getElementById(id); }
function sanitizeId(str){
  return (str||"").toUpperCase().trim().replace(/\s+/g,"_").replace(/[^A-Z0-9_]/g,"");
}
function toast(msg){ mlog(msg); }

// --------- init DOM refs once DOM ready ----------
document.addEventListener("DOMContentLoaded", function(){
  classSelect  = el("classSelect");
  examSelect   = el("examSelect");
  addClassBtn  = el("addClassBtn");
  addExamBtn   = el("addExamBtn");

  statStudents = el("statStudents");
  statSubjects = el("statSubjects");
  statExamName = el("statExamName");

  studentsMiniBody = document.querySelector("#studentsMiniTable tbody");
  subjectsMiniBody = document.querySelector("#subjectsMiniTable tbody");

  stepClassPill    = el("stepClassPill");
  stepStudentsPill = el("stepStudentsPill");
  stepExamPill     = el("stepExamPill");
  stepMarksPill    = el("stepMarksPill");

  tabButtons = document.querySelectorAll(".tab-btn");
  studentsTab = el("studentsTab");
  marksTab    = el("marksTab");
  pillExamLabel = el("pillExamLabel");

  marksMatrixWrap = el("marksMatrixWrap");

  generateReportsBtn = el("generateReportsBtn");
  loadSampleBtn      = el("loadSampleBtn");

  stuAdmission = el("stuAdmission");
  stuFirst     = el("stuFirst");
  stuLast      = el("stuLast");
  stuPhone     = el("stuPhone");
  stuSex       = el("stuSex");
  addStudentBtn= el("addStudentBtn");

  subCode      = el("subCode");
  subName      = el("subName");
  addSubjectBtn= el("addSubjectBtn");

  navAdminLink  = el("navAdminLink");

  bindUiEvents();
  mlog("DOM ready — waiting for Firebase auth...");
});

// --------- UI bindings (clicks etc) ----------
function bindUiEvents(){
  if(tabButtons){
    tabButtons.forEach(btn=>{
      btn.addEventListener("click", ()=>{
        tabButtons.forEach(b=>b.classList.remove("active"));
        btn.classList.add("active");
        const target = btn.dataset.tab;
        if(target==="studentsTab"){
          studentsTab.style.display="block";
          marksTab.style.display="none";
        }else{
          studentsTab.style.display="none";
          marksTab.style.display="block";
        }
      });
    });
  }

  if(addClassBtn) addClassBtn.addEventListener("click", onAddClass);
  if(addExamBtn) addExamBtn.addEventListener("click", onAddExam);
  if(addSubjectBtn) addSubjectBtn.addEventListener("click", onAddSubject);
  if(addStudentBtn) addStudentBtn.addEventListener("click", onAddStudent);
  if(classSelect) classSelect.addEventListener("change", onClassChange);
  if(examSelect) examSelect.addEventListener("change", onExamChange);
  if(generateReportsBtn) generateReportsBtn.addEventListener("click", onGenerateReports);
  if(loadSampleBtn) loadSampleBtn.addEventListener("click", onLoadSample);
}

// --------- AUTH: wait for Firebase auth then start page ----------
function startWhenAuthed(){
  if(typeof auth === "undefined" || !auth){
    merror("Firebase auth not available (database.js might not be loaded).");
    return;
  }

  auth.onAuthStateChanged(async function(user){
    mlog("onAuthStateChanged -> user:", user ? user.email : null);
    if(!user){
      // No user: redirect to index (login). Guard should already handle but double-safety.
      mwarn("No authenticated user — redirecting to login.");
      try { sessionStorage.removeItem('justSignedIn'); } catch(e){}
      window.location.replace("index.html");
      return;
    }

    // There is a user — set current and fetch role
    currentUser = user;
    currentRole = await fetchRoleFromStaff(user);
    mlog("User role:", currentRole);

    // role based UI
    applyRoleToUi();

    // Now safe to load page data
    try{
      await loadClasses();
    }catch(err){
      merror("Failed to load classes", err);
    }
  });
}

// fetch role helper (same logic as auth.js helper)
async function fetchRoleFromStaff(user){
  try{
    if(!user) return null;
    if(typeof db === "undefined" || !db){ mwarn("fetchRoleFromStaff: db not present"); return null; }
    const doc = await db.collection('staff').doc(user.uid).get();
    if(doc && doc.exists) return (doc.data().role || '').toLowerCase();
    const q = await db.collection('staff').where('email','==',user.email||'').limit(1).get();
    if(q && !q.empty) return (q.docs[0].data().role || '').toLowerCase();
    return null;
  }catch(e){ merror('fetchRoleFromStaff error', e); return null; }
}

// show/hide admin link, and optionally show a small welcome
function applyRoleToUi(){
  if(navAdminLink){
    if(currentRole === "admin") navAdminLink.style.display = "";
    else navAdminLink.style.display = "none";
  }
  if(currentUser){
    mlog("Signed in as:", currentUser.email, "| role:", currentRole);
  }
}

// --------- CLASS / EXAM / STUDENT / SUBJECT loading ----------
const classesCol = () => db.collection("classes");

async function loadClasses(){
  if(!db) throw new Error("Firestore not available.");
  if(!classSelect) throw new Error("classSelect DOM not ready.");

  classSelect.innerHTML = "";
  const snap = await classesCol().orderBy("name").get();

  if(snap.empty){
    const opt = document.createElement("option");
    opt.value="";
    opt.textContent="-- Add class first --";
    classSelect.appendChild(opt);
    currentClassId = null;
    subjects=[]; students=[]; exams=[];
    renderOverview();
    renderExamOptions();
    renderMarksMatrix();
    updateStepper();
    return;
  }

  snap.forEach(doc=>{
    const data = doc.data();
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = data.name || doc.id;
    classSelect.appendChild(opt);
  });

  currentClassId = classSelect.value || null;
  await loadClassData();
}

// add class
async function onAddClass(){
  const name = prompt("Enter class name e.g. FORM ONE A");
  if(!name) return;
  const id = sanitizeId(name);
  try{
    await classesCol().doc(id).set({ name, createdAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
    toast("Class saved");
    await loadClasses();
    classSelect.value = id;
    currentClassId = id;
    await loadClassData();
  }catch(err){
    merror("Failed to add class", err);
    toast("Failed to add class.");
  }
}

async function onClassChange(){
  currentClassId = classSelect.value || null;
  await loadClassData();
}

async function loadClassData(){
  if(!currentClassId){
    subjects=[]; students=[]; exams=[];
    renderOverview();
    renderExamOptions();
    renderMarksMatrix();
    updateStepper();
    return;
  }
  await Promise.all([ loadSubjects(), loadExams(), loadStudentsAndMarks() ]);
  renderOverview();
  renderExamOptions();
  renderMarksMatrix();
  updateStepper();
}

async function loadSubjects(){
  subjects=[];
  const snap = await classesCol().doc(currentClassId).collection("subjects").orderBy("code").get();
  snap.forEach(doc=> subjects.push({id:doc.id, ...doc.data()}) );
}

async function loadExams(){
  exams=[];
  const snap = await classesCol().doc(currentClassId).collection("exams").orderBy("createdAt","asc").get();
  snap.forEach(doc=> exams.push({id:doc.id, ...doc.data()}) );
  if(!exams.length) currentExamId = null;
  else if(!currentExamId) currentExamId = exams[0].id;
}

async function loadStudentsAndMarks(){
  students=[];
  const snap = await classesCol().doc(currentClassId).collection("students").orderBy("admissionNo").get();
  const promises = [];
  snap.forEach(doc=>{
    const data = doc.data()||{};
    const stu = {
      id: doc.id,
      admissionNo: data.admissionNo || doc.id,
      firstName: data.firstName || "",
      lastName: data.lastName || "",
      fullName: data.fullName || ((data.firstName||"")+" "+(data.lastName||"")).trim(),
      guardianPhone: data.guardianPhone || "",
      sex: data.sex || "",
      marks: {}
    };
    students.push(stu);
    promises.push(classesCol().doc(currentClassId).collection("students").doc(doc.id).get().then(d=>{
      const dd = d.data() || {};
      stu.marks = dd.marks || {};
    }));
  });
  await Promise.all(promises);
}

// render overview
function renderOverview(){
  if(statStudents) statStudents.textContent = students.length;
  if(statSubjects) statSubjects.textContent = subjects.length;

  if(studentsMiniBody){
    studentsMiniBody.innerHTML = "";
    students.forEach((s, idx)=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${idx+1}</td><td>${s.admissionNo}</td><td>${s.fullName}</td><td>${s.sex}</td><td>${s.guardianPhone}</td>`;
      studentsMiniBody.appendChild(tr);
    });
  }

  if(subjectsMiniBody){
    subjectsMiniBody.innerHTML = "";
    subjects.forEach(s=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${s.code}</td><td>${s.name}</td>`;
      subjectsMiniBody.appendChild(tr);
    });
  }
}

// exam select
function renderExamOptions(){
  if(!examSelect) return;
  examSelect.innerHTML = "";

  if(!currentClassId){
    const opt = document.createElement("option"); opt.value=""; opt.textContent="Select class first"; examSelect.appendChild(opt);
    if(statExamName) statExamName.textContent = "—";
    if(pillExamLabel) pillExamLabel.textContent = "—";
    return;
  }

  if(!exams.length){
    const opt = document.createElement("option"); opt.value=""; opt.textContent="No exam yet"; examSelect.appendChild(opt);
    if(statExamName) statExamName.textContent = "—";
    if(pillExamLabel) pillExamLabel.textContent = "—";
    return;
  }

  exams.forEach(ex=>{
    const opt = document.createElement("option");
    opt.value = ex.id;
    opt.textContent = ex.displayName || ex.name || ex.id;
    examSelect.appendChild(opt);
  });

  if(currentExamId) examSelect.value = currentExamId;
  else currentExamId = examSelect.value;

  const ex = exams.find(e=>e.id===currentExamId);
  const label = ex ? (ex.displayName || ex.name || ex.id) : "—";
  if(statExamName) statExamName.textContent = label;
  if(pillExamLabel) pillExamLabel.textContent = label;
}

function onExamChange(){
  currentExamId = examSelect.value || null;
  const ex = exams.find(e=>e.id===currentExamId);
  const label = ex ? (ex.displayName || ex.name || ex.id) : "—";
  if(statExamName) statExamName.textContent = label;
  if(pillExamLabel) pillExamLabel.textContent = label;
  renderMarksMatrix();
  updateStepper();
}

// add exam
async function onAddExam(){
  if(!currentClassId) return alert("Select class first.");
  const name = prompt("Exam name (e.g. TEST 1, MIDTERM 2025, ANNUAL 2025)");
  if(!name) return;
  const type = prompt("Type (e.g. TEST, MIDTERM, ANNUAL) - optional") || "";
  const examId = sanitizeId(name);
  try{
    const exRef = classesCol().doc(currentClassId).collection("exams").doc(examId);
    await exRef.set({ name, type, displayName: name, createdAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
    toast("Exam added.");
    await loadExams();
    renderExamOptions();
    renderMarksMatrix();
    updateStepper();
  }catch(err){
    merror("Failed to add exam", err);
    toast("Failed to add exam.");
  }
}

// add subject
async function onAddSubject(){
  if(!currentClassId) return alert("Select class first.");
  const code = (subCode.value || "").toUpperCase().trim();
  const name = (subName.value || "").trim();
  if(!code || !name) return alert("Fill subject code and name.");
  try{
    const subRef = classesCol().doc(currentClassId).collection("subjects").doc(code);
    await subRef.set({ code, name, createdAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
    subCode.value=""; subName.value="";
    toast("Subject added.");
    await loadSubjects();
    renderOverview();
    renderMarksMatrix();
    updateStepper();
  }catch(err){
    merror("Failed to add subject", err);
    toast("Failed to add subject.");
  }
}

// add student
async function onAddStudent(){
  if(!currentClassId) return alert("Select class first.");
  const admissionNoRaw = (stuAdmission.value || "").trim();
  const admissionNo    = admissionNoRaw.toUpperCase();
  const docId          = sanitizeId(admissionNoRaw);
  const firstName   = (stuFirst.value || "").trim();
  const lastName    = (stuLast.value || "").trim();
  const guardianPhone = (stuPhone.value || "").trim();
  const sex         = (stuSex.value || "").trim();

  if(!admissionNo || !firstName || !lastName) return alert("Admission, First name & Last name are required.");

  const fullName = `${firstName} ${lastName}`.trim();

  try{
    const stuRef = classesCol().doc(currentClassId).collection("students").doc(docId);
    await stuRef.set({ admissionNo, firstName, lastName, fullName, guardianPhone, sex, marks:{}, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });

    stuAdmission.value=""; stuFirst.value=""; stuLast.value=""; stuPhone.value=""; stuSex.value="";
    toast("Student saved.");
    await loadStudentsAndMarks();
    renderOverview();
    renderMarksMatrix();
    updateStepper();
  }catch(err){
    merror("Failed to add student", err);
    toast("Failed to add student.");
  }
}

// --------- marks matrix ----------
function renderMarksMatrix(){
  if(!marksMatrixWrap) return;
  marksMatrixWrap.innerHTML = "";

  if(!currentClassId){
    marksMatrixWrap.textContent = "Please select a class.";
    return;
  }
  if(!currentExamId){
    marksMatrixWrap.textContent = "Add and select exam (Test, Midterm, Annual) to start entering marks.";
    return;
  }
  if(!subjects.length || !students.length){
    marksMatrixWrap.textContent = "Make sure this class has subjects and registered students.";
    return;
  }

  const table = document.createElement("table");
  table.className = "matrix-table";

  const thead = document.createElement("thead");
  const row1 = document.createElement("tr");
  row1.innerHTML = `<th>#</th><th>Adm</th><th>Student</th><th>Sex</th>`;
  subjects.forEach(s=>{
    const th = document.createElement("th"); th.textContent = s.code; row1.appendChild(th);
  });
  thead.appendChild(row1);

  const tbody = document.createElement("tbody");
  students.forEach((stu, idx)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${idx+1}</td><td>${stu.admissionNo}</td><td>${stu.fullName}</td><td>${stu.sex}</td>`;
    const examMarks = stu.marks[currentExamId]?.subjects || {};
    subjects.forEach(sub=>{
      const markVal = examMarks[sub.code] ?? "";
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.type = "number"; input.min = "0"; input.max = "100"; input.value = markVal;
      input.className = "matrix-input";
      input.dataset.stuId = stu.id;
      input.dataset.subCode = sub.code;
      td.appendChild(input);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  marksMatrixWrap.appendChild(table);
  table.addEventListener("change", onMatrixChange);
}

async function onMatrixChange(e){
  const input = e.target;
  if(!input.classList.contains("matrix-input")) return;
  const stuId = input.dataset.stuId;
  const subCode = input.dataset.subCode;
  let value = input.value === "" ? null : Number(input.value);
  if(value != null && (value < 0 || value > 100)){ alert("Mark must be between 0 and 100"); input.focus(); return; }
  try{
    const stuRef = classesCol().doc(currentClassId).collection("students").doc(stuId);
    await stuRef.set({ marks: { [currentExamId]: { subjects: { [subCode]: value } } } }, { merge:true });
    const stu = students.find(s=>s.id===stuId);
    if(!stu.marks[currentExamId]) stu.marks[currentExamId] = { subjects:{} };
    stu.marks[currentExamId].subjects[subCode] = value;
  }catch(err){
    merror("Failed to save mark", err);
    toast("Failed to save mark.");
  }
}

// generate reports
function onGenerateReports(){
  if(!currentClassId || !currentExamId) return alert("Select class and exam first.");
  const url = `results.html?class=${encodeURIComponent(currentClassId)}&exam=${encodeURIComponent(currentExamId)}`;
  window.location.href = url;
}

// load sample (for testing)
async function onLoadSample(){
  const ok = confirm("Load sample class, exams, students and subjects? (for testing)");
  if(!ok) return;
  try{
    const clsId = "FORM_ONE_A";
    await classesCol().doc(clsId).set({ name:"FORM ONE A", createdAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });

    const subsRef = classesCol().doc(clsId).collection("subjects");
    const sampleSubs = [
      {code:"HIST", name:"History"},
      {code:"GEO",  name:"Geography"},
      {code:"KIS",  name:"Kiswahili"},
      {code:"ENG",  name:"English"},
      {code:"BUS",  name:"Business Studies"},
      {code:"MATH", name:"Mathematics"}
    ];
    for(const s of sampleSubs){
      await subsRef.doc(s.code).set({code:s.code,name:s.name,createdAt:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true});
    }

    const examsRef = classesCol().doc(clsId).collection("exams");
    const sampleExams = [
      {id:"TEST_1", name:"TEST 1", type:"TEST"},
      {id:"MIDTERM_2025", name:"MIDTERM 2025", type:"MIDTERM"}
    ];
    for(const ex of sampleExams){
      await examsRef.doc(ex.id).set({name:ex.name,type:ex.type,displayName:ex.name,createdAt:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true});
    }

    const stuRef = classesCol().doc(clsId).collection("students");
    for(let i=1;i<=8;i++){
      const adm = "F1A/"+String(i).padStart(3,"0");
      const docId = sanitizeId(adm);
      await stuRef.doc(docId).set({
        admissionNo:adm, firstName:"STU"+i, lastName:"", fullName:"STU"+i,
        guardianPhone:"06"+Math.floor(10000000 + Math.random()*89999999),
        sex: i%2===0 ? "M" : "F", marks:{}, updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
    }

    toast("Sample data loaded.");
    await loadClasses();
    classSelect.value = clsId;
    currentClassId = clsId;
    await loadClassData();
  }catch(err){
    merror("Failed to load sample data", err);
    toast("Failed to load sample data.");
  }
}

// --------- stepper update ----------
function updateStepper(){
  if(!stepClassPill || !stepStudentsPill || !stepExamPill || !stepMarksPill) return;
  stepClassPill.classList.toggle("active", !!currentClassId);
  stepStudentsPill.classList.toggle("active", !!currentClassId && subjects.length > 0);
  stepExamPill.classList.toggle("active", !!currentClassId && subjects.length > 0 && students.length > 0);
  stepMarksPill.classList.toggle("active", !!currentClassId && subjects.length > 0 && students.length > 0 && !!currentExamId);
}

// --------- init: start auth watcher
(function init(){
  try{
    startWhenAuthed();
  }catch(err){
    merror("Initialization failed", err);
  }
})();


