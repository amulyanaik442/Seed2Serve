/* ============================================================
   Seed2Serve — "Reset Password" page script
   Consumes a one-time token from the URL, validates the new
   password on the client, and submits it to /api/password/reset.
   ============================================================ */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var token = (params.get('token') || '').trim();

  var form = document.getElementById('resetForm');
  var password = document.getElementById('resetPassword');
  var confirm = document.getElementById('resetConfirm');
  var submit = document.getElementById('resetSubmit');
  var alertBox = document.getElementById('resetAlert');
  var yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  function setError(id, message) {
    var input = document.getElementById(id);
    var slot = document.querySelector('[data-error-for="' + id + '"]');
    if (input) {
      input.classList[message ? 'add' : 'remove']('is-invalid');
    }
    if (slot) {
      slot.textContent = message || '';
    }
  }

  function showAlert(type, message) {
    if (!alertBox) {
      return;
    }
    alertBox.className = 'auth-alert auth-alert--' + type + ' is-visible';
    alertBox.textContent = message;
  }

  function meetsPassword(pw) {
    return pw.length >= 8 && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);
  }

  if (!token) {
    showAlert(
      'error',
      'This reset link is invalid or has expired. Please request a new one.'
    );
    if (form) {
      form.style.display = 'none';
    }
  }

  // Password visibility toggles (mirrors the login page behavior —
  // this page does not load auth.js).
  document.querySelectorAll('.auth-eye').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = document.getElementById(btn.getAttribute('data-eye-for'));
      if (!target) {
        return;
      }
      var show = target.type === 'password';
      target.type = show ? 'text' : 'password';
      btn.classList.toggle('is-active', show);
      btn.setAttribute('aria-pressed', String(show));
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  });

  [password, confirm].forEach(function (input) {
    if (input) {
      input.addEventListener('input', function () {
        setError(input.id, '');
        showAlert('', '');
      });
    }
  });

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var ok = true;
      if (!password.value) {
        setError('resetPassword', 'Enter a new password.');
        ok = false;
      } else if (!meetsPassword(password.value)) {
        setError(
          'resetPassword',
          'Password must be at least 8 characters and include a letter and a number.'
        );
        ok = false;
      } else {
        setError('resetPassword', '');
      }

      if (!confirm.value) {
        setError('resetConfirm', 'Please confirm your new password.');
        ok = false;
      } else if (confirm.value !== password.value) {
        setError('resetConfirm', 'Passwords do not match.');
        ok = false;
      } else {
        setError('resetConfirm', '');
      }

      if (!ok) {
        return;
      }

      submit.disabled = true;
      showAlert('info', 'Updating your password…');

      fetch('/api/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ token: token, password: password.value })
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (res) {
          if (res.ok) {
            showAlert('success', 'Password updated. Redirecting you to log in…');
            setTimeout(function () {
              window.location.href = 'login.html';
            }, 1200);
          } else {
            showAlert(
              'error',
              (res.data && res.data.message) ||
                'This reset link is invalid or has expired.'
            );
          }
        })
        .catch(function () {
          showAlert(
            'error',
            'Unable to reach the server. Please check your connection and try again.'
          );
        })
        .finally(function () {
          submit.disabled = false;
        });
    });
  }
})();