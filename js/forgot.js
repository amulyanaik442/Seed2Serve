/* ============================================================
   Seed2Serve — "Forgot Password" page script
   Sends a reset-link request to the backend email API.
   ============================================================ */
(function () {
  'use strict';

  var form = document.getElementById('forgotForm');
  var input = document.getElementById('forgotIdentity');
  var submit = document.getElementById('forgotSubmit');
  var alertBox = document.getElementById('forgotAlert');
  var yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  function setError(message) {
    input.classList[message ? 'add' : 'remove']('is-invalid');
    var slot = document.querySelector('[data-error-for="forgotIdentity"]');
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

  if (input) {
    input.addEventListener('input', function () {
      setError('');
      showAlert('', '');
    });
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = input.value.trim();

      if (!email) {
        setError('Please enter your email address.');
        input.focus();
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('Enter a valid email address.');
        input.focus();
        return;
      }

      setError('');
      submit.disabled = true;
      showAlert('info', 'Sending reset link…');

      fetch('/api/password/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ identity: email })
      })
        .then(function () {
          // Always the same outcome, whether or not the account exists.
          showAlert(
            'success',
            'If an account exists for that email, a reset link is on its way.'
          );
          form.reset();
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