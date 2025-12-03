// js/academic.js
// UKSS — Academic Officer Dashboard

// Auth guard: hakikisha user yupo, vinginevyo mrudishe login
auth.onAuthStateChanged(function (user) {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  initAcademic(user).catch(function (err) {
    console.error("initAcademic error:", err);
    alert("Academic dashboard error. Angalia console.");
  });
});

// Helper ndogo ya kuweka text ikiwa element ipo
function setText(id, value) {
  var el = document.getElementById(id);
  if (el) el.textContent = value;
}

async function initAcademic(user) {
  console.log("Academic dashboard init for:", user.email);

  // 1. Soma basic data zote kwa Promise.all
  var results = await Promise.all([
    getAll(col.classes),       // 0
    getAll(col.students),      // 1
    getAll(col.exams),         // 2
    getAll(col.report_cards),  // 3
    getAll(col.marks).catch(function(){ return []; }), // 4 (ikishindikana, irudi list tupu)
    getAll(col.behaviour).catch(function(){ return []; }) // 5
  ]);

  var classes      = results[0];
  var students     = results[1];
  var exams        = results[2];
  var reportCards  = results[3];
  var marks        = results[4] || [];
  var behaviour    = results[5] || [];

  // 2. Stats za juu (cards)
  setText("statClasses",  classes.length);
  setText("statStudents", students.length);
  setText("statExams",    exams.length);
  setText("statReports",  reportCards.length);

  // Tafuta exam ya mwisho kwa tarehe
  if (exams.length) {
    exams.sort(function (a, b) {
      return (new Date(b.exam_date || b.created_at || 0)) -
             (new Date(a.exam_date || a.created_at || 0));
    });
    var lastExam = exams[0];
    setText("statLastExamName", lastExam.name || lastExam.id || "-");
    setText("statLastExamDate",
      (lastExam.exam_date || lastExam.created_at || "").toString().slice(0, 10)
    );
  }

  // 3. Pending students (wale ambao status != 'approved')
  var pending = students.filter(function (s) {
    return !s.status || s.status !== "approved";
  });

  var pendingBody = document.getElementById("pendingTableBody");
  if (pendingBody) {
    pendingBody.innerHTML = "";
    if (!pending.length) {
      var trEmpty = document.createElement("tr");
      trEmpty.innerHTML = "<td colspan='4'>Hakuna wanafunzi pending approval.</td>";
      pendingBody.appendChild(trEmpty);
    } else {
      pending.forEach(function (s, idx) {
        var tr = document.createElement("tr");
        tr.innerHTML =
          "<td>" + (idx + 1) + "</td>" +
          "<td>" + (s.admission_no || "-") + "</td>" +
          "<td>" + ((s.first_name || "") + " " + (s.last_name || "")) + "</td>" +
          "<td>" + (s.class_name || s.class_id || "-") + "</td>";
        pendingBody.appendChild(tr);
      });
    }
  }

  // 4. Overview kidogo ya performance ya exam ya mwisho per class
  // (optional — haitabomoka kama hakuna elements au data)
  if (reportCards.length && exams.length) {
    var latestExamId = exams[0].id || exams[0].code || exams[0].exam_id;

    var perClass = {};
    reportCards.forEach(function (r) {
      if (r.exam_id && latestExamId && r.exam_id !== latestExamId) return;
      var cid = r.class_id || "unknown";
      if (!perClass[cid]) {
        perClass[cid] = { totalMean: 0, count: 0 };
      }
      var mean = Number(r.mean_score || 0);
      perClass[cid].totalMean += mean;
      perClass[cid].count += 1;
    });

    Object.keys(perClass).forEach(function (cid) {
      var row = perClass[cid];
      var avg = row.count ? (row.totalMean / row.count).toFixed(2) : "-";
      console.log("Class", cid, "avg mean (latest exam):", avg);
      // Kama una meza ya ku-display, unaweza ku-update hapa
    });
  }

  console.log("Academic dashboard ready.");
}

