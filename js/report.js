// js/report.js — UKSS Student Report (FULL, A4, AUTO DATA)
"use strict";

/* ---------------------------------------------------
   HELPERS
--------------------------------------------------- */
function qs(id){ return document.getElementById(id); }
function getParam(name){
  return new URLSearchParams(window.location.search).get(name);
}
function fmtDate(d){
  return d.toLocaleDateString("sw-TZ",{day:"2-digit",month:"2-digit",year:"numeric"});
}
function gradeFromMark(m){
  if(m >= 75) return "A";
  if(m >= 65) return "B";
  if(m >= 45) return "C";
  if(m >= 30) return "D";
  return "F";
}
function commentFromGrade(g){
  if(g==="A") return "Bora sana";
  if(g==="B") return "Nzuri sana";
  if(g==="C") return "Wastani";
  if(g==="D") return "Hafifu";
  return "Duni, ongeza juhudi";
}

/* ---------------------------------------------------
   PARAMS
   report.html?class=FORM_ONE_A&exam=FINAL_2025&student=F1A_001
--------------------------------------------------- */
const classId   = getParam("class");
const examId    = getParam("exam");
const studentId = getParam("student");

/* ---------------------------------------------------
   INIT
--------------------------------------------------- */
(async function init(){
  if(!classId || !examId || !studentId){
    alert("Missing report parameters");
    return;
  }

  // Header date
  qs("repDate").textContent = fmtDate(new Date());

  try{
    await loadExam();
    await loadStudentAndMarks();
    await loadBehaviour();
    await loadTeachers();
  }catch(err){
    console.error("REPORT LOAD ERROR:", err);
    alert("Failed to load report");
  }
})();

/* ---------------------------------------------------
   LOAD EXAM
--------------------------------------------------- */
async function loadExam(){
  const examDoc = await db
    .collection("classes")
    .doc(classId)
    .collection("exams")
    .doc(examId)
    .get();

  if(examDoc.exists){
    const ex = examDoc.data();
    qs("repExamName").textContent = ex.displayName || ex.name || "EXAMINATION REPORT";
  }
}

/* ---------------------------------------------------
   LOAD STUDENT + MARKS
--------------------------------------------------- */
async function loadStudentAndMarks(){
  const stuRef = db
    .collection("classes")
    .doc(classId)
    .collection("students")
    .doc(studentId);

  const stuSnap = await stuRef.get();
  if(!stuSnap.exists) throw "Student not found";

  const stu = stuSnap.data();

  // BASIC INFO
  qs("repStudentName").textContent = stu.fullName || "-";
  qs("repParent").textContent = stu.parentName || "________________";
  qs("repForm").textContent = stu.form || classId.replace(/_/g," ");
  qs("repStream").textContent = stu.stream || "A";
  qs("repAdm").textContent = stu.admissionNo || "-";

  const subjectsSnap = await db
    .collection("classes")
    .doc(classId)
    .collection("subjects")
    .orderBy("code")
    .get();

  const body = qs("subjectsBody");
  body.innerHTML = "";

  let total = 0;
  let count = 0;
  let index = 1;

  subjectsSnap.forEach(doc=>{
    const sub = doc.data();
    const marks = (stu.marks?.[examId]?.subjects || {});
    const final = marks[sub.code];

    let avg = final ?? "-";
    let grade = final!=null ? gradeFromMark(final) : "-";
    let comment = final!=null ? commentFromGrade(grade) : "-";

    if(final!=null){
      total += final;
      count++;
    }

    body.innerHTML += `
      <tr>
        <td class="center">${index++}</td>
        <td class="left">${sub.name}</td>
        <td class="center">-</td>
        <td class="center">-</td>
        <td class="center">${final ?? "-"}</td>
        <td class="center">${avg}</td>
        <td class="center">${grade}</td>
        <td class="left">${comment}</td>
      </tr>
    `;
  });

  const average = count ? (total / count).toFixed(1) : 0;

  qs("repTotal").textContent   = total;
  qs("repAverage").textContent = average;

  await calculatePosition(total, average);
}

/* ---------------------------------------------------
   POSITION & DIVISION
--------------------------------------------------- */
async function calculatePosition(totalMarks, avg){
  const snap = await db
    .collection("classes")
    .doc(classId)
    .collection("students")
    .get();

  const scores = [];
  snap.forEach(doc=>{
    const m = doc.data().marks?.[examId]?.subjects || {};
    let t = 0, c = 0;
    Object.values(m).forEach(v=>{
      if(v!=null){ t+=v; c++; }
    });
    scores.push({ id:doc.id, total:t, avg:c?(t/c):0 });
  });

  scores.sort((a,b)=>b.total - a.total);

  const pos = scores.findIndex(s=>s.id===studentId) + 1;

  qs("repPosition").textContent      = pos;
  qs("repTotalStudents").textContent = scores.length;

  let division="IV", points=0;
  if(avg>=75){division="I";points=7;}
  else if(avg>=65){division="II";points=9;}
  else if(avg>=45){division="III";points=12;}

  qs("repDivision").textContent = division;
  qs("repPoints").textContent  = points;
}

/* ---------------------------------------------------
   BEHAVIOUR
--------------------------------------------------- */
async function loadBehaviour(){
  const snap = await db
    .collection("behaviour")
    .doc(studentId)
    .get();

  if(snap.exists){
    qs("repBehaviour").textContent = snap.data().summary || "Tabia nzuri";
  }
}

/* ---------------------------------------------------
   TEACHERS (AUTO FROM STAFF)
--------------------------------------------------- */
async function loadTeachers(){
  const staffSnap = await db.collection("staff").get();

  staffSnap.forEach(doc=>{
    const s = doc.data();
    if(s.role==="classteacher" && s.class===classId){
      qs("repClassTeacher").textContent = s.name;
      qs("repTeacherComment").textContent =
        s.comment || "Mwanafunzi anaendelea vizuri.";
    }
    if(s.role==="headmaster"){
      qs("repHeadTeacher").textContent = s.name;
      qs("repHeadComment").textContent =
        s.comment || "Endelea kujituma kwenye masomo.";
    }
  });
}


