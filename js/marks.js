// js/marks.js (REPLACE) — resilient auth checks, no redirect loops
"use strict";

/*
  Behavior changes:
  - Do NOT perform unconditional redirects here (head guard owns redirect).
  - Use auth.currentUser sync-check first to avoid adding extra listeners that cause loops.
  - If no user: show friendly "Please login" message and attach ONE onAuthStateChanged to continue setup when user logs in.
  - If user exists: fetch role and continue to load UI.
  - Avoid double initialization / duplicate calls.
*/

const classesCol = (typeof db !== 'undefined' && db) ? db.collection("classes") : null;

// DOM refs (guard for availability)
const q = (sel) => document.querySelector(sel);
const byId = (id) => document.getElementById(id);

// core DOM elements used
const classSelect  = byId("classSelect");
const examSelect   = byId("examSelect");
const addClassBtn  = byId("addClassBtn");
const addExamBtn   = byId("addExamBtn");

const statStudents = byId("statStudents");
const statSubjects = byId("statSubjects");
const statExamName = byId("statExamName");

const studentsMiniBody = document.querySelector("#studentsMiniTable tbody");
const subjectsMiniBody = document.querySelector("#subjectsMiniTable tbody");

const stepClassPill    = byId("stepClassPill");
const stepStudentsPill = byId("stepStudentsPill");
const stepExamPill     = byId("stepExamPill");
const stepMarksPill    = byId("stepMarksPill");

const tabButtons = document.querySelectorAll(".tab-btn");
const studentsTab = byId("studentsTab");
const marksTab    = byId("marksTab");
const pillExamLabel = byId("pillExamLabel");

const marksMatrixWrap = byId("marksMatrixWrap");

const generateReportsBtn = byId("generateReportsBtn");
const loadSampleBtn      = byId("loadSampleBtn");

// Student form
const stuAdmission = byId("stuAdmission");
const stuFirst     = byId("stuFirst");
const stuLast      = byId("stuLast");
const stuPhone     = byId("stuPhone");
const stuSex       = byId("stuSex");
const addStudentBtn= byId("addStudentBtn");

// Subject form
const subCode      = byId("subCode");
const subName      = byId("subName");
const addSubjectBtn= byId("addSubjectBtn");

// State
let currentClassId = null;
let currentExamId  = null;

let subjects = [];
let exams = [];
let students = [];

// Auth state
let currentUser = null;
let currentUserRole = null;
const allowedRolesToEdit = ["admin","academic","headmaster","class teacher"];

// helpers
function toast(msg){
  console.log("[TOAST]", msg);
  const dbg = byId('guardDebug');
  if(dbg){
    dbg.style.display = 'block';
    dbg.textContent = msg;
    clearTimeout(dbg._t);
    dbg._t = setTimeout(()=> dbg.style.display='none', 2500);
  }
}
function sanitizeId(str){
  return (str||"").toUpperCase().trim().replace(/\s+/g,"_").replace(/[^A-Z0-9_]/g,"");
}
function cap(s){ if(!s) return s; return s.charAt(0).toUpperCase()+s.slice(1); }
function isAllowedToEdit(){ return !!currentUserRole && allowedRolesToEdit.includes(currentUserRole.toLowerCase()); }
function disableInteractiveControls(){ document.querySelectorAll('input,select,button').forEach(i=>i.disabled = true); }
function enableInteractiveControls(){ document.querySelectorAll('input,select,button').forEach(i=>i.disabled = false); }

// tab handler
tabButtons.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    tabButtons.forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const t = btn.dataset.tab;
    if(t === "studentsTab"){ studentsTab.style.display="block"; marksTab.style.display="none"; }
    else { studentsTab.style.display="none"; marksTab.style.display="block"; }
  });
});

// ---------- AUTH + ROLE (resilient) ----------
async function fetchRoleForUserSync(user){
  if(!user) return null;
  try{
    const staffRef = db.collection('staff');
    let doc = await staffRef.doc(user.uid).get();
    if(doc && doc.exists) return (doc.data().role || '').toLowerCase();
    const q = await staffRef.where('email','==', user.email || '').limit(1).get();
    if(q && !q.empty) return (q.docs[0].data().role || '').toLowerCase();
    return null;
  }catch(err){
    console.error('fetchRole error', err);
    return null;
  }
}

