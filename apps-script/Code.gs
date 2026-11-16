/**
 * Baby Feed — Google Apps Script API (bound to the Google Sheet).
 *
 * Deploy: Web app, Execute as "Me", Who has access "Anyone".
 * Security is enforced here: every request (except login) needs a session
 * token. Sessions are issued only to emails listed (active) in `members`,
 * proven either by the companion login script (HMAC with LOGIN_SECRET,
 * see apps-script-login/) or by a Google Identity Services ID token.
 *
 * OAuth Web client ID: set CONFIG_CLIENT_ID in config.gs (not secret),
 * or Script Property CLIENT_ID (takes precedence).
 * Sheets are created automatically on the first request (or run setup()).
 */

const SHEETS = {
  events: [
    'id', 'baby_id', 'type', 'start_at', 'end_at', 'side', 'left_sec', 'right_sec',
    'amount_ml', 'milk_type', 'diaper', 'note',
    'created_by', 'updated_by', 'created_at', 'updated_at', 'deleted',
  ],
  babies: ['id', 'name', 'birth_date', 'gender', 'updated_at'],
  members: ['email', 'display_name', 'role', 'active'],
  sessions: ['token_hash', 'email', 'created_at', 'expires_at', 'user_agent'],
};

// Columns stored as plain text so Sheets does not auto-convert ISO dates / ids.
const TEXT_COLUMNS = {
  events: ['id', 'baby_id', 'start_at', 'end_at', 'created_at', 'updated_at'],
  babies: ['id', 'birth_date', 'updated_at'],
  sessions: ['token_hash', 'created_at', 'expires_at'],
};

const EVENT_TYPES = ['breast', 'bottle', 'pump', 'diaper', 'sleep'];
const CLIENT_FIELDS = [
  'id', 'baby_id', 'type', 'start_at', 'end_at', 'side', 'left_sec', 'right_sec',
  'amount_ml', 'milk_type', 'diaper', 'note', 'created_at', 'deleted',
];
const SESSION_DAYS = 30;
const SESSION_CACHE_SEC = 300;
// Pull window overlap, covers writes committed while a list was being read.
const SYNC_OVERLAP_MS = 2 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* One-time setup: run this from the Apps Script editor.               */
/* ------------------------------------------------------------------ */

function setup() {
  ensureSetup_(true);
  Logger.log('Setup done. Owner: ' + Session.getEffectiveUser().getEmail());
}

function ensureSetup_(force) {
  const props = PropertiesService.getScriptProperties();
  if (!force && props.getProperty('SETUP_VERSION') === '1') return;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(function (name) {
    const headers = SHEETS[name];
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
    (TEXT_COLUMNS[name] || []).forEach(function (col) {
      const idx = headers.indexOf(col) + 1;
      sh.getRange(1, idx, sh.getMaxRows(), 1).setNumberFormat('@');
    });
  });

  const babies = ss.getSheetByName('babies');
  if (babies.getLastRow() < 2) {
    babies.appendRow(['b1', 'Bé', '', '', new Date().toISOString()]);
  }

  const members = ss.getSheetByName('members');
  if (members.getLastRow() < 2) {
    const owner = Session.getEffectiveUser().getEmail();
    if (owner) members.appendRow([owner.toLowerCase(), 'Admin', 'admin', true]);
  }
  props.setProperty('SETUP_VERSION', '1');
}

function getClientId_() {
  const fromProps = PropertiesService.getScriptProperties().getProperty('CLIENT_ID');
  const fromConfig = typeof CONFIG_CLIENT_ID !== 'undefined' ? CONFIG_CLIENT_ID : '';
  return fromProps || fromConfig;
}

/* ------------------------------------------------------------------ */
/* HTTP entry points                                                   */
/* ------------------------------------------------------------------ */

function doGet(e) {
  return handle_((e && e.parameter) || {});
}

function doPost(e) {
  let body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ error: 'BAD_REQUEST', message: 'Invalid JSON' });
  }
  return handle_(body);
}

