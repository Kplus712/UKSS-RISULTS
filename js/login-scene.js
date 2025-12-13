window.addEventListener("load", () => {

  const character = document.getElementById("character");
  const bag = document.getElementById("bag");
  const card = document.getElementById("loginCard");

  // STEP 1: walking tayari inaanza kwa CSS
  // STEP 2: after walk ends
  setTimeout(() => {
    character.classList.remove("walk");
    character.classList.add("pose");

    // STEP 3: drop bag
    bag.classList.add("drop");

  }, 3000);

  // STEP 4: show login card
  setTimeout(() => {
    card.classList.add("show");
  }, 3800);

  // STEP 5: lean character to card
  setTimeout(() => {
    character.style.transform = "translateX(20px) rotate(-2deg)";
  }, 4800);

});
