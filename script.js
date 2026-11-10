const SUPABASE_URL = 'https://cyiwvqjmskwuphtcapug.supabase.co';
const SUPABASE_KEY = 'sb_publishable_KeA65VMTBBpzm2c00_EbCw_rkuZW1e0';

let supabaseClient = null;
let supabaseReady = false;
try {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    supabaseReady = true;
  }
} catch (e) { console.warn('[supabase]', e.message); }

const $ = id => document.getElementById(id);
const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function showToast(title, msg = '', kind = 'info') {
  const color = kind === 'success' ? '#3ddc84' : kind === 'err' ? '#ff4d4d' : kind === 'warn' ? '#ffcc00' : '#7c8cff';
  const t = document.createElement('div');
  t.style.cssText = 'background:#0d0d0d;border:1px solid #1a1a1a;border-left:3px solid ' + color + ';border-radius:8px;padding:10px 12px;color:#fff;font-size:12px;box-shadow:0 8px 30px rgba(0,0,0,0.5);';
  t.innerHTML = '<div style="font-weight:600;margin-bottom:2px;">' + escapeHtml(title) + '</div>' + (msg ? '<div style="font-size:11px;color:#999;">' + escapeHtml(msg) + '</div>' : '');
  $('toastStack').appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

let session = null;
let prompts = [];
let users = [];
let redeemCodes = [];
let notifications = [];
let notifHistory = [];
let webConfig = {
  bannerUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80',
  introTitle: 'Pengenalan System',
  introSubtitle: 'JaxxyJailbreak Core',
  introBody: 'JaxxyJailbreak adalah antarmuka pengujian prompt dan orkestrasi sistem.',
  heroTitle: 'Kumpulan Prompt Jailbreak',
  heroTag: 'prompt library · v3',
};
let telegramGroup = { name: '', link: '', bot: '' };
let musicConfig = { title: '', url: '', volume: 60 };
let verifyState = { step1: false, step2: false, token: '', verified: false };
let musicPlaying = false;

const isOwner = () => session && session.role === 'owner';
const isLoggedIn = () => session && session.role !== 'guest';
const isMemberOrAbove = () => session && ['member','vip','partner','admin','owner'].includes(session.role);

(function() {
  let p = 0;
  function render(txt) {
    $('bootFill').style.width = p + '%';
    $('bootPct').textContent = Math.floor(p) + '%';
    if (txt) $('bootStatus').innerHTML = txt + '<span class="caret"></span>';
  }
  render('initializing');
  function tick() {
    p = Math.min(100, p + (100 - p > 30 ? Math.random() * 5 + 1 : Math.random() * 2 + 0.4));
    render(p >= 100 ? 'ready' : p >= 60 ? 'loading config' : 'connecting supabase');
    if (p < 100) setTimeout(tick, 130);
    else {
      $('bootBrand').classList.add('loaded');
      $('bootLabel').textContent = 'complete';
      setTimeout(() => {
        $('bootLoading').classList.add('hide');
        $('bootAuth').classList.add('show');
      }, 400);
    }
  }
  setTimeout(tick, 400);
})();

document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    $('authLoginForm').classList.toggle('hidden', tab.dataset.atab !== 'login');
    $('authRegisterForm').classList.toggle('hidden', tab.dataset.atab !== 'register');
  });
});

$('authLoginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('al-user').value.trim(), pass = $('al-pass').value, err = $('al-err');
  err.textContent = '';
  if (!id || !pass) { err.textContent = 'isi username/email & password'; return; }
  if (!supabaseReady) { err.textContent = 'supabase tidak siap'; return; }
  try {
    const { data, error } = await supabaseClient.rpc('login_account', { p_identifier: id, p_password: pass });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || !row.ok) throw new Error(row ? row.message : 'login gagal');
    session = { username: row.username, role: row.role, email: row.email, account_id: row.account_id };
    hideBoot();
    await refreshAll();
    renderAll();
    showToast('Login berhasil', session.username, 'success');
  } catch (ex) { err.textContent = ex.message; }
});

$('authRegisterForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const u = $('ar-user').value.trim(), email = $('ar-email').value.trim();
  const p = $('ar-pass').value, p2 = $('ar-pass2').value, err = $('ar-err');
  err.textContent = '';
  if (!u || u.length < 3) { err.textContent = 'username min 3 karakter'; return; }
  if (!email || !email.includes('@')) { err.textContent = 'email tidak valid'; return; }
  if (p.length < 4) { err.textContent = 'password min 4 karakter'; return; }
  if (p !== p2) { err.textContent = 'konfirmasi password tidak cocok'; return; }
  if (!supabaseReady) { err.textContent = 'supabase tidak siap'; return; }
  try {
    const { data, error } = await supabaseClient.rpc('register_account', { p_username: u, p_email: email, p_password: p });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || !row.ok) throw new Error(row ? row.message : 'register gagal');
    const { data: ld, error: le } = await supabaseClient.rpc('login_account', { p_identifier: u, p_password: p });
    if (le) throw le;
    const lr = Array.isArray(ld) ? ld[0] : ld;
    if (!lr || !lr.ok) throw new Error('login otomatis gagal');
    session = { username: lr.username, role: lr.role, email: lr.email, account_id: lr.account_id };
    hideBoot();
    await refreshAll();
    renderAll();
    showToast('Akun dibuat', u, 'success');
  } catch (ex) { err.textContent = ex.message; }
});