function handle_(req) {
  try {
    const action = req.action;
    ensureSetup_(false);
    if (action === 'ping') return json_({ ok: true, configured: !!getClientId_(), serverTime: nowIso_() });
    if (action === 'login') return json_(login_(req.idToken, req.userAgent));
    if (action === 'loginComplete') return json_(loginComplete_(req));
    if (action === 'loginClaim') return json_(loginClaim_(req.nonce));

    const user = auth_(req.token);
    if (!user) return json_({ error: 'UNAUTHORIZED' });

    switch (action) {
      case 'me':
        return json_({ user: user, babies: readRows_('babies') });
      case 'list':
        return json_(list_(req.since));
      case 'upsert':
        return json_(upsert_(user, req.events || []));
      case 'saveBaby':
        if (user.role !== 'admin') return json_({ error: 'FORBIDDEN' });
        return json_(saveBaby_(req.baby || {}));
      case 'logout':
        logout_(req.token);
        return json_({ ok: true });
      default:
        return json_({ error: 'BAD_REQUEST', message: 'Unknown action: ' + action });
    }
  } catch (err) {
    console.error(err);
    return json_({ error: 'SERVER_ERROR', message: String(err && err.message ? err.message : err) });
  }
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

function login_(idToken, userAgent) {
  if (!idToken) return { error: 'INVALID_TOKEN' };
  const clientId = getClientId_();
  if (!clientId) throw new Error('CLIENT_ID is not configured (config.gs or Script Property)');

  const res = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) return { error: 'INVALID_TOKEN' };

  const info = JSON.parse(res.getContentText());
  const verified = info.email_verified === true || info.email_verified === 'true';
  if (info.aud !== clientId || !verified || Number(info.exp) * 1000 < Date.now()) {
    return { error: 'INVALID_TOKEN' };
  }

  const email = String(info.email).toLowerCase();
  const member = findMember_(email);
  if (!member || !isTrue_(member.active)) return { error: 'NOT_MEMBER', email: email };

  return createSession_(member, info, userAgent);
}

function createSession_(member, info, userAgent) {
  const email = String(member.email).trim().toLowerCase();
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400000);

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_('sessions');
    cleanupSessions_(sh);
    sh.appendRow([sha256_(token), email, now.toISOString(), expires.toISOString(), String(userAgent || '').slice(0, 200)]);
  } finally {
    lock.releaseLock();
  }
  return { token: token, user: userOf_(member, info), expiresAt: expires.toISOString() };
}

/* ---- Login via the companion "Baby Feed Login" Apps Script (no OAuth client needed) ----
 * 1. App opens LOGIN_URL?nonce=N. That script runs as the visiting user, reads their
 *    Google email and signs (email|nonce|exp) with the shared LOGIN_SECRET.
 * 2. The login page posts {email, nonce, exp, sig} here (loginComplete).
 * 3. The app polls loginClaim(nonce) and receives the session token once.
 */
const NONCE_RE = /^[a-f0-9]{32,128}$/;

function loginComplete_(req) {
  const secret = typeof LOGIN_SECRET !== 'undefined' ? LOGIN_SECRET : '';
  if (!secret) throw new Error('LOGIN_SECRET is not configured');
  const nonce = String(req.nonce || '');
  const email = String(req.email || '').trim().toLowerCase();
  const exp = Number(req.exp);
  if (!NONCE_RE.test(nonce) || !email || !(exp > Date.now()) || exp > Date.now() + 15 * 60000) {
    return { error: 'INVALID_TOKEN' };
  }
  if (!safeEqual_(hmacHex_(secret, email + '|' + nonce + '|' + exp), String(req.sig || ''))) {
    return { error: 'INVALID_TOKEN' };
  }
  const member = findMember_(email);
  if (!member || !isTrue_(member.active)) return { error: 'NOT_MEMBER', email: email };

  const cache = CacheService.getScriptCache();
  const existing = cache.get('n:' + nonce);
  if (existing) return { ok: true, name: JSON.parse(existing).user.name };

  const session = createSession_(member, null, req.userAgent || 'apps-script-login');
  cache.put('n:' + nonce, JSON.stringify(session), 600);
  return { ok: true, name: session.user.name };
}

