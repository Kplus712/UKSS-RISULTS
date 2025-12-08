// js/sms.js
// UKSS — SMS Engine (Results + General) with Beem

// ===== DOM ELEMENTS =====
const messageTypeSelect = document.getElementById("messageType");
const classSelect       = document.getElementById("classSelect");
const examSelect        = document.getElementById("examSelect");
const recipientFilter   = document.getElementById("recipientFilter");
const loadRecipientsBtn = document.getElementById("loadRecipientsBtn");

const smsTemplate       = document.getElementById("smsTemplate");
const closeDateInput    = document.getElementById("closeDate");
const openDateInput     = document.getElementById("openDate");

const generateSmsBtn    = document.getElementById("generateSmsBtn");
const saveLogsBtn       = document.getElementById("saveLogsBtn");
const downloadCsvBtn    = document.getElementById("downloadCsvBtn");
const sendViaGatewayBtn = document.getElementById("sendViaGatewayBtn");

const recipientsTableBody = document.querySelector("#recipientsTable tbody");
const selectAllCheckbox   = document.getElementById("selectAll");
const messagesList        = document.getElementById("messagesList");
const statusBar           = document.getElementById("smsStatus");

// ===== STATE =====
const classesCol = db.collection("classes");

let subjects   = [];
let students   = [];
let results    = [];
let generatedMessages = [];

let currentClassId = null;
let currentExamId  = null;

// ===== STATUS BAR HELPER =====
function setSmsStatus(type, msg){
  if (!statusBar) return;
  statusBar.classList.remove("hidden","status-info","status-success","status-error");

  if (!msg){
    statusBar.classList.add("hidden");
    statusBar.textContent = "";
    return;
  }

  if (type === "success") statusBar.classList.add("status-success");
  else if (type === "error") statusBar.classList.add("status-error");
  else statusBar.classList.add("status-info");

  statusBar.textContent = msg;
}

// ========================== LOAD CLASSES & EXAMS ==========================
async function loadClasses(){
  const snap = await classesCol.orderBy("name").get();
  classSelect.innerHTML = "";
  snap.forEach(doc=>{
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = doc.data().name;
    classSelect.appendChild(opt);
  });

  if (classSelect.value) {
    currentClassId = classSelect.value;
    await loadExams();
  }
}

async function loadExams(){
  examSelect.innerHTML = "";
  const snap = await classesCol
    .doc(currentClassId)
    .collection("exams")
    .orderBy("createdAt","asc")
    .get();

  snap.forEach(doc=>{
    const data = doc.data();
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = data.displayName || data.name || doc.id;
    examSelect.appendChild(opt);
  });

  currentExamId = examSelect.value || null;
}

classSelect.addEventListener("change", async ()=>{
  currentClassId = classSelect.value;
  await loadExams();
});

// ========================== LOAD SUBJECTS & STUDENTS ==========================
async function loadSubjects(){
  const snap = await classesCol
    .doc(currentClassId)
    .collection("subjects")
    .orderBy("code")
    .get();

  subjects = snap.docs.map(d=>d.data());
}

async function loadStudents(){
  const snap = await classesCol
    .doc(currentClassId)
    .collection("students")
    .orderBy("admissionNo")
    .get();

  students = snap.docs.map(doc=>({
    id: doc.id,
    ...doc.data()
  }));
}

// ========================== COMPUTE RESULTS ==========================
function computeResults(){
  const examId = currentExamId;
  const filter = recipientFilter.value;

  let rows = students.map(st=>{
    const examSubjects = st.marks?.[examId]?.subjects || {};

    let total = 0;
    let count = 0;

    subjects.forEach(s=>{
      const score = examSubjects[s.code] ?? null;
      if (score !== null && typeof score === "number") {
        total += score;
        count++;
      }
    });

    const avg = count>0 ? Number((total/count).toFixed(2)) : 0;
    const division = getDivision(avg);

    return {
      id: st.id,
      admissionNo: st.admissionNo,
      name: st.fullName,
      className: classSelect.options[classSelect.selectedIndex]?.textContent || "",
      phone: st.guardianPhone,
      avg,
      total,
      division,
      raw: st
    };
  });

  if (filter === "weak") {
    rows = rows.filter(r => r.division === "DIV III" || r.division === "DIV IV" || r.division === "DIV 0");
  }

  rows.sort((a,b)=> b.avg - a.avg);

  let lastAvg = null;
  let lastPos = 0;
  rows.forEach((r, idx)=>{
    if (r.avg !== lastAvg){
      lastPos = idx+1;
      lastAvg = r.avg;
    }
    r.position = lastPos;
  });

  results = rows;
}

