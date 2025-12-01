// js/report.js
// Single student report form (Maendeleo ya Taaluma)

var $ = function(id){ return document.getElementById(id); };

function qparam(){
  var p = new URLSearchParams(window.location.search);
  return {
    examId:    p.get("exam")    || "",
    classId:   p.get("class")   || "",
    studentId: p.get("student") || "",
    adm:       p.get("adm")     || ""
  };
}

/* ===== AUTH GUARD ===== */
auth.onAuthStateChanged(function(user){
  if (!user){
    window.location.href = "index.html";
    return;
  }
  initReport();
});

var allClasses   = [];
var allStudents  = [];
var allReports   = [];
var allBehaviour = [];
var allExams     = [];
var allMarks     = [];

var currentExamId    = "";
var currentClassId   = "";
var currentStudentId = "";

/* ===== MAIN INIT ===== */
async function initReport(){
  try{
    var qp = qparam();

    var res = await Promise.all([
      getAll(col.classes),
      getAll(col.students),
      getAll(col.report_cards),
      getAll(col.behaviour || "behaviour"),
      getAll(col.exams || "exams"),
      getAll(col.marks || "marks")
    ]);

    allClasses   = res[0];
    allStudents  = res[1];
    allReports   = res[2];
    allBehaviour = res[3] || [];
    allExams     = res[4] || [];
    allMarks     = res[5] || [];

    currentExamId  = qp.examId  || (allExams[0]   && allExams[0].id)   || "";
    currentClassId = qp.classId || (allClasses[0] && allClasses[0].id) || "";

    fillExamSelect();
    fillClassSelect();
    fillStudentSelect(qp);

    // handlers
    if ($("examSelect")){
      $("examSelect").onchange = function(){
        currentExamId = this.value;
        fillStudentSelect({});
        renderCurrent();
      };
    }
    if ($("classSelect")){
      $("classSelect").onchange = function(){
        currentClassId = this.value;
        fillStudentSelect({});
        renderCurrent();
      };
    }
    if ($("studentSelect")){
      $("studentSelect").onchange = function(){
        currentStudentId = this.value;
        renderCurrent();
      };
    }

    var prev = $("prevBtn");
    var next = $("nextBtn");
    if (prev){
      prev.onclick = function(){ stepStudent(-1); };
    }
    if (next){
      next.onclick = function(){ stepStudent(1); };
    }

    renderCurrent();
  }catch(err){
    console.error("initReport error:", err);
    alert("Imeshindikana kupakia report form. Angalia console.");
  }
}

/* ===== SELECT HELPERS ===== */
function fillExamSelect(){
  var sel = $("examSelect");
  if (!sel) return;

  if (!allExams.length){
    sel.innerHTML = "<option value=''>No exams</option>";
    return;
  }

  sel.innerHTML = allExams.map(function(ex){
    var label  = ex.name || ex.id;
    var selAtt = (ex.id === currentExamId) ? " selected" : "";
    return "<option value='"+ex.id+"'"+selAtt+">"+label+"</option>";
  }).join("");
}

function fillClassSelect(){
  var sel = $("classSelect");
  if (!sel) return;

  if (!allClasses.length){
    sel.innerHTML = "<option value=''>No classes</option>";
    return;
  }

  sel.innerHTML = allClasses.map(function(c){
    var selAtt = (c.id === currentClassId) ? " selected" : "";
    return "<option value='"+c.id+"'"+selAtt+">"+(c.name || c.id)+"</option>";
  }).join("");
}

function fillStudentSelect(qp){
  var sel = $("studentSelect");
  if (!sel) return;

  var list = allStudents.filter(function(s){
    return s.class_id === currentClassId;
  });

  if (!list.length){
    sel.innerHTML = "<option value=''>No students</option>";
    currentStudentId = "";
    return;
  }

  // sort kwa namba ya mtahiniwa
  list.sort(function(a,b){
    return (a.admission_no+"").localeCompare(b.admission_no+"");
  });

  if (qp && qp.studentId){
    currentStudentId = qp.studentId;
  }else if (qp && qp.adm){
    var m = list.find(function(s){ return (s.admission_no+"") === qp.adm; });
    currentStudentId = m ? m.id : list[0].id;
  }else if (!currentStudentId){
    currentStudentId = list[0].id;
  }

  sel.innerHTML = list.map(function(s){
    var label  = (s.admission_no || "")+" — "+(s.first_name || "")+" "+(s.last_name || "");
    var selAtt = (s.id === currentStudentId) ? " selected" : "";
    return "<option value='"+s.id+"'"+selAtt+">"+label+"</option>";
  }).join("");
}

