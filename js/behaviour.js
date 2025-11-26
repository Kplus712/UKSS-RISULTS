// js/behaviour.js
// Behaviour & comments per student, per exam

var EXAM_ID = "annual_2025";
var $ = function(id){ return document.getElementById(id); };

var store = {
  classes: [],
  students: []
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

/* ===== LOAD CLASSES/STUDENTS ===== */
async function refreshStore(){
  try{
    var res = await Promise.all([
      getAll(col.classes),
      getAll(col.students)
    ]);
    store.classes  = res[0];
    store.students = res[1];
  }catch(err){
    console.error("behaviour refreshStore error:", err);
    toast("Imeshindikana kusoma data (behaviour).");
  }
}

/* ===== FILL SELECTS ===== */
function fillClassSelect(){
  var sel = $("bhClass");
  if (!sel) return;
  if (!store.classes.length){
    sel.innerHTML = '<option value="">No classes</option>';
    return;
  }
  sel.innerHTML = store.classes
    .map(function(c){ return '<option value="'+c.id+'">'+c.name+'</option>'; })
    .join("");
}

function fillStudentSelect(){
  var sel = $("bhStudent");
  if (!sel) return;
  var classId = ($("bhClass") || {}).value;
  if (!classId){
    sel.innerHTML = '<option value="">Select class first</option>';
    return;
  }
  var list = store.students.filter(function(s){ return s.class_id === classId; });
  if (!list.length){
    sel.innerHTML = '<option value="">No students in this class</option>';
    return;
  }
  sel.innerHTML = list
    .map(function(s){
      return '<option value="'+s.id+'">'+(s.admission_no || "")+' — '+s.first_name+' '+s.last_name+'</option>';
    })
    .join("");
}

/* ===== CLEAR FORM ===== */
function clearForm(){
  var ids = [
    "bh_discipline","bh_cleanliness","bh_diligence","bh_punctuality",
    "bh_cooperation","bh_academics","bh_sports","bh_care","bh_honesty"
  ];
  ids.forEach(function(id){
    var el = $(id);
    if (el) el.value = "";
  });
  if ($("bh_teacher_comment")) $("bh_teacher_comment").value = "";
  if ($("bh_head_comment"))    $("bh_head_comment").value    = "";
}

/* ===== LOAD BEHAVIOUR FOR SELECTED STUDENT ===== */
async function loadBehaviour(){
  var examId = ($("bhExam") || {}).value || EXAM_ID;
  var classId = ($("bhClass") || {}).value;
  var studentId = ($("bhStudent") || {}).value;

  if (!classId || !studentId){
    toast("Chagua class na student kwanza.");
    return;
  }

  clearForm();

  var id = examId+"_"+classId+"_"+studentId;
  try{
    var doc = await getDocById(col.behaviour, id);
    if (!doc){
      toast("Hakuna behaviour iliyohifadhiwa bado.");
      return;
    }
    var r = doc.ratings || {};
    if ($("bh_discipline"))   $("bh_discipline").value   = r.discipline   != null ? r.discipline   : "";
    if ($("bh_cleanliness"))  $("bh_cleanliness").value  = r.cleanliness  != null ? r.cleanliness  : "";
    if ($("bh_diligence"))    $("bh_diligence").value    = r.diligence    != null ? r.diligence    : "";
    if ($("bh_punctuality"))  $("bh_punctuality").value  = r.punctuality  != null ? r.punctuality  : "";
    if ($("bh_cooperation"))  $("bh_cooperation").value  = r.cooperation  != null ? r.cooperation  : "";
    if ($("bh_academics"))    $("bh_academics").value    = r.academics    != null ? r.academics    : "";
    if ($("bh_sports"))       $("bh_sports").value       = r.sports       != null ? r.sports       : "";
    if ($("bh_care"))         $("bh_care").value         = r.care         != null ? r.care         : "";
    if ($("bh_honesty"))      $("bh_honesty").value      = r.honesty      != null ? r.honesty      : "";

    if ($("bh_teacher_comment")) $("bh_teacher_comment").value = doc.teacher_comment || "";
    if ($("bh_head_comment"))    $("bh_head_comment").value    = doc.head_comment    || "";

    toast("Behaviour imefunguliwa.");
  }catch(err){
    console.error("loadBehaviour error:", err);
    toast("Imeshindikana kusoma behaviour ya mwanafunzi.");
  }
}

/* ===== SAVE BEHAVIOUR ===== */
async function saveBehaviour(){
  var examId = ($("bhExam") || {}).value || EXAM_ID;
  var classId = ($("bhClass") || {}).value;
  var studentId = ($("bhStudent") || {}).value;

  if (!classId || !studentId){
    toast("Chagua class na student kwanza.");
    return;
  }

  function toNum(id){
    var el = $(id);
    if (!el || !el.value) return null;
    var n = Number(el.value);
    return isNaN(n) ? null : n;
  }

  var ratings = {
    discipline:   toNum("bh_discipline"),
    cleanliness:  toNum("bh_cleanliness"),
    diligence:    toNum("bh_diligence"),
    punctuality:  toNum("bh_punctuality"),
    cooperation:  toNum("bh_cooperation"),
    academics:    toNum("bh_academics"),
    sports:       toNum("bh_sports"),
    care:         toNum("bh_care"),
    honesty:      toNum("bh_honesty")
  };

  var teacherComment = ($("bh_teacher_comment") || {}).value || "";
  var headComment    = ($("bh_head_comment")    || {}).value || "";

  var id = examId+"_"+classId+"_"+studentId;

  try{
    await setDocById(col.behaviour, id, {
      id: id,
      exam_id: examId,
      class_id: classId,
      student_id: studentId,
      ratings: ratings,
      teacher_comment: teacherComment,
      head_comment: headComment,
      updated_at: new Date().toISOString()
    });
    toast("Behaviour imehifadhiwa.");
  }catch(err){
    console.error("saveBehaviour error:", err);
    toast("Imeshindikana kuhifadhi behaviour.");
  }
}

/* ===== INIT ===== */
document.addEventListener("DOMContentLoaded", function(){
  (async function init(){
    await refreshStore();
    fillClassSelect();
    fillStudentSelect();

    var clsSel = $("bhClass");
    if (clsSel){
      clsSel.onchange = fillStudentSelect;
    }

    if ($("bhLoadBtn")) $("bhLoadBtn").onclick = loadBehaviour;
    if ($("bhSaveBtn")) $("bhSaveBtn").onclick = saveBehaviour;
    if ($("bhClearBtn")) $("bhClearBtn").onclick = clearForm;

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