function loginClaim_(nonce) {
  nonce = String(nonce || '');
  if (!NONCE_RE.test(nonce)) return { error: 'BAD_REQUEST', message: 'Invalid nonce' };
  const cache = CacheService.getScriptCache();
  const v = cache.get('n:' + nonce);
  if (!v) return { pending: true };
  cache.remove('n:' + nonce);
  return JSON.parse(v);
}

function hmacHex_(key, value) {
  return Utilities.computeHmacSha256Signature(value, key)
    .map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, '0'); }).join('');
}

function safeEqual_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function auth_(token) {
  if (!token) return null;
  const hash = sha256_(String(token));
  const cache = CacheService.getScriptCache();
  const cached = cache.get('s:' + hash);
  if (cached) return JSON.parse(cached);

  const session = readRows_('sessions').filter(function (s) { return s.token_hash === hash; })[0];
  if (!session || new Date(session.expires_at).getTime() < Date.now()) return null;

  const member = findMember_(session.email);
  if (!member || !isTrue_(member.active)) return null;

  const user = userOf_(member);
  cache.put('s:' + hash, JSON.stringify(user), SESSION_CACHE_SEC);
  return user;
}

function logout_(token) {
  const hash = sha256_(String(token));
  CacheService.getScriptCache().remove('s:' + hash);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_('sessions');
    const values = sh.getDataRange().getValues();
    for (let r = values.length - 1; r >= 1; r--) {
      if (values[r][0] === hash) sh.deleteRow(r + 1);
    }
  } finally {
    lock.releaseLock();
  }
}

function cleanupSessions_(sh) {
  const values = sh.getDataRange().getValues();
  const now = Date.now();
  for (let r = values.length - 1; r >= 1; r--) {
    if (new Date(values[r][3]).getTime() < now) sh.deleteRow(r + 1);
  }
}

function findMember_(email) {
  email = String(email || '').toLowerCase();
  return readRows_('members').filter(function (m) {
    return String(m.email).trim().toLowerCase() === email;
  })[0];
}

function userOf_(member, info) {
  return {
    email: String(member.email).trim().toLowerCase(),
    name: member.display_name || (info && info.name) || member.email,
    role: member.role === 'admin' ? 'admin' : 'member',
    picture: (info && info.picture) || '',
  };
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

function list_(since) {
  const serverTime = nowIso_();
  let events = readRows_('events').map(normalizeEvent_);
  if (since) {
    const from = new Date(new Date(since).getTime() - SYNC_OVERLAP_MS).toISOString();
    events = events.filter(function (e) { return e.updated_at > from; });
  }
  return { events: events, serverTime: serverTime };
}

function upsert_(user, events) {
  if (!Array.isArray(events)) return { error: 'BAD_REQUEST', message: 'events must be an array' };
  if (events.length > 500) return { error: 'BAD_REQUEST', message: 'Too many events' };

  const headers = SHEETS.events;
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_('events');
    const values = sh.getDataRange().getValues();
    const rowById = {};
    for (let r = 1; r < values.length; r++) rowById[String(values[r][0])] = r; // 0-based index in values

    const now = nowIso_();
    const saved = [];
    const newRows = [];
    const newIndexById = {};

    events.forEach(function (input) {
      const ev = sanitizeEvent_(input);
      if (!ev) return;

      let base;
      if (rowById[ev.id] !== undefined) {
        base = rowToObj_(headers, values[rowById[ev.id]]);
      } else if (newIndexById[ev.id] !== undefined) {
        base = rowToObj_(headers, newRows[newIndexById[ev.id]]);
      } else {
        base = { created_by: user.email, created_at: ev.created_at || now };
      }

      const merged = {};
      headers.forEach(function (h) { merged[h] = base[h] !== undefined ? base[h] : ''; });
      CLIENT_FIELDS.forEach(function (f) { if (f !== 'created_at') merged[f] = ev[f]; });
      merged.created_by = base.created_by || user.email;
      merged.created_at = base.created_at || ev.created_at || now;
      merged.updated_by = user.email;
      merged.updated_at = now;

      const row = headers.map(function (h) { return merged[h]; });
      if (rowById[ev.id] !== undefined) {
        values[rowById[ev.id]] = row;
        sh.getRange(rowById[ev.id] + 1, 1, 1, headers.length).setValues([row]);
      } else if (newIndexById[ev.id] !== undefined) {
        newRows[newIndexById[ev.id]] = row;
      } else {
        newIndexById[ev.id] = newRows.length;
        newRows.push(row);
      }
      saved.push(merged);
    });

    if (newRows.length) {
      sh.getRange(sh.getLastRow() + 1, 1, newRows.length, headers.length).setValues(newRows);
    }
    return { events: saved.map(normalizeEvent_), serverTime: now };
  } finally {
    lock.releaseLock();
  }
}

