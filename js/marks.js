// js/marks.js (IMPROVED) — Marks & Students page with auth role checks, save protection, better UX

"use strict";

/*
 - Requires globals `db` and `auth` from ./js/database.js
 - marks.html includes early guard (justSignedIn) so this script assumes user reached here legitimately.
 - This script still verifies auth.currentUser and staff role before allowing edit operations.
*/

// ---------- Firestore refs (guarded) ----------
if (typeof db === "undefined" || !db) {
  console.error("[MARKS] Firestore `db` not available. Ensure database.js is loaded.");
  // Optionally redirect to login
  // window.location.replace('login.html');
}
const classesCol = db ? db.collection("classes") : null;

// ---------- DOM refs ----------
const classSelect  = document.getElementById("classSelect");
const examSelect   = document.getElementById("examSelect");
const addClassBtn  = document.getElementById("addClassBtn");
const addExamBtn   = document.getElementById("addExamBtn");

const statStudents = document.getElementById("statStudents");
const statSubjects = document.getElementById("statSubjects");
const statExamName = document.getElementById("statExamName");

const studentsMiniBody = document.querySelector("#studentsMiniTable tbody");
const subjectsMiniBody = document.querySelector("#subjectsMiniTable tbody");

const stepClassPill    = document.getElementById("stepClassPill");
const stepStudentsPill = document.getElementById("stepStudentsPill");
const stepExamPill     = document.getElementById("stepExamPill");
const stepMarksPill    = document.getElementById("stepMarksPill");

const tabButtons = document.querySelectorAll(".tab-btn");
const studentsTab = document.getElementById("studentsTab");
const marksTab    = document.getElementById("marksTab");
const pillExamLabel = document.getElementById("pillExamLabel");

const marksMatrixWrap = document.getElementById("marksMatrixWrap");

const generateReportsBtn = document.getElementById("generateReportsBtn");
const loadSampleBtn      = document.getElementById("loadSampleBtn");

// Student form
const stuAdmission = document.getElementById("stuAdmission");
const stuFirst     = document.getElementById("stuFirst");
const stuLast      = document.getElementById("stuLast");
const stuPhone     = document.getElementById("stuPhone");
const stuSex       = document.getElementById("stuSex");
const addStudentBtn= document.getElementById("addStudentBtn");

// Subject form
const subCode      = document.getElementById("subCode");
const subName      = document.getElementById("subName");
const addSubjectBtn= document.getElementById("addSubjectBtn");

// State
let currentClassId = null;
let currentExamId  = null;

let subjects = []; // {id, code, name}
let exams    = []; // {id, name, type}
let students = []; // {id, admissionNo, firstName, lastName, fullName, sex, guardianPhone, marks:{}}

// Auth/role state
let currentUser = null;
let currentUserRole = null; // lowercase string
const allowedRolesToEdit = ["admin","academic","headmaster","class teacher"]; // who can edit marks

// --------- small helpers ----------
function toast(msg){
  // brief UI-friendly toast: use console if no UI toast system
  console.log("[TOAST]", msg);
  // Optional: show simple on-page ephemeral message
  const el = document.getElementById('guardDebug');
  if(el){
    el.style.display='block';
    el.textContent = msg;
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(()=>{ el.style.display='none'; }, 2500);
  }
}

function sanitizeId(str){
  return (str || "")
    .toUpperCase()
    .trim()
    .replace(/\s+/g,"_")
    .replace(/[^A-Z0-9_]/g,"");
}

function cap(s){ if(!s) return s; return s.charAt(0).toUpperCase() + s.slice(1); }

// update stepper pills
function updateStepper(){
  stepClassPill && stepClassPill.classList.toggle("active", !!currentClassId);
  stepStudentsPill && stepStudentsPill.classList.toggle("active", !!currentClassId && subjects.length > 0);
  stepExamPill && stepExamPill.classList.toggle("active", !!currentClassId && subjects.length > 0 && students.length > 0);
  stepMarksPill && stepMarksPill.classList.toggle("active", !!currentClassId && subjects.length > 0 && students.length > 0 && !!currentExamId);
}

// ---------- tabs ----------
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

