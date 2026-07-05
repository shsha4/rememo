const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join('C:', 'Users', 'minjun', 'Desktop', 'memo', '.memograph', 'index.db');
console.log('Opening database:', dbPath);

const db = new Database(dbPath);

console.log('\n=== NOTES ===');
const notes = db.prepare('SELECT title, path FROM notes').all();
console.log(notes);

console.log('\n=== LINKS ===');
const links = db.prepare('SELECT * FROM links').all();
console.log(links);

console.log('\n=== TAGS ===');
const tags = db.prepare('SELECT * FROM tags').all();
console.log(tags);

db.close();
