// js/marks.js
// Marks entry — uses global auth, db, col, getAll, getDocById, setDocById from database.js

var EXAM_ID = "annual_2025";
var byId = function(id){ return document.getElementById(id); };

var store = {
  classes: [],
  students: [],
  subjects: []
};

// ============ AUTH GUARD ============ //
auth.onAuthStateChanged(function(user){
  if (!user){
    // mtu hajalogin → rudisha login page
    window.location.href = "index.html";
  }
});

// ============ TOAST ============ //
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

// ============ LOAD DATA ============ //
async function refreshStore(){
  var results = await Promise.all([
    getAll(col.classes),
    getAll(col.students),
    getAll(col.subjects)
  ]);
  store.classes  = results[0];
  store.students = results[1];
  store.subjects = results[2];
}

// ============ RENDER HELPERS ============ //
function renderClassSelect(){
  var sel = byId("classSelect");
  if (!store.classes.length){
    sel.innerHTML = '<option value="">No classes yet</option>';
    return;
  }
  sel.innerHTML = store.classes
    .map(function(c){ return '<option value="'+c.id+'">'+c.name+'</option>'; })
    .join("");
}

function renderSubjectsList(){
  var box = byId("subjectsList");
  if (!store.subjects.length){
    box.innerHTML = "No subjects yet.";
    return;
  }
  box.innerHTML = store.subjects
    .map(function(s){ return (s.code || s.id) + " — " + s.name; })
    .join("<br>");
}

function renderStudentsList(){
  var classId = byId("classSelect").value;
  var box = byId("studentsList");
  var list = store.students.filter(function(s){ return s.class_id === classId; });
  if (!list.length){
    box.innerHTML = "No students in this class.";
    return;
  }
  box.innerHTML = list
    .map(function(s){ return s.admission_no+" — "+s.first_name+" "+s.last_name; })
    .join("<br>");
}

// ============ MARKS TABLE ============ //
async function renderMatrix(){
  var classId   = byId("classSelect").value;
  var container = byId("marksMatrixWrap");
  container.innerHTML = "";

  var students = store.students.filter(function(s){ return s.class_id === classId; });
  var subjects = store.subjects;

  if (!classId || !students.length || !subjects.length){
    container.innerHTML = "<p class='small'>Add class, students and subjects to start entering marks.</p>";
    return;
  }

  var table = document.createElement("table");
  table.className = "table";

  var thead = document.createElement("thead");
  var hr    = document.createElement("tr");
  hr.innerHTML =
    "<th>Adm</th><th>Student</th>" +
    subjects.map(function(s){
      return "<th>"+(s.code || s.id)+"<br><span class='small'>"+s.name+"</span></th>";
    }).join("") +
    "<th>Total</th><th>Mean</th>";
  thead.appendChild(hr);
  table.appendChild(thead);

  var tbody = document.createElement("tbody");

  for (var i=0; i<students.length; i++){
    var stu = students[i];
    var row = document.createElement("tr");
    row.innerHTML = "<td>"+stu.admission_no+"</td><td>"+stu.first_name+" "+stu.last_name+"</td>";

    var sum = 0;

    for (var j=0; j<subjects.length; j++){
      var sub = subjects[j];
      var cell  = document.createElement("td");
      var docId = EXAM_ID+"_"+classId+"_"+stu.id;

      // eslint-disable-next-line no-await-in-loop
      var markDoc = await getDocById(col.marks, docId);
      var subj = (markDoc && markDoc.subject_marks && markDoc.subject_marks[sub.id]) ?
        markDoc.subject_marks[sub.id] : { ca:"", exam:"", total:0 };

      var caInput = document.createElement("input");
      caInput.className   = "input-inline";
      caInput.placeholder = "CA";
      caInput.value       = (subj.ca === null ? "" : subj.ca);

      var exInput = document.createElement("input");
      exInput.className   = "input-inline";
      exInput.placeholder = "EX";
      exInput.value       = (subj.exam === null ? "" : subj.exam);

      (function(classId, stuId, subjId, caInput, exInput){
        caInput.onchange = function(){
          saveMark(classId, stuId, subjId, caInput.value, exInput.value);
        };
        exInput.onchange = function(){
          saveMark(classId, stuId, subjId, caInput.value, exInput.value);
        };
      })(classId, stu.id, sub.id, caInput, exInput);

      cell.appendChild(caInput);
      cell.appendChild(document.createElement("br"));
      cell.appendChild(exInput);

      row.appendChild(cell);
      sum += subj.total || 0;
    }

    var totalCell = document.createElement("td");
    var meanCell  = document.createElement("td");

    var subjectsCount = subjects.length || 1;
    var mean = sum / subjectsCount;

    totalCell.textContent = sum.toFixed(0);
    meanCell.textContent  = mean.toFixed(2);

    row.appendChild(totalCell);
    row.appendChild(meanCell);
    tbody.appendChild(row);
  }

  table.appendChild(tbody);
  container.appendChild(table);
}

