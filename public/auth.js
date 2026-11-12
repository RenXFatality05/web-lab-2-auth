const guest = document.querySelector('#guest');
const profile = document.querySelector('#profile');
const notice = document.querySelector('#notice');
const login = document.querySelector('#login');
const register = document.querySelector('#register');
const expiry = document.querySelector('#profile-expiry');
const loadUsers = document.querySelector('#load-users');
const usersPanel = document.querySelector('#users');
const usersTable = usersPanel.querySelector('tbody');
let authToken = '';
let countdown;

function showNotice(message, error = false) {
  notice.textContent = message;
  notice.classList.toggle('error', error);
  notice.hidden = !message;
}

function signOut(message, error = false) {
  authToken = '';
  clearInterval(countdown);
  usersTable.replaceChildren();
  usersPanel.hidden = true;
  profile.hidden = true;
  guest.hidden = false;
  showNotice(message, error);
}

async function request(url, { method = 'GET', body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const response = await fetch(url, { method, headers, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error);
    error.status = response.status;
    throw error;
  }

  return result;
}

function submit(form, action) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true;
    showNotice('');

    try {
      await action(Object.fromEntries(new FormData(form)));
    } catch (error) {
      showNotice(error.status ? error.message : 'Не вдалося зв’язатися із сервером.', true);
    } finally {
      button.disabled = false;
    }
  });
}

submit(register, async (body) => {
  const user = await request('/api/register', { method: 'POST', body });
  register.reset();
  login.elements.username.value = user.username;
  login.elements.password.focus();
  showNotice('Обліковий запис створено. Тепер увійдіть.');
});

submit(login, async (body) => {
  const result = await request('/api/login', { method: 'POST', body });
  authToken = result.authToken;

  try {
    const { user, claims } = await request('/api/profile');
    login.reset();
    showProfile(user, claims);
  } catch (error) {
    authToken = '';
    throw error;
  }
});

function showProfile(user, claims) {
  document.querySelector('#profile-name').textContent = user.username;
  document.querySelector('#profile-role').textContent = user.role;
  document.querySelector('#profile-student').textContent = claims.student;
  document.querySelector('#profile-group').textContent = claims.group;
  document.querySelector('#profile-variant').textContent = claims.variant;
  loadUsers.hidden = user.role !== 'admin';
  guest.hidden = true;
  profile.hidden = false;

  function updateCountdown() {
    const remaining = Math.max(0, claims.exp - Math.floor(Date.now() / 1000));
    expiry.textContent = `${remaining} с`;
    if (remaining === 0) {
      signOut('Термін дії токена минув. Увійдіть ще раз.', true);
    }
  }

  clearInterval(countdown);
  countdown = setInterval(updateCountdown, 250);
  updateCountdown();
}

loadUsers.addEventListener('click', async () => {
  const session = authToken;
  loadUsers.disabled = true;
  showNotice('');

  try {
    const { users } = await request('/api/admin/users');
    if (session !== authToken) return;

    usersTable.replaceChildren();
    for (const user of users) {
      const row = usersTable.insertRow();
      for (const value of [user.id, user.username, user.role]) {
        row.insertCell().textContent = value;
      }
    }
    usersPanel.hidden = false;
  } catch (error) {
    if (session !== authToken) return;

    if (error.status === 401) {
      signOut(error.message, true);
    } else {
      showNotice(error.status ? error.message : 'Не вдалося завантажити список користувачів.', true);
    }
  } finally {
    loadUsers.disabled = false;
  }
});

document.querySelector('#logout').addEventListener('click', () => signOut('Ви вийшли з облікового запису.'));
