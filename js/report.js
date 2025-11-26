// js/report.js
// Results listing + single report card modal (with Behaviour)
// Uses global firebase auth, db, col, getAll, getDocById from database.js

var EXAM_ID = "annual_2025";
var $ = function(id){ return document.getElementById(id); };

var store = {
  classes: [],
  students: [],
  subjects: [],
  reports: []
};

/* ========== AUTH GUARD ========== */
auth.onAuthStateChanged(function(user){
  if (!user){
    window.location.href = "index.html";
  }
});

/* ========== TOAST ========== */
function toast(text){
  console.log(text);
  var el = document.createElement("div");
  el.textContent = text;
  el.style.cssText =
    "position:fixed;right:16px;bottom:16px;background:#11b86a;color:#00150b;" +
    "padding:8px 12px;border-radius:8px;font-size:13px;z-index:9999;";
  document.body.appendChild(el);
  setTimeout(function(){ el.remove(); }, 2200);
}

/* ========== LOAD DATA ========== */
async function refreshStore(){
  try{
    var res = await Promise.all([
      getAll(col.classes),
      getAll(col.students),
      getAll(col.subjects),
      getAll(col.report_cards)
    ]);
    store.classes  = res[0];
    store.students = res[1];
    store.subjects = res[2];
    store.reports  = res[3];
  }catch(err){
    console.error("refreshStore (results) error:", err);
    toast("Imeshindikana kusoma report cards kutoka Firestore.");
  }
}

/* ========== FILTERS & TABLE ========== */
function fillClassFilter(){
  var sel = $("classSelect");
  if (!sel) return;
  var options = ['<option value="">All classes</option>'];
  store.classes.forEach(function(c){
    options.push('<option value="'+c.id+'">'+c.name+'</option>');
  });
  sel.innerHTML = options.join("");
}

function applyFilters(){
  var examId  = $("examSelect").value || EXAM_ID;
  var classId = $("classSelect").value;
  var q       = ($("searchBox").value || "").toLowerCase();

  var list = store.reports.filter(function(r){
    if (r.exam_id && r.exam_id !== examId) return false;
    if (classId && r.class_id !== classId) return false;
    var stu = store.students.find(function(s){ return s.id === r.student_id; }) || {};
    var name = ((stu.first_name || "") + " " + (stu.last_name || "")).toLowerCase();
    var adm  = (r.admission_no || "").toLowerCase();
    if (q && !(name.includes(q) || adm.includes(q))) return false;
    return true;
  });

  renderTable(list);
}

function renderTable(list){
  var tbody = $("resultsTable").querySelector("tbody");
  tbody.innerHTML = "";

  if (!list.length){
    tbody.innerHTML = '<tr><td colspan="7">No report cards found. Hakikisha ume-generate reports kwenye Marks page.</td></tr>';
    return;
  }

  list.forEach(function(r){
    var stu = store.students.find(function(s){ return s.id === r.student_id; }) || {};
    var cls = store.classes.find(function(c){ return c.id === r.class_id; }) || {};

    var tr = document.createElement("tr");
    tr.innerHTML =
      "<td>"+(r.admission_no || "")+"</td>"+
      "<td>"+(stu.first_name || "")+" "+(stu.last_name || "")+"</td>"+
      "<td>"+(cls.name || "")+"</td>"+
      "<td>"+(r.total_marks || "")+"</td>"+
      "<td>"+(r.mean_score || "")+"</td>"+
      "<td>"+(r.grade || "")+"</td>"+
      '<td><button class="btn btn-ghost btn-sm" data-report-id="'+r.id+'">View</button></td>';

    tbody.appendChild(tr);
  });

  Array.prototype.forEach.call(
    tbody.querySelectorAll("button[data-report-id]"),
    function(btn){
      btn.onclick = function(){
        var repId = btn.getAttribute("data-report-id");
        openReport(repId);
      };
    }
  );
}

/* ========== HELPER: behaviour label ========== */
function behaviourLabel(score){
  if (score == null) return "-";
  if (score === 5) return "Excellent";
  if (score === 4) return "Very Good";
  if (score === 3) return "Good";
  if (score === 2) return "Fair";
  if (score === 1) return "Poor";
  return String(score);
}

