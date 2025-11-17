/*
  sms.js
  - Loads report_cards + students
  - Generates SMS from templates
  - Preview per recipient
  - Sends to external API (mock example + real example)
*/

const STORAGE_KEY = 'school_results_v1';
let store = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
  students: [],
  report_cards: [],
  classes: []
};

const $ = id => document.getElementById(id);

// Load classes into dropdown
window.onload = () => {
  const sel = $('classSelect');
  store.classes.forEach(c => {
    sel.innerHTML += `<option value="${c.id}">${c.name}</option>`;
  });

  loadTemplate(); // prefill template box
};

// ---------------------------
// Templates
// ---------------------------
function loadTemplate() {
  const type = $('templateSelect').value;

  let text = "";
  if (type === "simple") {
    text = "Matokeo ya {FirstName} ({AdmissionNo}) — Mean: {Mean}, Grade: {Grade}.";
  } 
  else if (type === "detail") {
    text = "Matokeo ya {FirstName}: Mean {Mean}, Daraja {Grade}. Masomo dhaifu: {WeakSubjects}.";
  } 
  else if (type === "remark") {
    text = "{FirstName} — Mean {Mean}, Grade {Grade}. Ujumbe: {Remark}.";
  }

  $('messageBox').value = text;
}

$('templateSelect').onchange = loadTemplate;

// ---------------------------
// Load Recipients (students from one class)
// ---------------------------
let currentRecipients = [];

function loadRecipients() {
  const cls = $('classSelect').value;

  const students = store.students.filter(s => s.class_id === cls);
  currentRecipients = [];

  if (!students.length) {
    alert("No students found for this class.");
    return;
  }

  const reportCards = store.report_cards;

  const tbody = $('recipientsTable').querySelector('tbody');
  tbody.innerHTML = '';

  students.forEach(stu => {
    const report = reportCards.find(r => r.student_id === stu.id);
    if (!report) return; // student has no report card

    const row = {
      student: stu,
      report: report,
      phone: stu.guardian_phone || "",
      sms: generateSMS(stu, report)
    };

    currentRecipients.push(row);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${stu.first_name} ${stu.last_name} <br><span class="small">(${stu.admission_no})</span></td>
      <td>${stu.guardian_phone}</td>
      <td>${row.sms}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ---------------------------
// Generate SMS from template
// ---------------------------
function generateSMS(student, report) {
  let msg = $('messageBox').value;

  msg = msg.replace("{FirstName}", student.first_name);
  msg = msg.replace("{AdmissionNo}", report.admission_no);
  msg = msg.replace("{Mean}", report.mean_score);
  msg = msg.replace("{Grade}", report.grade);
  msg = msg.replace("{WeakSubjects}", report.weak_subjects.join(", "));
  msg = msg.replace("{Remark}", report.remark);

  return msg;
}

// ---------------------------
// SEND BULK SMS
// ---------------------------
async function sendBulkSMS() {
  if (!currentRecipients.length) {
    alert("Load recipients first!");
    return;
  }

  $('statusLog').innerText = "Sending messages...";

  for (let i = 0; i < currentRecipients.length; i++) {
    let r = currentRecipients[i];

    // Mock sending (works without internet)
    // Replace with your actual SMS API below
    let res = await sendMockSMS(r.phone, r.sms);

    $('statusLog').innerText = `Sent to ${r.student.first_name} (${r.phone}): ${res}`;
  }

  $('statusLog').innerText += "\nDone sending all messages!";
}

// ---------------------------
// MOCK SMS SENDER (Works offline)
// ---------------------------
function sendMockSMS(phone, message) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve("DELIVERED (mock)");
    }, 500);
  });
}

// ---------------------------
// REAL SMS API EXAMPLE (Beem Africa)
// Replace sendMockSMS with this:
// ---------------------------
/*
async function sendRealSMS(phone, msg) {
  const apiKey = "YOUR_API_KEY";
  const secret = "YOUR_SECRET";

  let res = await fetch("https://apisms.beem.africa/v1/send", {
    method: "POST",
    headers: {
      "Authorization": "Basic " + btoa(apiKey + ":" + secret),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      source_addr: "INFO",
      schedule_type: "burst",
      messages: [
        {
          recipients: [phone],
          msg: msg
        }
      ]
    })
  });

  let data = await res.json();
  return data;
}
*/
