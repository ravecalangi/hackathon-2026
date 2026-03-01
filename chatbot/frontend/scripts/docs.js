document.addEventListener('DOMContentLoaded', () => {

  const tabBtns   = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  if (tabBtns.length > 0 && tabPanels.length > 0) {
    tabBtns[0].classList.add('active');
    tabPanels[0].classList.add('active');
  }

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');

      const target = document.getElementById('panel-' + btn.dataset.tab);
      if (target) {
        target.classList.add('active');
      }
    });
  });

});


const logoContainer = document.querySelector(".nav-logo");

logoContainer.addEventListener("click", () => {
  window.location.href = "../html/index.html";
});