$('authSkip').addEventListener('click', () => {
  session = { username: 'guest', role: 'guest' };
  hideBoot();
  renderAll();
});

function hideBoot() { $('bootScreen').style.display = 'none'; }
function showBoot() { $('bootScreen').style.display = ''; $('bootLoading').classList.remove('hide'); $('bootAuth').classList.remove('show'); }

async function refreshAll() {
  if (!supabaseReady) return;
  try {
    const [pR, uR, wR, tR, mR, rR] = await Promise.all([
      supabaseClient.rpc('get_prompts'),
      supabaseClient.rpc('get_users'),
      supabaseClient.rpc('get_web_config'),
      supabaseClient.rpc('get_telegram_config'),
      supabaseClient.rpc('get_music_config'),
      supabaseClient.rpc('get_redeem_codes'),
    ]);
    if (pR.data) prompts = pR.data.map(p => ({
      id: p.id, title: p.title, desc: p.description, body: p.body,
      tags: p.tags || [], role: p.role, author: p.author,
      date: p.date || (p.created_at || '').slice(0,10),
    }));
    if (uR.data) users = uR.data;
    if (wR.data && wR.data[0]) {
      const w = wR.data[0];
      webConfig = {
        bannerUrl: w.bannerUrl || webConfig.bannerUrl,
        introTitle: w.introTitle || webConfig.introTitle,
        introSubtitle: w.introSubtitle || webConfig.introSubtitle,
        introBody: w.introBody || webConfig.introBody,
        heroTitle: w.heroTitle || webConfig.heroTitle,
        heroTag: w.heroTag || webConfig.heroTag,
      };
    }
    if (tR.data && tR.data[0]) telegramGroup = tR.data[0];
    if (mR.data && mR.data[0]) musicConfig = mR.data[0];
    if (rR.data) redeemCodes = rR.data;

    if (isLoggedIn() && session.account_id) {
      const [nR, hR, vR] = await Promise.all([
        supabaseClient.rpc('get_notifications', { p_account_id: session.account_id }),
        supabaseClient.rpc('get_notification_history'),
        supabaseClient.rpc('check_my_verification', { p_account_id: session.account_id }),
      ]);
      if (nR.data) notifications = nR.data.map(n => ({ id: n.id, title: n.title, msg: n.message, kind: n.kind, read: n.read, time: timeAgo(n.created_at) }));
      if (hR.data) notifHistory = hR.data.map(h => ({ title: h.title, kind: h.kind, time: timeAgo(h.created_at) }));
      if (vR.data && vR.data[0]) verifyState.verified = !!vR.data[0].is_verified;
    }
    updateDbStatus();
  } catch (err) { console.warn('[refresh]', err.message); }
}

function timeAgo(iso) {
  if (!iso) return 'baru saja';
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'baru saja';
  if (d < 3600) return Math.floor(d/60) + 'm';
  if (d < 86400) return Math.floor(d/3600) + 'j';
  return Math.floor(d/86400) + 'h';
}

function updateDbStatus() {
  $('dbStatus').textContent = supabaseReady ? 'supabase' : 'offline';
  $('dbProject').textContent = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');
  $('dbSupabase').textContent = supabaseReady ? 'online' : 'offline';
  $('dbPrompts').textContent = prompts.length + ' rows';
  $('dbUsers').textContent = users.length + ' rows';
  $('dbRedeem').textContent = redeemCodes.length + ' rows';
}

function renderAll() {
  applyWebConfig();
  renderAuthSlot();
  renderAccount();
  renderVerify();
  renderPrompts();
  renderNotifications();
  renderOwnerPanel();
}

function renderAuthSlot() {
  if (isLoggedIn()) {
    $('authSlot').innerHTML = `<div class="owner-btn"><span class="owner-dot"></span><span class="owner-name">${escapeHtml(session.username)}</span><span class="owner-label">${escapeHtml(session.role)}</span><button class="owner-logout" id="topLogout">x</button></div>`;
    $('topLogout').addEventListener('click', doLogout);
  } else {
    $('authSlot').innerHTML = `<button class="login-btn" id="topLoginBtn">login</button>`;
    $('topLoginBtn').addEventListener('click', showBoot);
  }
  renderOwnerGate();
  $('verifyBadge').style.display = (isMemberOrAbove() && verifyState.verified) ? '' : 'none';
}

