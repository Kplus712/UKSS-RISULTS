// js/report.js
// Single student report form

// ===== helpers =====
function qs(id){ return document.getElementById(id); }

function setStatus(type, msg){
  const el = qs("reportStatus");
  if (!el) return;
  el.classList.remove("hidden","status-info","status-success","status-error");
  if (!msg){
    el.classList.add("hidden");
    return;
  }
  if (type === "success") el.classList.add("status-success");
  else if (type === "error") el.classList.add("status-error");
  else el.classList.add("status-info");
  el.textContent = msg;
}

function getQueryParam(name){
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// grade per subject
function gradeFromScore(m){
  if (m === null || m === undefined || m === "") return {grade:"-", remark:""};
  m = Number(m);
  if (isNaN(m)) return {grade:"-", remark:""};
  if (m >= 81) return {grade:"A", remark:"Bora Sana"};
  if (m >= 61) return {grade:"B", remark:"Vizuri Sana"};
  if (m >= 41) return {grade:"C", remark:"Wastani"};
  if (m >= 21) return {grade:"D", remark:"Hafifu"};
  return {grade:"E", remark:"Dhaifu Sana"};
}

// division (overall)
function divisionFromAverage(avg){
  if (avg >= 75) return "DIV I";
  if (avg >= 60) return "DIV II";
  if (avg >= 45) return "DIV III";
  if (avg >= 30) return "DIV IV";
  return "DIV 0";
}

// comment based on division
function overallComment(div){
  if (div === "DIV I") return "Ufaulu wa hali ya juu sana, endelea na juhudi hizo.";
  if (div === "DIV II") return "Ufaulu mzuri, ongeza bidii ili ufikie daraja la juu.";
  if (div === "DIV III") return "Ufaulu wa kati, ongeza juhudi zaidi kuboresha matokeo.";
  if (div === "DIV IV") return "Ufaulu wa chini, unahitaji kufanya kazi kwa bidii na msaada wa karibu.";
  return "Matokeo si mazuri, chukua hatua za haraka kuboresha ufaulu.";
}

// ===== main loader =====
(async function initReport(){
  try{
    setStatus("info","Loading report...");

    if (!db){
      setStatus("error","Firestore not initialised.");
      return;
    }

    const classId   = getQueryParam("classId");
    const studentId = getQueryParam("studentId");
    const examId    = getQueryParam("examId");

    if (!classId || !studentId || !examId){
      setStatus("error","Missing classId, studentId or examId in URL.");
      return;
    }

    // Update exam label on top
    qs("repExamLabel").textContent = `Class: ${classId} — Exam: ${examId}`;

    // get class document
    const classDoc = await db.collection("classes").doc(classId).get();
    if (!classDoc.exists){
      setStatus("error","Class not found.");
      return;
    }
    const classData = classDoc.data();
    const className = classData.name || classId;

    // school info (unaweza ku-binda hapa ukitaka dynamic)
    if (classData.schoolName) qs("repSchoolName").textContent = classData.schoolName;
    if (classData.council) qs("repCouncil").textContent = classData.council;

    // get subjects of that class
    const subjSnap = await db.collection("classes").doc(classId)
      .collection("subjects").orderBy("code").get();
    const subjects = subjSnap.docs.map(d => d.data());

    // get all students (for position)
    const stuSnap = await db.collection("classes").doc(classId)
      .collection("students").get();
    const students = stuSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const target = students.find(s => s.id === studentId);
    if (!target){
      setStatus("error","Student not found in this class.");
      return;
    }

    // fill basic info
    qs("repStudentName").textContent = target.fullName || "";
    qs("repAdmNo").textContent      = target.admissionNo || "";
    qs("repForm").textContent       = classData.level || classData.form || "FORM";
    qs("repStream").textContent     = classData.stream || "";
    qs("repParentName").textContent = target.guardianName || target.parentName || "................";
    qs("repClosingDate").textContent = classData.closingDate || "______________";
    qs("repOpeningDate").textContent = classData.openingDate || "______________";

    // date today
    qs("repDate").textContent = new Date().toLocaleDateString("en-GB");

    // exam title (optional)
    if (classData.exams && classData.exams[examId] && classData.exams[examId].name){
      qs("repExamTitle").textContent = classData.exams[examId].name;
    }

    // build subject table
    const examMarksObj = target.marks && target.marks[examId] ? target.marks[examId].subjects || {} : {};
    let total = 0;
    let countSubjects = 0;

    const tbody = qs("repSubjectsBody");
    tbody.innerHTML = "";

    subjects.forEach((subj, index) => {
      const code = subj.code;
      const name = subj.name || code;
      const rawMark = examMarksObj[code] ?? null;

      const row = document.createElement("tr");

      let markDisplay = "";
      let grade = "-";
      let remark = "";

      if (rawMark !== null && rawMark !== undefined){
        const m = Number(rawMark);
        if (!isNaN(m)){
          markDisplay = m.toString();
          const g = gradeFromScore(m);
          grade = g.grade;
          remark = g.remark;
          total += m;
          countSubjects += 1;
        }
      }

      row.innerHTML = `
        <td class="num">${index+1}</td>
        <td>${name}</td>
        <td class="num">${markDisplay}</td>
        <td class="num">${grade}</td>
        <td>${remark}</td>
      `;
      tbody.appendChild(row);
    });

    // totals, average, division
    const avg = countSubjects > 0 ? +(total / countSubjects).toFixed(1) : 0;
    const division = divisionFromAverage(avg);

    qs("repTotalMarks").textContent = total.toString();
    qs("repAverage").textContent    = avg.toString();
    qs("repDivision").textContent   = division;

    // compute position in class (based on same exam)
    const ranking = students.map(st => {
      const marksObj = st.marks && st.marks[examId] ? st.marks[examId].subjects || {} : {};
      let tot = 0;
      let cnt = 0;
      subjects.forEach(sub => {
        const val = marksObj[sub.code];
        if (val !== null && val !== undefined){
          const n = Number(val);
          if (!isNaN(n)){
            tot += n;
            cnt++;
          }
        }
      });
      const av = cnt>0 ? tot/cnt : 0;
      return {
        id: st.id,
        avg: av
      };
    });

    ranking.sort((a,b)=> b.avg - a.avg);

    let classSize = ranking.length;
    let position = "-";
    let lastAvg = null;
    let lastPos = 0;
    ranking.forEach((r, idx)=>{
      if (r.avg !== lastAvg){
        lastPos = idx + 1;
        lastAvg = r.avg;
      }
      if (r.id === studentId){
        position = lastPos;
      }
    });

    qs("repPosition").textContent   = position.toString();
    qs("repClassSize").textContent  = classSize.toString();

    // comments
    qs("repTeacherComment").textContent = overallComment(division);

    // show page
    qs("reportPage").style.display = "block";
    setStatus("success","Report loaded successfully.");

  }catch(err){
    console.error(err);
    setStatus("error","Failed to load report: " + err.message);
  }
})();



