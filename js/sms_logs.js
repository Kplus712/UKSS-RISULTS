// js/sms_logs.js
// View sms_logs collection

var $ = function(id){ return document.getElementById(id); };

var store = {
  classes: [],
  logs: []
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
      getAll(col.sms_logs)
    ]);
    store.classes = res[0];
    store.logs    = res[1];
  }catch(err){
    console.error("sms_logs refresh error:", err);
    toast("Imeshindikana kusoma sms logs.");
  }
}

/* ===== FILL CLASS FILTER ===== */
function fillClassFilter(){
  var sel = $("classSelect");
  if (!sel) return;
  var opts = ['<option value="">All classes</option>'];
  store.classes.forEach(function(c){
    opts.push('<option value="'+c.id+'">'+c.name+'</option>');
  });
  sel.innerHTML = opts.join("");
}

/* ===== APPLY FILTERS ===== */
function applyFilters(){
  var examId  = $("examSelect").value;
  var classId = $("classSelect").value;
  var q       = ($("searchBox").value || "").toLowerCase();

  var list = store.logs.filter(function(l){
    if (examId && l.exam_id !== examId) return false;
    if (classId && l.class_id !== classId) return false;

    if (q){
      var hay = (
        (l.student_name || "") + " " +
        (l.admission_no || "") + " " +
        (l.phone || "")
      ).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  renderTable(list);
}

/* ===== RENDER TABLE ===== */
function renderTable(list){
  var tbody = $("logsTable").querySelector("tbody");
  tbody.innerHTML = "";

  if (!list.length){
    tbody.innerHTML = '<tr><td colspan="7">No logs for this filter.</td></tr>';
    return;
  }

  // sort newest first
  list.sort(function(a,b){
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });

  list.forEach(function(l){
    var cls = store.classes.find(function(c){ return c.id === l.class_id; }) || {};
    var d = l.created_at ? new Date(l.created_at) : null;
    var dText = d ? d.toLocaleString() : "-";

    var tr = document.createElement("tr");
    tr.innerHTML =
      "<td>"+dText+"</td>"+
      "<td>"+(l.exam_id || "")+"</td>"+
      "<td>"+(cls.name || "")+"</td>"+
      "<td>"+(l.admission_no || "")+"</td>"+
      "<td>"+(l.student_name || "")+"</td>"+
      "<td>"+(l.phone || "")+"</td>"+
      "<td style='max-width:260px;font-size:12px;'>"+(l.message || "").slice(0,120)+"</td>";
    tbody.appendChild(tr);
  });
}

/* ===== INIT ===== */
document.addEventListener("DOMContentLoaded", function(){
  (async function init(){
    await refreshStore();
    fillClassFilter();
    applyFilters();

    if ($("filterBtn")) $("filterBtn").onclick = applyFilters;
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
