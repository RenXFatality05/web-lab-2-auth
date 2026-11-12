const { randomBytes } = require('node:crypto');
const { existsSync } = require('node:fs');
const path = require('node:path');
const express = require('express');
const jwt = require('jsonwebtoken');
const { addUser, findByName, findById, listUsers } = require('./users');
const { normalizeUsername, validPassword, hashPassword, verifyPassword } = require('./passwords');
const studentFile = path.join(__dirname, 'student.json');
const student = existsSync(studentFile) ? require(studentFile) : require('./student.example.json');

const app = express();
const secret = randomBytes(32);
const tokenLifetime = 60 + student.variant;
const port = Number(process.env.PORT ?? 3001);
const issuer = 'web-lab-2-auth';
// Use the same password-checking work for unknown and existing logins.
const dummyHash = randomBytes(16).toString('hex') + ':' + randomBytes(64).toString('hex');

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use('/api', express.json({ limit: '4kb' }));

app.post('/api/register', async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = req.body?.password;
  if (!username || !validPassword(password)) {
    return res.status(400).json({ error: 'Вкажіть логін із 3–24 латинських літер, цифр або символів _ і пароль із 8–128 символів.' });
  }

  const hash = await hashPassword(password);
  if (!addUser(username, hash, 'user')) {
    return res.status(409).json({ error: 'Цей логін уже зайнято.' });
  }

  res.status(201).json({ username, role: 'user' });
});

app.post('/api/login', async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = req.body?.password;
  if (!username || !validPassword(password)) {
    return res.status(401).json({ error: 'Неправильний логін або пароль.' });
  }

  const user = findByName(username);
  const matches = await verifyPassword(password, user?.password_hash ?? dummyHash);
  if (!user || !matches) {
    return res.status(401).json({ error: 'Неправильний логін або пароль.' });
  }

  const authToken = jwt.sign({ ...student, role: user.role }, secret, {
    algorithm: 'HS256',
    issuer,
    subject: String(user.id),
    expiresIn: tokenLifetime,
  });
  res.json({ authToken });
});

function authenticate(req, res, next) {
  const match = req.get('Authorization')?.match(/^Bearer ([^\s]+)$/i);
  if (!match) {
    return res.status(401).json({ error: 'Для цієї дії потрібно увійти.' });
  }

  try {
    req.claims = jwt.verify(match[1], secret, { algorithms: ['HS256'], issuer });
  } catch (error) {
    const message = error.name === 'TokenExpiredError'
      ? 'Термін дії токена минув. Увійдіть ще раз.'
      : 'Недійсний токен. Увійдіть ще раз.';
    return res.status(401).json({ error: message });
  }

  req.user = findById(Number(req.claims.sub));
  if (!req.user) {
    return res.status(401).json({ error: 'Обліковий запис не знайдено.' });
  }

  next();
}

app.get('/api/profile', authenticate, (req, res) => {
  const { student, group, variant, iat, exp } = req.claims;
  res.json({ user: req.user, claims: { student, group, variant, iat, exp } });
});

app.get('/api/admin/users', authenticate, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Ця дія доступна лише адміністратору.' });
  }

  res.json({ users: listUsers() });
});

app.use(express.static(path.join(__dirname, 'public')));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Неправильний формат даних.' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Запит завеликий.' });
  }

  console.error(error);
  res.status(500).json({ error: 'Помилка сервера.' });
});

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Застосунок доступний за адресою http://127.0.0.1:${server.address().port}`);
});
