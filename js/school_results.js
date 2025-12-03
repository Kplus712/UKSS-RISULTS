// js/school_results.js
// School results — centre + subject + class sheet

/* Auth guard: lazima awe logged in */
auth.onAuthStateChanged(function (user) {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  initSchoolResults().catch(function (err) {
    console.error("initSchoolResults error:", err);
    alert("Imeshindikana kupakia school results. Angalia console.");
  });
});

// Helper: set text kama element ipo
function setText(id, value) {
  var el = document.getElementById(id);
  if (el) el.textContent = value;
}

// GPA mapping (NECTA style approx)
function gradeToPoints(g) {
  if (!g) return null;
  switch (String(g).toUpperCase()) {
    case "A": return 1;
    case "B": return 2;
    case "C": return 3;
    case "D": return 4;
    case "E": return 5;
    case "F": return 6;
    default:  return null;
  }
}

// Competency level kwa centre GPA
function competencyLevel(gpa) {
  if (gpa === "-" || gpa == null) return "-";
  gpa = Number(gpa);
  if (gpa <= 2.0) return "Grade B (Very Good)";
  if (gpa <= 3.0) return "Grade C (Good)";
  if (gpa <= 4.0) return "Grade D (Satisfactory)";
  if (gpa <= 5.0) return "Grade E (Unsatisfactory)";
  return "Grade F (Poor)";
}

async function initSchoolResults() {
  // Load exams, classes, subjects for filters
  var res = await Promise.all([
    getAll(col.exams),
    getAll(col.classes),
    getAll(col.subjects)
  ]);
  var exams    = res[0];
  var classes  = res[1];
  var subjects = res[2];

  var examSel  = document.getElementById("examSelect");
  var classSel = document.getElementById("classSelect");

  // Fill exams
  examSel.innerHTML = "";
  if (!exams.length) {
    examSel.innerHTML = '<option value="">No exams</option>';
  } else {
    // sort latest first
    exams.sort(function (a, b) {
      return (new Date(b.exam_date || b.created_at || 0)) -
             (new Date(a.exam_date || a.created_at || 0));
    });
    exams.forEach(function (ex, idx) {
      var opt = document.createElement("option");
      opt.value = ex.id;
      opt.textContent = (ex.name || ex.id);
      if (idx === 0) opt.selected = true;
      examSel.appendChild(opt);
    });
  }

  // Fill classes
  classSel.innerHTML = '<option value="">All classes</option>';
  classes.forEach(function (c) {
    var opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    classSel.appendChild(opt);
  });

  var loadBtn = document.getElementById("loadBtn");
  loadBtn.onclick = function () {
    var examId = examSel.value;
    var classId = classSel.value || null;
    loadExamResults(examId, classId, subjects, classes).catch(function (err) {
      console.error("loadExamResults error:", err);
      alert("Imeshindikana kupakia matokeo ya exam. Angalia console.");
    });
  };

  // load default
  if (exams.length) {
    loadExamResults(exams[0].id, classSel.value || null, subjects, classes);
  }
}

