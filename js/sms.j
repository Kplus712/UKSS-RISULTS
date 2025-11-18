// /js/sms.js
// Bulk SMS using Firestore + templates

import {
  col,
  getAll,
  queryCollection,
  getDocById,
  setDocById
} from './database.js';

const $ = id => document.getElementById(id);
const EXAM_ID = 'annual_2025';

// Load classes
async function loadClasses() {
  const classes = await getAll(col.classes);
  $('classSelect').innerHTML = classes.map(c =>
    `<option value="${c.id}">${c.name}</option>`
  ).join('');
}

window.addEventListener('load', () => {
  loadClasses();
  setDefaultTemplate();
  $('templateSelect').onchange = setDefaultTemplate;
  $('loadBtn').onclick = loadRecipients;
  $('sendAll').onclick = sendAllSMS;
});

// ----------------------------
// Templates
// ----------------------------
function setDefaultTemplate() {
  const type = $('templateSelect').value;
  let msg = "";

  if (type === 'simple') {
    msg = "Matokeo ya {FirstName} ({Admission}): Mean {Mean}, Daraja {Grade}.";
  } else if (type === 'detail') {
    msg = "Matokeo: {FirstName} — Mean {Mean}, Grade {Grade}. Masomo dhaifu: {Weak}.";
  } else {
    msg = "Matokeo ya {FirstName}: Mean {Mean}, Grade {Grade}. Remark: {Remark}.";
  }

  $('msgBox').value = msg;
}

// ----------------------------
// Load Recipients
// ----------------------------
async function loadRecipients() {
  const cls = $('classSelect').value;
  if (!cls) return alert("Choose class.");

  const students = (await getAll(col.students))
    .filter(s => s.class_id === cls && !s.deleted);

  const tbody = $('recTable').querySelector('tbody');
  tbody.innerHTML = '';

  recipients = [];

  for (const stu of students) {
    // report card doc id: `${stu.id}_${EXAM_ID}`
    const repId = `${stu.id}_${EXAM_ID}`;
    const rep = await getDocById(col.report_cards, repId);

    if (!rep) continue;

    const sms = buildMessage(stu, rep);

    recipients.push({ stu, rep, sms });

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${stu.first_name} ${stu.last_name} <br><span style="color:#666">${stu.admission_no}</span></td>
      <td>${stu.guardian_phone}</td>
      <td>${sms}</td>
    `;
    tbody.appendChild(tr);
  }

  if (!recipients.length) {
    tbody.innerHTML = `<tr><td colspan="3">No report cards found for exam ${EXAM_ID}</td></tr>`;
  }
}

function buildMessage(stu, rep) {
  let msg = $('msgBox').value;

  msg = msg.replace("{FirstName}", stu.first_name)
           .replace("{Admission}", stu.admission_no)
           .replace("{Mean}", rep.mean_score)
           .replace("{Grade}", rep.grade)
           .replace("{Weak}", rep.weak_subjects.join(", "))
           .replace("{Remark}", rep.remark);

  return msg;
}

// ----------------------------
// SEND BULK SMS
// ----------------------------
let recipients = [];

async function sendAllSMS() {
  if (!recipients.length) return alert("Load recipients first.");

  $('status').innerText = "Sending...";

  for (const r of recipients) {
    let result = await sendMock(r.stu.guardian_phone, r.sms);

    // Save log to Firestore
    const logId = `${r.stu.id}_${Date.now()}`;
    await setDocById(col.sms_logs, logId, {
      id: logId,
      student_id: r.stu.id,
      phone: r.stu.guardian_phone,
      sms: r.sms,
      exam_id: EXAM_ID,
      delivered: true,
      timestamp: new Date().toISOString()
    });

    $('status').innerText = `Sent to ${r.stu.first_name} (${r.stu.guardian_phone})`;
  }

  $('status').innerText = "All SMS sent successfully!";
}

// ----------------------------
// MOCK SMS — Works offline
// ----------------------------
function sendMock(phone, msg) {
  return new Promise(res => setTimeout(() => res("sent"), 350));
}

// ----------------------------
// REAL SMS API (Use Beem)
// ----------------------------
async function sendRealSMS(phone, msg) {
  const apiKey = "YOUR_BEEM_KEY";
  const secret = "YOUR_BEEM_SECRET";

  const res = await fetch("https://apisms.beem.africa/v1/send", {
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

  return await res.json();
}
