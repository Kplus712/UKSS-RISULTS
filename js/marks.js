
// ===== UKSS — Marks Entry Logic =====

// EXAM inayotumika kwenye page hii
const EXAM_ID = "annual_2025";

// Firestore ref (hakikisha ipo kwenye database.js)
const classesCol = db.collection("classes");

// DOM refs
const classSelect        = document.getElementById("classSelect");
const addClassBtn        = document.getElementById("addClassBtn");
const generateReportsBtn = document.getElementById("generateReportsBtn");

const stuAdmission = document.getElementById("stuAdmission");
const stuFirst     = document.getElementById("stuFirst");
const stuLast      = document.getElementById("stuLast");
const stuPhone     = document.getElementById("stuPhone");
const stuSex       = document.getElementById("stuSex"); // optional

const addStudentBtn = document.getElementById("addStudentBtn");

const subCode   = document.getElementById("subCode");
const subName   = document.getElementById("subName");
const addSubjectBtn = document.getElementById("addSubjectBtn");

const subjectsListEl = document.getElementById("subjectsList");
const studentsListEl = document.getElementById("studentsList");
const marksMatrixWrap = document.getElementById("marksMatrixWrap");
const loadSampleBtn = document.getElementById("loadSampleBtn");

// Data caches kwa upande wa browser
let currentClassId = null;
let subjects = [];  // [{id, code, name}]
let students = [];  // [{id, admissionNo, fullName, guardianPhone, sex, marks:{...}}]

// -------------------- HELPERS --------------------
function toast(msg) {
  console.log(msg);
  // Ukiwa na toast ya UI, weka hapa
  // alert(msg);
}

function sanitizeId(str) {
  return (str || "")
    .toUpperCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}

// -------------------- LOAD CLASSES --------------------
async function loadClasses() {
  classSelect.innerHTML = "";
  const snap = await classesCol.orderBy("name").get();
  if (snap.empty) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "-- No class yet --";
    classSelect.appendChild(opt);
    currentClassId = null;
    return;
  }

  snap.forEach(doc => {
    const data = doc.data();
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = data.name || doc.id;
    classSelect.appendChild(opt);
  });

  currentClassId = classSelect.value || null;
  if (currentClassId) {
    await loadClassData();
  }
}

