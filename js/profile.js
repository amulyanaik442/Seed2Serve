/* ============================================================
   Seed2Serve — Profile page script
   Loads the authenticated user's stored information, guards
   the page, and wires drawer / logout / navigation.
   ============================================================ */
(function () {
  'use strict';

  var avatarSkeleton = document.getElementById('avatarSkeleton');
  var avatarInit = document.getElementById('avatarInit');
  var nameSkeleton = document.getElementById('nameSkeleton');
  var heroName = document.getElementById('heroName');
  var heroEmail = document.getElementById('heroEmail');
  var detailsSkeleton = document.getElementById('detailsSkeleton');
  var detailsList = document.getElementById('detailsList');

  var menuBtn = document.getElementById('menuBtn');
  var drawer = document.getElementById('drawer');
  var overlay = document.getElementById('overlay');
  var logoutBtn = document.getElementById('logoutBtn');
  var logoutMobile = document.getElementById('logoutMobile');

  var editProfileBtn = document.getElementById('editProfileBtn');
  var settingsBtn = document.getElementById('settingsBtn');
  var editPanel = document.getElementById('editPanel');
  var settingsPanel = document.getElementById('settingsPanel');
  var editForm = document.getElementById('editForm');
  var editFullName = document.getElementById('editFullName');
  var editPhone = document.getElementById('editPhone');
  var editAlert = document.getElementById('editAlert');
  var editCancel = document.getElementById('editCancel');
  var editSave = document.getElementById('editSave');

  var currentUser = null;

  /* ----------------------------------------------------------
     1. Load profile (auth guard via /api/profile)
     ---------------------------------------------------------- */
  fetch('/api/profile', { credentials: 'same-origin' })
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      if (!data || !data.user) {
        window.location.replace('login.html');
        return;
      }
      fill(data.user);
    })
    .catch(function () {
      window.location.replace('login.html');
    });

  function initials(name) {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(function (part) {
        return part.charAt(0);
      })
      .join('')
      .toUpperCase();
  }

  function fill(user) {
    currentUser = user;

    var name = String(user.full_name || user.username || 'Farmer');
    var email = user.email || '';
    var phone = user.phone || '—';
    var created = user.created_at || '';

    if (heroName) {
      heroName.textContent = name;
      heroName.hidden = false;
    }
    if (heroEmail) {
      heroEmail.textContent = email;
      heroEmail.hidden = false;
    }
    if (avatarInit) {
      avatarInit.textContent = initials(name);
      avatarInit.hidden = false;
    }
    if (nameSkeleton) {
      nameSkeleton.hidden = true;
    }
    if (avatarSkeleton) {
      avatarSkeleton.hidden = true;
    }

    if (detailsList) {
      setText('pFullName', name);
      setText('pUsername', user.username || '—');
      setText('pEmail', email || '—');
      setText('pPhone', phone);
      setText('pCreated', formatDate(created));
      detailsList.hidden = false;
    }
    if (detailsSkeleton) {
      detailsSkeleton.hidden = true;
    }
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) {
      el.textContent = value;
    }
  }

  function formatDate(value) {
    if (!value) {
      return '—';
    }
    var d = new Date(value);
    if (isNaN(d.getTime())) {
      return String(value);
    }
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /* ----------------------------------------------------------
     1b. Edit Profile + Settings
     ---------------------------------------------------------- */
  function isValidPhone(value) {
    return /^\+?[0-9][0-9\s\-()]{6,20}$/.test(value);
  }

  function showEditAlert(message) {
    if (!editAlert) {
      return;
    }
    if (!message) {
      editAlert.hidden = true;
      editAlert.className = 'edit-alert';
      editAlert.textContent = '';
      return;
    }
    editAlert.hidden = false;
    editAlert.className = 'edit-alert edit-alert--ok';
    editAlert.textContent = message;
  }

  function showEditError(message) {
    if (!editAlert) {
      return;
    }
    editAlert.hidden = false;
    editAlert.className = 'edit-alert edit-alert--err';
    editAlert.textContent = message;
  }

  function openEditPanel() {
    if (!currentUser) {
      return;
    }
    showEditAlert('');
    editFullName.value = String(currentUser.full_name || '');
    editPhone.value = String(currentUser.phone || '');
    editPanel.hidden = false;
    if (settingsPanel) {
      settingsPanel.hidden = true;
    }
    editFullName.focus();
  }

  function closeEditPanel() {
    editPanel.hidden = true;
    editPhone.classList.remove('is-invalid');
  }

  if (editProfileBtn) {
    editProfileBtn.addEventListener('click', function () {
      if (editPanel.hidden) {
        openEditPanel();
      } else {
        closeEditPanel();
      }
    });
  }

  if (settingsBtn && settingsPanel) {
    settingsBtn.addEventListener('click', function () {
      var show = settingsPanel.hidden;
      closeEditPanel();
      settingsPanel.hidden = !show;
      showEditAlert('');
    });
  }

  if (editCancel) {
    editCancel.addEventListener('click', closeEditPanel);
  }

  if (editForm) {
    editForm.addEventListener('submit', function (e) {
      e.preventDefault();
      showEditAlert('');

      var name = editFullName.value.trim();
      var phone = editPhone.value.trim();

      if (!name) {
        showEditError('Full name is required.');
        editFullName.focus();
        return;
      }
      if (!isValidPhone(phone)) {
        editPhone.classList.add('is-invalid');
        showEditError('Enter a valid phone number.');
        editPhone.focus();
        return;
      }
      editPhone.classList.remove('is-invalid');

      setBusy(editSave, true);
      fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ fullName: name, phone: phone })
      })
        .then(function (res) {
          return res.json();
        })
        .then(function (data) {
          setBusy(editSave, false);
          if (data && data.user) {
            fill(data.user);
            editPanel.hidden = true;
            showEditAlert('Profile updated successfully!');
          } else {
            showEditError((data && data.message) || 'Could not save your changes. Please try again.');
          }
        })
        .catch(function () {
          setBusy(editSave, false);
          showEditError('Unable to reach the server. Please try again.');
        });
    });
  }

  function setBusy(btn, busy) {
    if (btn) {
      btn.disabled = busy;
    }
  }

  /* ----------------------------------------------------------
     2. Drawer
     ---------------------------------------------------------- */
  function openDrawer(open) {
    drawer.classList.toggle('is-open', open);
    overlay.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  }

  menuBtn.addEventListener('click', function () {
    openDrawer(!drawer.classList.contains('is-open'));
  });

  overlay.addEventListener('click', function () {
    openDrawer(false);
  });

  // Close when the user presses Escape.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      openDrawer(false);
    }
  });

  /* ----------------------------------------------------------
     2b. Navigation (hamburger sidebar)
     ---------------------------------------------------------- */
  document.querySelectorAll('[data-nav]').forEach(function (item) {
    item.addEventListener('click', function () {
      var target = item.getAttribute('data-nav');
      if (target === 'profile') {
        openDrawer(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (target === 'products') {
        openDrawer(false);
        window.setTimeout(function () {
          window.location.href = 'dashboard.html#products';
        }, 280);
      } else {
        openDrawer(false);
        window.setTimeout(function () {
          window.location.href = 'dashboard.html';
        }, 200);
      }
    });
  });

  // "Back to site" in the sidebar also closes the drawer.
  if (drawer) {
    drawer.querySelectorAll('a[href="index.html#home"]').forEach(function (link) {
      link.addEventListener('click', function () {
        openDrawer(false);
      });
    });
  }

  /* ----------------------------------------------------------
     3. Log out
     ---------------------------------------------------------- */
  function doLogout() {
    [logoutBtn, logoutMobile].forEach(function (btn) {
      if (btn) {
        btn.disabled = true;
      }
    });
    fetch('/api/logout', { method: 'POST', credentials: 'same-origin' })
      .then(function () {
        window.location.href = 'login.html';
      })
      .catch(function () {
        window.location.href = 'login.html';
      });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', doLogout);
  }
  if (logoutMobile) {
    logoutMobile.addEventListener('click', doLogout);
  }
})();