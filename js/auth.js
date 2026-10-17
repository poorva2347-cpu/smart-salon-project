/* ══════════════════════════════════════════
   SMART SALON — auth.js
   Authentication UI ↔ API Integration
   Phase 3.4.1
══════════════════════════════════════════ */

const API_BASE    = 'http://localhost:3000';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\+]?[\d\s\-\(\)]{7,15}$/;

/* ════════════════════════════════════════
   UTILITY — Error / Success helpers
════════════════════════════════════════ */

function showError(fieldId, message) {
  const fg  = document.getElementById('fg-' + fieldId);
  const err = document.getElementById('err-' + fieldId);
  if (!fg || !err) return;
  fg.classList.add('has-error');
  err.textContent = message;
  err.classList.add('visible');
}

function clearError(fieldId) {
  const fg  = document.getElementById('fg-' + fieldId);
  const err = document.getElementById('err-' + fieldId);
  if (!fg || !err) return;
  fg.classList.remove('has-error');
  err.textContent = '';
  err.classList.remove('visible');
}

function clearAllErrors(fieldIds) {
  fieldIds.forEach(id => clearError(id));
}

function showFormSuccess(formEl, message) {
  const existing = formEl.parentNode.querySelector('.auth-success-msg');
  if (existing) existing.remove();
  const div = document.createElement('div');
  div.className = 'auth-success-msg';
  div.textContent = message;
  formEl.parentNode.insertBefore(div, formEl);
  formEl.style.display = 'none';
}

/* ════════════════════════════════════════
   PASSWORD VISIBILITY TOGGLE
════════════════════════════════════════ */

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const icon = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) icon.className = 'fa fa-eye-slash';
    btn.setAttribute('aria-label', 'Hide password');
  } else {
    input.type = 'password';
    if (icon) icon.className = 'fa fa-eye';
    btn.setAttribute('aria-label', 'Show password');
  }
}

/* ════════════════════════════════════════
   LOGIN FORM
════════════════════════════════════════ */

(function initLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

  // Session check — skip login page if already authenticated
  if (localStorage.getItem('customerToken')) {
    window.location.replace('../index.html');
    return;
  }

  const emailInput    = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const loginBtn      = document.getElementById('login-btn');

  emailInput?.addEventListener('input',    () => clearError('email'));
  passwordInput?.addEventListener('input', () => clearError('password'));

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearAllErrors(['email', 'password']);

    const email    = (emailInput?.value    || '').trim();
    const password = (passwordInput?.value || '');
    let valid = true;

    if (!email) {
      showError('email', 'Email address is required.');
      valid = false;
    } else if (!EMAIL_REGEX.test(email)) {
      showError('email', 'Please enter a valid email address.');
      valid = false;
    }

    if (!password) {
      showError('password', 'Password is required.');
      valid = false;
    } else if (password.length < 6) {
      showError('password', 'Password must be at least 6 characters.');
      valid = false;
    }

    if (!valid) return;

    loginBtn.textContent = 'Signing in…';
    loginBtn.classList.add('loading');
    loginBtn.disabled = true;

    try {
      const res  = await fetch(API_BASE + '/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('customerToken', data.token);
        localStorage.setItem('customerId',    data.customer_id);
        localStorage.setItem('email',         data.email);
        loginBtn.textContent = 'Login successful!';
        setTimeout(() => window.location.replace('../index.html'), 600);
      } else {
        loginBtn.textContent = 'Sign In';
        loginBtn.classList.remove('loading');
        loginBtn.disabled = false;

        if (res.status === 401) {
          showError('email', 'Invalid email or password.');
        } else if (res.status === 403) {
          const msg = (data.error || '').toLowerCase();
          showError('email', msg.includes('suspended') ? 'This account has been suspended.' : 'Account not found.');
        } else {
          showError('email', data.error || 'Something went wrong. Please try again.');
        }
      }

    } catch (_err) {
      loginBtn.textContent = 'Sign In';
      loginBtn.classList.remove('loading');
      loginBtn.disabled = false;
      showError('email', 'Connection error. Please check your network and try again.');
    }
  });
})();

