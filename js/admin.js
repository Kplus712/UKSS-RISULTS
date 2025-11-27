// js/admin.js
// Admin dashboard: manage staff, approvals, system settings, logs overview

var $ = function(id){ return document.getElementById(id); };

var ROLES = ["admin", "headmaster", "academic", "class_teacher"];

function roleLabel(role){
  switch(role){
    case "admin":        return "Admin (System Owner)";
    case "headmaster":   return "Headmaster";
    case "academic":     return "Academic Officer";
    case "class_teacher":return "Class Teacher";
    default:             return "Unassigned";
  }
}

/* ===== MAIN AUTH GUARD ===== */
auth.onAuthStateChanged(function(user){
  if (!user){
    window.location.href = "index.html";
    return;
  }
  initAdmin(user);
});

/* ===== INIT ADMIN ===== */
async function initAdmin(user){
  try{
    // 1) SOMA STAFF DOC YA USER HUYU
    var staffDoc = await getDocById(col.staff, user.uid);
    if (!staffDoc){
      // kama hana doc, muundie ya basic (unassigned, inactive)
      staffDoc = {
        id: user.uid,
        name: user.displayName || "",
        email: user.email || "",
        role: "none",
        main_class: "",
        active: false,
        updated_at: new Date().toISOString()
      };
      await setDocById(col.staff, user.uid, staffDoc);
    }

    var myRole  = staffDoc.role || "none";
    var myClass = staffDoc.main_class || "";
    var active  = (staffDoc.active !== false); // default true kama haipo

    // 2) JAZA YOUR ACCOUNT SECTION
    if ($("meName"))  $("meName").value  = staffDoc.name  || (user.displayName || "");
    if ($("meEmail")) $("meEmail").value = staffDoc.email || user.email;
    if ($("meRole"))  $("meRole").value  = roleLabel(myRole);
    if ($("meClass")) $("meClass").value = myClass;

    var warn = $("roleWarning");

    // kama sio active kabisa
    if (!active){
      if (warn){
        warn.textContent =
          "Akaunti yako imewekwa kama INACTIVE. Mwone Admin wa shule " +
          "aku-activate ili uweze kutumia mfumo kikamilifu.";
      }
      // bado tunaendelea kusoma, lakini tuna-block kazi za admin
      return;
    }

    // 3) CHECK kama ana ruhusa ya admin
    var isAdminLike = (myRole === "admin" || myRole === "headmaster");

    if (!isAdminLike){
      if (warn){
        warn.textContent =
          "Role yako ni: "+roleLabel(myRole)+". Huna ruhusa kamili ya Admin. " +
          "Unaweza tu kuona taarifa zako. Mwone Admin wa shule kubadilisha role.";
      }
      // mtu asiye admin/headmaster haoni tables za chini
    }else{
      if (warn) warn.textContent = "";
      // load all admin features
      await loadStaffTable();
      await loadPendingTable();
      await loadSettings();
      await loadLogsOverview();
    }

    // 4) Logout button
    var logoutBtn = $("logoutBtn");
    if (logoutBtn){
      logoutBtn.onclick = function(){
        auth.signOut().then(function(){
          window.location.href = "index.html";
        });
      };
    }
  }catch(err){
    console.error("initAdmin error:", err);
    alert("Imeshindikana kusoma taarifa za admin. Angalia console.");
  }
}

/* =========================
   1) STAFF MANAGEMENT TABLE
   ========================= */
