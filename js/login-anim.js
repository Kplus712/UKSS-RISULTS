// Subtle UX polish only (NO auth logic here)
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.querySelector('.btn-primary');
  if(!btn) return;

  btn.addEventListener('mousemove', e => {
    const r = btn.getBoundingClientRect();
    const x = e.clientX - r.left;
    btn.style.background =
      `radial-gradient(circle at ${x}px center, #34d399, #16a34a)`;
  });

  btn.addEventListener('mouseleave', () => {
    btn.style.background = 'linear-gradient(90deg,#22c55e,#16a34a)';
  });
});
