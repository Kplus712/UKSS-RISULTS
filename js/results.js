// js/results.js
// Class results listing + per-student report link

const classSelect     = document.getElementById("classSelect");
const examSelect      = document.getElementById("examSelect");
const filterSelect    = document.getElementById("filterSelect");
const searchInput     = document.getElementById("searchInput");
const loadResultsBtn  = document.getElementById("loadResultsBtn");
const resultsStatusEl = document.getElementById("resultsStatus");
const resultsTableBody= document.querySelector("#resultsTable tbody");

const sumCountEl = document.getElementById("sumCount");
const sumAvgEl   = document.getElementById("sumAvg");
const sumBestEl  = document.getElementById("sumBest");
const sumWorstEl = document.getElementById("sumWorst");

const classesCol = db.collection("classes");

let currentClassId = null;
let currentExamId  = null;

let subjects   = [];
let students   = [];
let resultRows = [];

// ===== helpers =====
function setResultsStatus(type, msg){
  if (!resultsStatusEl) return;
  resultsStatusEl.classList.remove("hidden","status-info","status-success","status-error");
  if (!msg){
    resultsStatusEl.classList.add("hidden");
    return;
  }
  if (type === "success") resultsStatusEl.classList.add("status-success");
  else if (type === "error") resultsStatusEl.classList.add("status-error");
  else resultsStatusEl.classList.add("status-info");
  resultsStatusEl.textContent = msg;
}

function divisionFromAverage(avg){
  if (avg >= 75) return "DIV I";
  if (avg >= 60) return "DIV II";
  if (avg >= 45) return "DIV III";
  if (avg >= 30) return "DIV IV";
  return "DIV 0";
}

function remarkFromDivision(div){
  if (div === "DIV I") return "Bora sana";
  if (div === "DIV II") return "Vizuri sana";
  if (div === "DIV III") return "Wastani";
  if (div === "DIV IV") return "Hafifu";
  return "Dhaifu";
}

// public function for report.html usage (called from HTML onclick)
function openReport(classId, studentId, examId){
  const url = `report.html?classId=${encodeURIComponent(classId)}&studentId=${encodeURIComponent(studentId)}&examId=${encodeURIComponent(examId)}`;
  window.open(url, "_blank");
}
window.openReport = openReport; // expose globally

// ===== load classes & exams =====
async function loadClasses(){
  const snap = await classesCol.orderBy("name").get();
  classSelect.innerHTML = "";
  snap.forEach(doc=>{
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = doc.data().name;
    classSelect.appendChild(opt);
  });

  if (classSelect.value){
    currentClassId = classSelect.value;
    await loadExams();
  }
}

async function loadExams(){
  examSelect.innerHTML = "";
  const snap = await classesCol
    .doc(currentClassId)
    .collection("exams")
    .orderBy("createdAt","asc")
    .get();

  snap.forEach(doc=>{
    const data = doc.data();
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = data.displayName || data.name || doc.id;
    examSelect.appendChild(opt);
  });

  currentExamId = examSelect.value || null;
}

classSelect.addEventListener("change", async ()=>{
  currentClassId = classSelect.value;
  await loadExams();
});

// ===== load subjects & students =====
async function loadSubjects(){
  const snap = await classesCol
    .doc(currentClassId)
    .collection("subjects")
    .orderBy("code")
    .get();

  subjects = snap.docs.map(d => d.data());
}

