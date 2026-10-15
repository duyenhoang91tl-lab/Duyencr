#!/usr/bin/env node
// Giai ma file tai ve cua TAI KHOAN TEST (.enc) — xem js/51-demo-guard.js.
// Dung:  node tools/decrypt-demo-file.js <file.enc> <demoToken> [file_ra]
// demoToken: o sheet Settings (key demoToken). Dinh dang: 'DEMOENC1' | salt16 | iv12 | ciphertext+tag(16). PBKDF2-SHA256 100000 vong, AES-256-GCM.
const fs = require('fs'), crypto = require('crypto');
const [inp, token, outArg] = process.argv.slice(2);
if (!inp || !token) { console.error('Dung: node tools/decrypt-demo-file.js <file.enc> <demoToken> [file_ra]'); process.exit(1); }
const b = fs.readFileSync(inp);
if (b.length < 52 || b.slice(0, 8).toString() !== 'DEMOENC1') { console.error('Khong phai file DEMOENC1'); process.exit(1); }
const salt = b.slice(8, 24), iv = b.slice(24, 36), ct = b.slice(36, b.length - 16), tag = b.slice(b.length - 16);
const key = crypto.pbkdf2Sync(token, salt, 100000, 32, 'sha256');
const d = crypto.createDecipheriv('aes-256-gcm', key, iv); d.setAuthTag(tag);
let out; try { out = Buffer.concat([d.update(ct), d.final()]); } catch (e) { console.error('Giai ma that bai: sai demoToken hoac file bi sua'); process.exit(2); }
const outPath = outArg || inp.replace(/\.enc$/, '') || inp + '.dec';
fs.writeFileSync(outPath, out); console.log('Da giai ma ->', outPath, '(' + out.length + ' byte)');