// ---------- AUTH ROLE CHECK ----------
async function ensureAuthAndRole(){
  return new Promise((resolve, reject) => {
    if(typeof auth === "undefined" || !auth){
      console.error("[MARKS] auth not available.");
      reject(new Error("auth not available"));
      return;
    }

    // onAuthStateChanged ensures we respond to current state
    const unsub = auth.onAuthStateChanged(async user => {
      unsub();
      if(!user){
        console.warn("[MARKS] No authenticated user. Redirecting to login.");
        // redirect to login (head guard should normally catch this)
        try { window.location.replace('login.html'); } catch(e){}
        reject(new Error("no user"));
        return;
      }
      // got user
      currentUser = user;
      try{
        // fetch role from staff collection (uid -> email fallback)
        const staffRef = db.collection('staff');
        let staffDoc = await staffRef.doc(user.uid).get();
        if(!staffDoc.exists){
          // fallback search by email
          const q = await staffRef.where('email','==', user.email || '').limit(1).get();
          if(q && !q.empty) staffDoc = q.docs[0];
        }
        if(staffDoc && staffDoc.exists){
          currentUserRole = (staffDoc.data().role || '').toLowerCase();
        } else {
          currentUserRole = null;
        }

        // hide admin link if not admin
        const navAdminLink = document.getElementById('navAdminLink');
        if(navAdminLink){
          if(currentUserRole !== 'admin'){
            navAdminLink.style.display = 'none';
          } else {
            navAdminLink.style.display = '';
          }
        }

        resolve({ user, role: currentUserRole });
      }catch(err){
        console.error("[MARKS] failed to fetch staff role", err);
        currentUserRole = null;
        resolve({ user, role: null });
      }
    });
  });
}