// ============ SAVE MARK ============ //
async function saveMark(classId, studentId, subjectId, caVal, exVal){
  var ca = (caVal === "") ? null : Number(caVal);
  var ex = (exVal === "") ? null : Number(exVal);

  if (ca !== null && (isNaN(ca) || ca < 0 || ca > 100)){
    toast("CA must be 0–100");
    return;
  }
  if (ex !== null && (isNaN(ex) || ex < 0 || ex > 100)){
    toast("EX must be 0–100");
    return;
  }

  var total = (ca || 0) + (ex || 0);
  if (total > 100){
    toast("CA + EX must not exceed 100");
    return;
  }

  var id       = EXAM_ID+"_"+classId+"_"+studentId;
  var existing = await getDocById(col.marks, id);
  var subjMarks = (existing && existing.subject_marks) ? existing.subject_marks : {};
  subjMarks[subjectId] = { ca:ca, exam:ex, total:total };

  await setDocById(col.marks, id, {
    id: id,
    exam_id: EXAM_ID,
    class_id: classId,
    student_id: studentId,
    subject_marks: subjMarks,
    updated_at: new Date().toISOString()
  });

  toast("Mark saved");
  await renderMatrix();
}

// ============ ADD CLASS/STUDENT/SUBJECT ============ //
async function addClass(){
  var name = prompt("Andika jina la darasa (mf. Form 1A):");
  if (!name) return;
  var id = name.toLowerCase().replace(/\s+/g,"_");
  await setDocById(col.classes, id, { id:id, name:name });
  toast("Class added");
  await refreshStore();
  renderClassSelect();
  renderStudentsList();
  await renderMatrix();
}

async function addStudent(){
  var cls   = byId("classSelect").value;
  var adm   = byId("stuAdmission").value.trim();
  var first = byId("stuFirst").value.trim();
  var last  = byId("stuLast").value.trim();
  var phone = byId("stuPhone").value.trim();

  if (!cls){ toast("Chagua darasa kwanza"); return; }
  if (!adm || !first || !last){ toast("Jaza admission, first na last name"); return; }

  var id = adm;
  await setDocById(col.students, id, {
    id:id,
    admission_no: adm,
    first_name: first,
    last_name:  last,
    class_id:   cls,
    guardian_phone: phone
  });

  byId("stuAdmission").value = "";
  byId("stuFirst").value     = "";
  byId("stuLast").value      = "";
  byId("stuPhone").value     = "";

  toast("Student added");
  await refreshStore();
  renderStudentsList();
  await renderMatrix();
}

async function addSubject(){
  var code = byId("subCode").value.trim().toUpperCase();
  var name = byId("subName").value.trim();
  if (!code || !name){
    toast("Jaza subject code na name");
    return;
  }
  await setDocById(col.subjects, code, { id:code, code:code, name:name });

  byId("subCode").value = "";
  byId("subName").value = "";

  toast("Subject added");
  await refreshStore();
  renderSubjectsList();
  await renderMatrix();
}

