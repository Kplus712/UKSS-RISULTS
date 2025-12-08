// ===== UKSS — Marks & Students (modern flow, single mark per subject) =====

// Firestore
const classesCol = db.collection("classes");

// DOM refs
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
let students = []; // {id, admissionNo, fullName, sex, guardianPhone, marks:{}}

// --------- helpers ----------
function toast(msg){ console.log(msg); }

function sanitizeId(str){
  return (str || "")
    .toUpperCase()
    .trim()
    .replace(/\s+/g,"_")
    .replace(/[^A-Z0-9_]/g,"");   // inaondoa slash na characters zingine zisizotakiwa
}

function updateStepper(){
  // 1: kuna class
  stepClassPill.classList.toggle("active", !!currentClassId);

  // 2: kuna subjects
  stepStudentsPill.classList.toggle(
    "active",
    !!currentClassId && subjects.length > 0
  );

  // 3: usajili wanafunzi (Form I–IV)
  stepExamPill.classList.toggle(
    "active",
    !!currentClassId && subjects.length > 0 && students.length > 0
  );

  // 4: mitihani & alama
  stepMarksPill.classList.toggle(
    "active",
    !!currentClassId && subjects.length > 0 && students.length > 0 && !!currentExamId
  );
}

// --------- tabs ----------
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

// --------- load classes ----------
async function loadClasses(){
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

// --------- add class ----------
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

// --------- when class changes ----------
classSelect.addEventListener("change", async ()=>{
  currentClassId = classSelect.value || null;
  await loadClassData();
});

// --------- load exams, subjects, students ----------
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
  const snap = await classesCol
    .doc(currentClassId)
    .collection("subjects")
    .orderBy("code")
    .get();

  snap.forEach(doc=>{
    subjects.push({id:doc.id, ...doc.data()});
  });
}

async function loadExams(){
  exams=[];
  const snap = await classesCol
    .doc(currentClassId)
    .collection("exams")
    .orderBy("createdAt","asc")
    .get();

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
  const snap = await classesCol
    .doc(currentClassId)
    .collection("students")
    .orderBy("admissionNo")
    .get();

  const promises = [];

  snap.forEach(doc=>{
    const data = doc.data();
    const stu = {
      id: doc.id,   // sanitized ID (512_0001)
      admissionNo: data.admissionNo || doc.id, // anaonekana 512/0001
      firstName: data.firstName || "",
      lastName: data.lastName || "",
      fullName: data.fullName || ((data.firstName||"")+" "+(data.lastName||"")).trim(),
      guardianPhone: data.guardianPhone || "",
      sex: data.sex || "",
      marks: {}
    };
    students.push(stu);

    promises.push(
      classesCol
        .doc(currentClassId)
        .collection("students")
        .doc(doc.id)
        .get()
        .then(d=>{
          const dd = d.data() || {};
          stu.marks = dd.marks || {};
        })
    );
  });

  await Promise.all(promises);
}