// ---------- load classes ----------
async function loadClasses(){
  if(!classesCol) throw new Error('classes collection unavailable');
  classSelect.innerHTML = "";
  const snap = await classesCol.orderBy("name").get();

  if(snap.empty){
    const opt = document.createElement("option");
    opt.value="";
    opt.textContent="-- Add class first --";
    classSelect.appendChild(opt);
    currentClassId = null;
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
addClassBtn.addEventListener("click", async ()=>{
  const name = prompt("Enter class name e.g. FORM ONE A");
  if(!name) return;
  const id = sanitizeId(name);

  try{
    await classesCol.doc(id).set(
      { name, createdAt: firebase.firestore.FieldValue.serverTimestamp() },
      { merge:true }
    );
    toast("Class saved");
    await loadClasses();
    classSelect.value = id;
    currentClassId = id;
    await loadClassData();
  }catch(err){
    console.error(err);
    toast("Failed to add class");
  }
});

classSelect.addEventListener("change", async ()=>{
  currentClassId = classSelect.value || null;
  await loadClassData();
});

// load subjects/exams/students
async function loadClassData(){
  if(!currentClassId){
    subjects=[]; students=[]; exams=[];
    renderOverview();
    renderExamOptions();
    renderMarksMatrix();
    updateStepper();
    return;
  }

  await Promise.all([
    loadSubjects(),
    loadExams(),
    loadStudentsAndMarks()
  ]);

  renderOverview();
  renderExamOptions();
  renderMarksMatrix();
  updateStepper();
}

async function loadSubjects(){
  subjects=[];
  const snap = await classesCol.doc(currentClassId).collection("subjects").orderBy("code").get();
  snap.forEach(doc=>{
    subjects.push({id:doc.id, ...doc.data()});
  });
}

async function loadExams(){
  exams=[];
  const snap = await classesCol.doc(currentClassId).collection("exams").orderBy("createdAt","asc").get();
  snap.forEach(doc=>{
    exams.push({id:doc.id, ...doc.data()});
  });

  if(!exams.length){
    currentExamId = null;
  }else if(!currentExamId){
    currentExamId = exams[0].id;
  }
}

async function loadStudentsAndMarks(){
  students=[];
  const snap = await classesCol.doc(currentClassId).collection("students").orderBy("admissionNo").get();

  const promises = [];
  snap.forEach(doc=>{
    const data = doc.data() || {};
    const stu = {
      id: doc.id,
      admissionNo: data.admissionNo || doc.id,
      firstName: data.firstName || "",
      lastName: data.lastName || "",
      fullName: data.fullName || ((data.firstName||"")+" "+(data.lastName||"")).trim(),
      guardianPhone: data.guardianPhone || "",
      sex: data.sex || "",
      marks: data.marks || {}
    };
    students.push(stu);
    // no extra fetch needed because we already read marks above (doc.data())
  });
  await Promise.all(promises);
}

// render overview + mini lists
function renderOverview(){
  statStudents.textContent = students.length;
  statSubjects.textContent = subjects.length;

  studentsMiniBody.innerHTML = "";
  students.forEach((s, idx)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td>${s.admissionNo}</td>
      <td>${s.fullName}</td>
      <td>${s.sex}</td>
      <td>${s.guardianPhone}</td>
    `;
    studentsMiniBody.appendChild(tr);
  });

  subjectsMiniBody.innerHTML = "";
  subjects.forEach(s=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${s.code}</td><td>${s.name}</td>`;
    subjectsMiniBody.appendChild(tr);
  });
}

// exam select render
function renderExamOptions(){
  examSelect.innerHTML = "";

  if(!currentClassId){
    const opt = document.createElement("option"); opt.value=""; opt.textContent="Select class first"; examSelect.appendChild(opt);
    statExamName.textContent = "—"; pillExamLabel.textContent = "—"; return;
  }

  if(!exams.length){
    const opt = document.createElement("option"); opt.value=""; opt.textContent="No exam yet"; examSelect.appendChild(opt);
    statExamName.textContent = "—"; pillExamLabel.textContent = "—"; return;
  }

  exams.forEach(ex=>{
    const opt = document.createElement("option"); opt.value = ex.id; opt.textContent = ex.displayName || ex.name || ex.id;
    examSelect.appendChild(opt);
  });

  if(currentExamId) examSelect.value = currentExamId; else currentExamId = examSelect.value;
  const ex = exams.find(e=>e.id===currentExamId);
  const label = ex ? (ex.displayName || ex.name || ex.id) : "—";
  statExamName.textContent = label; pillExamLabel.textContent = label;
}

examSelect.addEventListener("change", ()=>{
  currentExamId = examSelect.value || null;
  const ex = exams.find(e=>e.id===currentExamId);
  const label = ex ? (ex.displayName || ex.name || ex.id) : "—";
  statExamName.textContent = label; pillExamLabel.textContent = label;
  renderMarksMatrix();
  updateStepper();
});

// add exam
addExamBtn.addEventListener("click", async ()=>{
  if(!currentClassId) return alert("Select class first.");
  const name = prompt("Exam name (e.g. TEST 1, MIDTERM 2025, ANNUAL 2025)");
  if(!name) return;
  const type = prompt("Type (e.g. TEST, MIDTERM, ANNUAL) - optional") || "";
  const examId = sanitizeId(name);

  try{
    await classesCol.doc(currentClassId).collection("exams").doc(examId).set(
      { name, type, displayName: name, createdAt: firebase.firestore.FieldValue.serverTimestamp() },
      { merge:true }
    );
    toast("Exam added.");
    await loadExams(); renderExamOptions(); renderMarksMatrix(); updateStepper();
  }catch(err){ console.error(err); toast("Failed to add exam."); }
});

// add subject
addSubjectBtn.addEventListener("click", async ()=>{
  if(!currentClassId) return alert("Select class first.");
  const code = (subCode.value || "").toUpperCase().trim();
  const name = (subName.value || "").trim();
  if(!code || !name) return alert("Fill subject code and name.");

  try{
    await classesCol.doc(currentClassId).collection("subjects").doc(code).set(
      { code, name, createdAt: firebase.firestore.FieldValue.serverTimestamp() },
      { merge:true }
    );
    subCode.value=""; subName.value="";
    toast("Subject added.");
    await loadSubjects(); renderOverview(); renderMarksMatrix(); updateStepper();
  }catch(err){ console.error(err); toast("Failed to add subject."); }
});

// add student
addStudentBtn.addEventListener("click", async ()=>{
  if(!currentClassId) return alert("Select class first.");

  const admissionNoRaw = (stuAdmission.value || "").trim();
  const admissionNo    = admissionNoRaw.toUpperCase();
  const docId          = sanitizeId(admissionNoRaw);
  const firstName   = (stuFirst.value || "").trim();
  const lastName    = (stuLast.value || "").trim();
  const guardianPhone = (stuPhone.value || "").trim();
  const sex         = (stuSex.value || "").trim();

  if(!admissionNo || !firstName || !lastName){
    return alert("Admission, First name & Last name are required.");
  }

  const fullName = `${firstName} ${lastName}`.trim();

  try{
    const stuRef = classesCol.doc(currentClassId).collection("students").doc(docId);
    await stuRef.set(
      { admissionNo, firstName, lastName, fullName, guardianPhone, sex, marks:{}, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
      { merge:true }
    );
    stuAdmission.value=""; stuFirst.value=""; stuLast.value=""; stuPhone.value=""; stuSex.value="";
    toast("Student saved.");
    await loadStudentsAndMarks(); renderOverview(); renderMarksMatrix(); updateStepper();
  }catch(err){ console.error(err); toast("Failed to add student."); }
});

// ---------- MARKS MATRIX RENDER & SAVE ----------
function renderMarksMatrix(){
  marksMatrixWrap.innerHTML = "";

  if(!currentClassId) { marksMatrixWrap.textContent = "Please select a class."; return; }
  if(!currentExamId)  { marksMatrixWrap.textContent = "Add and select exam to start entering marks."; return; }
  if(!subjects.length || !students.length){ marksMatrixWrap.textContent = "Make sure this class has subjects and registered students."; return; }

  const table = document.createElement("table"); table.className = "matrix-table";
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
    const examMarks = (stu.marks && stu.marks[currentExamId] && stu.marks[currentExamId].subjects) || {};

    subjects.forEach(sub=>{
      const markVal = (typeof examMarks[sub.code] !== 'undefined') ? examMarks[sub.code] : "";
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.type = "number"; input.min = "0"; input.max = "100";
      input.value = (markVal === null || markVal === undefined) ? "" : markVal;
      input.className = "matrix-input";
      input.dataset.stuId = stu.id;
      input.dataset.subCode = sub.code;
      // if user not allowed to edit, disable input
      if(!isCurrentUserAllowedToEdit()){
        input.disabled = true;
        input.title = "You don't have permission to edit marks";
      }
      td.appendChild(input);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(thead); table.appendChild(tbody);
  marksMatrixWrap.appendChild(table);

  // attach delegated listener
  table.addEventListener("change", onMatrixChangeDebounced);
}

// permission check
function isCurrentUserAllowedToEdit(){
  if(!currentUserRole) return false;
  return allowedRolesToEdit.includes(currentUserRole.toLowerCase());
}

// Per-input debounce map (small throttle so quick edits don't flood writes)
const saveTimers = new Map();
function onMatrixChangeDebounced(e){
  const input = e.target;
  if(!input || !input.classList.contains("matrix-input")) return;
  const key = `${input.dataset.stuId}::${input.dataset.subCode}`;
  // clear prior
  if(saveTimers.has(key)) clearTimeout(saveTimers.get(key));
  saveTimers.set(key, setTimeout(()=> { onMatrixChangeSave(input); saveTimers.delete(key); }, 120));
}

// Save handler
async function onMatrixChangeSave(input){
  if(!isCurrentUserAllowedToEdit()){
    alert("You are not allowed to edit marks.");
    // revert UI to stored value
    const stu = students.find(s=>s.id === input.dataset.stuId);
    const prev = (stu && stu.marks && stu.marks[currentExamId] && stu.marks[currentExamId].subjects && stu.marks[currentExamId].subjects[input.dataset.subCode]) || "";
    input.value = (prev === null || prev === undefined) ? "" : prev;
    return;
  }

  const stuId = input.dataset.stuId;
  const subCode = input.dataset.subCode;
  let value = input.value === "" ? null : Number(input.value);
  if(value !== null && (isNaN(value) || value < 0 || value > 100)){
    alert("Mark must be a number between 0 and 100");
    input.focus();
    return;
  }

  // visual saving indicator
  input.setAttribute('data-saving', '1');

  try{
    const stuRef = classesCol.doc(currentClassId).collection("students").doc(stuId);
    // merge nested marks object
    const payload = {
      marks: {
        [currentExamId]: {
          subjects: {
            [subCode]: value
          }
        }
      },
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await stuRef.set(payload, { merge:true });

    // update local state
    const stu = students.find(s=>s.id === stuId);
    if(stu){
      if(!stu.marks) stu.marks = {};
      if(!stu.marks[currentExamId]) stu.marks[currentExamId] = { subjects: {}};
      stu.marks[currentExamId].subjects[subCode] = value;
    }

    // remove saving attr, flash success
    input.removeAttribute('data-saving');
    input.classList.add('saved');
    setTimeout(()=> input.classList.remove('saved'), 900);
  }catch(err){
    console.error('[MARKS] save failed', err);
    input.removeAttribute('data-saving');
    toast("Failed to save mark. Check network/permissions.");
    // revert UI value from local state
    const stu = students.find(s=>s.id === stuId);
    const prev = (stu && stu.marks && stu.marks[currentExamId] && stu.marks[currentExamId].subjects && stu.marks[currentExamId].subjects[subCode]) || "";
    input.value = (prev === null || prev === undefined) ? "" : prev;
  }
}

// reports button
generateReportsBtn.addEventListener("click", ()=>{
  if(!currentClassId || !currentExamId) return alert("Select class and exam first.");
  const url = `results.html?class=${encodeURIComponent(currentClassId)}&exam=${encodeURIComponent(currentExamId)}`;
  window.location.href = url;
});

// load sample
loadSampleBtn.addEventListener("click", async ()=>{
  const ok = confirm("Load sample class, exams, students and subjects? (for testing)");
  if(!ok) return;
  try{
    const clsId = "FORM_ONE_A";
    await classesCol.doc(clsId).set({ name:"FORM ONE A", createdAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });

    const subsRef = classesCol.doc(clsId).collection("subjects");
    const sampleSubs = [
      {code:"HIST", name:"History"},
      {code:"GEO",  name:"Geography"},
      {code:"KIS",  name:"Kiswahili"},
      {code:"ENG",  name:"English"},
      {code:"PHY",  name:"Physics"},
      {code:"CHEM", name:"Chemistry"},
      {code:"BIO",  name:"Biology"},
      {code:"MATH", name:"Mathematics"},
      {code:"BUS",  name:"Business Studies"},
      {code:"CIV",  name:"Civics"}
    ];
    for(const s of sampleSubs) await subsRef.doc(s.code).set({ code:s.code,name:s.name,createdAt:firebase.firestore.FieldValue.serverTimestamp() }, {merge:true});

    const examsRef = classesCol.doc(clsId).collection("exams");
    const sampleExams = [
      {id:"TEST_1",        name:"TEST 1",        type:"TEST"},
      {id:"MIDTERM_2025",  name:"MIDTERM 2025",  type:"MIDTERM"},
      {id:"ANNUAL_2025",   name:"ANNUAL 2025",   type:"ANNUAL"}
    ];
    for(const ex of sampleExams) await examsRef.doc(ex.id).set({ name:ex.name,type:ex.type,displayName:ex.name,createdAt:firebase.firestore.FieldValue.serverTimestamp() }, {merge:true});

    const stuRef = classesCol.doc(clsId).collection("students");
    for(let i=1;i<=10;i++){
      const adm   = "F1A/"+String(i).padStart(3,"0");
      const docId = sanitizeId(adm);
      await stuRef.doc(docId).set({
        admissionNo:adm, firstName:"STUDENT"+i, lastName:"", fullName:"STUDENT"+i,
        guardianPhone:"06"+Math.floor(10000000 + Math.random()*89999999),
        sex: i%2===0 ? "M" : "F", marks:{}, updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
    }

    toast("Sample data loaded.");
    await loadClasses();
    classSelect.value = clsId; currentClassId = clsId; await loadClassData();
  }catch(err){
    console.error(err);
    toast("Failed to load sample data.");
  }
});

// ---------- INIT ----------
(async function init(){
  try{
    // Ensure user authenticated and fetch role
    await ensureAuthAndRole();
    // Now load classes and UI
    await loadClasses();
  }catch(err){
    console.error('[MARKS] init aborted', err);
    // show friendly message on page if available
    const wrap = document.querySelector('.main') || document.body;
    const el = document.createElement('div');
    el.className = 'card';
    el.style.margin = '12px';
    el.innerHTML = `<strong>Access error</strong><div class="small">You must sign in with a staff account to use this page.</div>`;
    wrap.insertBefore(el, wrap.firstChild);
    // hide interactive controls
    document.querySelectorAll('input,select,button').forEach(i=>i.disabled = true);
    return;
  }
})();