function renderAccount() {
  $('accUsername').textContent = session ? session.username : 'guest';
  $('accEmail').textContent = session ? (session.email || '-') : '-';
  $('accRole').textContent = session ? session.role : 'guest';
  $('accStatus').textContent = isLoggedIn() ? 'login aktif' : 'guest';
  $('accStatus').style.color = isLoggedIn() ? 'var(--ok)' : '';
  $('accPlan').textContent = session ? (session.role === 'owner' ? 'owner - unlimited' : session.role === 'vip' ? 'vip - pro' : session.role === 'member' ? 'member' : 'free') : 'free';
  $('accUserId').textContent = session ? (session.account_id || '-') : '-';
  $('accountAuthCard').style.display = isLoggedIn() ? 'none' : '';
  $('accountSessionCard').style.display = isLoggedIn() ? '' : 'none';
  renderTelegramAccess();
}

function doLogout() {
  session = null;
  verifyState = { step1: false, step2: false, token: '', verified: false };
  notifications = [];
  renderAll();
  showBoot();
}

$('accountLoginBtn').addEventListener('click', showBoot);
$('accountLogoutBtn').addEventListener('click', doLogout);

function renderOwnerGate() {
  $('ownerGate').style.display = isOwner() ? 'none' : '';
  $('ownerContent').style.display = isOwner() ? '' : 'none';
}

function renderTelegramAccess() {
  const card = $('accountTelegramCard'), box = $('accountTelegramAccess');
  if (!telegramGroup.link && !telegramGroup.bot) { card.style.display = 'none'; return; }
  card.style.display = '';
  if (isOwner()) {
    box.innerHTML = `<span class="ta-icon"><svg viewBox="0 0 24 24"><path d="M21.5 3.5 2.5 11.2c-.8.3-.8 1.4 0 1.7l5 1.8 1.9 5.7c.2.7 1.1.9 1.6.3l2.8-3.3 5.2 3.8c.6.4 1.4.1 1.6-.6l3-15.3c.2-.9-.7-1.6-1.6-1.2z"/></svg></span><div class="ta-info"><div class="ta-title">${escapeHtml(telegramGroup.name || 'grup telegram')}</div><div class="ta-desc">${escapeHtml(telegramGroup.bot || '-')}</div></div>${telegramGroup.link ? `<a class="ta-btn" href="${escapeHtml(telegramGroup.link)}" target="_blank">buka grup</a>` : ''}`;
  } else {
    box.innerHTML = `<span class="ta-icon"><svg viewBox="0 0 24 24"><path d="M21.5 3.5 2.5 11.2c-.8.3-.8 1.4 0 1.7l5 1.8 1.9 5.7c.2.7 1.1.9 1.6.3l2.8-3.3 5.2 3.8c.6.4 1.4.1 1.6-.6l3-15.3c.2-.9-.7-1.6-1.6-1.2z"/></svg></span><div class="ta-info"><div class="ta-title">akses bot grup</div><div class="ta-desc">buka bot untuk akses prompt dan update.</div></div>${telegramGroup.bot ? `<a class="ta-btn" href="${escapeHtml(telegramGroup.bot)}" target="_blank">buka bot</a>` : ''}`;
  }
}

function applyWebConfig() {
  $('introTitle').textContent = webConfig.introTitle;
  $('introSubtitle').textContent = webConfig.introSubtitle;
  $('introBody').textContent = webConfig.introBody;
  $('heroTitle').textContent = webConfig.heroTitle;
  $('heroTag').textContent = webConfig.heroTag;
  const img = $('bannerImg');
  if (webConfig.bannerUrl) { img.src = webConfig.bannerUrl; img.style.display = ''; }
  else { img.removeAttribute('src'); img.style.display = 'none'; }
}

function renderPrompts(filter = '') {
  const q = filter.trim().toLowerCase();
  const vis = prompts.filter(p => !q || p.title.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q) || p.tags.some(t => t.toLowerCase().includes(q)));
  $('promptCount').textContent = vis.length + ' prompt';
  $('promptGrid').innerHTML = '';
  vis.forEach(p => {
    const idx = prompts.indexOf(p) + 1;
    const c = document.createElement('div');
    c.className = 'prompt-card';
    c.innerHTML = `<div class="pc-head"><span class="pc-num">${String(idx).padStart(2,'0')}</span><div class="pc-main"><div class="pc-title-row"><span class="pc-title">${escapeHtml(p.title)}</span><span class="role-badge" data-role="${p.role}">${escapeHtml(p.role)}</span></div><div class="pc-desc">${escapeHtml(p.desc)}</div><div class="pc-meta"><span>${escapeHtml(p.author)}</span><span>${escapeHtml(p.date)}</span></div><div class="pc-tags">${p.tags.map(t => `<span class="tag-pill">${escapeHtml(t)}</span>`).join('')}</div></div></div><div class="pc-actions"><button class="btn ghost sm" data-act="view" data-i="${idx-1}">lihat</button><button class="btn ghost sm" data-act="copy" data-i="${idx-1}">salin</button><button class="btn sm" data-act="download" data-i="${idx-1}">unduh</button></div>`;
    $('promptGrid').appendChild(c);
  });
}

