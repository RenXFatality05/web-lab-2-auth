const { randomBytes } = require('node:crypto');
const { normalizeUsername, hashPassword } = require('./passwords');

async function createAdmin() {
  const username = normalizeUsername(process.argv[2]);
  if (!username) {
    throw new Error('Вкажіть логін із 3–24 латинських літер, цифр або символів _.');
  }

  const { addUser } = require('./users');
  const password = randomBytes(18).toString('base64url');
  if (!addUser(username, await hashPassword(password), 'admin')) {
    throw new Error('Цей логін уже зайнято.');
  }

  console.log(`Адміністратора створено. Логін: ${username}`);
  console.log(`Пароль: ${password}`);
}

createAdmin().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