// Called when we have a confirmed user (either from currentUser or onAuthStateChanged)
async function proceedAfterAuth(user){
  currentUser = user;
  currentUserRole = await fetchRoleForUserSync(user);
  // hide/show admin nav
  const navAdminLink = byId('navAdminLink');
  if(navAdminLink) navAdminLink.style.display = (currentUserRole === 'admin') ? '' : 'none';
  // allow page initialization
  await loadClasses();
}

// Main init flow (avoid redirect here)
async function init(){
  try{
    // ensure db and classesCol available
    if(!classesCol) throw new Error('Firestore classes collection missing');

    // Check sync snapshot first to avoid extra listeners causing redirect loops
    if(window.firebase && firebase.auth && firebase.auth().currentUser){
      console.log('[MARKS] sync auth.currentUser found -> continuing init');
      await proceedAfterAuth(firebase.auth().currentUser);
      return;
    }

    // No currentUser snapshot. Do NOT redirect here (head guard handles redirect).
    // Instead show friendly message and attach a single one-time onAuthStateChanged listener.
    showLoginRequiredMessage();

    if(window.firebase && firebase.auth){
      const unsub = firebase.auth().onAuthStateChanged(async (user) => {
        // run once and unsubscribe
        unsub();
        if(user){
          // proceed
          clearLoginRequiredMessage();
          await proceedAfterAuth(user);
        } else {
          // still no user: keep showing message; do not redirect from here
          console.warn('[MARKS] onAuthStateChanged: no user');
        }
      });
    } else {
      console.warn('[MARKS] firebase.auth not available to listen for login');
    }
  }catch(err){
    console.error('[MARKS] init error', err);
    showFatalError(err.message || 'Initialization failed');
  }
}

function showLoginRequiredMessage(){
  // Insert friendly card at top and disable controls
  const main = document.querySelector('.main') || document.body;
  if(main && !document.getElementById('loginRequiredCard')){
    const card = document.createElement('div');
    card.id = 'loginRequiredCard';
    card.className = 'card';
    card.innerHTML = `<h3>Authentication required</h3>
      <p class="small">Please sign in via the login page to access marks. If you were redirected here incorrectly, sign out and log in again.</p>`;
    main.insertBefore(card, main.firstChild);
  }
  disableInteractiveControls();
}
function clearLoginRequiredMessage(){
  const c = document.getElementById('loginRequiredCard');
  if(c) c.remove();
  enableInteractiveControls();
}
function showFatalError(msg){
  const main = document.querySelector('.main') || document.body;
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `<strong>Error</strong><div class="small">${msg}</div>`;
  main.insertBefore(card, main.firstChild);
  disableInteractiveControls();
}

// ---------- DATA LOAD & UI ----------
async function loadClasses(){
  classSelect.innerHTML = "";
  const snap = await classesCol.orderBy("name").get();
  if(snap.empty){
    classSelect.appendChild(Object.assign(document.createElement('option'), { value:'', textContent:'-- Add class first --' }));
    currentClassId = null;
    updateUIAfterData();
    return;
  }
  snap.forEach(doc=>{
    const opt = document.createElement('option');
    opt.value = doc.id;
    opt.textContent = doc.data().name || doc.id;
    classSelect.appendChild(opt);
  });
  currentClassId = classSelect.value || null;
  await loadClassData();
}

