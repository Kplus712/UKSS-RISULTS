/* =========================================================
   UKSS — OFFCANVAS SIDEBAR CONTROLLER (FINAL VERSION)
========================================================= */

const sidebar = document.querySelector('.sidebar');
const topbar = document.querySelector('.topbar') || document.body;
const mainArea = document.querySelector('.main');

/* Create backdrop */
let backdrop = document.querySelector('.sidebar-backdrop');
if(!backdrop){
    backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    document.body.appendChild(backdrop);
}

/* Create menu button */
let menuBtn = document.getElementById('menuBtn');
if(!menuBtn){
    menuBtn = document.createElement('button');
    menuBtn.id = "menuBtn";
    menuBtn.innerHTML = "☰";
    menuBtn.style = `
        font-size:24px;
        background:none;
        border:none;
        cursor:pointer;
        padding:6px 10px;
        display:none;
    `;
    topbar.prepend(menuBtn);
}

/* Ensure sidebar has offcanvas behavior */
sidebar.classList.add('offcanvas');

/* Scroll control */
function lockScroll(){
    document.body.style.overflow = "hidden";
}
function unlockScroll(){
    document.body.style.overflow = "";
}

/* Open & close functions */
function openSidebar(){
    sidebar.classList.add("show");
    backdrop.classList.add("show");
    lockScroll();
    if(window.innerWidth < 900) mainArea.classList.add("shifted");
}
function closeSidebar(){
    sidebar.classList.remove("show");
    backdrop.classList.remove("show");
    unlockScroll();
    mainArea.classList.remove("shifted");
}

/* Toggle */
menuBtn.onclick = ()=>{
    if(sidebar.classList.contains("show")) closeSidebar();
    else openSidebar();
};

/* Close when tapping backdrop */
backdrop.onclick = closeSidebar;

/* Close when clicking any sidebar link */
sidebar.addEventListener("click",(e)=>{
    if(e.target.closest("a")){
        setTimeout(closeSidebar,120);
    }
});

/* Swipe to close */
let startX = 0, endX = 0;
document.addEventListener("touchstart",(e)=>startX=e.touches[0].clientX);
document.addEventListener("touchmove",(e)=>endX=e.touches[0].clientX);
document.addEventListener("touchend",()=>{
    if(sidebar.classList.contains("show") && (endX - startX) < -50){
        closeSidebar();
    }
});

/* ESC closes */
document.addEventListener("keydown",(e)=>{
    if(e.key === "Escape") closeSidebar();
});

/* Responsive initialization */
function initSidebar(){
    if(window.innerWidth > 900){
        menuBtn.style.display="none";
        sidebar.classList.remove("offcanvas","show");
        backdrop.classList.remove("show");
        unlockScroll();
    } else {
        menuBtn.style.display="inline-flex";
        sidebar.classList.add("offcanvas");
    }
}
window.addEventListener("resize",initSidebar);
initSidebar();