function getDivision(avg){
  if (avg >= 75) return "DIV I";
  if (avg >= 60) return "DIV II";
  if (avg >= 45) return "DIV III";
  if (avg >= 30) return "DIV IV";
  return "DIV 0";
}

// ========================== RENDER RECIPIENT TABLE ==========================
function renderRecipientsTable(){
  recipientsTableBody.innerHTML = "";

  if (!results.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="8">No recipients loaded.</td>`;
    recipientsTableBody.appendChild(tr);
    return;
  }

  results.forEach(r=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="checkbox" class="rowCheck" data-id="${r.id}" checked /></td>
      <td>${r.admissionNo || ""}</td>
      <td>${r.name || ""}</td>
      <td>${r.className || ""}</td>
      <td>${r.phone || ""}</td>
      <td>${r.avg}</td>
      <td>${r.division}</td>
      <td>${r.position}</td>
    `;
    recipientsTableBody.appendChild(tr);
  });

  selectAllCheckbox.checked = true;
}

selectAllCheckbox.addEventListener("change", ()=>{
  document.querySelectorAll(".rowCheck").forEach(ch=>{
    ch.checked = selectAllCheckbox.checked;
  });
});

// ========================== LOAD RECIPIENTS BUTTON ==========================
loadRecipientsBtn.addEventListener("click", async ()=>{
  setSmsStatus("info","Loading recipients...");
  if (!currentClassId){
    setSmsStatus("error","Select class first.");
    return;
  }

  const type = messageTypeSelect.value;

  await loadSubjects();
  await loadStudents();

  if (type === "results") {
    if (!examSelect.value){
      setSmsStatus("error","Select exam for results SMS.");
      return;
    }
    currentExamId = examSelect.value;
    computeResults();
  } else {
    currentExamId = examSelect.value || null;
    computeResults();
  }

  renderRecipientsTable();
  messagesList.innerHTML = "";
  generatedMessages = [];

  setSmsStatus("success","Recipients loaded. Now generate SMS.");
});

// ========================== GENERATE SMS ==========================
generateSmsBtn.addEventListener("click", ()=>{
  generatedMessages = [];
  messagesList.innerHTML = "";

  if (!results.length){
    setSmsStatus("error","Load recipients first.");
    return;
  }

  const tmpl      = smsTemplate.value;
  const examLabel = examSelect.options[examSelect.selectedIndex]?.textContent || "";
  const closeDate = closeDateInput.value || "";
  const openDate  = openDateInput.value || "";
  const className = classSelect.options[classSelect.selectedIndex]?.textContent || "";

  const selectedChecks = Array.from(document.querySelectorAll(".rowCheck:checked"));
  if (!selectedChecks.length){
    setSmsStatus("error","Select at least one student.");
    return;
  }

  selectedChecks.forEach(ch=>{
    const id  = ch.dataset.id;
    const row = results.find(r => r.id === id);
    if (!row) return;

    let text = tmpl;
    text = text.replaceAll("{name}", row.name || "");
    text = text.replaceAll("{adm}", row.admissionNo || "");
    text = text.replaceAll("{class}", row.className || className);
    text = text.replaceAll("{exam}", examLabel || "");
    text = text.replaceAll("{total}", String(row.total || 0));
    text = text.replaceAll("{mean}", String(row.avg || 0));
    text = text.replaceAll("{div}", row.division || "");
    text = text.replaceAll("{pos}", String(row.position || ""));
    text = text.replaceAll("{close}", closeDate || "");
    text = text.replaceAll("{open}", openDate || "");

    generatedMessages.push({
      to: row.phone,
      text,
      adm: row.admissionNo,
      className: row.className,
      exam: examLabel
    });
  });

  generatedMessages.forEach(msg=>{
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `<strong>${msg.to}</strong> — ${msg.text}`;
    messagesList.appendChild(div);
  });

  if (!generatedMessages.length){
    setSmsStatus("error","No messages generated. Check recipients list.");
  } else {
    setSmsStatus("success",`Generated ${generatedMessages.length} SMS ready to send.`);
  }
});

