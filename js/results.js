// ========== UKSS RESULTS ENGINE ==========

const classesCol = db.collection("classes");

const classSelect = document.getElementById("classSelect");
const examSelect  = document.getElementById("examSelect");
const loadBtn     = document.getElementById("loadResultsBtn");

const chipStudents = document.getElementById("chipStudents");
const chipSubjects = document.getElementById("chipSubjects");
const chipExam     = document.getElementById("chipExam");

const btnBestTen = document.getElementById("btnBestTen");
const btnSMS     = document.getElementById("btnSMS");
const btnPrint   = document.getElementById("btnPrint");

const resultsTableWrap = document.getElementById("resultsTableWrap");

// STATE
let subjects = [];
let students = [];
let exams = [];

let currentClassId = null;
let currentExamId = null;

// ========================== LOAD CLASSES ==========================
async function loadClasses(){
  const snap = await classesCol.orderBy("name").get();
  classSelect.innerHTML = "";
  snap.forEach(doc=>{
    const o = document.createElement("option");
    o.value = doc.id;
    o.textContent = doc.data().name;
    classSelect.appendChild(o);
  });

  currentClassId = classSelect.value;
  await loadExams();
  await loadSubjects();
}
classSelect.addEventListener("change", async ()=>{
  currentClassId = classSelect.value;
  await loadExams();
  await loadSubjects();
});

// ========================== LOAD EXAMS ==========================
async function loadExams(){
  examSelect.innerHTML = "";
  exams = [];
  const snap = await classesCol.doc(currentClassId)
    .collection("exams")
    .orderBy("createdAt","asc")
    .get();

  snap.forEach(doc=>{
    exams.push({id:doc.id, ...doc.data()});
  });

  exams.forEach(ex=>{
    const o = document.createElement("option");
    o.value = ex.id;
    o.textContent = ex.displayName || ex.name;
    examSelect.appendChild(o);
  });

  currentExamId = examSelect.value;
  chipExam.textContent = examSelect.options[examSelect.selectedIndex]?.textContent || "—";
}

examSelect.addEventListener("change", ()=>{
  currentExamId = examSelect.value;
  chipExam.textContent = examSelect.options[examSelect.selectedIndex]?.textContent || "—";
});

// ========================== LOAD SUBJECTS ==========================
async function loadSubjects(){
  subjects=[];
  const snap = await classesCol
    .doc(currentClassId)
    .collection("subjects")
    .orderBy("code")
    .get();

  snap.forEach(doc=>{
    subjects.push(doc.data());
  });

  chipSubjects.textContent = subjects.length;
}

// ========================== LOAD STUDENTS + MARKS ==========================
async function loadStudents(){
  students=[];
  const snap = await classesCol
    .doc(currentClassId)
    .collection("students")
    .orderBy("admissionNo")
    .get();

  snap.forEach(doc=>{
    const d = doc.data();
    students.push({
      id: doc.id,
      admissionNo: d.admissionNo,
      fullName: d.fullName,
      sex: d.sex,
      guardianPhone: d.guardianPhone,
      marks: d.marks || {}
    });
  });

  chipStudents.textContent = students.length;
}

// ========================== COMPUTE RESULTS ==========================
function computeResults(){
  let results = [];

  students.forEach(st=>{
    const examData = st.marks[currentExamId]?.subjects || {};
    let total = 0;
    let count = 0;
    let row = {
      id: st.id,
      name: st.fullName,
      admissionNo: st.admissionNo,
      sex: st.sex,
      phone: st.guardianPhone,
      subjects: {},
      total:0,
      average:0,
      division:""
    };

    subjects.forEach(sub=>{
      const score = examData[sub.code] ?? null;
      row.subjects[sub.code] = score;

      if(score !== null){
        total += score;
        count++;
      }
    });

    row.total = total;
    row.average = count>0 ? Number((total/count).toFixed(2)) : 0;
    row.division = getDivision(row.average);

    results.push(row);
  });

  // Ranking
  results.sort((a,b)=> b.average - a.average);

  let lastAvg=null;
  let lastPos=0;

  results.forEach((r,i)=>{
    if(r.average !== lastAvg){
      lastPos = i+1;
      lastAvg = r.average;
    }
    r.position = lastPos;
  });

  return results;
}

function getDivision(avg){
  if(avg >= 75) return "DIV I";
  if(avg >= 60) return "DIV II";
  if(avg >= 45) return "DIV III";
  if(avg >= 30) return "DIV IV";
  return "DIV 0";
}

// ========================== RENDER TABLE ==========================
function renderResultsTable(data){
  let html = `<table class="results-table"><thead><tr>
    <th>#</th>
    <th>Adm</th>
    <th>Name</th>
    <th>Sex</th>`;

  subjects.forEach(s=>{
    html += `<th>${s.code}</th>`;
  });

  html += `
    <th>Total</th>
    <th>Average</th>
    <th>Division</th>
    <th>Position</th>
  </tr></thead><tbody>`;

  data.forEach((r,i)=>{
    html += `<tr>
      <td>${i+1}</td>
      <td>${r.admissionNo}</td>
      <td>${r.name}</td>
      <td>${r.sex}</td>`;

    subjects.forEach(sub=>{
      html += `<td>${r.subjects[sub.code] ?? ""}</td>`;
    });

    html += `
      <td>${r.total}</td>
      <td>${r.average}</td>
      <td>${r.division}</td>
      <td>${r.position}</td>
    </tr>`;
  });

  html += "</tbody></table>";

  resultsTableWrap.innerHTML = html;
}

// ========================== SMS BUILDER ==========================
function buildSMS(result){
  let parts = [];
  subjects.forEach(s=>{
    parts.push(`${s.code}:${result.subjects[s.code] ?? "-"}`);
  });

  return (
    `Matokeo ya ${result.name} (${result.admissionNo}): ` +
    parts.join(", ") +
    `. WST:${result.average}, DIV:${result.division}, POS:${result.position}.`
  );
}

btnSMS.addEventListener("click", ()=>{
  const results = computeResults();

  console.log("====== SMS FOR EACH STUDENT ======");
  results.forEach(r=>{
    console.log(r.phone + " => " + buildSMS(r));
  });

  alert("SMS preview opened in console");
});

// ========================== BEST TEN ==========================
btnBestTen.addEventListener("click", ()=>{
  const results = computeResults();
  const best = results.slice(0,10);
  const last = results.slice(-10);

  console.log("BEST 10:", best);
  console.log("LAST 10:", last);
  alert("Best 10 & Last 10 opened in console");
});

// ========================== PRINT ==========================
btnPrint.addEventListener("click", ()=>{
  window.print();
});

// ========================== LOAD RESULTS ==========================
loadBtn.addEventListener("click", async ()=>{
  await loadStudents();
  const results = computeResults();
  renderResultsTable(results);
});

// INIT
(async ()=>{
  await loadClasses();
})();