async function loadExamResults(examId, classId, subjects, classes) {
  if (!examId) return;

  console.log("Loading results for exam:", examId, "class:", classId || "ALL");

  // load report cards + students
  var res = await Promise.all([
    getAll(col.report_cards),
    getAll(col.students)
  ]);
  var cards    = res[0];
  var students = res[1];

  // filter by exam
  cards = cards.filter(function (r) { return r.exam_id === examId; });

  if (!cards.length) {
    resetTables("Hakuna report cards kwa exam hii.");
    return;
  }

  // Map ya students & classes
  var studentMap = {};
  students.forEach(function (s) { studentMap[s.id] = s; });

  var classMap = {};
  classes.forEach(function (c) { classMap[c.id] = c; });

  // ---------- 1. Centre overall performance ----------
  var total = cards.length;
  var passed = 0;
  var gpaSum = 0;
  var gpaCount = 0;

  cards.forEach(function (r) {
    var g = (r.grade || "").toUpperCase();
    if (g !== "F" && g !== "") passed++;
    var p = gradeToPoints(g);
    if (p != null) {
      gpaSum += p;
      gpaCount++;
    }
  });

  var percent = total ? ((passed * 100) / total).toFixed(1) + "%" : "-";
  var centreGpa = gpaCount ? (gpaSum / gpaCount).toFixed(3) : "-";
  var level = competencyLevel(centreGpa);

  setText("ctTotal", total);
  setText("ctPassed", passed);
  setText("ctPercent", percent);
  setText("ctGpa", centreGpa);
  setText("ctLevel", level);

  // ---------- 2. Overall subject performance ----------
  var subjStats = {}; // subject_id => stats

  cards.forEach(function (r) {
    var sb = r.subject_breakdown || r.subjects || {};
    Object.keys(sb).forEach(function (code) {
      var rec = sb[code] || {};
      var g = (rec.grade || rec.final_grade || "").toUpperCase();
      if (!subjStats[code]) {
        subjStats[code] = {
          name: rec.name || code,
          reg: 0, sat: 0, abs: 0,
          A:0,B:0,C:0,D:0,E:0,F:0,
          gpaSum:0, gpaCount:0
        };
      }
      var st = subjStats[code];
      st.reg++;

      // Assume all sat unless mark==null or remark Abs
      var absent = (rec.absent === true) ||
        (rec.remark && String(rec.remark).toLowerCase().indexOf("abs") !== -1);
      if (absent) {
        st.abs++;
      } else {
        st.sat++;
        if (g && st.hasOwnProperty(g)) st[g]++;
        var p = gradeToPoints(g);
        if (p != null) {
          st.gpaSum += p;
          st.gpaCount++;
        }
      }
    });
  });

  var subjectTableBody = document.querySelector("#subjectTable tbody");
  subjectTableBody.innerHTML = "";

  var statsArr = Object.keys(subjStats).map(function (code) {
    var st = subjStats[code];
    var gpa = st.gpaCount ? (st.gpaSum / st.gpaCount).toFixed(3) : "-";
    return {
      code: code,
      name: st.name,
      reg: st.reg,
      sat: st.sat,
      abs: st.abs,
      A: st.A, B: st.B, C: st.C, D: st.D, E: st.E, F: st.F,
      gpa: gpa
    };
  });

  // rank by GPA (lower = better)
  statsArr.sort(function (a, b) {
    var ga = a.gpa === "-" ? 99 : Number(a.gpa);
    var gb = b.gpa === "-" ? 99 : Number(b.gpa);
    return ga - gb;
  });

  statsArr.forEach(function (st, idx) {
    var tr = document.createElement("tr");
    var levelBadge;
    var g = st.gpa === "-" ? null : Number(st.gpa);
    if (g == null || isNaN(g)) {
      levelBadge = "<span class='badge'>-</span>";
    } else if (g <= 3) {
      levelBadge = "<span class='badge badge-good'>Good</span>";
    } else if (g <= 4) {
      levelBadge = "<span class='badge badge-avg'>Average</span>";
    } else {
      levelBadge = "<span class='badge badge-poor'>Weak</span>";
    }

    tr.innerHTML =
      "<td class='left'>" + st.name + "</td>" +
      "<td>" + st.reg + "</td>" +
      "<td>" + st.sat + "</td>" +
      "<td>" + st.abs + "</td>" +
      "<td>" + st.A + "</td>" +
      "<td>" + st.B + "</td>" +
      "<td>" + st.C + "</td>" +
      "<td>" + st.D + "</td>" +
      "<td>" + st.E + "</td>" +
      "<td>" + st.F + "</td>" +
      "<td>" + st.gpa + "</td>" +
      "<td>" + levelBadge + "</td>" +
      "<td>" + (idx + 1) + "</td>";
    subjectTableBody.appendChild(tr);
  });

  if (!statsArr.length) {
    subjectTableBody.innerHTML = "<tr><td colspan='13'>Hakuna breakdown ya masomo kwenye report cards.</td></tr>";
  }

  // ---------- 3. Class results sheet ----------
  var classTableBody = document.querySelector("#classTable tbody");
  classTableBody.innerHTML = "";

  var classCards = cards;
  if (classId) {
    classCards = cards.filter(function (r) { return r.class_id === classId; });
  }

  if (!classCards.length) {
    classTableBody.innerHTML =
      "<tr><td colspan='10'>Hakuna report cards kwa class hii.</td></tr>";
    return;
  }

  // sort descending total marks
  classCards.sort(function (a, b) {
    return (b.total_marks || 0) - (a.total_marks || 0);
  });

  classCards.forEach(function (r, index) {
    var stu = studentMap[r.student_id] || {};
    var cls = classMap[r.class_id] || {};
    var tr = document.createElement("tr");
    tr.innerHTML =
      "<td>" + (index + 1) + "</td>" +
      "<td>" + (r.admission_no || "") + "</td>" +
      "<td class='left'>" + ((stu.first_name || "") + " " + (stu.last_name || "")) + "</td>" +
      "<td>" + (stu.sex || "-") + "</td>" +
      "<td>" + (cls.name || r.class_id || "-") + "</td>" +
      "<td>" + (r.total_marks != null ? r.total_marks : "") + "</td>" +
      "<td>" + (r.mean_score != null ? r.mean_score.toFixed ? r.mean_score.toFixed(1) : r.mean_score : "") + "</td>" +
      "<td>" + (r.grade || "") + "</td>" +
      "<td>" + (index + 1) + "</td>" +
      "<td class='left'>" + (r.remark || "") + "</td>";
    classTableBody.appendChild(tr);
  });
}

function resetTables(msg) {
  setText("ctTotal", "-");
  setText("ctPassed", "-");
  setText("ctPercent", "-");
  setText("ctGpa", "-");
  setText("ctLevel", "-");

  var stBody = document.querySelector("#subjectTable tbody");
  stBody.innerHTML = "<tr><td colspan='13'>" + (msg || "No data.") + "</td></tr>";

  var clBody = document.querySelector("#classTable tbody");
  clBody.innerHTML = "<tr><td colspan='10'>" + (msg || "No data.") + "</td></tr>";
}