// -------------------- ADD CLASS --------------------
addClassBtn.addEventListener("click", async () => {
  const name = prompt("Enter class name e.g. FORM ONE A");
  if (!name) return;

  const id = sanitizeId(name); // FORM_ONE_A
  try {
    await classesCol.doc(id).set(
      {
        name,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    toast("Class added");
    await loadClasses();
    classSelect.value = id;
    currentClassId = id;
    await loadClassData();
  } catch (err) {
    console.error(err);
    toast("Failed to add class");
  }
});

// -------------------- LOAD SUBJECTS, STUDENTS & MARKS --------------------
async function loadClassData() {
  if (!currentClassId) return;
  await Promise.all([loadSubjects(), loadStudentsAndMarks()]);
  renderLists();
  renderMarksMatrix();
}

async function loadSubjects() {
  subjects = [];
  const subSnap = await classesCol
    .doc(currentClassId)
    .collection("subjects")
    .orderBy("code")
    .get();

  subSnap.forEach(doc => {
    subjects.push({ id: doc.id, ...doc.data() });
  });
}

async function loadStudentsAndMarks() {
  students = [];
  const stuSnap = await classesCol
    .doc(currentClassId)
    .collection("students")
    .orderBy("admissionNo")
    .get();

  const promises = [];

  stuSnap.forEach(doc => {
    const data = doc.data();
    const stu = {
      id: doc.id,
      admissionNo: data.admissionNo || doc.id,
      firstName: data.firstName || "",
      lastName: data.lastName || "",
      fullName: data.fullName || "",
      guardianPhone: data.guardianPhone || "",
      sex: data.sex || "",
      marks: {} // tutaweka hapa baada ya kusoma
    };

    students.push(stu);

    // Soma marks za exam hii (zipo ndani ya doc ya student)
    promises.push(
      classesCol
        .doc(currentClassId)
        .collection("students")
        .doc(doc.id)
        .get()
        .then(d => {
          const dd = d.data() || {};
          const allMarks = dd.marks || {};
          stu.marks = allMarks[EXAM_ID]?.subjects || {};
        })
    );
  });

  await Promise.all(promises);
}

// -------------------- RENDER SUBJECT/STUDENT LISTS --------------------
function renderLists() {
  // subjects list
  if (!subjects.length) {
    subjectsListEl.textContent = "No subjects yet.";
  } else {
    subjectsListEl.innerHTML = subjects
      .map(s => `${s.code} — ${s.name}`)
      .join("<br/>");
  }

  // students list
  if (!students.length) {
    studentsListEl.textContent = "No students in this class.";
  } else {
    studentsListEl.innerHTML = students
      .map((s, idx) => `${idx + 1}. ${s.admissionNo} — ${s.fullName || (s.firstName + " " + s.lastName)}`)
      .join("<br/>");
  }
}

// -------------------- ADD SUBJECT --------------------
addSubjectBtn.addEventListener("click", async () => {
  if (!currentClassId) return alert("Select class first.");
  const code = (subCode.value || "").toUpperCase().trim();
  const name = (subName.value || "").trim();
  if (!code || !name) return alert("Fill subject code and name.");

  try {
    const subRef = classesCol
      .doc(currentClassId)
      .collection("subjects")
      .doc(code);

    await subRef.set(
      {
        code,
        name,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    subCode.value = "";
    subName.value = "";
    toast("Subject added.");
    await loadSubjects();
    renderLists();
    renderMarksMatrix();
  } catch (err) {
    console.error(err);
    toast("Failed to add subject.");
  }
});

// -------------------- ADD STUDENT --------------------
addStudentBtn.addEventListener("click", async () => {
  if (!currentClassId) return alert("Select class first.");

  const admissionNo = (stuAdmission.value || "").toUpperCase().trim();
  const firstName   = (stuFirst.value || "").trim();
  const lastName    = (stuLast.value || "").trim();
  const guardianPhone = (stuPhone.value || "").trim();
  const sex         = stuSex ? (stuSex.value || "").trim() : "";

  if (!admissionNo || !firstName || !lastName) {
    return alert("Admission No, First name and Last name are required.");
  }

  const fullName = `${firstName} ${lastName}`;

  try {
    const stuRef = classesCol
      .doc(currentClassId)
      .collection("students")
      .doc(admissionNo);

    await stuRef.set(
      {
        admissionNo,
        firstName,
        lastName,
        fullName,
        guardianPhone,
        sex,
        // hakikisha marks field ipo ili tusipate undefined
        marks: {},
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    stuAdmission.value = "";
    stuFirst.value = "";
    stuLast.value = "";
    stuPhone.value = "";
    if (stuSex) stuSex.value = "";

    toast("Student added.");
    await loadStudentsAndMarks();
    renderLists();
    renderMarksMatrix();
  } catch (err) {
    console.error(err);
    toast("Failed to add student.");
  }
});

// -------------------- MARKS MATRIX --------------------
function renderMarksMatrix() {
  if (!currentClassId) {
    marksMatrixWrap.textContent = "Please add/select a class first.";
    return;
  }
  if (!subjects.length || !students.length) {
    marksMatrixWrap.textContent = "Add subjects and students to see the matrix.";
    return;
  }

  const table = document.createElement("table");
  table.className = "matrix-table";

  // HEADER
  const thead = document.createElement("thead");
  const headRow1 = document.createElement("tr");
  headRow1.innerHTML = `
    <th rowspan="2">#</th>
    <th rowspan="2">Adm No</th>
    <th rowspan="2">Student Name</th>
    <th rowspan="2">Sex</th>
  `;

  subjects.forEach(sub => {
    const th = document.createElement("th");
    th.colSpan = 2;
    th.textContent = sub.code;
    headRow1.appendChild(th);
  });

  const headRow2 = document.createElement("tr");
  subjects.forEach(() => {
    const thCA = document.createElement("th");
    thCA.textContent = "CA";
    const thEX = document.createElement("th");
    thEX.textContent = "EX";
    headRow2.appendChild(thCA);
    headRow2.appendChild(thEX);
  });

  thead.appendChild(headRow1);
  thead.appendChild(headRow2);

  const tbody = document.createElement("tbody");

  students.forEach((stu, idx) => {
    const tr = document.createElement("tr");
    const fullName = stu.fullName || `${stu.firstName} ${stu.lastName}`.trim();

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${stu.admissionNo}</td>
      <td>${fullName}</td>
      <td>${stu.sex || ""}</td>
    `;

    subjects.forEach(sub => {
      const subMarks = stu.marks[sub.code] || {};
      const caVal = subMarks.ca ?? "";
      const exVal = subMarks.ex ?? "";

      // CA input
      const tdCA = document.createElement("td");
      const inputCA = document.createElement("input");
      inputCA.type = "number";
      inputCA.min = "0";
      inputCA.max = "100";
      inputCA.value = caVal;
      inputCA.className = "matrix-input";
      inputCA.dataset.stuId = stu.id;
      inputCA.dataset.subCode = sub.code;
      inputCA.dataset.part = "ca";
      tdCA.appendChild(inputCA);

      // EX input
      const tdEX = document.createElement("td");
      const inputEX = document.createElement("input");
      inputEX.type = "number";
      inputEX.min = "0";
      inputEX.max = "100";
      inputEX.value = exVal;
      inputEX.className = "matrix-input";
      inputEX.dataset.stuId = stu.id;
      inputEX.dataset.subCode = sub.code;
      inputEX.dataset.part = "ex";
      tdEX.appendChild(inputEX);

      tr.appendChild(tdCA);
      tr.appendChild(tdEX);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);

  marksMatrixWrap.innerHTML = "";
  marksMatrixWrap.appendChild(table);

  // Listener moja kwa matrix yote (event delegation)
  table.addEventListener("change", onMatrixInputChange);
}

async function onMatrixInputChange(e) {
  const input = e.target;
  if (!input.classList.contains("matrix-input")) return;

  const stuId = input.dataset.stuId;
  const subCode = input.dataset.subCode;
  const part = input.dataset.part; // "ca" or "ex"
  let value = input.value === "" ? null : Number(input.value);

  if (value != null && (value < 0 || value > 100)) {
    alert("Value must be between 0 and 100");
    input.focus();
    return;
  }

  try {
    const stuRef = classesCol
      .doc(currentClassId)
      .collection("students")
      .doc(stuId);

    // Njia ya kutumia dot notation:
    const fieldPath = `marks.${EXAM_ID}.subjects.${subCode}.${part}`;

    await stuRef.set(
      {
        marks: {
          [EXAM_ID]: {
            subjects: {
              [subCode]: {
                [part]: value
              }
            }
          }
        }
      },
      { merge: true }
    );

    // refresh cache kidogo tu – hatulazimiki kusoma Firestore tena,
    // tuna-update object ya local:
    const stu = students.find(s => s.id === stuId);
    if (!stu.marks[subCode]) stu.marks[subCode] = {};
    stu.marks[subCode][part] = value;

    // OPTIONAL: ukitaka kukagua kuwa CA+EX <= 100
    const ca = stu.marks[subCode].ca ?? 0;
    const ex = stu.marks[subCode].ex ?? 0;
    if (ca + ex > 100) {
      alert(`CA (${ca}) + EX (${ex}) > 100 for ${subCode}. Please adjust.`);
    }

  } catch (err) {
    console.error(err);
    toast("Failed to save mark.");
  }
}

// -------------------- CLASS SELECT CHANGE --------------------
classSelect.addEventListener("change", async () => {
  currentClassId = classSelect.value || null;
  if (!currentClassId) return;
  await loadClassData();
});

// -------------------- GENERATE REPORTS BUTTON --------------------
// Kwa sasa: tunahifadhi info ya exam kwenye kila student.
// Pages za results/ranking zitasoma `marks[EXAM_ID].subjects` na
// kutumia formula ya average, division, position.
generateReportsBtn.addEventListener("click", () => {
  // Hapa unaweza kuhama kwenda results page au kutoa maelekezo
  window.location.href = "results.html?exam=" + encodeURIComponent(EXAM_ID);
});

// -------------------- LOAD SAMPLE DATA --------------------
loadSampleBtn.addEventListener("click", async () => {
  const confirmLoad = confirm("Load sample class, subjects and students? (For testing)");
  if (!confirmLoad) return;

  try {
    // sample class
    const clsId = "FORM_ONE_A";
    await classesCol.doc(clsId).set(
      {
        name: "FORM ONE A",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    // sample subjects
    const sampleSubs = [
      { code: "HIST", name: "History" },
      { code: "GEO",  name: "Geography" },
      { code: "KIS",  name: "Kiswahili" },
      { code: "ENG",  name: "English" },
      { code: "PHY",  name: "Physics" },
      { code: "CHEM", name: "Chemistry" },
      { code: "BIO",  name: "Biology" },
      { code: "MATH", name: "Mathematics" },
      { code: "BUS",  name: "Business Studies" },
      { code: "CIV",  name: "Civics" }
    ];

    const subsRef = classesCol.doc(clsId).collection("subjects");
    for (const s of sampleSubs) {
      await subsRef.doc(s.code).set(
        {
          code: s.code,
          name: s.name,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    }

    // sample students
    const stRef = classesCol.doc(clsId).collection("students");
    for (let i = 1; i <= 10; i++) {
      const adm = "F1A/" + String(i).padStart(3, "0");
      await stRef.doc(adm).set(
        {
          admissionNo: adm,
          firstName: "STUDENT" + i,
          lastName: "",
          fullName: "STUDENT" + i,
          guardianPhone: "06" + Math.floor(10000000 + Math.random() * 89999999),
          sex: i % 2 === 0 ? "M" : "F",
          marks: {},
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    }

    toast("Sample data loaded.");
    await loadClasses();
    classSelect.value = clsId;
    currentClassId = clsId;
    await loadClassData();
  } catch (err) {
    console.error(err);
    toast("Failed to load sample data.");
  }
});

// -------------------- INIT --------------------
(async function init() {
  try {
    await loadClasses();
  } catch (err) {
    console.error(err);
    toast("Failed to load classes.");
  }
})();