$('promptGrid').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const p = prompts[Number(b.dataset.i)];
  if (!p) return;
  if (b.dataset.act === 'view') {
    $('modalIdx').textContent = 'PROMPT';
    $('modalTitle').textContent = p.title;
    $('modalBody').textContent = p.body;
    $('modal').classList.add('show');
  }
  if (b.dataset.act === 'copy') {
    try { await navigator.clipboard.writeText(p.body); } catch {}
    showToast('Tersalin', p.title, 'success');
  }
  if (b.dataset.act === 'download') {
    const blob = new Blob(['# ' + p.title + '\n\n' + p.body], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.txt';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showToast('Terunduh', a.download, 'success');
  }
});
$('searchInput').addEventListener('input', () => renderPrompts($('searchInput').value));

document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => {
  if (e.target.hasAttribute('data-close') || e.target.hasAttribute('data-notif-close')) m.classList.remove('show');
}));
$('modalCopy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('modalBody').textContent); } catch {}
  showToast('Tersalin', '', 'success');
});
$('modalDownload').addEventListener('click', () => {
  const blob = new Blob([$('modalBody').textContent], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = $('modalTitle').textContent.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.txt';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
});

function renderNotifications() {
  const unread = notifications.filter(n => !n.read).length;
  $('notifBtn').classList.toggle('has-unread', unread > 0);
  $('notifDot').textContent = unread > 9 ? '9+' : String(unread);
  $('notifSub').textContent = unread + ' baru';
  const list = $('notifSheetList');
  list.innerHTML = '';
  if (notifications.length === 0) {
    list.innerHTML = '<p style="color:var(--dim);text-align:center;padding:20px;font-size:12px;">belum ada notifikasi</p>';
    return;
  }
  notifications.forEach(n => {
    const item = document.createElement('div');
    item.className = 'redeem-card' + (n.read ? ' used' : '');
    item.innerHTML = `<div class="rc-body"><div class="rc-code">${escapeHtml(n.title)}</div>${n.msg ? '<div style="font-size:11px;color:var(--dim-2);margin-bottom:4px;">' + escapeHtml(n.msg) + '</div>' : ''}<div class="rc-meta"><span class="pill ${n.read ? 'used' : 'free'}">${n.read ? 'dibaca' : 'baru'}</span><span class="pill">${escapeHtml(n.time)}</span></div></div>`;
    item.addEventListener('click', async () => {
      if (!n.read && isLoggedIn()) {
        try { await supabaseClient.rpc('mark_notif_read', { p_notif_id: n.id, p_account_id: session.account_id }); } catch {}
      }
      n.read = true; renderNotifications();
    });
    list.appendChild(item);
  });
}
$('notifBtn').addEventListener('click', () => {
  if (!isLoggedIn()) { showToast('Login dulu', '', 'warn'); return; }
  $('notifSheet').classList.add('show');
});
$('notifMarkAll').addEventListener('click', async () => {
  if (!session) return;
  if (supabaseReady) { try { await supabaseClient.rpc('mark_all_notif_read', { p_account_id: session.account_id }); } catch {} }
  notifications.forEach(n => n.read = true);
  renderNotifications();
});

function renderVerify() {
  $('stepJoinGroup').href = telegramGroup.link || '#';
  $('stepOpenBot').href = telegramGroup.bot || telegramGroup.link || '#';

  if (isMemberOrAbove() && verifyState.verified) {
    $('verifySteps').style.display = 'none';
    $('verifyHero').style.display = 'none';
    $('verifyDone').style.display = '';
    return;
  }
  $('verifyDone').style.display = 'none';
  $('verifySteps').style.display = '';
  $('verifyHero').style.display = '';
  $('vstep-1').classList.toggle('done', !!verifyState.step1);
  $('vstep-2').classList.toggle('locked', !verifyState.step1);
  $('vstep-2').classList.toggle('done', !!verifyState.step2);
  $('vstep-3').classList.toggle('locked', !verifyState.step2);
  $('vstep-3').classList.toggle('done', !!verifyState.token);
  $('vstep-4').classList.toggle('locked', !verifyState.token);
  $('vstep-5').classList.toggle('locked', !verifyState.token || !isLoggedIn());
  $('verifyToken').value = verifyState.token || '';
  $('verifyAuthActions').style.display = isLoggedIn() ? 'none' : '';
  $('verifyAuthInfo').style.display = isLoggedIn() ? '' : 'none';
  if (isLoggedIn()) $('verifySessionUser').textContent = session.username;
}
$('step1Next').addEventListener('click', () => { verifyState.step1 = true; renderVerify(); });
$('step2Next').addEventListener('click', () => { verifyState.step2 = true; renderVerify(); });
$('verifyToken').addEventListener('input', () => { verifyState.token = $('verifyToken').value.trim(); renderVerify(); });
$('verifyGotoLogin').addEventListener('click', showBoot);
$('verifySubmit').addEventListener('click', async () => {
  const err = $('verifyError');
  err.textContent = '';
  if (!verifyState.token) { err.textContent = 'token kosong'; return; }
  if (!isLoggedIn()) { err.textContent = 'login dulu dengan akun member kamu'; return; }
  $('verifyLoading').style.display = 'inline-flex';
  $('verifySubmit').disabled = true;
  try {
    const { data, error } = await supabaseClient.rpc('confirm_member_verify', {
      p_token: verifyState.token, p_account_id: session.account_id,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || !row.ok) throw new Error(row ? row.message : 'verifikasi gagal');
    session.role = 'member';
    verifyState.verified = true;
    await refreshAll(); renderAll();
    showToast('Verifikasi berhasil', 'kamu sekarang member', 'success');
  } catch (ex) { err.textContent = ex.message; }
  finally { $('verifyLoading').style.display = 'none'; $('verifySubmit').disabled = false; }
});

window.switchPanel = function(target) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const p = $('panel-' + target);
  if (p) p.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.target === target));
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const t = item.dataset.target;
    if (t === 'owner') {
      if (!isOwner()) { showBoot(); closeDrawer(); return; }
      closeDrawer(); openOwnerOverlay(); return;
    }
    switchPanel(t); closeDrawer();
  });
});

