// js/school_results.js
// School Results Form — Centre & Subject performance (NECTA style)

/* === Auth guard ==== */
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

function setText(id, value) {
  var el = document.getElementById(id);
  if (el) el.textContent = value;
}

// Grade → points (approx NECTA)
function gradeToPoints(g) {
  if (!g) return null;
  g = String(g).toUpperCase();
  if (g === "A") return 1;
  if (g === "B") return 2;
  if (g === "C") return 3;
  if (g === "D") return 4;
  if (g === "E") return 5;
  if (g === "F") return 6;
  return null;
}

// Centre competency level based on GPA
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
  var examSelect = document.getElementById("examSelect");
  var loadBtn = document.getElementById("loadBtn");

  // pata report_cards zote ili kupata list ya exams tofauti
  var allCards = await getAll(col.report_cards);

  if (!allCards.length) {
    examSelect.innerHTML = '<option value="">No exams yet</option>';
    resetTables("Hakuna report cards kwenye mfumo.");
    return;
  }

  var examSet = {};
  allCards.forEach(function (r) {
    if (r.exam_id) examSet[r.exam_id] = true;
  });
  var exams = Object.keys(examSet);

  examSelect.innerHTML = "";
  exams.forEach(function (id, idx) {
    var opt = document.createElement("option");
    opt.value = id;
    opt.textContent = id;
    if (idx === 0) opt.selected = true;
    examSelect.appendChild(opt);
  });

  loadBtn.onclick = function () {
    var examId = examSelect.value;
    if (!examId) {
      alert("Chagua exam kwanza.");
      return;
    }
    loadExamResults(examId).catch(function (err) {
      console.error("loadExamResults error:", err);
      alert("Imeshindikana kupakia matokeo ya exam. Angalia console.");
    });
  };

  // load ya kwanza auto
  if (exams.length) {
    await loadExamResults(exams[0]);
  }
}

async function loadExamResults(examId) {
  console.log("Loading school results for exam:", examId);

  // chukua report_cards za exam husika
  var cardsAll = await getAll(col.report_cards);
  var cards = cardsAll.filter(function (r) { return r.exam_id === examId; });

  if (!cards.length) {
    resetTables("Hakuna report cards kwa exam hii (" + examId + ").");
    return;
  }

  // header: exam info
  var first = cards[0] || {};
  var examTitle =
    (first.exam_name || first.exam_label || "").toString().toUpperCase() ||
    ("EXAMINATION " + examId.toUpperCase());
  setText("examTitle", examTitle);
  setText("examIdLabel", examId.toUpperCase());

  // ===== 1. Centre overall performance =====
  var total = cards.length;
  var passed = 0;
  var gpaSum = 0;
  var gpaCount = 0;

  cards.forEach(function (r) {
    var g = (r.grade || "").toUpperCase();
    if (g && g !== "F") passed++;
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

  // ===== 2. Subject performance (subject_breakdown) =====
  var subjStats = {}; // code => stats

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

      var absent = (rec.absent === true) ||
        (rec.remark && String(rec.remark).toLowerCase().indexOf("abs") !== -1);
      if (absent) {
        st.abs++;
      } else {
        st.sat++;
        if (st.hasOwnProperty(g)) st[g]++;

        var p = gradeToPoints(g);
        if (p != null) {
          st.gpaSum += p;
          st.gpaCount++;
        }
      }
    });
  });

  var tbody = document.querySelector("#subjectTable tbody");
  tbody.innerHTML = "";

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

  // rank kwa GPA (lower = better)
  statsArr.sort(function (a, b) {
    var ga = a.gpa === "-" ? 99 : Number(a.gpa);
    var gb = b.gpa === "-" ? 99 : Number(b.gpa);
    return ga - gb;
  });

  statsArr.forEach(function (st, idx) {
    var levelText;
    var g = st.gpa === "-" ? null : Number(st.gpa);
    if (g == null || isNaN(g)) {
      levelText = "-";
    } else if (g <= 3) {
      levelText = "Good";
    } else if (g <= 4) {
      levelText = "Satisfactory";
    } else {
      levelText = "Unsatisfactory";
    }

    var badgeClass =
      levelText === "Good" ? "badge badge-good" :
      levelText === "Satisfactory" ? "badge badge-avg" :
      levelText === "Unsatisfactory" ? "badge badge-poor" :
      "badge";

    var tr = document.createElement("tr");
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
      "<td><span class='" + badgeClass + "'>" + levelText + "</span></td>" +
      "<td>" + (idx + 1) + "</td>";
    tbody.appendChild(tr);
  });

  if (!statsArr.length) {
    tbody.innerHTML =
      "<tr><td colspan='13'>Hakuna breakdown ya masomo kwenye report cards. Hakikisha " +
      "report_cards zina field subject_breakdown.</td></tr>";
  }
}

