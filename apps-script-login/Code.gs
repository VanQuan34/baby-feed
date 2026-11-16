/**
 * Baby Feed — Google login helper (standalone Apps Script).
 *
 * Deploy: Web app, Execute as "User accessing the web app", Who has access
 * "Anyone with a Google account". It runs as the visitor, so it can read their
 * Google email (scope userinfo.email only — it cannot touch their data), then
 * signs (email|nonce|exp) with LOGIN_SECRET (secret.gs, shared with the main
 * API) and hands the signature to the page, which posts it to the main API.
 */

// Main API (apps-script/) web app URL.
const MAIN_API_URL = 'https://script.google.com/macros/s/AKfycbySEKZ34xTj1NI0sIm2nY9uacgfv45edYr54Jr-AeAU0Q_5gQOtGfGla4y-4lW-GAN1/exec';

function doGet(e) {
  const p = (e && e.parameter) || {};
  const nonce = String(p.nonce || '');
  const ret = /^https?:\/\/[^\s"'<>]+$/.test(p.return || '') ? String(p.return) : '';
  const email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  const exp = Date.now() + 10 * 60 * 1000;

  const data = {
    api: MAIN_API_URL,
    nonce: nonce,
    email: email,
    exp: exp,
    ret: ret,
    sig: /^[a-f0-9]{32,128}$/.test(nonce) && email ? hmacHex_(LOGIN_SECRET, email + '|' + nonce + '|' + exp) : '',
  };

  const t = HtmlService.createTemplateFromFile('page');
  // JSON embedded in a <script>: escape "<" so it can never close the tag.
  t.data = JSON.stringify(data).replace(/</g, '\\u003c');
  return t.evaluate()
    .setTitle('Baby Feed · Đăng nhập')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function hmacHex_(key, value) {
  return Utilities.computeHmacSha256Signature(value, key)
    .map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, '0'); }).join('');
}
