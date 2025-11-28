// js/academic.js
// Academic Officer dashboard: exams, approve students, print views

var $ = function(id){ return document.getElementById(id); };

/* Simple toast */
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

var EXAMS_COL = col.exams || "exams";

/* ===== AUTH GUARD ===== */
auth.onAuthStateChanged(function(user){
  if (!user){
    window.location.href = "index.html";
    return;
  }
  initAcademic(user);
});

async function initAcademic(user){
  try{
    // soma staff doc yake
    var snap = await db.collection(col.staff).doc(user.uid).get();
    var staff = snap.exists ? snap.data() : {};
    var role  = staff.role || "none";
    var active = (staff.active !== false);

    var roleInfo = $("roleInfo");
    var roleWarning = $("roleWarning");

    if (roleInfo){
      roleInfo.textContent = "Logged in as: " + (staff.name || user.email) +
        " — Role: " + (role.toUpperCase()) +
        (active ? "" : " (INACTIVE)");
    }

    var allowed = active && (role === "academic" || role === "headmaster" || role === "admin");

    if (!allowed){
      if (roleWarning){
        roleWarning.textContent =
          "Akaunti yako haina ruhusa ya Academic Officer. Mwone Admin/Headmaster wakubadilishie role kuwa 'academic'.";
      }
      // usiendelee na features
      return;
    }else{
      if (roleWarning) roleWarning.textContent = "";
    }

    // attach logout
    var logoutBtn = $("logoutBtn");
    if (logoutBtn){
      logoutBtn.onclick = function(){
        auth.signOut().then(function(){
          window.location.href = "index.html";
        });
      };
    }

    // load data za mwanzo
    await Promise.all([
      loadExams(),
      loadClassesForFilters(),
      loadPendingStudents()
    ]);

    attachEventHandlers();
  }catch(err){
    console.error("initAcademic error:", err);
    toast("Academic dashboard error. Angalia console.");
  }
}

/* ===== EVENT HANDLERS ===== */
function attachEventHandlers(){
  var addExamBtn = $("addExamBtn");
  if (addExamBtn){
    addExamBtn.onclick = saveExam;
  }

  var setCurrentBtn = $("setCurrentExamBtn");
  if (setCurrentBtn){
    setCurrentBtn.onclick = setCurrentExamFromInputs;
  }

  var reloadPendingBtn = $("reloadPendingBtn");
  if (reloadPendingBtn){
    reloadPendingBtn.onclick = loadPendingStudents;
  }

  var openTopLastBtn = $("openTopLastBtn");
  if (openTopLastBtn){
    openTopLastBtn.onclick = openTopLastView;
  }

  var openReportFormBtn = $("openReportFormBtn");
  if (openReportFormBtn){
    openReportFormBtn.onclick = openReportFormView;
  }

  var openSchoolResultsBtn = $("openSchoolResultsBtn");
  if (openSchoolResultsBtn){
    openSchoolResultsBtn.onclick = openSchoolResultsView;
  }
}

/* =================================
   1) EXAMS: LOAD & SAVE / SET CURRENT
   ================================= */
