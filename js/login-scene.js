document.addEventListener('DOMContentLoaded', () => {
  const char = document.getElementById('character');
  const bag  = char.querySelector('.bag');
  const form = document.getElementById('loginForm');

  // STEP 1: walk in
  setTimeout(() => {
    char.classList.remove('walk');
    char.classList.add('stand');

    // STEP 2: drop bag
    setTimeout(() => {
      bag.classList.remove('hidden');

      // STEP 3: idle pose
      setTimeout(() => {
        char.classList.add('idle');

        // STEP 4: show login
        form.classList.remove('hidden');

      }, 600);

    }, 700);

  }, 3000); // walking duration
});
