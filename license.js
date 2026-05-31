/**
 * EdgeWay PipeSpec — Licensmodul
 *
 * Nøgleformat:  EDGW-XXXX-XXXX-XXXX  (genereret af Render-admin)
 * Aktivering:   POST /activate på pipespec-proxy (kræver internet første gang)
 * Offline:      Signeret token gemmes krypteret i %APPDATA%/EdgeWay PipeSpec/license.dat
 * Maskine-lock: hwid baseret på hostname+platform+arch
 */

'use strict';

const crypto = require('crypto');
const path   = require('path');
const fs     = require('fs');
const os     = require('os');
const https  = require('https');

require('dotenv').config();

const PROXY_URL    = process.env.PROXY_URL || 'https://pipespec-proxy.onrender.com';
const HMAC_SECRET  = process.env.LICENSE_SECRET || 'edgeway-pipespec-1357';

// ── Hjælpefunktioner ─────────────────────────────────────────────────────────

function getMachineId() {
  const raw = os.hostname() + '-' + os.platform() + '-' + os.arch();
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32);
}

function getLicensePath() {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const dir = path.join(appData, 'EdgeWay PipeSpec');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'license.dat');
}

function encrypt(text) {
  const key = crypto.createHash('sha256').update(getMachineId()).digest();
  const iv  = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + enc.toString('hex');
}

function decrypt(data) {
  const [ivHex, encHex] = data.split(':');
  const key = crypto.createHash('sha256').update(getMachineId()).digest();
  const iv  = Buffer.from(ivHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

function verifyToken(token, licenseKey, hwid) {
  try {
    const [b64, sig] = token.split('.');
    const payload = JSON.parse(Buffer.from(b64, 'base64').toString());
    const expected = crypto
      .createHmac('sha256', HMAC_SECRET)
      .update(JSON.stringify({ licenseKey: payload.licenseKey, hwid: payload.hwid, plan: payload.plan, expiresAt: payload.expiresAt }))
      .digest('hex');
    if (sig !== expected)              return { valid: false, error: 'Ugyldigt token' };
    if (payload.hwid !== hwid)         return { valid: false, error: 'Licensen er aktiveret på en anden maskine' };
    if (payload.licenseKey !== licenseKey) return { valid: false, error: 'Nøgle-mismatch' };
    if (Date.now() > payload.expiresAt)    return { valid: false, error: `Licensen udløb den ${new Date(payload.expiresAt).toLocaleDateString('da-DK')}` };
    return { valid: true, plan: payload.plan, expiresAt: new Date(payload.expiresAt) };
  } catch {
    return { valid: false, error: 'Ugyldigt token-format' };
  }
}

// ── HTTP hjælper ──────────────────────────────────────────────────────────────

function postJSON(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      port:     u.port || 443,
      path:     u.pathname,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout:  10000,
    };
    const req = https.request(options, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); }
        catch { reject(new Error('Ugyldigt svar fra server')); }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ── Gem / indlæs lokalt ───────────────────────────────────────────────────────

function saveLicense(licenseKey, token, plan, expiresAt) {
  const data = JSON.stringify({
    licenseKey,
    token,
    plan,
    expiresAt:   expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt,
    machineId:   getMachineId(),
    activatedAt: new Date().toISOString(),
  });
  fs.writeFileSync(getLicensePath(), encrypt(data), 'utf8');
}

function loadLicense() {
  try {
    const raw  = fs.readFileSync(getLicensePath(), 'utf8');
    const data = JSON.parse(decrypt(raw));
    if (data.machineId !== getMachineId()) {
      return { valid: false, error: 'Licensen er aktiveret på en anden maskine' };
    }
    // Verificér token lokalt (offline-tjek)
    const check = verifyToken(data.token, data.licenseKey, getMachineId());
    if (!check.valid) return { valid: false, error: check.error };
    return { valid: true, plan: data.plan, expiresAt: new Date(data.expiresAt), licenseKey: data.licenseKey, token: data.token };
  } catch {
    return null;
  }
}

function deleteLicense() {
  try { fs.unlinkSync(getLicensePath()); } catch (_) {}
}

// ── Aktivering (kræver internet) ──────────────────────────────────────────────

async function activateKey(keyStr) {
  const key  = keyStr.trim().toUpperCase();
  const hwid = getMachineId();

  let result;
  try {
    result = await postJSON(`${PROXY_URL}/activate`, { licenseKey: key, hwid });
  } catch (err) {
    return { ok: false, error: `Ingen forbindelse til licensserver: ${err.message}` };
  }

  if (!result.ok) {
    return { ok: false, error: result.reason || 'Aktivering afvist af server' };
  }

  saveLicense(key, result.token, result.plan, new Date(result.expiresAt));
  return { ok: true, plan: result.plan, expiresAt: new Date(result.expiresAt) };
}

module.exports = {
  activateKey,
  loadLicense,
  deleteLicense,
  getMachineId,
};