// ============ REPORTS (simple) ============ //
function gradeFromMean(m){
  if (m >= 80) return "A";
  if (m >= 65) return "B";
  if (m >= 50) return "C";
  if (m >= 35) return "D";
  return "E";
}

async function generateReports(){
  await refreshStore();
  var subjects = store.subjects;
  var classes  = store.classes;
  var students = store.students;

  for (var c=0;c<classes.length;c++){
    var cls = classes[c];
    var studs = students.filter(function(s){ return s.class_id === cls.id; });

    for (var k=0;k<studs.length;k++){
      var s = studs[k];
      var markId  = EXAM_ID+"_"+cls.id+"_"+s.id;
      // eslint-disable-next-line no-await-in-loop
      var markDoc = await getDocById(col.marks, markId);
      if (!markDoc || !markDoc.subject_marks) continue;

      var sum  = 0;
      var weak = [];
      for (var m=0;m<subjects.length;m++){
        var sub = subjects[m];
        var t = (markDoc.subject_marks[sub.id] && markDoc.subject_marks[sub.id].total) || 0;
        sum += t;
        if (t < 50) weak.push(sub.code || sub.id);
      }

      var mean  = subjects.length ? sum / subjects.length : 0;
      var grade = gradeFromMean(mean);
      var repId = s.id+"_"+EXAM_ID;

      // eslint-disable-next-line no-await-in-loop
      await setDocById(col.report_cards, repId, {
        id: repId,
        exam_id: EXAM_ID,
        class_id: cls.id,
        student_id: s.id,
        admission_no: s.admission_no,
        total_marks: sum,
        mean_score: Number(mean.toFixed(2)),
        grade: grade,
        weak_subjects: weak,
        generated_at: new Date().toISOString()
      });
    }
  }
  toast("Reports generated for all classes");
}

// ============ SAMPLE DATA ============ //
async function loadSample(){
  if (!confirm("Load sample data into Firestore?")) return;
  var cid = "form1a";
  await setDocById(col.classes, cid, { id:cid, name:"Form 1A" });

  await setDocById(col.subjects, "ENG",  { id:"ENG",  code:"ENG",  name:"English" });
  await setDocById(col.subjects, "MATH", { id:"MATH", code:"MATH", name:"Mathematics" });
  await setDocById(col.subjects, "BS",   { id:"BS",   code:"BS",   name:"Business Studies" });

  await setDocById(col.students, "ADM001", {
    id:"ADM001", admission_no:"ADM001", first_name:"Kelvin",
    last_name:"Deogratias", class_id:cid, guardian_phone:"0671866932"
  });
  await setDocById(col.students, "ADM002", {
    id:"ADM002", admission_no:"ADM002", first_name:"Amina",
    last_name:"Yusuf", class_id:cid, guardian_phone:"0710000002"
  });

  toast("Sample data loaded");
  await refreshStore();
  renderClassSelect();
  renderStudentsList();
  renderSubjectsList();
  await renderMatrix();
}

// ============ INIT ============ //
document.addEventListener("DOMContentLoaded", function(){
  (async function init(){
    await refreshStore();
    renderClassSelect();
    renderSubjectsList();
    renderStudentsList();
    await renderMatrix();

    byId("classSelect").onchange       = async function(){ renderStudentsList(); await renderMatrix(); };
    byId("addClassBtn").onclick        = addClass;
    byId("addStudentBtn").onclick      = addStudent;
    byId("addSubjectBtn").onclick      = addSubject;
    byId("generateReportsBtn").onclick = generateReports;
    byId("loadSampleBtn").onclick      = loadSample;

    var logoutBtn = byId("logoutBtn");
    if (logoutBtn){
      logoutBtn.onclick = function(){
        auth.signOut().then(function(){
          window.location.href = "index.html";
        });
      };
    }
  })();
});