/* ===== PREV / NEXT STUDENT ===== */
function stepStudent(direction){
  var sel = $("studentSelect");
  if (!sel || !sel.options.length) return;
  var idx  = sel.selectedIndex;
  var next = idx + direction;
  if (next < 0 || next >= sel.options.length) return;
  sel.selectedIndex = next;
  currentStudentId = sel.value;
  renderCurrent();
}

/* ===== RENDER REPORT CARD ===== */
function renderCurrent(){
  if (!currentExamId || !currentClassId || !currentStudentId) return;

  var cls  = allClasses.find(function(c){ return c.id === currentClassId; }) || {};
  var stu  = allStudents.find(function(s){ return s.id === currentStudentId; }) || {};
  var exam = allExams.find(function(e){ return e.id === currentExamId; }) || { id: currentExamId };

  var rep = allReports.find(function(r){
    var okExam = (r.exam_id === currentExamId) || (!r.exam_id && r.exam === currentExamId);
    return okExam && r.class_id === currentClassId && r.student_id === currentStudentId;
  }) || {};

  var behave = allBehaviour.find(function(b){
    if (b.student_id !== currentStudentId) return false;
    if (b.exam_id && b.exam_id !== currentExamId) return false;
    return true;
  }) || {};

  // header
  if ($("repExamName")) $("repExamName").textContent = exam.name || exam.id || "";
  if ($("metaStudentName")) $("metaStudentName").textContent =
    (stu.first_name || "")+" "+(stu.last_name || "");
  if ($("metaAdmForm")) $("metaAdmForm").textContent =
    (stu.admission_no || "")+" / "+(cls.level || "Form ?");
  if ($("metaSex")) $("metaSex").textContent = stu.gender || "";
  if ($("metaClass")) $("metaClass").textContent = cls.name || cls.id || "";

  if ($("metaClassTeacher")) $("metaClassTeacher").textContent =
    (cls.class_teacher_name || behave.class_teacher_name || "");
  if ($("metaExamDate")) $("metaExamDate").textContent =
    exam.date || exam.exam_date || "";
  if ($("metaYear")) $("metaYear").textContent =
    exam.year || new Date().getFullYear();

  // ===== SUBJECT TABLE =====
  var tbody    = $("subjectsTable").querySelector("tbody");
  var subjects = rep.subjects || rep.subject_summary || [];

  // kama hakuna subjects kwenye report_cards, tumia marks
  if ((!subjects || !subjects.length) && allMarks && allMarks.length){
    subjects = allMarks
      .filter(function(m){
        var okExam  = (m.exam_id === currentExamId) || (!m.exam_id && m.exam === currentExamId);
        var okClass = m.class_id === currentClassId;
        var okStu   = m.student_id === currentStudentId;
        return okExam && okClass && okStu;
      })
      .map(function(m){
        return {
          name:  m.subject_name || m.subject || m.code || "",
          marks: m.total != null ? m.total : (m.marks != null ? m.marks : m.score),
          grade: m.grade || "",
          remark:m.remark || m.comment || ""
        };
      });
  }

  if (!subjects || !subjects.length){
    tbody.innerHTML =
      "<tr><td colspan='5'>Hakuna breakdown ya masomo kwenye report ya mwanafunzi huyu kwa mtihani huu.</td></tr>";
  }else{
    tbody.innerHTML = "";
    subjects.forEach(function(sub, idx){
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>"+(idx+1)+"</td>"+
        "<td class='subj-name'>"+(sub.name || "")+"</td>"+
        "<td>"+(sub.marks != null ? sub.marks : "")+"</td>"+
        "<td>"+(sub.grade || "")+"</td>"+
        "<td style='text-align:left;'>"+(sub.remark || "")+"</td>";
      tbody.appendChild(tr);
    });
  }

  // ===== TOTALS & BEHAVIOUR =====
  if ($("metaTotal"))    $("metaTotal").textContent    = rep.total_marks != null ? rep.total_marks : "";
  if ($("metaMean"))     $("metaMean").textContent     = rep.mean_score != null ? rep.mean_score : "";
  if ($("metaGrade"))    $("metaGrade").textContent    = rep.grade || "";
  if ($("metaPosition")) $("metaPosition").textContent = rep.position || rep.rank || "";

  if ($("metaClassRemark")) $("metaClassRemark").textContent =
    rep.remark || behave.class_comment || "";

  if ($("metaBehaviour")) $("metaBehaviour").textContent =
    behave.summary || behave.behaviour || behave.remark || " ";

  if ($("metaClosed"))  $("metaClosed").textContent  =
    exam.closed_date  || behave.closed_date  || "";
  if ($("metaOpening")) $("metaOpening").textContent =
    exam.opening_date || behave.opening_date || "";
  if ($("metaAdvice"))  $("metaAdvice").textContent  =
    behave.advice || "";
}


