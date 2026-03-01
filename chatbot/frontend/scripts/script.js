const themeToggleBtn = document.getElementById('theme-toggle');
const html = document.documentElement;

const savedTheme = localStorage.getItem('theme') || 'light';

applyTheme(savedTheme);

themeToggleBtn.addEventListener('click', () => {
  const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
  localStorage.setItem('theme', newTheme);
});

function applyTheme(theme) {
  html.setAttribute('data-theme', theme);
}

window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 20);
});


const gsOverlay     = document.getElementById('gsOverlay');
const getStartedBtn = document.getElementById('getStartedBtn');
const gsClose       = document.getElementById('gsClose');

function openGsModal() {
  // Remove closing class in case it was mid-close
  gsOverlay.classList.remove('closing');
  gsOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeGsModal() {
  // Add closing so CSS exit animations fire
  gsOverlay.classList.add('closing');

  // Wait for curtain + modal sink to finish, then fully hide
  setTimeout(() => {
    gsOverlay.classList.remove('active', 'closing');
    document.body.style.overflow = '';
  }, 550);
}

getStartedBtn.addEventListener('click', openGsModal);
gsClose.addEventListener('click', closeGsModal);

// Close on backdrop click (clicking curtain area, not modal)
gsOverlay.addEventListener('click', (e) => {
  if (e.target === gsOverlay) closeGsModal();
});

// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeGsModal();
});

document.querySelector('.gs-option[href="chatbot.html"]')
  ?.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('veritascan_user_name');
    localStorage.removeItem('veritascan_chat_history');
    window.location.href = 'chatbot.html';
  });



  (function () {
  const hint = document.getElementById('scrollHint');
  if (!hint) return;

  function onScroll() {
    if (window.scrollY > 60) {
      hint.classList.add('hidden');
      window.removeEventListener('scroll', onScroll);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
})();



document.querySelectorAll('.sample-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.sample-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.sample-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});