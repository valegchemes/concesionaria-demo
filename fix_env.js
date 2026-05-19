const fs = require('fs');
let b = fs.readFileSync('.env');
let s = b.toString('utf16le');
if (s.indexOf('DATABASE') === -1) s = b.toString('utf8');
s = s.replace(/\0/g, '');
const lines = s.split('\n').filter(l => !l.includes('BLOB_READ_WRITE_TOKEN') && l.trim().length > 0);
lines.push('BLOB_READ_WRITE_TOKEN="vercel_blob_rw_dummy_token_for_build"');
fs.writeFileSync('.env', lines.join('\n'), 'utf8');
console.log('Fixed .env');
