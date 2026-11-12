const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');

const deriveKey = promisify(scrypt);
const keyLength = 64;

function normalizeUsername(value) {
  const username = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return /^[a-z0-9_]{3,24}$/.test(username) ? username : null;
}

function validPassword(password) {
  return typeof password === 'string' && password.length >= 8 && password.length <= 128;
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, keyLength);
  return [salt.toString('hex'), key.toString('hex')].join(':');
}

async function verifyPassword(password, hash) {
  const [salt, savedKey] = hash.split(':').map((part) => Buffer.from(part, 'hex'));
  const suppliedKey = await deriveKey(password, salt, keyLength);
  return timingSafeEqual(suppliedKey, savedKey);
}

module.exports = { normalizeUsername, validPassword, hashPassword, verifyPassword };
