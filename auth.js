function login() {
    let user = document.getElementById("username").value;
    let pass = document.getElementById("password").value;
    let msg = document.getElementById("loginMessage");

    if (user === "admin" && pass === "12345") {
        localStorage.setItem("loggedIn", "true");
        window.location.href = "marks.html";
    } else {
        msg.style.color = "red";
        msg.innerText = "Invalid username or password";
    }
}