/* ════════════════════════════════════════
   REGISTER FORM
════════════════════════════════════════ */

(function initRegisterForm() {
  const form = document.getElementById('register-form');
  if (!form) return;

  const nameInput     = document.getElementById('reg-name');
  const emailInput    = document.getElementById('reg-email');
  const phoneInput    = document.getElementById('reg-phone');
  const passwordInput = document.getElementById('reg-password');
  const confirmInput  = document.getElementById('reg-confirm');
  const registerBtn   = document.getElementById('register-btn');

  nameInput?.addEventListener('input',     () => clearError('name'));
  emailInput?.addEventListener('input',    () => clearError('email'));
  phoneInput?.addEventListener('input',    () => clearError('phone'));
  passwordInput?.addEventListener('input', () => clearError('password'));

  confirmInput?.addEventListener('input', function () {
    const pw  = passwordInput?.value || '';
    const cpw = this.value;
    if (cpw && pw && cpw !== pw) {
      showError('confirm', 'Passwords do not match.');
    } else {
      clearError('confirm');
    }
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearAllErrors(['name', 'email', 'phone', 'password', 'confirm']);

    const name     = (nameInput?.value     || '').trim();
    const email    = (emailInput?.value    || '').trim();
    const phone    = (phoneInput?.value    || '').trim();
    const password = (passwordInput?.value || '');
    const confirm  = (confirmInput?.value  || '');
    let valid = true;

    if (!name) {
      showError('name', 'Full name is required.');
      valid = false;
    } else if (name.length < 2) {
      showError('name', 'Please enter your full name.');
      valid = false;
    }

    if (!email) {
      showError('email', 'Email address is required.');
      valid = false;
    } else if (!EMAIL_REGEX.test(email)) {
      showError('email', 'Please enter a valid email address.');
      valid = false;
    }

    if (!phone) {
      showError('phone', 'Phone number is required.');
      valid = false;
    } else if (!PHONE_REGEX.test(phone)) {
      showError('phone', 'Please enter a valid phone number.');
      valid = false;
    }

    if (!password) {
      showError('password', 'Password is required.');
      valid = false;
    } else if (password.length < 6) {
      showError('password', 'Password must be at least 6 characters.');
      valid = false;
    }

    if (!confirm) {
      showError('confirm', 'Please confirm your password.');
      valid = false;
    } else if (password && confirm !== password) {
      showError('confirm', 'Passwords do not match.');
      valid = false;
    }

    if (!valid) return;

    registerBtn.textContent = 'Creating Account…';
    registerBtn.classList.add('loading');
    registerBtn.disabled = true;

    try {
      const res  = await fetch(API_BASE + '/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ full_name: name, email, phone, password })
      });
      const data = await res.json();

      if (res.status === 201) {
        localStorage.removeItem('customerToken');
        localStorage.removeItem('customerId');
        localStorage.removeItem('email');
        showFormSuccess(form, 'Account created successfully. Please login to continue.');
        setTimeout(() => window.location.replace('login.html'), 2000);
      } else {
        registerBtn.textContent = 'Create Account';
        registerBtn.classList.remove('loading');
        registerBtn.disabled = false;

        if (res.status === 409) {
          showError('email', 'This email is already registered.');
        } else if (res.status === 400) {
          showError('name', data.error || 'Please check your details and try again.');
        } else {
          showError('name', data.error || 'Something went wrong. Please try again.');
        }
      }

    } catch (_err) {
      registerBtn.textContent = 'Create Account';
      registerBtn.classList.remove('loading');
      registerBtn.disabled = false;
      showError('name', 'Connection error. Please check your network and try again.');
    }
  });
})();