// --------- render overview + stats ----------
function renderOverview(){
  statStudents.textContent = students.length;
  statSubjects.textContent = subjects.length;

  // students mini table
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

  // subjects mini table
  subjectsMiniBody.innerHTML = "";
  subjects.forEach(s=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.code}</td>
      <td>${s.name}</td>
    `;
    subjectsMiniBody.appendChild(tr);
  });
}

// --------- exam select ----------
function renderExamOptions(){
  examSelect.innerHTML = "";

  if(!currentClassId){
    const opt = document.createElement("option");
    opt.value="";
    opt.textContent="Select class first";
    examSelect.appendChild(opt);
    statExamName.textContent = "—";
    pillExamLabel.textContent= "—";
    return;
  }

  if(!exams.length){
    const opt = document.createElement("option");
    opt.value="";
    opt.textContent="No exam yet";
    examSelect.appendChild(opt);
    statExamName.textContent = "—";
    pillExamLabel.textContent= "—";
    return;
  }

  exams.forEach(ex=>{
    const opt = document.createElement("option");
    opt.value = ex.id;
    opt.textContent = ex.displayName || ex.name || ex.id;
    examSelect.appendChild(opt);
  });

  if(currentExamId){
    examSelect.value = currentExamId;
  }else{
    currentExamId = examSelect.value;
  }

  const ex = exams.find(e=>e.id===currentExamId);
  const label = ex ? (ex.displayName || ex.name || ex.id) : "—";
  statExamName.textContent = label;
  pillExamLabel.textContent = label;
}

examSelect.addEventListener("change", ()=>{
  currentExamId = examSelect.value || null;
  const ex = exams.find(e=>e.id===currentExamId);
  const label = ex ? (ex.displayName || ex.name || ex.id) : "—";
  statExamName.textContent = label;
  pillExamLabel.textContent = label;
  renderMarksMatrix();
  updateStepper();
});

// --------- add exam ----------
addExamBtn.addEventListener("click", async ()=>{
  if(!currentClassId) return alert("Select class first.");
  const name = prompt("Exam name (e.g. TEST 1, MIDTERM 2025, ANNUAL 2025)");
  if(!name) return;
  const type = prompt("Type (e.g. TEST, MIDTERM, ANNUAL) - optional") || "";
  const examId = sanitizeId(name);

  try{
    const exRef = classesCol
      .doc(currentClassId)
      .collection("exams")
      .doc(examId);

    await exRef.set(
      {
        name,
        type,
        displayName: name,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      },
      { merge:true }
    );

    toast("Exam added.");
    await loadExams();
    renderExamOptions();
    renderMarksMatrix();
    updateStepper();
  }catch(err){
    console.error(err);
    toast("Failed to add exam.");
  }
});

// --------- add subject ----------
addSubjectBtn.addEventListener("click", async ()=>{
  if(!currentClassId) return alert("Select class first.");

  const code = (subCode.value || "").toUpperCase().trim();
  const name = (subName.value || "").trim();
  if(!code || !name) return alert("Fill subject code and name.");

  try{
    const subRef = classesCol
      .doc(currentClassId)
      .collection("subjects")
      .doc(code);

    await subRef.set(
      {
        code,
        name,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      },
      { merge:true }
    );

    subCode.value="";
    subName.value="";
    toast("Subject added.");
    await loadSubjects();
    renderOverview();
    renderMarksMatrix();
    updateStepper();
  }catch(err){
    console.error(err);
    toast("Failed to add subject.");
  }
});

// --------- add student (Form I–IV, admission inaweza kuwa na /) ----------
addStudentBtn.addEventListener("click", async ()=>{
  if(!currentClassId) return alert("Select class first.");

  const admissionNoRaw = (stuAdmission.value || "").trim();   // mfano 512/0001
  const admissionNo    = admissionNoRaw.toUpperCase();        // kwa display
  const docId          = sanitizeId(admissionNoRaw);          // 512_0001

  const firstName   = (stuFirst.value || "").trim();
  const lastName    = (stuLast.value || "").trim();
  const guardianPhone = (stuPhone.value || "").trim();
  const sex         = (stuSex.value || "").trim();

  if(!admissionNo || !firstName || !lastName){
    return alert("Admission, First name & Last name are required.");
  }

  const fullName = `${firstName} ${lastName}`.trim();

  try{
    const stuRef = classesCol
      .doc(currentClassId)
      .collection("students")
      .doc(docId);   // sanitized ID, haina slash

    await stuRef.set(
      {
        admissionNo,        // tunaweka asili: 512/0001
        firstName,
        lastName,
        fullName,
        guardianPhone,
        sex,
        marks: {},
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      },
      { merge:true }
    );

    stuAdmission.value="";
    stuFirst.value="";
    stuLast.value="";
    stuPhone.value="";
    stuSex.value="";

    toast("Student saved.");
    await loadStudentsAndMarks();
    renderOverview();
    renderMarksMatrix();
    updateStepper();
  }catch(err){
    console.error(err);
    toast("Failed to add student.");
  }
});

// --------- marks matrix (single mark per subject) ----------
function renderMarksMatrix(){
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
  row1.innerHTML = `
    <th>#</th>
    <th>Adm</th>
    <th>Student</th>
    <th>Sex</th>
  `;
  subjects.forEach(s=>{
    const th = document.createElement("th");
    th.textContent = s.code;      // HIST, GEO, BUS, etc.
    row1.appendChild(th);
  });
  thead.appendChild(row1);

  const tbody = document.createElement("tbody");

  students.forEach((stu, idx)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td>${stu.admissionNo}</td>
      <td>${stu.fullName}</td>
      <td>${stu.sex}</td>
    `;

    const examMarks = stu.marks[currentExamId]?.subjects || {};

    subjects.forEach(sub=>{
      const markVal = examMarks[sub.code] ?? "";  // alama ya mwisho ya somo hilo

      const td = document.createElement("td");
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.max = "100";
      input.value = markVal;
      input.className = "matrix-input";
      input.dataset.stuId   = stu.id;
      input.dataset.subCode = sub.code;   // HIST, GEO ...
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

  const stuId   = input.dataset.stuId;
  const subCode = input.dataset.subCode;

  let value = input.value === "" ? null : Number(input.value);
  if(value != null && (value < 0 || value > 100)){
    alert("Mark must be between 0 and 100");
    input.focus();
    return;
  }

  try{
    const stuRef = classesCol
      .doc(currentClassId)
      .collection("students")
      .doc(stuId);

    // marks[currentExamId].subjects[subCode] = value
    await stuRef.set(
      {
        marks: {
          [currentExamId]: {
            subjects: {
              [subCode]: value
            }
          }
        }
      },
      { merge:true }
    );

    // update local state
    const stu = students.find(s=>s.id === stuId);
    if(!stu.marks[currentExamId]) stu.marks[currentExamId] = { subjects:{} };
    stu.marks[currentExamId].subjects[subCode] = value;

  }catch(err){
    console.error(err);
    toast("Failed to save mark.");
  }
}

// --------- reports button ----------
generateReportsBtn.addEventListener("click", ()=>{
  if(!currentClassId || !currentExamId){
    return alert("Select class and exam first.");
  }
  const url = `results.html?class=${encodeURIComponent(currentClassId)}&exam=${encodeURIComponent(currentExamId)}`;
  window.location.href = url;
});

// --------- load sample data ----------
loadSampleBtn.addEventListener("click", async ()=>{
  const ok = confirm("Load sample class, exams, students and subjects? (for testing)");
  if(!ok) return;

  try{
    const clsId = "FORM_ONE_A";
    await classesCol.doc(clsId).set(
      { name:"FORM ONE A", createdAt: firebase.firestore.FieldValue.serverTimestamp() },
      { merge:true }
    );

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
    for(const s of sampleSubs){
      await subsRef.doc(s.code).set(
        {code:s.code,name:s.name,createdAt:firebase.firestore.FieldValue.serverTimestamp()},
        {merge:true}
      );
    }

    const examsRef = classesCol.doc(clsId).collection("exams");
    const sampleExams = [
      {id:"TEST_1",        name:"TEST 1",        type:"TEST"},
      {id:"MIDTERM_2025",  name:"MIDTERM 2025",  type:"MIDTERM"},
      {id:"ANNUAL_2025",   name:"ANNUAL 2025",   type:"ANNUAL"}
    ];
    for(const ex of sampleExams){
      await examsRef.doc(ex.id).set(
        {name:ex.name,type:ex.type,displayName:ex.name,createdAt:firebase.firestore.FieldValue.serverTimestamp()},
        {merge:true}
      );
    }

    const stuRef = classesCol.doc(clsId).collection("students");
    for(let i=1;i<=10;i++){
      const adm   = "F1A/"+String(i).padStart(3,"0"); // F1A/001
      const docId = sanitizeId(adm);                  // F1A_001

      await stuRef.doc(docId).set(
        {
          admissionNo:adm,       // ya kuonyesha, ina slash
          firstName:"STUDENT"+i,
          lastName:"",
          fullName:"STUDENT"+i,
          guardianPhone:"06"+Math.floor(10000000 + Math.random()*89999999),
          sex: i%2===0 ? "M" : "F",
          marks:{},
          updatedAt:firebase.firestore.FieldValue.serverTimestamp()
        },
        {merge:true}
      );
    }

    toast("Sample data loaded.");
    await loadClasses();
    classSelect.value = clsId;
    currentClassId = clsId;
    await loadClassData();

  }catch(err){
    console.error(err);
    toast("Failed to load sample data.");
  }
});

// --------- init ----------
(async function init(){
  try{
    await loadClasses();
  }catch(err){
    console.error(err);
    toast("Failed to initialise marks page.");
  }
})();