async function loadStudents(){
  const snap = await classesCol
    .doc(currentClassId)
    .collection("students")
    .orderBy("admissionNo")
    .get();

  students = snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

// ===== compute results for each student =====
function computeResults(){
  const examId = currentExamId;

  const rows = students.map(st => {
    const examSubjects = st.marks?.[examId]?.subjects || {};

    let total = 0;
    let count = 0;

    subjects.forEach(subj => {
      const v = examSubjects[subj.code];
      if (v !== null && v !== undefined){
        const n = Number(v);
        if (!isNaN(n)){
          total += n;
          count++;
        }
      }
    });

    const avg = count>0 ? Number((total/count).toFixed(1)) : 0;
    const division = divisionFromAverage(avg);

    return {
      id: st.id,
      admissionNo: st.admissionNo,
      name: st.fullName,
      sex: st.sex || "",
      total,
      avg,
      division,
      remark: remarkFromDivision(division),
      raw: st
    };
  });

  // sort kwa wastani mkubwa kwanza
  rows.sort((a,b)=> b.avg - a.avg);

  // compute positions (tie = same position)
  let lastAvg = null;
  let lastPos = 0;
  rows.forEach((r, idx)=>{
    if (r.avg !== lastAvg){
      lastPos = idx + 1;
      lastAvg = r.avg;
    }
    r.position = lastPos;
  });

  resultRows = rows;
}

// ===== apply filter + search then render =====
function applyFilterAndRender(){
  const filter = filterSelect.value;
  const searchTerm = (searchInput.value || "").toLowerCase().trim();

  let rows = [...resultRows];

  if (filter === "top10"){
    rows = rows.slice(0,10);
  }else if (filter === "weak"){
    rows = rows.filter(r => r.division === "DIV III" || r.division === "DIV IV" || r.division === "DIV 0");
  }

  if (searchTerm){
    rows = rows.filter(r =>
      (r.admissionNo || "").toLowerCase().includes(searchTerm) ||
      (r.name || "").toLowerCase().includes(searchTerm)
    );
  }

  // summary
  if (rows.length){
    const sumCount = rows.length;
    const sumTotalAvg = rows.reduce((acc,r)=> acc + r.avg, 0);
    const classAvg = +(sumTotalAvg / sumCount).toFixed(1);
    const best = rows[0].avg;
    const worst = rows[rows.length-1].avg;

    sumCountEl.textContent = sumCount.toString();
    sumAvgEl.textContent   = classAvg.toString();
    sumBestEl.textContent  = best.toString();
    sumWorstEl.textContent = worst.toString();
  }else{
    sumCountEl.textContent = "0";
    sumAvgEl.textContent   = "0";
    sumBestEl.textContent  = "0";
    sumWorstEl.textContent = "0";
  }

  // render table
  resultsTableBody.innerHTML = "";

  if (!rows.length){
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="10">No results found for this filter/search.</td>`;
    resultsTableBody.appendChild(tr);
    return;
  }

  rows.forEach((r, index)=>{
    const tr = document.createElement("tr");

    const isTop3 = r.position <= 3;

    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${r.admissionNo || ""}</td>
      <td>${r.name || ""}</td>
      <td>${r.sex || ""}</td>
      <td>${r.total}</td>
      <td>${r.avg}</td>
      <td>${r.division}</td>
      <td>
        ${r.position}
        ${isTop3 ? '<span class="chip chip-top">Top</span>' : ""}
      </td>
      <td>${r.remark}</td>
      <td>
        <button class="btn btn-ghost btn-sm"
          onclick="openReport('${currentClassId}','${r.id}','${currentExamId}')">
          Report
        </button>
      </td>
    `;

    resultsTableBody.appendChild(tr);
  });
}

// ===== main load button =====
loadResultsBtn.addEventListener("click", async ()=>{
  try{
    if (!classSelect.value){
      setResultsStatus("error","Select class first.");
      return;
    }
    if (!examSelect.value){
      setResultsStatus("error","Select exam first.");
      return;
    }

    currentClassId = classSelect.value;
    currentExamId  = examSelect.value;

    setResultsStatus("info","Loading subjects & students...");

    await loadSubjects();
    await loadStudents();

    computeResults();
    applyFilterAndRender();

    setResultsStatus("success","Results loaded.");
  }catch(err){
    console.error(err);
    setResultsStatus("error","Failed to load results: " + err.message);
  }
});

// filter & search live
filterSelect.addEventListener("change", applyFilterAndRender);
searchInput.addEventListener("input", ()=>{
  // kidogo delay unaweza kuongeza kama unataka
  applyFilterAndRender();
});

// ===== init =====
(async function init(){
  try{
    await loadClasses();
    setResultsStatus("info","Choose class and exam then click Load Results.");
  }catch(err){
    console.error(err);
    setResultsStatus("error","Failed to initialise results page: " + err.message);
  }
})();
