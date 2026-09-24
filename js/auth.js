/* ============================================================
   Seed2Serve — Authentication page script
   Handles the login/signup flip, client-side validation, and
   the calls to the secure backend API.
   ============================================================ */
(function () {
  'use strict';

  var card = document.getElementById('authCard');
  var loginForm = document.getElementById('loginForm');
  var signupForm = document.getElementById('signupForm');
  var loginAlert = document.getElementById('loginAlert');
  var signupAlert = document.getElementById('signupAlert');
  var loginSubmit = document.getElementById('loginSubmit');
  var signupSubmit = document.getElementById('signupSubmit');

  var API_BASE = '/api'; // served by the Express backend

  /* ----------------------------------------------------------
     0b. Terms & Conditions agreement state
     ---------------------------------------------------------- */
  var termsAgreed = false;

  /* ----------------------------------------------------------
     0a. Already signed in? Go straight to the Farmer Dashboard.
     ---------------------------------------------------------- */
  fetch('/api/me', { credentials: 'same-origin' })
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      if (data && data.authenticated) {
        window.location.replace('dashboard.html');
      }
    })
    .catch(function () {
      /* no active session — let the form handle login */
    });

  /* ----------------------------------------------------------
     0. Helpers
     ---------------------------------------------------------- */
  function setError(inputId, message) {
    var input = document.getElementById(inputId);
    var errSlot = document.querySelector('[data-error-for="' + inputId + '"]');
    if (input) {
      input.classList[message ? 'add' : 'remove']('is-invalid');
    }
    if (errSlot) {
      errSlot.textContent = message || '';
    }
    return message === '' || !message;
  }

  function clearErrors(scope) {
    (scope || document).querySelectorAll('.is-invalid').forEach(function (el) {
      el.classList.remove('is-invalid');
    });
    (scope || document).querySelectorAll('.auth-error').forEach(function (el) {
      el.textContent = '';
    });
  }

  function showAlert(el, type, message) {
    if (!el) {
      return;
    }
    el.className = 'auth-alert auth-alert--' + type + ' is-visible';
    el.textContent = message;
  }

  function hideAlert(el) {
    if (el) {
      el.className = 'auth-alert';
      el.textContent = '';
    }
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function isValidPhone(value) {
    // Accepts digits, spaces, dashes, parentheses and leading +
    // (e.g. +91 98765 43210, 9876543210, (555) 123-4567).
    return /^\+?[0-9][0-9\s\-()]{6,20}$/.test(value);
  }

  function meetsPassword(value) {
    // At least 8 chars, one letter, one number.
    return value.length >= 8 && /[A-Za-z]/.test(value) && /[0-9]/.test(value);
  }

  function setBusy(btn, busy) {
    if (!btn) {
      return;
    }
    btn.disabled = busy;
  }

  /* ----------------------------------------------------------
     1. Flip between Login and Sign Up
     ---------------------------------------------------------- */
  function goToMode(mode) {
    if (!card) {
      return;
    }
    card.classList.toggle('is-signup', mode === 'signup');
  }

  /* ----------------------------------------------------------
     1b. Password visibility toggle (eye icon)
     ---------------------------------------------------------- */
  document.querySelectorAll('.auth-eye').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = document.getElementById(btn.getAttribute('data-eye-for'));
      if (!input) {
        return;
      }
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.classList.toggle('is-active', show);
      btn.setAttribute('aria-pressed', String(show));
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  });

  document.querySelectorAll('[data-auth-go]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      goToMode(btn.getAttribute('data-auth-go'));
    });
  });

  // Optional: preselect sign-up mode via ?mode=signup
  var params = new URLSearchParams(window.location.search);
  if (params.get('mode') === 'signup') {
    goToMode('signup');
  }

  /* ----------------------------------------------------------
     2. Validation — Sign Up
     ---------------------------------------------------------- */
  function validateSignup() {
    var ok = true;
    var fullName = document.getElementById('signupFullName').value.trim();
    var username = document.getElementById('signupUsername').value.trim();
    var email = document.getElementById('signupEmail').value.trim();
    var phone = document.getElementById('signupPhone').value.trim();
    var password = document.getElementById('signupPassword').value;
    var confirm = document.getElementById('signupConfirm').value;

    if (!setError('signupFullName', fullName ? '' : 'Full name is required.')) {
      ok = false;
    }
    if (!setError('signupUsername', username ? '' : 'Username is required.')) {
      ok = false;
    }
    if (!email) {
      setError('signupEmail', 'Email is required.');
      ok = false;
    } else if (!isValidEmail(email)) {
      setError('signupEmail', 'Enter a valid email address.');
      ok = false;
    } else {
      setError('signupEmail', '');
    }

    if (!phone) {
      setError('signupPhone', 'Phone number is required.');
      ok = false;
    } else if (!isValidPhone(phone)) {
      setError('signupPhone', 'Enter a valid phone number.');
      ok = false;
    } else {
      setError('signupPhone', '');
    }

    if (!password) {
      setError('signupPassword', 'Password is required.');
      ok = false;
    } else if (!meetsPassword(password)) {
      setError(
        'signupPassword',
        'Password must be at least 8 characters and include a letter and a number.'
      );
      ok = false;
    } else {
      setError('signupPassword', '');
    }

    if (!confirm) {
      setError('signupConfirm', 'Please confirm your password.');
      ok = false;
    } else if (confirm !== password) {
      setError('signupConfirm', 'Passwords do not match.');
      ok = false;
    } else {
      setError('signupConfirm', '');
    }

    if (!termsAgreed) {
      ok = false;
    }

    return ok;
  }

  /* ----------------------------------------------------------
     3. Validation — Login
     ---------------------------------------------------------- */
  function validateLogin() {
    var ok = true;
    var identity = document.getElementById('loginIdentity').value.trim();
    var password = document.getElementById('loginPassword').value;

    if (!setError('loginIdentity', identity ? '' : 'Username or email is required.')) {
      ok = false;
    }
    if (!setError('loginPassword', password ? '' : 'Password is required.')) {
      ok = false;
    }
    return ok;
  }

  /* ----------------------------------------------------------
     4. API helpers
     ---------------------------------------------------------- */
  function request(path, body) {
    return fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin', // include the session cookie
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().then(function (data) {
        return { ok: res.ok, status: res.status, data: data };
      });
    });
  }

  function redirectAfterAuth() {
    window.location.href = 'dashboard.html';
  }

  /* ----------------------------------------------------------
     5. Sign Up submit
     ---------------------------------------------------------- */
  if (signupForm) {
    signupForm.addEventListener('submit', function (e) {
      e.preventDefault();
      hideAlert(signupAlert);

      if (!validateSignup()) {
        return;
      }

      var payload = {
        fullName: document.getElementById('signupFullName').value.trim(),
        username: document.getElementById('signupUsername').value.trim(),
        email: document.getElementById('signupEmail').value.trim(),
        phone: document.getElementById('signupPhone').value.trim(),
        password: document.getElementById('signupPassword').value
      };

      setBusy(signupSubmit, true);
      request('/register', payload)
        .then(function (res) {
          if (res.ok) {
            showAlert(signupAlert, 'success', 'Account created successfully! Welcome to Seed2Serve.');

            // Empty the password fields so they can't linger in the DOM.
            document.getElementById('signupPassword').value = '';
            document.getElementById('signupConfirm').value = '';

            // The backend created a session already — head to the Farmer Dashboard.
            setTimeout(function () {
              window.location.href = 'dashboard.html';
            }, 800);
          } else {
            var msg =
              (res.data && res.data.message) ||
              'Something went wrong. Please try again.';
            showAlert(signupAlert, 'error', msg);
          }
        })
        .catch(function () {
          showAlert(
            signupAlert,
            'error',
            'Unable to reach the server. Please check your connection and try again.'
          );
        })
        .finally(function () {
          setBusy(signupSubmit, false);
        });
    });
  }

  /* ----------------------------------------------------------
     6. Login submit
     ---------------------------------------------------------- */
  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      hideAlert(loginAlert);

      if (!validateLogin()) {
        return;
      }

      var payload = {
        identity: document.getElementById('loginIdentity').value.trim(),
        password: document.getElementById('loginPassword').value,
        remember: document.getElementById('loginRemember')
          ? document.getElementById('loginRemember').checked
          : false
      };

      setBusy(loginSubmit, true);
      request('/login', payload)
        .then(function (res) {
          if (res.ok) {
            showAlert(loginAlert, 'success', 'Logged in! Taking you to your dashboard…');
            setTimeout(redirectAfterAuth, 700);
          } else {
            var msg = (res.data && res.data.message) || 'Invalid email or password.';
            showAlert(loginAlert, 'error', msg);
          }
        })
        .catch(function () {
          showAlert(
            loginAlert,
            'error',
            'Unable to reach the server. Please check your connection and try again.'
          );
        })
        .finally(function () {
          setBusy(loginSubmit, false);
        });
    });
  }

  /* ----------------------------------------------------------
      7. Misc
     ---------------------------------------------------------- */
  var yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  /* ----------------------------------------------------------
      7b. Terms & Conditions modal
     ---------------------------------------------------------- */
  var termsLink = document.getElementById('termsLink');
  var termsModal = document.getElementById('termsModal');
  var termsClose = document.getElementById('termsClose');
  var termsAgree = document.getElementById('termsAgree');

  function applyTermsState() {
    if (signupSubmit) {
      signupSubmit.disabled = !termsAgreed;
    }
    if (termsAgree) {
      termsAgree.checked = !!termsAgreed;
    }
  }

  function openTermsModal() {
    if (!termsModal) {
      return;
    }
    termsModal.hidden = false;
    termsModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    if (termsAgree) {
      termsAgree.checked = !!termsAgreed;
    }
    if (termsClose) {
      termsClose.focus();
    }
  }

  function closeTermsModal() {
    if (!termsModal) {
      return;
    }
    termsModal.hidden = true;
    termsModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    if (termsLink) {
      termsLink.focus();
    }
  }

  if (termsLink) {
    termsLink.addEventListener('click', function (e) {
      e.preventDefault();
      openTermsModal();
    });
  }

  if (termsClose) {
    termsClose.addEventListener('click', closeTermsModal);
  }

  if (termsModal) {
    termsModal.addEventListener('click', function (e) {
      if (e.target === termsModal) {
        closeTermsModal();
      }
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !termsModal.hidden) {
      closeTermsModal();
    }
  });

  if (termsAgree) {
    termsAgree.addEventListener('change', function () {
      termsAgreed = termsAgree.checked;
      applyTermsState();
      if (termsAgreed) {
        closeTermsModal();
      }
    });
  }

  // Persist agreement for the rest of the session so it survives
  // modal closes and page reloads.
  try {
    termsAgreed = sessionStorage.getItem('seed2serve.termsAgreed') === '1';
  } catch (e) {
    termsAgreed = false;
  }
  if (termsAgree && termsAgreed) {
    applyTermsState();
  }

  // When the user returns to signup mode after agreeing, keep the
  // button enabled without showing a checkbox on the page itself.
  function syncTermsOnMode() {
    applyTermsState();
  }
  if (card) {
    card.addEventListener('transitionend', syncTermsOnMode);
  }

  // Continue with Google (Google Identity Services).
  // The server exposes its public client id at /api/config; when a
  // client id is configured the GIS button is rendered and the ID
  // token is verified server-side at /api/auth/google.
  var googleButton = document.getElementById('googleLogin');
  var googleSignup = document.getElementById('googleSignup');

  function renderGoogleFallback(el, signup) {
    if (!el) {
      return;
    }
    el.innerHTML = '';
    addGoogleLabel(el, signup);
    el.addEventListener('click', function googleNotReadyHandler(e) {
      e.preventDefault();
      var alert = signup ? signupAlert : loginAlert;
      hideAlert(alert);
      showAlert(
        alert,
        'info',
        'Google sign-in is not configured yet. Please continue with your username and password.'
      );
    });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.click();
      }
    });
  }

  function addGoogleLabel(el, signup) {
    var icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'auth-google__icon');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('width', '20');
    icon.setAttribute('height', '20');
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML =
      '<path fill="#4285F4" d="M23.5 12.27c0-.79-.07-1.55-.2-2.28H12v4.32h6.45a5.2 5.2 0 0 1-2.26 3.41v2.84h3.66c2.14-1.97 3.65-4.87 3.65-8.3Z" />' +
      '<path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.85-2.91l-3.66-2.84c-1.01.68-2.31 1.08-4.19 1.08-3.22 0-5.95-2.18-6.93-5.1H1.28v2.93A12 12 0 0 0 12 24Z" />' +
      '<path fill="#FBBC05" d="M5.07 14.23a7.2 7.2 0 0 1 0-4.46V6.84H1.28a12 12 0 0 0 0 10.32l3.79-2.93Z" />' +
      '<path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44A11.9 11.9 0 0 0 12 0 12 12 0 0 0 1.28 6.84l3.79 2.93C6.05 6.93 8.78 4.75 12 4.75Z" />';
    var text = document.createElement('span');
    text.textContent = signup ? 'Sign up with Google' : 'Continue with Google';
    el.appendChild(icon);
    el.appendChild(text);
  }

  function googleVerificationFailed(alert) {
    hideAlert(alert);
    showAlert(alert, 'error', 'Google sign-in could not be verified. Please try again.');
  }

  function handleGoogleCredential(credential) {
    request('/auth/google', { credential: credential })
      .then(function (res) {
        if (res.ok) {
          showAlert(loginAlert, 'success', 'Signed in with Google! Taking you to your dashboard…');
          setTimeout(redirectAfterAuth, 700);
        } else {
          googleVerificationFailed(loginAlert);
        }
      })
      .catch(function () {
        googleVerificationFailed(loginAlert);
      });
  }

  fetch('/api/config', { credentials: 'same-origin' })
    .then(function (res) {
      return res.json();
    })
    .then(function (cfg) {
      var clientId = cfg && cfg.google && cfg.google.clientId;

      // No client id configured -> show the polite fallback on both faces.
      if (!clientId) {
        renderGoogleFallback(googleButton, false);
        renderGoogleFallback(googleSignup, true);
        return;
      }

      // GIS script not loaded (offline / blocked) -> polite fallback.
      if (!window.google || !window.google.accounts) {
        renderGoogleFallback(googleButton, false);
        renderGoogleFallback(googleSignup, true);
        return;
      }

      function onCredential(response) {
        if (response && response.credential) {
          handleGoogleCredential(response.credential);
        } else {
          googleVerificationFailed(loginAlert);
        }
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: onCredential,
        auto_select: false,
        cancel_on_tap_outside: true
      });

      var gisOptions = {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        width: 100
      };

      if (googleButton) {
        googleButton.innerHTML = '';
        window.google.accounts.id.renderButton(googleButton, gisOptions);
      }
      if (googleSignup) {
        googleSignup.innerHTML = '';
        window.google.accounts.id.renderButton(googleSignup, gisOptions);
      }
    })
    .catch(function () {
      renderGoogleFallback(googleButton, false);
      renderGoogleFallback(googleSignup, true);
    });

  // Clear a field's error as the user types.
  document.querySelectorAll('.auth-input').forEach(function (input) {
    input.addEventListener('input', function () {
      setError(input.id, '');
      hideAlert(input.id === 'loginIdentity' || input.id === 'loginPassword' ? loginAlert : signupAlert);
    });
  });
})();
