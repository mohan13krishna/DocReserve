// Frontend/js/super-admin-shared.js
// Shared behaviors for Super Admin pages: sidebar toggle, dark mode, user menu

(function () {
  document.addEventListener('DOMContentLoaded', function () {
    // Sidebar: mobile hamburger
    const body = document.body;
    const hamburgerBtn = document.getElementById('hamburger-btn');
    let overlayEl = null;

    function ensureOverlay() {
      if (!overlayEl) {
        overlayEl = document.createElement('div');
        overlayEl.id = 'sidebar-overlay';
        overlayEl.style.position = 'fixed';
        overlayEl.style.inset = '0';
        overlayEl.style.background = 'rgba(0,0,0,0.4)';
        overlayEl.style.zIndex = '1040';
        overlayEl.style.display = 'none';
        document.body.appendChild(overlayEl);
        overlayEl.addEventListener('click', closeSidebar);
      }
      return overlayEl;
    }

    function openSidebar() {
      body.classList.add('sidebar-open');
      ensureOverlay().style.display = 'block';
    }
    function closeSidebar() {
      body.classList.remove('sidebar-open');
      if (overlayEl) overlayEl.style.display = 'none';
    }
    function toggleSidebar() {
      if (body.classList.contains('sidebar-open')) closeSidebar(); else openSidebar();
    }

    if (hamburgerBtn) {
      hamburgerBtn.addEventListener('click', toggleSidebar);
    }

    window.addEventListener('resize', function () {
      if (window.innerWidth >= 992) closeSidebar();
    });


    // User menu logout link (optional)
    const logoutItem = document.getElementById('logout-menu-item');
    if (logoutItem && typeof window.logout === 'function') {
      logoutItem.addEventListener('click', function (e) {
        e.preventDefault();
        window.logout();
      });
    }
  });
})();