function openDrawer() { $('drawer').classList.add('open'); $('overlay').classList.add('show'); }
function closeDrawer() { $('drawer').classList.remove('open'); $('overlay').classList.remove('show'); }
$('menuBtn').addEventListener('click', () => $('drawer').classList.contains('open') ? closeDrawer() : openDrawer());
$('closeBtn').addEventListener('click', closeDrawer);
$('overlay').addEventListener('click', closeDrawer);

function openOwnerOverlay() { if (!isOwner()) { showBoot(); return; } $('ownerOverlay').classList.add('show'); renderOwnerPanel(); }
function closeOwnerOverlay() { $('ownerOverlay').classList.remove('show'); }
$('ownerBack').addEventListener('click', closeOwnerOverlay);
$('openOwnerOverlayBtn').addEventListener('click', openOwnerOverlay);
$('ownerGateLogin').addEventListener('click', showBoot);

$('ownerGridMenu').addEventListener('click', (e) => {
  const card = e.target.closest('.owner-grid-card');
  if (!card) return;
  const name = card.dataset.ocard;
  const sub = $('osub-' + name);
  if (sub) {
    document.querySelectorAll('.owner-sub').forEach(s => s.classList.remove('show'));
    sub.classList.add('show');
    if (name === 'users') renderUserList();
    if (name === 'prompts') renderOwnerPromptList();
    if (name === 'telegram') fillTelegram();
    if (name === 'redeem') renderRedeem();
    if (name === 'notify') renderNotifHistory();
    if (name === 'music') fillMusic();
    if (name === 'web') fillWeb();
  }
});
document.querySelectorAll('.owner-sub-back').forEach(b => b.addEventListener('click', () => b.closest('.owner-sub').classList.remove('show')));

function renderOwnerPanel() {
  $('statTotal').textContent = users.length;
  $('statOwner').textContent = users.filter(u => u.role === 'owner').length;
  $('statPrompt').textContent = prompts.length;
  $('statRedeem').textContent = redeemCodes.filter(r => !r.used).length;
  $('ogcUsers').textContent = users.length;
  $('ogcPrompts').textContent = prompts.length;
  $('ogcTelegram').textContent = (telegramGroup.link || telegramGroup.bot) ? 'v' : '-';
  $('ogcRedeem').textContent = redeemCodes.filter(r => !r.used).length;
  $('ogcNotif').textContent = notifHistory.length;
  $('ogcMusic').textContent = musicConfig.url ? 'v' : '-';
  $('ogcWeb').textContent = webConfig.bannerUrl ? 'v' : '-';
}

