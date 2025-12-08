// ==============================
//  UKSS — SMS Engine with BEEM
// ==============================

const dbClass = db.collection("classes");

// UI Elements
const classSelect = document.getElementById("classSelect");
const examSelect  = document.getElementById("examSelect");
const loadBtn     = document.getElementById("loadRecipientsBtn");

const smsTemplate = document.getElementById("smsTemplate");
const generateSmsBtn = document.getElementById("generateSmsBtn");
const messagesList = document.getElementById("messagesList");

const tableBody = document.querySelector("#recipientsTable tbody");
const selectAll = document.getElementById("selectAll");

const sendViaGatewayBtn = document.getElementById("sendViaGatewayBtn");
const downloadCsvBtn = document.getElementById("downloadCsvBtn");
const saveLogsBtn = document.getElementById("saveLogsBtn");

// STATE
let recipients = [];
let subjects = [];
let examName = "";
let currentClassId = "";
let currentExamId = "";
let generatedMessages = [];

// =============================================
// LOAD CLASSES
// =============================================
async function loadClasses() {
  const snap = await dbClass.orderBy("name").get();
  classSelect.innerHTML = "";
  snap.forEach(doc => {
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = doc.data().name;
    classSelect.appendChild(opt);
  });
}
await loadClasses();

// =============================================
// LOAD EXAMS WHEN CLASS SELECTED
// =============================================
classSelect.addEventListener("change", async () => {
  currentClassId = classSelect.value;
  await loadExams();
});

async function loadExams() {
  examSelect.innerHTML = "";
  const snap = await dbClass.doc(classSelect.value)
    .collection("exams")
    .orderBy("createdAt", "asc")
    .get();

  snap.forEach(doc => {
    const data = doc.data();
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = data.displayName || data.name;
    examSelect.appendChild(opt);
  });
}

// =============================================
// LOAD RECIPIENTS
// =============================================
loadBtn.addEventListener("click", async () => {
  currentClassId = classSelect.value;
  currentExamId = examSelect.value;

  recipients = [];
  subjects = [];

  await loadSubjects();
  await loadStudents();

  renderRecipientsTable();
});

async function loadSubjects() {
  const snap = await dbClass
    .doc(currentClassId)
    .collection("subjects")
    .orderBy("code")
    .get();

  subjects = snap.docs.map(d => d.data());
}

async function loadStudents() {
  const snap = await dbClass
    .doc(currentClassId)
    .collection("students")
    .orderBy("admissionNo")
    .get();

  recipients = snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  // compute grade + weak subjects
  recipients = recipients.map(r => computeStudentPerformance(r));
}

function computeStudentPerformance(student) {
  const exam = student.marks?.[currentExamId]?.subjects || {};

  let total = 0;
  let count = 0;
  let weak = [];

  subjects.forEach(s => {
    const score = exam[s.code] ?? null;
    if (score !== null) {
      total += score;
      count++;
      if (score < 50) weak.push(`${s.code}:${score}`);
    }
  });

  const avg = count > 0 ? Number((total / count).toFixed(2)) : 0;
  const grade = getGrade(avg);

  return {
    ...student,
    total,
    mean: avg,
    grade,
    weakSubjects: weak.join(", ")
  };
}

function getGrade(avg) {
  if (avg >= 75) return "A";
  if (avg >= 60) return "B";
  if (avg >= 45) return "C";
  if (avg >= 30) return "D";
  return "E";
}

// =============================================
// RENDER TABLE
// =============================================
function renderRecipientsTable() {
  tableBody.innerHTML = "";

  recipients.forEach((r, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="checkbox" class="rowCheck" data-id="${r.id}" checked /></td>
      <td>${r.admissionNo}</td>
      <td>${r.fullName}</td>
      <td>${classSelect.options[classSelect.selectedIndex].textContent}</td>
      <td>${r.guardianPhone}</td>
      <td>${r.grade}</td>
    `;
    tableBody.appendChild(tr);
  });

  selectAll.checked = true;
}

selectAll.addEventListener("change", () => {
  document.querySelectorAll(".rowCheck").forEach(ch => {
    ch.checked = selectAll.checked;
  });
});

// =============================================
// GENERATE SMS
// =============================================
generateSmsBtn.addEventListener("click", () => {
  generatedMessages = [];

  const template = smsTemplate.value;
  const className = classSelect.options[classSelect.selectedIndex].textContent;
  const examLabel = examSelect.options[examSelect.selectedIndex].textContent;

  document.querySelectorAll(".rowCheck:checked").forEach(ch => {
    const id = ch.dataset.id;
    const r = recipients.find(x => x.id === id);

    let sms = template
      .replaceAll("{name}", r.fullName)
      .replaceAll("{adm}", r.admissionNo)
      .replaceAll("{class}", className)
      .replaceAll("{exam}", examLabel)
      .replaceAll("{total}", r.total)
      .replaceAll("{mean}", r.mean)
      .replaceAll("{grade}", r.grade)
      .replaceAll("{weak}", r.weakSubjects || "-");

    generatedMessages.push({
      to: r.guardianPhone,
      text: sms,
      adm: r.admissionNo
    });
  });

  renderMessages();
});

function renderMessages() {
  messagesList.innerHTML = "";
  generatedMessages.forEach(msg => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `<strong>${msg.to}</strong> — ${msg.text}`;
    messagesList.appendChild(div);
  });
}

// =============================================
// BULK SMS — BEEM API
// =============================================
sendViaGatewayBtn.addEventListener("click", async () => {
  if (generatedMessages.length === 0) {
    alert("Generate SMS first.");
    return;
  }

  const apiKey = "e5edb2f2e829e03c";
  const secretKey = "oKqd6pGuJtQFtZamWYG7zsuLQm22";
  const senderId = "UKSS"; // must be registered in Beem

  const payload = {
    source_addr: senderId,
    schedule_time: "",
    messages: generatedMessages.map(m => ({
      recipients: [m.to],
      message: m.text
    }))
  };

  const res = await fetch("https://apis.beem.africa/v1/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + btoa(e5edb2f2e829e03c + ":" + oKqd6pGuJtQFtZamWYG7zsuLQm22)
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  console.log("BEEM RESPONSE:", data);

  alert("SMS sent! Check console for details.");

  // SAVE LOG
  saveSmsLogs(data);
});

// =============================================
// LOGGING TO FIRESTORE
// =============================================
async function saveSmsLogs(response) {
  const doc = {
    timestamp: new Date(),
    classId: currentClassId,
    examId: currentExamId,
    messages: generatedMessages,
    response
  };

  await db.collection("sms_logs").add(doc);
  alert("Logs saved.");
}

// =============================================
// DOWNLOAD CSV
// =============================================
downloadCsvBtn.addEventListener("click", () => {
  let csv = "Phone,Message\n";

  generatedMessages.forEach(m => {
    csv += `"${m.to}","${m.text.replace(/"/g, "'")}"\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "bulk_sms.csv";
  a.click();
});


