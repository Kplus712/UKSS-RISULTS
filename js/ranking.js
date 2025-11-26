// js/ranking.js
// Top 10 & Last 10 based on report_cards.mean_score

var EXAM_ID = "annual_2025";
var $ = function(id){ return document.getElementById(id); };

var store = {
  classes: [],
  students: [],
  reports: []
};

/* ===== AUTH GUARD ===== */
auth.onAuthStateChanged(function(user){
  if (!user){
    window.location.href = "index.html";
  }
});

/* ===== TOAST ===== */
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

/* ===== LOAD DATA ===== */
async function refreshStore(){
  try{
    var res = await Promise.all([
      getAll(col.classes),
      getAll(col.students),
      getAll(col.report_cards)
    ]);
    store.classes  = res[0];
    store.students = res[1];
    store.reports  = res[2];
  }catch(err){
    console.error("refreshStore ranking error:", err);
    toast("Imeshindikana kusoma data za ranking.");
  }
}

/* ===== SELECTORS ===== */
function fillClassSelect(){
  var sel = $("classSelect");
  if (!sel) return;
  if (!store.classes.length){
    sel.innerHTML = '<option value="">No classes</option>';
    return;
  }
  sel.innerHTML = store.classes
    .map(function(c){ return '<option value="'+c.id+'">'+c.name+'</option>'; })
    .join("");
}

/* ===== RENDER HELPERS ===== */
function renderTable(tbodyEl, list, isTop){
  tbodyEl.innerHTML = "";
  if (!list.length){
    tbodyEl.innerHTML =
      '<tr><td colspan="7">'+(isTop ? "No students for this filter." : "No students for this filter.")+'</td></tr>';
    return;
  }

  list.forEach(function(r, idx){
    var stu = store.students.find(function(s){ return s.id === r.student_id; }) || {};
    var cls = store.classes.find(function(c){ return c.id === r.class_id; }) || {};

    var tr = document.createElement("tr");
    tr.innerHTML =
      "<td>"+(idx+1)+"</td>"+
      "<td>"+(r.admission_no || "")+"</td>"+
      "<td>"+(stu.first_name || "")+" "+(stu.last_name || "")+"</td>"+
      "<td>"+(cls.name || "")+"</td>"+
      "<td>"+(r.total_marks || "")+"</td>"+
      "<td>"+(r.mean_score || "")+"</td>"+
      "<td>"+(r.grade || "")+"</td>";
    tbodyEl.appendChild(tr);
  });
}

/* ===== BUILD RANKING ===== */
function buildRanking(){
  var examId  = ($("examSelect") || {}).value || EXAM_ID;
  var classId = ($("classSelect") || {}).value;

  if (!classId){
    toast("Chagua class kwanza.");
    return;
  }

  // chukua reports za exam + class husika
  var list = store.reports.filter(function(r){
    if (r.exam_id && r.exam_id !== examId) return false;
    return r.class_id === classId;
  });

  if (!list.length){
    toast("Hakuna report cards kwa exam hii na class hiyo. Generate reports kwenye Marks.");
  }

  // sort kwa mean_score descending
  list.sort(function(a,b){
    return (b.mean_score || 0) - (a.mean_score || 0);
  });

  var top10  = list.slice(0,10);
  var last10 = list.slice().reverse().slice(0,10);

  var topBody  = $("topTable").querySelector("tbody");
  var lastBody = $("lastTable").querySelector("tbody");

  renderTable(topBody,  top10,  true);
  renderTable(lastBody, last10, false);
}

/* ===== INIT ===== */
document.addEventListener("DOMContentLoaded", function(){
  (async function init(){
    await refreshStore();
    fillClassSelect();

    if ($("applyBtn")) $("applyBtn").onclick = buildRanking;
    if ($("classSelect")) $("classSelect").onchange = buildRanking;

    var logoutBtn = $("logoutBtn");
    if (logoutBtn){
      logoutBtn.onclick = function(){
        auth.signOut().then(function(){
          window.location.href = "index.html";
        });
      };
    }

    // load default ranking kama kuna class ya kwanza
    if (store.classes.length){
      $("classSelect").value = store.classes[0].id;
      buildRanking();
    }
  })();
});