function renderUserList() {
  const list = $('userList');
  list.innerHTML = '';
  users.forEach(u => {
    const row = document.createElement('div');
    row.className = 'user-row';
    row.innerHTML = `<div class="u-main"><span class="avatar">${escapeHtml((u.name||'?')[0].toUpperCase())}</span><div class="u-info"><span class="u-name">${escapeHtml(u.name)}</span><span class="u-id">${escapeHtml((u.id||'').slice(0,8))}</span></div></div><div class="u-actions"><select class="role-select" data-id="${u.id}">${['owner','admin','partner','vip','member'].map(r => `<option value="${r}" ${u.role===r?'selected':''}>${r}</option>`).join('')}</select><button class="btn danger ghost sm" data-del="${u.id}">hapus</button></div>`;
    list.appendChild(row);
  });
  list.querySelectorAll('.role-select').forEach(sel => sel.addEventListener('change', async () => {
    try {
      const { data, error } = await supabaseClient.rpc('owner_update_user_role', {
        p_owner_id: session.account_id, p_user_id: sel.dataset.id, p_new_role: sel.value,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || !row.ok) throw new Error(row ? row.message : 'gagal');
      showToast('Role diubah', sel.value, 'success');
      await refreshAll(); renderUserList(); renderOwnerPanel();
    } catch (ex) { showToast('Gagal', ex.message, 'err'); }
  }));
  list.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('hapus user?')) return;
    try {
      const { data, error } = await supabaseClient.rpc('owner_delete_user', {
        p_owner_id: session.account_id, p_user_id: b.dataset.del,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || !row.ok) throw new Error(row ? row.message : 'gagal');
      await refreshAll(); renderUserList(); renderOwnerPanel();
      showToast('User dihapus', '', 'success');
    } catch (ex) { showToast('Gagal', ex.message, 'err'); }
  }));
}
$('addUserBtn').addEventListener('click', async () => {
  const name = $('newUserName').value.trim(), role = $('newUserRole').value;
  if (!name) { showToast('Gagal', 'nama kosong', 'err'); return; }
  try {
    const { data, error } = await supabaseClient.rpc('owner_add_user', {
      p_owner_id: session.account_id, p_name: name, p_role: role,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || !row.ok) throw new Error(row ? row.message : 'gagal');
    $('newUserName').value = '';
    await refreshAll(); renderUserList(); renderOwnerPanel();
    showToast('User ditambah', name, 'success');
  } catch (ex) { showToast('Gagal', ex.message, 'err'); }
});

function renderOwnerPromptList() {
  const list = $('ownerPromptList');
  list.innerHTML = '';
  prompts.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'redeem-card';
    row.innerHTML = `<div class="rc-body"><div class="rc-code">${String(i+1).padStart(2,'0')} - ${escapeHtml(p.title)}</div><div class="rc-meta"><span class="pill">${escapeHtml(p.role)}</span><span class="pill">${p.tags.length} tags</span></div></div><div class="redeem-actions"><button class="btn ghost sm" data-edit="${i}">edit</button><button class="btn danger ghost sm" data-delp="${i}">hapus</button></div>`;
    list.appendChild(row);
  });
  list.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
    const p = prompts[Number(b.dataset.edit)];
    $('pf-index').value = b.dataset.edit;
    $('pf-title').value = p.title;
    $('pf-role').value = p.role;
    $('pf-desc').value = p.desc;
    $('pf-tags').value = p.tags.join(', ');
    $('pf-body').value = p.body;
    $('promptFormTitle').textContent = 'Edit: ' + p.title;
    $('pf-submit').textContent = 'simpan';
    $('pf-cancel').style.display = '';
  }));
  list.querySelectorAll('[data-delp]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('hapus prompt?')) return;
    const i = Number(b.dataset.delp);
    try {
      const { data, error } = await supabaseClient.rpc('owner_delete_prompt', {
        p_owner_id: session.account_id, p_prompt_id: prompts[i].id,
      });
      if (error) throw error;
      await refreshAll(); renderOwnerPromptList(); renderPrompts(); renderOwnerPanel();
      showToast('Prompt dihapus', '', 'success');
    } catch (ex) { showToast('Gagal', ex.message, 'err'); }
  }));
}
$('promptForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = $('pf-title').value.trim(), desc = $('pf-desc').value.trim(), body = $('pf-body').value.trim();
  const tags = $('pf-tags').value.split(',').map(t => t.trim()).filter(Boolean);
  const role = $('pf-role').value;
  if (!title || !desc || !body) { showToast('Gagal', 'lengkapi', 'err'); return; }
  const idx = $('pf-index').value === '' ? -1 : Number($('pf-index').value);
  try {
    if (idx >= 0) {
      const { error } = await supabaseClient.rpc('owner_update_prompt', {
        p_owner_id: session.account_id, p_prompt_id: prompts[idx].id,
        p_title: title, p_description: desc, p_body: body, p_tags: tags, p_role: role,
      });
      if (error) throw error;
      showToast('Prompt diupdate', title, 'success');
    } else {
      const { error } = await supabaseClient.rpc('owner_add_prompt', {
        p_owner_id: session.account_id,
        p_title: title, p_description: desc, p_body: body, p_tags: tags, p_role: role,
      });
      if (error) throw error;
      showToast('Prompt ditambah', title, 'success');
    }
    resetPromptForm();
    await refreshAll(); renderOwnerPromptList(); renderPrompts(); renderOwnerPanel();
  } catch (ex) { showToast('Gagal', ex.message, 'err'); }
});
function resetPromptForm() {
  $('pf-index').value = ''; $('pf-title').value = ''; $('pf-desc').value = ''; $('pf-tags').value = ''; $('pf-body').value = ''; $('pf-role').value = 'owner';
  $('promptFormTitle').textContent = 'Tambah Prompt Baru';
  $('pf-submit').textContent = '+ tambah prompt';
  $('pf-cancel').style.display = 'none';
}
$('pf-cancel').addEventListener('click', resetPromptForm);