async function loadStaffTable(){
  var tbody = $("staffTable").querySelector("tbody");
  tbody.innerHTML = "<tr><td colspan='6'>Loading staff...</td></tr>";

  try{
    var staffList = await getAll(col.staff); // -> [{id, ...data}]
    if (!staffList.length){
      tbody.innerHTML = "<tr><td colspan='6'>Hakuna staff kwenye collection 'staff' bado.</td></tr>";
      return;
    }

    tbody.innerHTML = "";
    staffList.forEach(function(item){
      var tr = document.createElement("tr");

      var name    = item.name  || "(no name)";
      var email   = item.email || "";
      var role    = item.role  || "none";
      var mclass  = item.main_class || "";
      var updated = item.updated_at || "";
      var active  = (item.active !== false); // default true

      var roleOptions = ROLES.map(function(r){
        var sel = (r === role) ? " selected" : "";
        return "<option value='"+r+"'"+sel+">"+roleLabel(r)+"</option>";
      }).join("");

      tr.innerHTML =
        "<td>"+name+"</td>"+
        "<td>"+email+"</td>"+
        "<td>"+
          "<select class='input roleSelect' data-id='"+item.id+"' style='min-width:170px'>"+
            "<option value='none' "+(role==="none"?"selected":"")+">Unassigned</option>"+
            roleOptions+
          "</select>"+
        "</td>"+
        "<td>"+
          "<input class='input classInput' data-id='"+item.id+"' value='"+mclass+"' placeholder='eg. Form II A' />"+
        "</td>"+
        "<td style='text-align:center;'>"+
          "<input type='checkbox' class='activeCheck' data-id='"+item.id+"' "+(active?"checked":"")+"/>"+
        "</td>"+
        "<td style='font-size:12px'>"+updated+"</td>";

      tbody.appendChild(tr);
    });

    attachStaffHandlers();
  }catch(err){
    console.error("loadStaffTable error:", err);
    tbody.innerHTML = "<tr><td colspan='6'>Imeshindikana kusoma staff kutoka Firestore.</td></tr>";
  }
}

function attachStaffHandlers(){
  // role change
  var selects = document.querySelectorAll(".roleSelect");
  Array.prototype.forEach.call(selects, function(sel){
    sel.onchange = function(){
      var uid = sel.dataset.id;
      var value = sel.value;
      updateStaff(uid, { role: value });
    };
  });

  // main_class change
  var classInputs = document.querySelectorAll(".classInput");
  Array.prototype.forEach.call(classInputs, function(inp){
    inp.onblur = function(){
      var uid = inp.dataset.id;
      var value = inp.value.trim();
      updateStaff(uid, { main_class: value });
    };
  });

  // active checkbox
  var activeChecks = document.querySelectorAll(".activeCheck");
  Array.prototype.forEach.call(activeChecks, function(ch){
    ch.onchange = function(){
      var uid = ch.dataset.id;
      var value = !!ch.checked;
      updateStaff(uid, { active: value });
    };
  });
}

/* ==== helper: updateStaff with merge ==== */
async function updateStaff(uid, partial){
  try{
    var existing = await getDocById(col.staff, uid) || { id: uid };
    var data = Object.assign({}, existing, partial, {
      id: uid,
      updated_at: new Date().toISOString()
    });
    await setDocById(col.staff, uid, data);
    console.log("updated staff", uid, partial);
  }catch(err){
    console.error("updateStaff error:", err);
    alert("Imeshindikana kubadilisha taarifa za staff. Angalia console.");
  }
}

/* ==============================
   2) ACCESS CONTROL / APPROVALS
   ============================== */
async function loadPendingTable(){
  var tbody = $("pendingTable").querySelector("tbody");
  tbody.innerHTML = "<tr><td colspan='6'>Loading pending staff...</td></tr>";

  try{
    var staffList = await getAll(col.staff);

    // pending = wale ambao role ni none/empty AU active=false
    var pending = staffList.filter(function(s){
      var role = s.role || "none";
      var active = (s.active !== false); // default true
      return (role === "none" || !active);
    });

    if (!pending.length){
      tbody.innerHTML = "<tr><td colspan='6'>No pending staff.</td></tr>";
      return;
    }

    tbody.innerHTML = "";
    pending.forEach(function(item){
      var tr = document.createElement("tr");

      var name  = item.name  || "(no name)";
      var email = item.email || "";
      var role  = item.role  || "none";

      var roleOptions = ROLES.map(function(r){
        return "<option value='"+r+"'>"+roleLabel(r)+"</option>";
      }).join("");

      tr.innerHTML =
        "<td>"+name+"</td>"+
        "<td>"+email+"</td>"+
        "<td>"+roleLabel(role)+"</td>"+
        "<td>"+
          "<select class='input newRoleSelect' data-id='"+item.id+"' style='min-width:160px'>"+
            "<option value='none'>Unassigned</option>"+
            roleOptions+
          "</select>"+
        "</td>"+
        "<td style='text-align:center;'>"+
          "<input type='checkbox' class='approveActive' data-id='"+item.id+"' "+((item.active!==false)?"checked":"")+"/>"+
        "</td>"+
        "<td>"+
          "<button class='btn btn-primary btn-sm approveBtn' data-id='"+item.id+"'>Apply</button>"+
        "</td>";

      tbody.appendChild(tr);
    });

    attachPendingHandlers();
  }catch(err){
    console.error("loadPendingTable error:", err);
    tbody.innerHTML = "<tr><td colspan='6'>Imeshindikana kusoma pending staff.</td></tr>";
  }
}