// ========================== SAVE LOGS ==========================
saveLogsBtn.addEventListener("click", async ()=>{
  if (!generatedMessages.length){
    setSmsStatus("error","No messages to log. Generate SMS first.");
    return;
  }

  const doc = {
    timestamp: new Date(),
    classId: currentClassId,
    examId: currentExamId,
    messageType: messageTypeSelect.value,
    template: smsTemplate.value,
    closeDate: closeDateInput.value || null,
    openDate: openDateInput.value || null,
    messages: generatedMessages
  };

  await db.collection("sms_logs").add(doc);
  setSmsStatus("success","SMS logs saved to Firestore.");
});

// ========================== DOWNLOAD CSV ==========================
downloadCsvBtn.addEventListener("click", ()=>{
  if (!generatedMessages.length){
    setSmsStatus("error","Generate SMS first.");
    return;
  }

  let csv = "Phone,Message\n";
  generatedMessages.forEach(m=>{
    const safeText = (m.text || "").replace(/"/g,"'");
    csv += `"${m.to}","${safeText}"\n`;
  });

  const blob = new Blob([csv], {type:"text/csv"});
  const url  = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "bulk_sms.csv";
  a.click();

  setSmsStatus("success","CSV downloaded. You can upload it to Beem panel if needed.");
});

// ========================== SEND VIA BEEM ==========================
sendViaGatewayBtn.addEventListener("click", async ()=>{
  if (!generatedMessages.length){
    setSmsStatus("error","Generate SMS first.");
    return;
  }

  if (!navigator.onLine) {
    setSmsStatus("error","Inaonekana huna mtandao (internet). Unganisha kifaa chako na jaribu tena.");
    return;
  }

  const apiKey    = "182165a09d7d6eaf";
  const secretKey = "OGQ2MGVhY2NhOTgzNzdhODYyYTNmYjE4M2VjZmEzYjZmM2E0YzQ2OWFjNWZlNzk1MTVlMGY5NzdiM2ZjNmI5Yw==";
  const senderId  = "SCHOOL";

  const payload = {
    source_addr: senderId,
    schedule_time: "",
    messages: generatedMessages.map(m=>({
      recipients: [m.to],
      message: m.text
    }))
  };

  setSmsStatus("info",`Sending ${generatedMessages.length} SMS via Beem…`);

  try{
    const res = await fetch("https://apis.beem.africa/v1/send", {
      method: "POST",
      headers: {
        "Content-Type":"application/json",
        Authorization: "Basic " + btoa(apiKey + ":" + secretKey)
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log("BEEM RESPONSE:", data);

    setSmsStatus("success","Request sent to Beem. Check Beem dashboard for delivery status.");

    await db.collection("sms_logs").add({
      timestamp: new Date(),
      classId: currentClassId,
      examId: currentExamId,
      messageType: messageTypeSelect.value,
      response: data,
      messages: generatedMessages
    });

  }catch(err){
    console.error(err);
    setSmsStatus("error","Failed to send via Beem: " + err.message);
  }
});

// ========================== INIT ==========================
(async function init(){
  try{
    await loadClasses();
    if (classSelect.value){
      currentClassId = classSelect.value;
      await loadExams();
    }
    setSmsStatus("info","Choose class and exam, then load recipients.");
  }catch(err){
    console.error("Failed to initialise SMS page", err);
    setSmsStatus("error","Failed to initialise SMS page: " + err.message);
  }
})();