function sanitizeEvent_(e) {
  if (!e || typeof e.id !== 'string' || !e.id || e.id.length > 64) return null;
  if (EVENT_TYPES.indexOf(e.type) < 0) return null;
  const num = function (v) {
    if (v === '' || v === null || v === undefined) return '';
    const n = Number(v);
    return isFinite(n) && n >= 0 ? Math.round(n) : '';
  };
  const str = function (v, max) { return v === null || v === undefined ? '' : String(v).slice(0, max || 100); };
  const pick = function (v, allowed) { return allowed.indexOf(v) >= 0 ? v : ''; };
  return {
    id: e.id,
    baby_id: str(e.baby_id, 64),
    type: e.type,
    start_at: str(e.start_at, 40),
    end_at: str(e.end_at, 40),
    side: pick(e.side, ['L', 'R', 'both']),
    left_sec: num(e.left_sec),
    right_sec: num(e.right_sec),
    amount_ml: num(e.amount_ml),
    milk_type: pick(e.milk_type, ['breast', 'formula']),
    diaper: pick(e.diaper, ['wet', 'dirty', 'both']),
    note: str(e.note, 500),
    created_at: str(e.created_at, 40),
    deleted: e.deleted === true,
  };
}

function normalizeEvent_(e) {
  const num = function (v) { return v === '' || v === null || v === undefined ? null : Number(v); };
  return {
    id: String(e.id),
    baby_id: String(e.baby_id || ''),
    type: e.type,
    start_at: isoOf_(e.start_at),
    end_at: isoOf_(e.end_at),
    side: e.side || '',
    left_sec: num(e.left_sec),
    right_sec: num(e.right_sec),
    amount_ml: num(e.amount_ml),
    milk_type: e.milk_type || '',
    diaper: e.diaper || '',
    note: String(e.note || ''),
    created_by: e.created_by || '',
    updated_by: e.updated_by || '',
    created_at: isoOf_(e.created_at),
    updated_at: isoOf_(e.updated_at),
    deleted: isTrue_(e.deleted),
  };
}

/* ------------------------------------------------------------------ */
/* Babies                                                              */
/* ------------------------------------------------------------------ */

function saveBaby_(b) {
  if (!b.id || !b.name) return { error: 'BAD_REQUEST', message: 'id and name are required' };
  const headers = SHEETS.babies;
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_('babies');
    const values = sh.getDataRange().getValues();
    const row = [String(b.id).slice(0, 64), String(b.name).slice(0, 60), String(b.birth_date || '').slice(0, 10),
      ['boy', 'girl'].indexOf(b.gender) >= 0 ? b.gender : '', nowIso_()];
    for (let r = 1; r < values.length; r++) {
      if (String(values[r][0]) === row[0]) {
        sh.getRange(r + 1, 1, 1, headers.length).setValues([row]);
        return { babies: readRows_('babies') };
      }
    }
    sh.appendRow(row);
    return { babies: readRows_('babies') };
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function sheet_(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Missing sheet "' + name + '". Run setup() first.');
  return sh;
}

function readRows_(name) {
  const values = sheet_(name).getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1)
    .filter(function (row) { return row[0] !== '' && row[0] !== null; })
    .map(function (row) { return rowToObj_(headers, row); });
}

function rowToObj_(headers, row) {
  const obj = {};
  headers.forEach(function (h, i) {
    const v = row[i];
    obj[h] = v instanceof Date ? v.toISOString() : v;
  });
  return obj;
}

function isoOf_(v) {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function isTrue_(v) {
  return v === true || String(v).toUpperCase() === 'TRUE';
}

function nowIso_() {
  return new Date().toISOString();
}

function sha256_(s) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, '0'); }).join('');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