function resetTables(msg) {
  setText("ctTotal", "-");
  setText("ctPassed", "-");
  setText("ctPercent", "-");
  setText("ctGpa", "-");
  setText("ctLevel", "-");

  var tbody = document.querySelector("#subjectTable tbody");
  if (tbody) {
    tbody.innerHTML = "<tr><td colspan='13'>" + (msg || "No data.") + "</td></tr>";
  }
}
// ================================
// CLASS PERFORMANCE SUMMARY
// ================================
var classStats = {}; // class_id → {reg, sat, passed, gpa...}

cards.forEach(r => {
  var cls = r.class_id || "N/A";
  if (!classStats[cls]) {
    classStats[cls] = {
      reg: 0, sat: 0, passed: 0,
      gpaSum: 0, gpaCount: 0
    };
  }
  var s = classStats[cls];
  s.reg++;

  var g = (r.grade || "").toUpperCase();
  var absent = r.absent === true;

  if (!absent) {
    s.sat++;
    if (g && g !== "F") s.passed++;
    var p = gradeToPoints(g);
    if (p != null) { s.gpaSum += p; s.gpaCount++; }
  }
});

// render table
var cBody = document.querySelector("#classTable tbody");
cBody.innerHTML = "";

var classArr = Object.keys(classStats).map(cls => {
  var c = classStats[cls];
  return {
    class_id: cls,
    reg: c.reg,
    sat: c.sat,
    passed: c.passed,
    percent: c.sat ? ((c.passed * 100) / c.sat).toFixed(1) : "-",
    gpa: c.gpaCount ? (c.gpaSum / c.gpaCount).toFixed(3) : "-"
  };
});

// rank by GPA
classArr.sort((a, b) => {
  let ga = a.gpa === "-" ? 99 : Number(a.gpa);
  let gb = b.gpa === "-" ? 99 : Number(b.gpa);
  return ga - gb;
});

classArr.forEach((c, idx) => {
  var tr = document.createElement("tr");
  tr.innerHTML =
    `<td>${c.class_id}</td>
     <td>${c.reg}</td>
     <td>${c.sat}</td>
     <td>${c.passed}</td>
     <td>${c.percent}%</td>
     <td>${c.gpa}</td>
     <td>${idx + 1}</td>`;
  cBody.appendChild(tr);
});

// ======================================
// BEST TEN & LAST TEN
// ======================================

// sort cards by total descending
var sorted = [...cards].sort((a, b) => Number(b.total) - Number(a.total));

// BEST 10
var bestTen = sorted.slice(0, 10);
var bBody = document.querySelector("#bestTenTable tbody");
bBody.innerHTML = "";
bestTen.forEach((s, i) => {
  var tr = document.createElement("tr");
  tr.innerHTML =
    `<td>${i + 1}</td>
     <td>${s.student_name}</td>
     <td>${s.sex}</td>
     <td>${s.class_id}</td>
     <td>${s.total}</td>
     <td>${s.mean}</td>
     <td>${s.grade}</td>
     <td>${s.position}</td>`;
  bBody.appendChild(tr);
});

// LAST 10
var lastTen = sorted.slice(-10);
var lBody = document.querySelector("#lastTenTable tbody");
lBody.innerHTML = "";
lastTen.forEach((s, i) => {
  var tr = document.createElement("tr");
  tr.innerHTML =
    `<td>${i + 1}</td>
     <td>${s.student_name}</td>
     <td>${s.sex}</td>
     <td>${s.class_id}</td>
     <td>${s.total}</td>
     <td>${s.mean}</td>
     <td>${s.grade}</td>
     <td>${s.position}</td>`;
  lBody.appendChild(tr);
});