async function loadExams(){
  var tbody = $("examsTable").querySelector("tbody");
  tbody.innerHTML = "<tr><td colspan='7'>Loading exams...</td></tr>";

  try{
    var list = await getAll(EXAMS_COL); // -> [{id,...}]
    if (!list.length){
      tbody.innerHTML = "<tr><td colspan='7'>No exams registered yet.</td></tr>";
      return;
    }

    // sort by year desc
    list.sort(function(a,b){
      return (b.year || 0) - (a.year || 0);
    });

    // find current exam
    var current = list.find(function(e){ return e.current === true; }) || null;

    tbody.innerHTML = "";
    list.forEach(function(ex){
      var tr = document.createElement("tr");

      var isCurrent = current && current.id === ex.id;

      tr.innerHTML =
        "<td>"+(isCurrent ? "✔" : "")+"</td>"+
        "<td>"+(ex.id || "")+"</td>"+
        "<td>"+(ex.name || "")+"</td>"+
        "<td>"+(ex.level || "")+"</td>"+
        "<td>"+(ex.term  || "")+"</td>"+
        "<td>"+(ex.year  || "")+"</td>"+
        "<td style='font-size:12px'>"+(ex.created_at || "")+"</td>";

      tbody.appendChild(tr);
    });

    // pia fill selects za print exam
    var printExamSel = $("printExamSelect");
    if (printExamSel){
      printExamSel.innerHTML = list.map(function(ex){
        var sel = (ex.current ? " selected" : "");
        return "<option value='"+(ex.id || "")+"'"+sel+">"+(ex.name || ex.id)+"</option>";
      }).join("");
    }
  }catch(err){
    console.error("loadExams error:", err);
    tbody.innerHTML = "<tr><td colspan='7'>Imeshindikana kusoma mitihani.</td></tr>";
  }
}

async function saveExam(){
  try{
    var code = ($("exCode") || {}).value || "";
    var name = ($("exName") || {}).value || "";
    var level = ($("exLevel") || {}).value || "all";
    var term  = ($("exTerm")  || {}).value || "";
    var year  = parseInt(($("exYear") || {}).value || "0", 10);

    if (!code.trim() || !name.trim()){
      toast("Weka Exam Code na Exam Name kwanza.");
      return;
    }
    if (!year){
      toast("Weka year sahihi (mfano 2025).");
      return;
    }

    var data = {
      id: code.trim(),
      name: name.trim(),
      level: level,
      term: term,
      year: year,
      created_at: new Date().toISOString()
    };

    await db.collection(EXAMS_COL).doc(code.trim()).set(data, { merge:true });
    toast("Exam "+code+" imehifadhiwa.");

    var status = $("examStatus");
    if (status) status.textContent = "Exam saved.";

    await loadExams();
  }catch(err){
    console.error("saveExam error:", err);
    toast("Imeshindikana kuhifadhi exam.");
  }
}

async function setCurrentExamFromInputs(){
  var code = ($("exCode") || {}).value || "";
  code = code.trim();
  if (!code){
    toast("Chagua / andika Exam Code ya kuweka kama current.");
    return;
  }
  await setCurrentExam(code);
}

async function setCurrentExam(code){
  try{
    var list = await getAll(EXAMS_COL);
    var batch = db.batch();

    list.forEach(function(ex){
      var ref = db.collection(EXAMS_COL).doc(ex.id);
      batch.set(ref, { current: (ex.id === code) }, { merge:true });
    });

    await batch.commit();
    toast("Exam "+code+" imewekwa kama CURRENT.");
    var status = $("examStatus");
    if (status) status.textContent = "Current exam: "+code;
    await loadExams();
  }catch(err){
    console.error("setCurrentExam error:", err);
    toast("Imeshindikana kubadilisha current exam.");
  }
}

/* ====================================
   2) APPROVE STUDENTS REGISTRATION
   ==================================== */
async function loadClassesForFilters(){
  try{
    var classes = await getAll(col.classes);
    var classSel = $("approveClassFilter");
    var printClassSel = $("printClassSelect");

    var options = '<option value="all">All classes</option>';
    classes.forEach(function(c){
      options += '<option value="'+c.id+'">'+(c.name || c.id)+'</option>';
    });

    if (classSel) classSel.innerHTML = options;
    if (printClassSel) printClassSel.innerHTML = options;
  }catch(err){
    console.error("loadClassesForFilters error:", err);
  }
}