/* ========== REPORT CARD MODAL ========== */
async function openReport(reportId){
  var r = store.reports.find(function(x){ return x.id === reportId; });
  if (!r){
    toast("Report haijapatikana.");
    return;
  }
  var stu = store.students.find(function(s){ return s.id === r.student_id; }) || {};
  var cls = store.classes.find(function(c){ return c.id === r.class_id; }) || {};

  $("rpName").textContent  = (stu.first_name || "")+" "+(stu.last_name || "");
  $("rpAdm").textContent   = r.admission_no || "";
  $("rpClass").textContent = cls.name || "";
  $("rpExam").textContent  = r.exam_id || EXAM_ID;
  $("rpTotal").textContent = r.total_marks || "";
  $("rpMean").textContent  = r.mean_score || "";
  $("rpGrade").textContent = r.grade || "";
  $("rpWeak").textContent  = (r.weak_subjects && r.weak_subjects.length)
    ? r.weak_subjects.join(", ")
    : "None";

  // SUBJECT MARKS
  var tbody = $("rpSubjectsTable").querySelector("tbody");
  tbody.innerHTML = "";

  try{
    var markId = EXAM_ID+"_"+r.class_id+"_"+r.student_id;
    var markDoc = await getDocById(col.marks, markId);
    if (markDoc && markDoc.subject_marks){
      store.subjects.forEach(function(sub){
        var m = markDoc.subject_marks[sub.id] || {};
        var tr = document.createElement("tr");
        tr.innerHTML =
          "<td>"+(sub.code || sub.id)+" — "+sub.name+"</td>"+
          "<td>"+(m.ca   != null ? m.ca   : "")+"</td>"+
          "<td>"+(m.exam != null ? m.exam : "")+"</td>"+
          "<td>"+(m.total!= null ? m.total: "")+"</td>";
        tbody.appendChild(tr);
      });
    }else{
      tbody.innerHTML = "<tr><td colspan='4'>No subject breakdown found for this report.</td></tr>";
    }
  }catch(err){
    console.error("openReport marks error:", err);
    tbody.innerHTML = "<tr><td colspan='4'>Error loading subject marks.</td></tr>";
  }

  // BEHAVIOUR
  try{
    var behId  = EXAM_ID+"_"+r.class_id+"_"+r.student_id;
    var behDoc = await getDocById(col.behaviour, behId);

    if (behDoc && behDoc.ratings){
      var rt = behDoc.ratings;
      var lines = [];

      if (rt.discipline != null)
        lines.push("Discipline: "+behaviourLabel(rt.discipline)+" ("+rt.discipline+"/5)");
      if (rt.cleanliness != null)
        lines.push("Personal Cleanliness: "+behaviourLabel(rt.cleanliness)+" ("+rt.cleanliness+"/5)");
      if (rt.diligence != null)
        lines.push("Diligence: "+behaviourLabel(rt.diligence)+" ("+rt.diligence+"/5)");
      if (rt.punctuality != null)
        lines.push("Punctuality: "+behaviourLabel(rt.punctuality)+" ("+rt.punctuality+"/5)");
      if (rt.cooperation != null)
        lines.push("Cooperation: "+behaviourLabel(rt.cooperation)+" ("+rt.cooperation+"/5)");
      if (rt.academics != null)
        lines.push("Academic Attitude: "+behaviourLabel(rt.academics)+" ("+rt.academics+"/5)");
      if (rt.sports != null)
        lines.push("Sports & Activities: "+behaviourLabel(rt.sports)+" ("+rt.sports+"/5)");
      if (rt.care != null)
        lines.push("Care for School Property: "+behaviourLabel(rt.care)+" ("+rt.care+"/5)");
      if (rt.honesty != null)
        lines.push("Honesty: "+behaviourLabel(rt.honesty)+" ("+rt.honesty+"/5)");

      $("rpBehaviour").innerHTML = lines.length ? lines.join("<br>") : "Not recorded.";
      $("rpTeacherComment").textContent = behDoc.teacher_comment || "Not recorded.";
      $("rpHeadComment").textContent    = behDoc.head_comment    || "Not recorded.";
    }else{
      $("rpBehaviour").textContent      = "Not recorded.";
      $("rpTeacherComment").textContent = "Not recorded.";
      $("rpHeadComment").textContent    = "Not recorded.";
    }
  }catch(err2){
    console.error("openReport behaviour error:", err2);
    $("rpBehaviour").textContent      = "Error loading behaviour.";
    $("rpTeacherComment").textContent = "";
    $("rpHeadComment").textContent    = "";
  }

  $("reportOverlay").classList.remove("hidden");
}

/* ========== INIT & EVENTS ========== */
document.addEventListener("DOMContentLoaded", function(){
  (async function init(){
    await refreshStore();
    fillClassFilter();
    applyFilters();

    if ($("filterBtn")) $("filterBtn").onclick = applyFilters;
    if ($("searchBox")) $("searchBox").onkeyup = function(e){
      if (e.key === "Enter") applyFilters();
    };

    var closeBtn = $("closeReportBtn");
    if (closeBtn){
      closeBtn.onclick = function(){
        $("reportOverlay").classList.add("hidden");
      };
    }
    var overlay = $("reportOverlay");
    if (overlay){
      overlay.addEventListener("click", function(e){
        if (e.target === overlay) overlay.classList.add("hidden");
      });
    }

    var printBtn = $("printBtn");
    if (printBtn){
      printBtn.onclick = function(){
        window.print();
      };
    }

    var logoutBtn = $("logoutBtn");
    if (logoutBtn){
      logoutBtn.onclick = function(){
        auth.signOut().then(function(){
          window.location.href = "index.html";
        });
      };
    }
  })();
});