function attachPendingHandlers(){
  var buttons = document.querySelectorAll(".approveBtn");
  Array.prototype.forEach.call(buttons, function(btn){
    btn.onclick = async function(){
      var uid = btn.dataset.id;
      var roleSel = document.querySelector(".newRoleSelect[data-id='"+uid+"']");
      var activeCheck = document.querySelector(".approveActive[data-id='"+uid+"']");
      var newRole = roleSel ? roleSel.value : "none";
      var active  = activeCheck ? !!activeCheck.checked : true;

      await updateStaff(uid, { role: newRole, active: active });
      toast("Staff updated.");
      // reload tables
      await loadStaffTable();
      await loadPendingTable();
    };
  });
}

/* ==================
   3) SYSTEM SETTINGS
   ================== */
async function loadSettings(){
  try{
    var s = await getDocById(col.settings, "global");
    if (!s) s = {};

    if ($("setSchoolName"))   $("setSchoolName").value   = s.school_name  || "";
    if ($("setSchoolMotto"))  $("setSchoolMotto").value  = s.school_motto || "";
    if ($("setSchoolAddress"))$("setSchoolAddress").value= s.school_addr  || "";
    if ($("setSchoolPhone"))  $("setSchoolPhone").value  = s.school_phone || "";
    if ($("setSmsProvider"))  $("setSmsProvider").value  = s.sms_provider || "Beem Africa";
    if ($("setAcademicYear")) $("setAcademicYear").value = s.academic_year|| "";
    if ($("setGradingNote"))  $("setGradingNote").value  = s.grading_note || "";

    var btn = $("saveSettingsBtn");
    if (btn){
      btn.onclick = saveSettings;
    }
  }catch(err){
    console.error("loadSettings error:", err);
    var st = $("settingsStatus");
    if (st) st.textContent = "Imeshindikana kusoma settings.";
  }
}

async function saveSettings(){
  try{
    var data = {
      school_name:   ($("setSchoolName")   || {}).value || "",
      school_motto:  ($("setSchoolMotto")  || {}).value || "",
      school_addr:   ($("setSchoolAddress")|| {}).value || "",
      school_phone:  ($("setSchoolPhone")  || {}).value || "",
      sms_provider:  ($("setSmsProvider")  || {}).value || "",
      academic_year: ($("setAcademicYear") || {}).value || "",
      grading_note:  ($("setGradingNote")  || {}).value || "",
      updated_at:    new Date().toISOString()
    };

    await setDocById(col.settings, "global", data);
    var st = $("settingsStatus");
    if (st) st.textContent = "Settings saved successfully.";
    toast("System settings zimeshifadhiwa.");
  }catch(err){
    console.error("saveSettings error:", err);
    var st2 = $("settingsStatus");
    if (st2) st2.textContent = "Imeshindikana ku-save settings.";
    toast("Imeshindikana ku-save settings.");
  }
}

/* ======================
   4) LOGS OVERVIEW COUNTS
   ====================== */
async function loadLogsOverview(){
  try{
    var res = await Promise.all([
      getAll(col.sms_logs),
      getAll(col.report_cards),
      getAll(col.behaviour)
    ]);
    var smsCount   = res[0] ? res[0].length : 0;
    var repCount   = res[1] ? res[1].length : 0;
    var behCount   = res[2] ? res[2].length : 0;

    if ($("logSmsCount"))       $("logSmsCount").value       = String(smsCount);
    if ($("logReportsCount"))   $("logReportsCount").value   = String(repCount);
    if ($("logBehaviourCount")) $("logBehaviourCount").value = String(behCount);
  }catch(err){
    console.error("loadLogsOverview error:", err);
    if ($("logSmsCount"))       $("logSmsCount").value       = "error";
    if ($("logReportsCount"))   $("logReportsCount").value   = "error";
    if ($("logBehaviourCount")) $("logBehaviourCount").value = "error";
  }
}
