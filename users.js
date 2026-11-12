const { mkdirSync } = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const directory = path.join(__dirname, 'data');
const filename = process.env.LAB2_DB ?? path.join(directory, 'users.sqlite');
if (!process.env.LAB2_DB) mkdirSync(directory, { recursive: true });

const db = new DatabaseSync(filename, { timeout: 5000 });
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'admin'))
  ) STRICT
`);

const insert = db.prepare(`
  INSERT INTO users (username, password_hash, role)
  VALUES (?, ?, ?) ON CONFLICT(username) DO NOTHING
`);
const byName = db.prepare('SELECT * FROM users WHERE username = ?');
const byId = db.prepare('SELECT id, username, role FROM users WHERE id = ?');
const all = db.prepare('SELECT id, username, role FROM users ORDER BY id');

module.exports = {
  addUser: (username, hash, role) => insert.run(username, hash, role).changes === 1,
  findByName: (username) => byName.get(username),
  findById: (id) => byId.get(id),
  listUsers: () => all.all(),
};