addClassBtn && addClassBtn.addEventListener("click", async ()=>{
  const name = prompt("Enter class name e.g. FORM ONE A");
  if(!name) return;
  const id = sanitizeId(name);
  try{
    await classesCol.doc(id).set({ name, createdAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
    toast("Class saved");
    await loadClasses();
    classSelect.value = id; currentClassId = id;
    await loadClassData();
  }catch(err){ console.error(err); toast("Failed to add class"); }
});

classSelect && classSelect.addEventListener("change", async ()=>{
  currentClassId = classSelect.value || null;
  await loadClassData();
});

async function loadClassData(){
  if(!currentClassId){
    subjects = []; students = []; exams = [];
    updateUIAfterData();
    return;
  }
  await Promise.all([ loadSubjects(), loadExams(), loadStudentsAndMarks() ]);
  updateUIAfterData();
}

async function loadSubjects(){
  subjects = [];
  const snap = await classesCol.doc(currentClassId).collection("subjects").orderBy("code").get();
  snap.forEach(doc => subjects.push({ id: doc.id, ...doc.data() }));
}
async function loadExams(){
  exams = [];
  const snap = await classesCol.doc(currentClassId).collection("exams").orderBy("createdAt","asc").get();
  snap.forEach(doc => exams.push({ id: doc.id, ...doc.data() }));
  if(!exams.length) currentExamId = null;
  else if(!currentExamId) currentExamId = exams[0].id;
}
async function loadStudentsAndMarks(){
  students = [];
  const snap = await classesCol.doc(currentClassId).collection("students").orderBy("admissionNo").get();
  snap.forEach(doc=>{
    const d = doc.data() || {};
    students.push({
      id: doc.id,
      admissionNo: d.admissionNo || doc.id,
      firstName: d.firstName || '',
      lastName: d.lastName || '',
      fullName: d.fullName || ((d.firstName||'')+' '+(d.lastName||'')).trim(),
      guardianPhone: d.guardianPhone || '',
      sex: d.sex || '',
      marks: d.marks || {}
    });
  });
}

// UI render methods
function updateUIAfterData(){
  renderOverview();
  renderExamOptions();
  renderMarksMatrix();
  updateStepper();
}

// overview
function renderOverview(){
  statStudents && (statStudents.textContent = students.length);
  statSubjects && (statSubjects.textContent = subjects.length);

  if(studentsMiniBody){
    studentsMiniBody.innerHTML = "";
    students.forEach((s, idx)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${idx+1}</td><td>${s.admissionNo}</td><td>${s.fullName}</td><td>${s.sex}</td><td>${s.guardianPhone}</td>`;
      studentsMiniBody.appendChild(tr);
    });
  }

  if(subjectsMiniBody){
    subjectsMiniBody.innerHTML = "";
    subjects.forEach(s=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.code}</td><td>${s.name}</td>`;
      subjectsMiniBody.appendChild(tr);
    });
  }
}

function renderExamOptions(){
  if(!examSelect){ return; }
  examSelect.innerHTML = "";
  if(!currentClassId){ examSelect.appendChild(Object.assign(document.createElement('option'), { value:'', textContent:'Select class first' })); statExamName.textContent = '—'; pillExamLabel.textContent = '—'; return; }
  if(!exams.length){ examSelect.appendChild(Object.assign(document.createElement('option'), { value:'', textContent:'No exam yet' })); statExamName.textContent = '—'; pillExamLabel.textContent = '—'; return; }
  exams.forEach(ex=>{
    const opt = document.createElement('option'); opt.value = ex.id; opt.textContent = ex.displayName || ex.name || ex.id;
    examSelect.appendChild(opt);
  });
  if(currentExamId) examSelect.value = currentExamId; else currentExamId = examSelect.value;
  const ex = exams.find(e=>e.id===currentExamId);
  const label = ex ? (ex.displayName || ex.name || ex.id) : '—';
  statExamName && (statExamName.textContent = label);
  pillExamLabel && (pillExamLabel.textContent = label);
}

if(examSelect) examSelect.addEventListener("change", ()=>{
  currentExamId = examSelect.value || null;
  const ex = exams.find(e=>e.id===currentExamId);
  const label = ex ? (ex.displayName || ex.name || ex.id) : '—';
  statExamName && (statExamName.textContent = label);
  pillExamLabel && (pillExamLabel.textContent = label);
  renderMarksMatrix(); updateStepper();
});

// add exam/subject/student handlers (unchanged logic, but defensive)
if(addExamBtn) addExamBtn.addEventListener("click", async ()=>{
  if(!currentClassId) return alert("Select class first.");
  const name = prompt("Exam name (e.g. TEST 1, MIDTERM 2025, ANNUAL 2025)");
  if(!name) return;
  const type = prompt("Type (e.g. TEST, MIDTERM, ANNUAL) - optional") || "";
  const examId = sanitizeId(name);
  try{
    await classesCol.doc(currentClassId).collection("exams").doc(examId).set({ name, type, displayName: name, createdAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
    toast("Exam added."); await loadExams(); renderExamOptions(); renderMarksMatrix(); updateStepper();
  }catch(err){ console.error(err); toast("Failed to add exam."); }
});

if(addSubjectBtn) addSubjectBtn.addEventListener("click", async ()=>{
  if(!currentClassId) return alert("Select class first.");
  const code = (subCode.value||"").toUpperCase().trim(); const name = (subName.value||"").trim();
  if(!code || !name) return alert("Fill subject code and name.");
  try{ await classesCol.doc(currentClassId).collection("subjects").doc(code).set({ code, name, createdAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
    subCode.value=""; subName.value=""; toast("Subject added."); await loadSubjects(); renderOverview(); renderMarksMatrix(); updateStepper();
  }catch(err){ console.error(err); toast("Failed to add subject."); }
});

if(addStudentBtn) addStudentBtn.addEventListener("click", async ()=>{
  if(!currentClassId) return alert("Select class first.");
  const admissionNoRaw = (stuAdmission.value||"").trim(); const admissionNo = admissionNoRaw.toUpperCase(); const docId = sanitizeId(admissionNoRaw);
  const firstName = (stuFirst.value||"").trim(); const lastName = (stuLast.value||"").trim(); const guardianPhone = (stuPhone.value||"").trim(); const sex = (stuSex.value||"").trim();
  if(!admissionNo || !firstName || !lastName) return alert("Admission, First name & Last name are required.");
  const fullName = `${firstName} ${lastName}`.trim();
  try{
    await classesCol.doc(currentClassId).collection("students").doc(docId).set({ admissionNo, firstName, lastName, fullName, guardianPhone, sex, marks:{}, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
    stuAdmission.value=""; stuFirst.value=""; stuLast.value=""; stuPhone.value=""; stuSex.value="";
    toast("Student saved."); await loadStudentsAndMarks(); renderOverview(); renderMarksMatrix(); updateStepper();
  }catch(err){ console.error(err); toast("Failed to add student."); }
});

// MARKS MATRIX
function renderMarksMatrix(){
  if(!marksMatrixWrap) return;
  marksMatrixWrap.innerHTML = "";
  if(!currentClassId) { marksMatrixWrap.textContent = "Please select a class."; return; }
  if(!currentExamId) { marksMatrixWrap.textContent = "Add and select exam to start entering marks."; return; }
  if(!subjects.length || !students.length){ marksMatrixWrap.textContent = "Make sure this class has subjects and registered students."; return; }

  const table = document.createElement('table'); table.className = 'matrix-table';
  const thead = document.createElement('thead'); const trh = document.createElement('tr');
  trh.innerHTML = '<th>#</th><th>Adm</th><th>Student</th><th>Sex</th>';
  subjects.forEach(s=>{ const th = document.createElement('th'); th.textContent = s.code; trh.appendChild(th); });
  thead.appendChild(trh);
  const tbody = document.createElement('tbody');

  students.forEach((stu, idx)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${idx+1}</td><td>${stu.admissionNo}</td><td>${stu.fullName}</td><td>${stu.sex}</td>`;
    const examMarks = (stu.marks && stu.marks[currentExamId] && stu.marks[currentExamId].subjects) || {};
    subjects.forEach(sub=>{
      const td = document.createElement('td');
      const input = document.createElement('input');
      input.type = 'number'; input.min = '0'; input.max='100';
      const v = (typeof examMarks[sub.code] !== 'undefined') ? examMarks[sub.code] : '';
      input.value = (v === null || v === undefined) ? '' : v;
      input.className = 'matrix-input';
      input.dataset.stuId = stu.id; input.dataset.subCode = sub.code;
      if(!isAllowedToEdit()) { input.disabled = true; input.title = "You don't have permission to edit marks"; }
      td.appendChild(input); tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(thead); table.appendChild(tbody); marksMatrixWrap.appendChild(table);
  table.addEventListener('change', matrixChangeDebounced);
}

// debounce throttle
const saveTimers = new Map();
function matrixChangeDebounced(e){
  const input = e.target;
  if(!input || !input.classList.contains('matrix-input')) return;
  const key = `${input.dataset.stuId}::${input.dataset.subCode}`;
  if(saveTimers.has(key)) clearTimeout(saveTimers.get(key));
  saveTimers.set(key, setTimeout(()=> { saveMark(input); saveTimers.delete(key); }, 120));
}

async function saveMark(input){
  if(!isAllowedToEdit()){
    alert("You are not allowed to edit marks.");
    // revert
    const s = students.find(x=>x.id === input.dataset.stuId);
    const prev = (s && s.marks && s.marks[currentExamId] && s.marks[currentExamId].subjects && s.marks[currentExamId].subjects[input.dataset.subCode]) || "";
    input.value = (prev === null || prev === undefined) ? "" : prev;
    return;
  }
  const stuId = input.dataset.stuId; const subCode = input.dataset.subCode;
  const raw = input.value === "" ? null : Number(input.value);
  if(raw !== null && (isNaN(raw) || raw < 0 || raw > 100)){ alert("Mark must be number 0-100"); input.focus(); return; }
  input.setAttribute('data-saving','1');
  try{
    await classesCol.doc(currentClassId).collection('students').doc(stuId).set({ marks: { [currentExamId]: { subjects: { [subCode]: raw } } }, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
    const stu = students.find(s=>s.id === stuId);
    if(stu){ if(!stu.marks) stu.marks = {}; if(!stu.marks[currentExamId]) stu.marks[currentExamId] = { subjects:{} }; stu.marks[currentExamId].subjects[subCode] = raw; }
    input.removeAttribute('data-saving'); input.classList.add('saved'); setTimeout(()=> input.classList.remove('saved'), 800);
  }catch(err){
    console.error('saveMark failed', err); input.removeAttribute('data-saving'); toast('Failed to save mark'); const s = students.find(x=>x.id===stuId); const prev = (s && s.marks && s.marks[currentExamId] && s.marks[currentExamId].subjects && s.marks[currentExamId].subjects[subCode]) || ""; input.value = (prev === null || prev === undefined) ? '' : prev;
  }
}

// generate reports / sample load (reuse previous logic)
if(generateReportsBtn) generateReportsBtn.addEventListener('click', ()=> {
  if(!currentClassId || !currentExamId) return alert("Select class and exam first.");
  window.location.href = `results.html?class=${encodeURIComponent(currentClassId)}&exam=${encodeURIComponent(currentExamId)}`;
});

if(loadSampleBtn) loadSampleBtn.addEventListener('click', async ()=>{
  const ok = confirm("Load sample class, exams, students and subjects? (for testing)");
  if(!ok) return;
  try{
    const clsId = "FORM_ONE_A";
    await classesCol.doc(clsId).set({ name:"FORM ONE A", createdAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
    const subs = [ {code:"HIST",name:"History"}, {code:"GEO",name:"Geography"}, {code:"KIS",name:"Kiswahili"},{code:"ENG",name:"English"},{code:"MATH",name:"Mathematics"},{code:"BUS",name:"Business Studies"} ];
    for(const s of subs) await classesCol.doc(clsId).collection('subjects').doc(s.code).set({ code:s.code, name:s.name, createdAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
    const examsRef = classesCol.doc(clsId).collection('exams');
    await examsRef.doc('TEST_1').set({ name:'TEST 1', displayName:'TEST 1', type:'TEST', createdAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
    const stuRef = classesCol.doc(clsId).collection('students');
    for(let i=1;i<=6;i++){ const adm = `F1A/${String(i).padStart(3,'0')}`; const id = sanitizeId(adm); await stuRef.doc(id).set({ admissionNo:adm, firstName:'STU'+i, lastName:'', fullName:'STU'+i, guardianPhone:'06'+Math.floor(10000000+Math.random()*89999999), sex:i%2===0?'M':'F', marks:{}, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true }); }
    toast('Sample loaded'); await loadClasses(); classSelect.value = clsId; currentClassId = clsId; await loadClassData();
  }catch(err){ console.error(err); toast('Sample load failed'); }
});

// run init
init();