async function loadPendingStudents(){
  var tbody = $("pendingStudentsTable").querySelector("tbody");
  tbody.innerHTML = "<tr><td colspan='7'>Loading pending students...</td></tr>";

  try{
    var selectedClass = ($("approveClassFilter") || {}).value || "all";
    var all = await getAll(col.students);

    // pending = approved == false OR field missing
    var pending = all.filter(function(s){
      var appr = (s.approved === true);
      if (appr) return false;
      if (selectedClass !== "all" && s.class_id !== selectedClass) return false;
      return true;
    });

    if (!pending.length){
      tbody.innerHTML = "<tr><td colspan='7'>No pending students.</td></tr>";
      return;
    }

    // sort by class then admission_no
    pending.sort(function(a,b){
      var ca = a.class_id || "";
      var cb = b.class_id || "";
      if (ca < cb) return -1;
      if (ca > cb) return 1;
      var aa = (a.admission_no || "").toString();
      var bb = (b.admission_no || "").toString();
      return aa.localeCompare(bb);
    });

    tbody.innerHTML = "";
    pending.forEach(function(s){
      var name = (s.first_name || "") + " " + (s.last_name || "");
      var cls  = s.class_name || s.class_id || "";
      var gender = s.gender || "";
      var phone  = s.guardian_phone || "";

      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>"+(s.admission_no || "")+"</td>"+
        "<td>"+name+"</td>"+
        "<td>"+cls+"</td>"+
        "<td>"+gender+"</td>"+
        "<td>"+phone+"</td>"+
        "<td>"+(s.approved ? "Approved" : "Pending")+"</td>"+
        "<td><button class='btn btn-primary btn-sm approveStudentBtn' data-id='"+s.id+"'>Approve</button></td>";

      tbody.appendChild(tr);
    });

    // attach buttons
    var buttons = document.querySelectorAll(".approveStudentBtn");
    Array.prototype.forEach.call(buttons, function(btn){
      btn.onclick = function(){
        var id = btn.dataset.id;
        approveStudent(id);
      };
    });
  }catch(err){
    console.error("loadPendingStudents error:", err);
    tbody.innerHTML = "<tr><td colspan='7'>Imeshindikana kusoma wanafunzi.</td></tr>";
  }
}

async function approveStudent(studentId){
  try{
    await db.collection(col.students).doc(studentId).set(
      { approved:true, approved_at:new Date().toISOString() },
      { merge:true }
    );
    toast("Student approved.");
    await loadPendingStudents();
  }catch(err){
    console.error("approveStudent error:", err);
    toast("Imeshindikana ku-approve mwanafunzi.");
  }
}

/* ====================================
   3) PRINTING / ANALYSIS — OPEN VIEWS
   ==================================== */
function getSelectedExamAndClass(){
  var exam = ($("printExamSelect") || {}).value || "";
  var cls  = ($("printClassSelect") || {}).value || "";
  return { exam: exam, cls: cls };
}

// Top 10 & last students view (ranking)
function openTopLastView(){
  var sel = getSelectedExamAndClass();
  if (!sel.exam || !sel.cls){
    toast("Chagua Exam na Class kwanza.");
    return;
  }
  // ranking.html itasomea query parameters haya baadaye
  var url = "ranking.html?exam="+encodeURIComponent(sel.exam)+
            "&class="+encodeURIComponent(sel.cls)+
            "&view=top_last";
  window.open(url, "_blank");
}

// Individual report form
function openReportFormView(){
  var sel = getSelectedExamAndClass();
  if (!sel.exam || !sel.cls){
    toast("Chagua Exam na Class kwanza.");
    return;
  }
  // hapa tutatumia report.html ambayo tayari inaprint report card
  // tutaipangia ifanye filtering kwa exam & class kupitia query string
  var url = "report.html?exam="+encodeURIComponent(sel.exam)+
            "&class="+encodeURIComponent(sel.cls);
  window.open(url, "_blank");
}

// School results form (centre overall performance)
function openSchoolResultsView(){
  var sel = getSelectedExamAndClass();
  if (!sel.exam){
    toast("Chagua Exam kwanza.");
    return;
  }
  // kwa sasa tunafungua results.html, baadaye tutaandika school_results.html
  var url = "results.html?exam="+encodeURIComponent(sel.exam)+
            "&mode=centre";
  window.open(url, "_blank");
}
