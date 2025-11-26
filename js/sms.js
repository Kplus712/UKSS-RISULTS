// js/sms.js
// Generate SMS texts from report_cards

var EXAM_ID = "annual_2025";
var $ = function(id){ return document.getElementById(id); };

var store = {
  classes: [],
  students: [],
  reports: []
};

var currentMessages = []; // kwa ku-save logs

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
    console.error("sms refreshStore error:", err);
    toast("Imeshindikana kusoma data (SMS).");
  }
}

/* ===== CLASS SELECT ===== */
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

/* ===== LOAD RECIPIENTS ===== */
function loadRecipients(){
  var examId = ($("examSelect") || {}).value || EXAM_ID;
  var classId = ($("classSelect") || {}).value;
  var filter = ($("recipientFilter") || {}).value || "all";

  var tbody = $("recipientsTable").querySelector("tbody");
  tbody.innerHTML = "";

  if (!classId){
    tbody.innerHTML = '<tr><td colspan="6">Chagua class kwanza.</td></tr>';
    return;
  }

  // reports za exam + class
  var list = store.reports.filter(function(r){
    if (r.exam_id && r.exam_id !== examId) return false;
    return r.class_id === classId;
  });

  if (!list.length){
    tbody.innerHTML = '<tr><td colspan="6">No report cards for this exam & class.</td></tr>';
    toast("Hakuna report cards, kwanza run Generate Reports kwenye Marks.");
    return;
  }

  var rows = [];

  list.forEach(function(r){
    var stu = store.students.find(function(s){ return s.id === r.student_id; }) || {};
    var cls = store.classes.find(function(c){ return c.id === r.class_id; }) || {};

    var grade = r.grade || "";
    if (filter === "weak" && !(grade === "D" || grade === "E")){
      return; // skip strong students
    }

    var phone = stu.guardian_phone || "";
    rows.push({
      report: r,
      student: stu,
      classObj: cls,
      phone: phone
    });
  });

  if (!rows.length){
    tbody.innerHTML = '<tr><td colspan="6">No students match this filter.</td></tr>';
    return;
  }

  rows.forEach(function(row, index){
    var r   = row.report;
    var stu = row.student;
    var cls = row.classObj;

    var tr = document.createElement("tr");
    tr.innerHTML =
      '<td><input type="checkbox" class="rowCheck" data-index="'+index+'" checked /></td>'+
      "<td>"+(r.admission_no || "")+"</td>"+
      "<td>"+(stu.first_name || "")+" "+(stu.last_name || "")+"</td>"+
      "<td>"+(cls.name || "")+"</td>"+
      "<td>"+(row.phone || "-")+"</td>"+
      "<td>"+(r.grade || "")+"</td>";
    tbody.appendChild(tr);
  });

  // hifadhi rows kwenye DOM dataset kwa matumizi ya generateSms
  tbody.dataset.rows = JSON.stringify(rows.map(function(row){
    return {
      reportId: row.report.id,
      studentId: row.student.id,
      classId: row.classObj.id,
      admission_no: row.report.admission_no,
      name: (row.student.first_name || "")+" "+(row.student.last_name || ""),
      class_name: row.classObj.name,
      phone: row.phone,
      total: row.report.total_marks,
      mean: row.report.mean_score,
      grade: row.report.grade,
      weak_subjects: row.report.weak_subjects || []
    };
  }));

  // select all checkbox
  var selectAll = $("selectAll");
  if (selectAll){
    selectAll.checked = true;
    selectAll.onchange = function(){
      var checks = document.querySelectorAll(".rowCheck");
      Array.prototype.forEach.call(checks, function(ch){
        ch.checked = selectAll.checked;
      });
    };
  }
}

/* ===== TEMPLATE HELPER ===== */
function buildMessage(tpl, data){
  var msg = tpl;
  var weak = (data.weak_subjects && data.weak_subjects.length)
    ? data.weak_subjects.join(", ")
    : "hakuna";

  var map = {
    "{name}": data.name || "",
    "{adm}": data.admission_no || "",
    "{class}": data.class_name || "",
    "{exam}": EXAM_ID,
    "{total}": data.total != null ? data.total : "",
    "{mean}": data.mean != null ? data.mean : "",
    "{grade}": data.grade || "",
    "{weak}": weak
  };

  Object.keys(map).forEach(function(tag){
    msg = msg.split(tag).join(String(map[tag]));
  });
  return msg.trim();
}

/* ===== GENERATE SMS ===== */
function generateSms(){
  var tbody = $("recipientsTable").querySelector("tbody");
  var rowsJson = tbody.dataset.rows;
  var tpl = ($("smsTemplate") || {}).value || "";

  if (!rowsJson){
    toast("Hakuna recipients. Bofya 'Load Recipients' kwanza.");
    return;
  }
  if (!tpl.trim()){
    toast("Andika SMS template kwanza.");
    return;
  }

  var rows = JSON.parse(rowsJson);
  var checks = document.querySelectorAll(".rowCheck");
  var messagesDiv = $("messagesList");
  messagesDiv.innerHTML = "";

  currentMessages = [];

  rows.forEach(function(row, index){
    var checked = checks[index] && checks[index].checked;
    if (!checked) return;

    var text = buildMessage(tpl, row);
    currentMessages.push({
      exam_id: EXAM_ID,
      class_id: row.classId,
      student_id: row.studentId,
      student_name: row.name,
      admission_no: row.admission_no,
      phone: row.phone,
      message: text
    });

    var wrapper = document.createElement("div");
    wrapper.style.marginBottom = "8px";
    wrapper.innerHTML =
      "<div class='small'><strong>"+row.name+"</strong> — "+(row.phone || "-")+"</div>"+
      "<div style='font-size:13px;white-space:pre-wrap;border:1px solid rgba(255,255,255,0.18);border-radius:8px;padding:6px 8px;margin-top:2px;'>"+
      text+
      "</div>";
    messagesDiv.appendChild(wrapper);
  });

  if (!currentMessages.length){
    messagesDiv.innerHTML = "No messages — angalia selections zako.";
    toast("Hakuna message zilizochaguliwa.");
  }else{
    toast("SMS "+currentMessages.length+" zimeandaliwa. Copy & paste kwenye app ya SMS.");
  }
}

/* ===== SAVE LOGS ===== */
async function saveLogs(){
  if (!currentMessages.length){
    toast("Hakuna SMS za ku-save. Generate SMS kwanza.");
    return;
  }

  try{
    for (var i=0;i<currentMessages.length;i++){
      var m = currentMessages[i];
      // eslint-disable-next-line no-await-in-loop
      await addCollectionDoc(col.sms_logs, {
        exam_id: m.exam_id,
        class_id: m.class_id,
        student_id: m.student_id,
        student_name: m.student_name,
        admission_no: m.admission_no,
        phone: m.phone,
        message: m.message,
        created_at: new Date().toISOString()
      });
    }
    toast("SMS logs saved ("+currentMessages.length+"). Angalia SMS Logs page.");
  }catch(err){
    console.error("saveLogs error:", err);
    toast("Imeshindikana ku-save sms logs.");
  }
}

/* ===== INIT ===== */
document.addEventListener("DOMContentLoaded", function(){
  (async function init(){
    await refreshStore();
    fillClassSelect();

    if ($("loadRecipientsBtn")) $("loadRecipientsBtn").onclick = loadRecipients;
    if ($("generateSmsBtn"))   $("generateSmsBtn").onclick = generateSms;
    if ($("saveLogsBtn"))      $("saveLogsBtn").onclick = saveLogs;

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