function fillTelegram() {
  $('tgName').value = telegramGroup.name || '';
  $('tgLink').value = telegramGroup.link || '';
  $('tgBot').value = telegramGroup.bot || '';
}
async function saveTelegram(name, link, bot) {
  try {
    const { error } = await supabaseClient.rpc('owner_update_telegram', {
      p_owner_id: session.account_id, p_name: name, p_link: link, p_bot: bot,
    });
    if (error) throw error;
    telegramGroup = { name, link, bot };
    fillTelegram(); renderTelegramAccess(); renderVerify(); renderOwnerPanel();
    showToast('Telegram disimpan', '', 'success');
  } catch (ex) { showToast('Gagal', ex.message, 'err'); }
}
$('tgSave').addEventListener('click', () => saveTelegram($('tgName').value.trim(), $('tgLink').value.trim(), $('tgBot').value.trim()));
$('tgSkip').addEventListener('click', () => saveTelegram('', '', ''));
$('tgClear').addEventListener('click', () => saveTelegram('', '', ''));

function renderRedeem() {
  const list = $('redeemList');
  list.innerHTML = '';
  if (redeemCodes.length === 0) { list.innerHTML = '<p style="color:var(--dim);font-size:11px;">belum ada kode</p>'; return; }
  redeemCodes.forEach(r => {
    const c = document.createElement('div');
    c.className = 'redeem-card' + (r.used ? ' used' : '');
    c.innerHTML = `<div class="rc-body"><div class="rc-code">${escapeHtml(r.code)}</div><div class="rc-meta"><span class="pill vip">${escapeHtml(r.role)}</span><span class="pill">${r.days}h</span><span class="pill ${r.used ? 'used' : 'free'}">${r.used ? 'terpakai' : 'aktif'}</span></div></div><div class="redeem-actions">${!r.used ? `<button class="btn ghost sm" data-mark="${r.id}">pakai</button>` : ''}<button class="btn danger ghost sm" data-delr="${r.id}">hapus</button></div>`;
    list.appendChild(c);
  });
  list.querySelectorAll('[data-mark]').forEach(b => b.addEventListener('click', async () => {
    try {
      const { error } = await supabaseClient.rpc('owner_mark_redeem_used', {
        p_owner_id: session.account_id, p_code_id: b.dataset.mark,
      });
      if (error) throw error;
      await refreshAll(); renderRedeem(); renderOwnerPanel();
    } catch (ex) { showToast('Gagal', ex.message, 'err'); }
  }));
  list.querySelectorAll('[data-delr]').forEach(b => b.addEventListener('click', async () => {
    try {
      const { error } = await supabaseClient.rpc('owner_delete_redeem', {
        p_owner_id: session.account_id, p_code_id: b.dataset.delr,
      });
      if (error) throw error;
      await refreshAll(); renderRedeem(); renderOwnerPanel();
    } catch (ex) { showToast('Gagal', ex.message, 'err'); }
  }));
}
$('rdGenerate').addEventListener('click', async () => {
  const role = $('rd-role').value, days = parseInt($('rd-days').value) || 30, count = parseInt($('rd-count').value) || 1;
  try {
    const { error } = await supabaseClient.rpc('owner_generate_redeem', {
      p_owner_id: session.account_id, p_role: role, p_days: days, p_count: count,
    });
    if (error) throw error;
    showToast('Kode dibuat', count + ' kode', 'success');
    await refreshAll(); renderRedeem(); renderOwnerPanel();
  } catch (ex) { showToast('Gagal', ex.message, 'err'); }
});

function renderNotifHistory() {
  const list = $('nfHistory');
  list.innerHTML = '';
  if (notifHistory.length === 0) { list.innerHTML = '<p style="color:var(--dim);font-size:11px;">belum ada riwayat</p>'; return; }
  notifHistory.slice(0, 20).forEach(h => {
    const r = document.createElement('div');
    r.className = 'redeem-card';
    r.innerHTML = `<div class="rc-body"><div class="rc-code">${escapeHtml(h.title)}</div><div class="rc-meta"><span class="pill">${escapeHtml(h.kind)}</span><span class="pill">${escapeHtml(h.time)}</span></div></div>`;
    list.appendChild(r);
  });
}
$('nfSend').addEventListener('click', async () => {
  const title = $('nf-title').value.trim(), msg = $('nf-msg').value.trim(), kind = $('nf-kind').value;
  if (!title) { showToast('Gagal', 'judul kosong', 'err'); return; }
  try {
    const { error } = await supabaseClient.rpc('send_broadcast', {
      p_title: title, p_message: msg, p_kind: kind, p_sender: session.account_id,
    });
    if (error) throw error;
    $('nf-title').value = ''; $('nf-msg').value = '';
    await refreshAll(); renderNotifHistory(); renderNotifications(); renderOwnerPanel();
    showToast('Notif terkirim', title, 'success');
  } catch (ex) { showToast('Gagal', ex.message, 'err'); }
});

