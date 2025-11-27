// js/admin.js
// Admin dashboard: manage staff roles

var $ = function(id){ return document.getElementById(id); };

var ROLES = ["admin", "headmaster", "academic", "class_teacher"];

function roleLabel(role){
  switch(role){
    case "admin": return "Admin (System Owner)";
    case "headmaster": return "Headmaster";
    case "academic": return "Academic Officer";
    case "class_teacher": return "Class Teacher";
    default: return "Unassigned";
  }
}

/* ===== AUTH GUARD + LOAD CURRENT USER ROLE ===== */
auth.onAuthStateChanged(async function(user){
  if (!user){
    window.location.href = "index.html";
    return;
  }

  try{
    // soma document ya staff ya mtumiaji huyu
    var docRef = col.staff.doc(user.uid);
    var snap = await docRef.get();
    var data = snap.exists ? snap.data() : {};

    var myRole  = data.role || "none";
    var myClass = data.main_class || "";

    $("meName").value  = data.name  || (user.displayName || "");
    $("meEmail").value = data.email || user.email;
    $("meRole").value  = roleLabel(myRole);
    $("meClass").value = myClass;

    // weka warning kama si admin/headmaster
    if (myRole !== "admin" && myRole !== "headmaster"){
      $("roleWarning").textContent =
        "Huna ruhusa kamili ya Admin. Unaweza tu kuona taarifa zako. " +
        "Mwone Admin wa shule akubadilishie role kuwa 'admin' au 'headmaster'.";
    }else{
      $("roleWarning").textContent = "";
      // admin/headmaster wanaweza kuona list nzima ya staff
      loadStaffTable();
    }

    var logoutBtn = $("logoutBtn");
    if (logoutBtn){
      logoutBtn.onclick = function(){
        auth.signOut().then(function(){
          window.location.href = "index.html";
        });
      };
    }
  }catch(err){
    console.error("admin init error:", err);
    alert("Imeshindikana kusoma taarifa za staff.");
  }
});

/* ===== LOAD STAFF ===== */
async function loadStaffTable(){
  var tbody = $("staffTable").querySelector("tbody");
  tbody.innerHTML = "<tr><td colspan='5'>Loading staff...</td></tr>";

  try{
    // tunatumia helper getAll kama ilivyo sehemu nyingine
    var staffList = await getAll(col.staff); // -> [{id, ...data}]
    if (!staffList.length){
      tbody.innerHTML = "<tr><td colspan='5'>Hakuna staff kwenye collection 'staff' bado.</td></tr>";
      return;
    }

    tbody.innerHTML = "";
    staffList.forEach(function(item){
      var tr = document.createElement("tr");

      var name   = item.name  || "(no name)";
      var email  = item.email || "";
      var role   = item.role  || "none";
      var mclass = item.main_class || "";
      var updated = item.updated_at || "";

      var roleOptions = ROLES.map(function(r){
        var sel = (r === role) ? " selected" : "";
        return "<option value='"+r+"'"+sel+">"+roleLabel(r)+"</option>";
      }).join("");

      tr.innerHTML =
        "<td>"+name+"</td>"+
        "<td>"+email+"</td>"+
        "<td>"+
          "<select class='input roleSelect' data-id='"+item.id+"' style='min-width:180px'>"+
            "<option value='none' "+(role==="none"?"selected":"")+">Unassigned</option>"+
            roleOptions+
          "</select>"+
        "</td>"+
        "<td>"+
          "<input class='input classInput' data-id='"+item.id+"' value='"+mclass+"' placeholder='eg. Form II A' />"+
        "</td>"+
        "<td style='font-size:12px'>"+updated+"</td>";

      tbody.appendChild(tr);
    });

    // attach listeners
    attachRoleHandlers();
  }catch(err){
    console.error("loadStaffTable error:", err);
    tbody.innerHTML = "<tr><td colspan='5'>Imeshindikana kusoma staff kutoka Firestore.</td></tr>";
  }
}

/* ===== HANDLERS FOR ROLE + CLASS CHANGE ===== */
function attachRoleHandlers(){
  var selects = document.querySelectorAll(".roleSelect");
  Array.prototype.forEach.call(selects, function(sel){
    sel.onchange = function(){
      var uid = sel.dataset.id;
      var value = sel.value;
      updateStaff(uid, { role: value });
    };
  });

  var classInputs = document.querySelectorAll(".classInput");
  Array.prototype.forEach.call(classInputs, function(inp){
    inp.onblur = function(){
      var uid = inp.dataset.id;
      var value = inp.value.trim();
      updateStaff(uid, { main_class: value });
    };
  });
}

/* ===== UPDATE STAFF DOC ===== */
async function updateStaff(uid, data){
  try{
    data.updated_at = new Date().toISOString();
    await col.staff.doc(uid).set(data, { merge:true });
    console.log("updated staff", uid, data);
    // optional: small toast
  }catch(err){
    console.error("updateStaff error:", err);
    alert("Imeshindikana kubadilisha taarifa za staff.");
  }
}
