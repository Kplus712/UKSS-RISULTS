// js/ranking.js
// Class ranking printing view (Top 10 & Last 10)

var $ = function(id){ return document.getElementById(id); };

function toastLog(msg){
  console.log("[RANK]", msg);
}

/* ===== GET QUERY PARAMS ===== */
function getQuery(){
  var q = new URLSearchParams(window.location.search);
  return {
    examId: q.get("exam") || "",     // exam code, eg. annual_2025
    classId: q.get("class") || "",   // class ID
    view: q.get("view") || "all"
  };
}

/* ===== MAIN INIT ===== */
auth.onAuthStateChanged(function(user){
  if (!user){
    // ukifungulia bila login, mrudishe login
    window.location.href = "index.html";
    return;
  }
  initRanking();
});

async function initRanking(){
  try{
    var query = getQuery();
    if (!query.examId || !query.classId){
      alert("Missing exam or class in URL. Tafadhali fungua page hii kupitia Academic → Top 10 & Last.");
      return;
    }

    // weka meta text
    var now = new Date();
    if ($("metaPrinted")){
      $("metaPrinted").textContent = now.toLocaleString();
    }
    $("viewMode").value = query.view || "all";

    $("viewMode").onchange = function(){
      renderRanking(currentList, $("viewMode").value);
    };

    // load data
    var res = await Promise.all([
      getAll(col.classes),
      getAll(col.students),
      getAll(col.report_cards),
      getAll(col.exams || "exams")
    ]);

    var classes  = res[0];
    var students = res[1];
    var reports  = res[2];
    var exams    = res[3];

    var cls = classes.find(function(c){ return c.id === query.classId; }) || {};
    var ex  = exams.find(function(e){ return e.id === query.examId; }) || { id: query.examId, name: query.examId };

    if ($("metaExam"))  $("metaExam").textContent  = ex.name || ex.id;
    if ($("metaClass")) $("metaClass").textContent = cls.name || cls.id || query.classId;
    if ($("rankExamTitle")){
      $("rankExamTitle").textContent =
        "FORM "+(cls.level || "")+" "+(ex.name || ex.id).toUpperCase()+" — CLASS RANKING";
    }

    // filter report_cards kwa exam + class
    var list = reports.filter(function(r){
      var okExam  = (!r.exam_id && r.exam === query.examId) || r.exam_id === query.examId;
      var okClass = r.class_id === query.classId;
      return okExam && okClass;
    });

    if (!list.length){
      var tbody = $("rankingTable").querySelector("tbody");
      tbody.innerHTML = "<tr><td colspan='11' style='text-align:center;'>Hakuna report cards kwa exam/class hii. Hakikisha ume-run Generate Reports.</td></tr>";
      return;
    }

    // join na students
    list = list.map(function(r){
      var stu = students.find(function(s){ return s.id === r.student_id; }) || {};
      var clsName = cls.name || r.class_name || query.classId;
      return {
        id: r.id,
        admission_no: r.admission_no || "",
        name: (stu.first_name || "")+" "+(stu.last_name || ""),
        sex: stu.gender || "",
        class_name: clsName,
        total: r.total_marks || 0,
        mean: r.mean_score || 0,
        grade: r.grade || "",
        position: 0,       // tutaweka baada ya sort
        remark: r.remark || ""
      };
    });

    // sort by total desc
    list.sort(function(a,b){
      if (b.total !== a.total) return b.total - a.total;
      return (a.admission_no+"").localeCompare(b.admission_no+"");
    });

    // assign positions (ties = same position)
    var currentPos = 0;
    var lastTotal  = null;
    list.forEach(function(item, idx){
      if (item.total !== lastTotal){
        currentPos = idx + 1;
        lastTotal = item.total;
      }
      item.position = currentPos;
    });

    window.currentList = list; // store globally for re-render
    if ($("metaTotal")) $("metaTotal").textContent = String(list.length);

    renderRanking(list, query.view || "all");
  }catch(err){
    console.error("initRanking error:", err);
    alert("Imeshindikana kupakia ranking. Angalia console.");
  }
}

/* ===== RENDER TABLE ===== */
function renderRanking(list, viewMode){
  var tbody = $("rankingTable").querySelector("tbody");
  if (!list || !list.length){
    tbody.innerHTML = "<tr><td colspan='11' style='text-align:center;'>No data.</td></tr>";
    return;
  }

  var rows = list.slice(); // copy

  if (viewMode === "top_last"){
    var top = rows.slice(0, 10);
    var last = rows.slice(-10);
    rows = top.concat(last);
  }

  tbody.innerHTML = "";
  rows.forEach(function(item, index){
    var tr = document.createElement("tr");

    var flagHTML = "";
    if (viewMode === "top_last"){
      if (item.position <= 10){
        flagHTML = "<span class='tag-top'>TOP "+item.position+"</span>";
      }else if (item.position >= list.length - 9){
        flagHTML = "<span class='tag-last'>LAST</span>";
      }
    }

    tr.innerHTML =
      "<td style='text-align:center;'>"+(index+1)+"</td>"+
      "<td>"+item.admission_no+"</td>"+
      "<td>"+item.name+"</td>"+
      "<td style='text-align:center;'>"+item.sex+"</td>"+
      "<td style='text-align:center;'>"+item.class_name+"</td>"+
      "<td style='text-align:right;'>"+item.total+"</td>"+
      "<td style='text-align:right;'>"+item.mean.toFixed ? item.mean.toFixed(2) : item.mean+"</td>"+
      "<td style='text-align:center;'>"+item.grade+"</td>"+
      "<td style='text-align:center;'>"+item.position+"</td>"+
      "<td>"+(item.remark || "")+"</td>"+
      "<td style='text-align:center;'>"+flagHTML+"</td>";

    tbody.appendChild(tr);
  });
}