function fillMusic() {
  $('ms-title').value = musicConfig.title || '';
  $('ms-url').value = musicConfig.url || '';
  $('ms-volume').value = musicConfig.volume || 60;
}
$('msSave').addEventListener('click', async () => {
  const title = $('ms-title').value.trim(), url = $('ms-url').value.trim(), vol = parseInt($('ms-volume').value) || 60;
  if (!url) { showToast('Gagal', 'url kosong', 'err'); return; }
  try {
    const { error } = await supabaseClient.rpc('owner_update_music', {
      p_owner_id: session.account_id, p_title: title, p_url: url, p_volume: vol,
    });
    if (error) throw error;
    musicConfig = { title, url, volume: vol };
    applyMusic(); renderOwnerPanel();
    showToast('Musik disimpan', '', 'success');
  } catch (ex) { showToast('Gagal', ex.message, 'err'); }
});
$('msClear').addEventListener('click', async () => {
  try {
    const { error } = await supabaseClient.rpc('owner_update_music', {
      p_owner_id: session.account_id, p_title: '', p_url: '', p_volume: 60,
    });
    if (error) throw error;
    musicConfig = { title: '', url: '', volume: 60 };
    applyMusic(); renderOwnerPanel();
    showToast('Musik dihapus', '', 'warn');
  } catch (ex) { showToast('Gagal', ex.message, 'err'); }
});
function applyMusic() {
  if (!musicConfig.url) { $('musicWidget').classList.remove('show'); $('audioPlayer').removeAttribute('src'); $('audioPlayer').load(); $('mwTitle').textContent = 'musik'; $('mwSub').textContent = 'belum di-set'; musicPlaying = false; updatePlayIcon(); return; }
  $('musicWidget').classList.add('show');
  $('mwTitle').textContent = musicConfig.title || 'musik';
  $('audioPlayer').src = musicConfig.url;
  $('audioPlayer').volume = musicConfig.volume / 100;
  $('audioPlayer').loop = true;
  updatePlayIcon();
}
function updatePlayIcon() {
  $('mwPlayIcon').style.display = musicPlaying ? 'none' : '';
  $('mwPauseIcon').style.display = musicPlaying ? '' : 'none';
  $('mwSub').textContent = musicPlaying ? 'playing' : 'paused';
}
$('mwToggle').addEventListener('click', async () => {
  if (!musicConfig.url) return;
  try { if (musicPlaying) { $('audioPlayer').pause(); musicPlaying = false; } else { await $('audioPlayer').play(); musicPlaying = true; } } catch {}
  updatePlayIcon();
});
$('mwClose').addEventListener('click', () => { $('musicWidget').classList.remove('show'); $('audioPlayer').pause(); musicPlaying = false; updatePlayIcon(); });

function fillWeb() {
  $('webBanner').value = webConfig.bannerUrl || '';
  $('webIntroTitle').value = webConfig.introTitle || '';
  $('webIntroSubtitle').value = webConfig.introSubtitle || '';
  $('webIntroBody').value = webConfig.introBody || '';
  $('webHeroTitle').value = webConfig.heroTitle || '';
  $('webHeroTag').value = webConfig.heroTag || '';
  const p = $('webBannerPreview');
  if (webConfig.bannerUrl) { p.src = webConfig.bannerUrl; p.style.display = ''; } else p.style.display = 'none';
}
$('webBanner').addEventListener('input', () => {
  const v = $('webBanner').value.trim(), p = $('webBannerPreview');
  if (v && /^https?:\/\//i.test(v)) { p.src = v; p.style.display = ''; } else p.style.display = 'none';
});
$('webSave').addEventListener('click', async () => {
  try {
    const { error } = await supabaseClient.rpc('update_web_config', {
      p_account_id: session.account_id,
      p_banner_url: $('webBanner').value.trim(),
      p_intro_title: $('webIntroTitle').value.trim(),
      p_intro_subtitle: $('webIntroSubtitle').value.trim(),
      p_intro_body: $('webIntroBody').value.trim(),
      p_hero_title: $('webHeroTitle').value.trim(),
      p_hero_tag: $('webHeroTag').value.trim(),
    });
    if (error) throw error;
    await refreshAll(); applyWebConfig(); fillWeb(); renderOwnerPanel();
    showToast('Set web disimpan', '', 'success');
  } catch (ex) { showToast('Gagal', ex.message, 'err'); }
});

document.querySelectorAll('.theme-option').forEach(opt => opt.addEventListener('click', () => {
  const name = opt.dataset.theme;
  document.documentElement.setAttribute('data-theme', name);
  localStorage.setItem('jaxxy-theme', name);
  document.querySelectorAll('.theme-option').forEach(o => o.classList.toggle('selected', o.dataset.theme === name));
}));
(function() {
  const s = localStorage.getItem('jaxxy-theme') || 'brutalism';
  document.documentElement.setAttribute('data-theme', s);
  document.querySelectorAll('.theme-option').forEach(o => o.classList.toggle('selected', o.dataset.theme === s));
})();

(async function init() {
  $('dbStatus').textContent = supabaseReady ? 'supabase' : 'offline';
  if (supabaseReady) { try { await refreshAll(); } catch (e) { console.warn(e); } }
  renderAll();
  if (musicConfig.url) applyMusic();
})();