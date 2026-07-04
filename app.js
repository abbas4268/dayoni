'use strict';

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

// وظائف مساعدة محسنة
const esc = v => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const num = v => Number(String(v ?? '').replace(/[^0-9.-]/g,'')) || 0;
const clean = v => String(v ?? '').replace(/[^0-9]/g,'');
const money = n => `${Number(n || 0).toLocaleString('en-US')} د.ع`;
const iraqPhone = v => {
  const p = clean(v);
  if (!p) return '';
  if (p.startsWith('964')) return p;
  return `964${p.replace(/^0+/, '')}`;
};
const nowISO = () => new Date().toISOString();
const pad = n => String(n).padStart(2, '0');
const fmt = t => {
  const d = t ? new Date(t) : new Date();
  if (isNaN(d)) return '-';
  return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const toast = (msg, isError = false) => {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.style.borderColor = isError ? 'var(--danger)' : 'var(--green)';
  t.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add('hidden'), 2500);
};

const id = () => `AR-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2,5).toUpperCase()}`;

// حالات الجهاز مع أيقونات وتقدم
const statuses = {
  received: { label: 'تم الاستلام', icon: '📥', progress: 10 },
  checking: { label: 'جاري الفحص', icon: '🔍', progress: 25 },
  approval: { label: 'بانتظار موافقة الزبون', icon: '🟠', progress: 35 },
  part: { label: 'بانتظار قطعة', icon: '🧩', progress: 45 },
  repairing: { label: 'جاري الإصلاح', icon: '🔧', progress: 65 },
  testing: { label: 'الاختبار', icon: '🧪', progress: 80 },
  ready: { label: 'جاهز للاستلام', icon: '✅', progress: 95 },
  delivered: { label: 'تم التسليم', icon: '📦', progress: 100 },
  cancelled: { label: 'ملغي', icon: '⛔', progress: 0 }
};

// تعيين الحالات القديمة إلى الجديدة
const oldStatus = {
  under: 'repairing',
  done: 'ready',
  delivered: 'delivered',
  rejected: 'cancelled',
  new: 'received',
  inspection: 'checking',
  ready: 'ready'
};

// المتغيرات العامة
let currentUser = null, profile = {}, devices = {}, rawPhones = {}, rawRepairs = {}, activeInvoiceId = null;
const params = new URLSearchParams(location.search);
const isTrack = params.has('track');
const uid = () => currentUser?.uid;
const root = () => db.ref(`users/${uid()}`);
const phoneIndex = p => db.ref(`phoneIndex/${clean(p)}`);

// تعبئة خيارات الحالة
function fillStatusOptions() {
  const html = Object.entries(statuses).map(([k, s]) =>
    `<option value="${k}">${s.icon} ${s.label}</option>`
  ).join('');
  $('#statusSelect').innerHTML = html;
  $('#statusFilter').innerHTML = `<option value="all">كل الحالات</option>` + html;
  $('#statusChoices').innerHTML = Object.entries(statuses).map(([k, s]) =>
    `<button type="button" data-set-status="${k}">${s.icon}<br>${s.label}</button>`
  ).join('');
}

// تطبيع بيانات الجهاز
function normalizeDevice(key, r) {
  if (!r) return null;
  const st = oldStatus[r.status] || r.status || 'received';
  const price = num(r.price ?? r.repairPrice);
  const paid = num(r.paid ?? r.paidAmount);
  const created = r.createdAt || r.receivedAt || Date.now();
  const timeline = Array.isArray(r.timeline) ? r.timeline : [{
    status: st,
    label: statuses[st]?.label || st,
    at: typeof created === 'number' ? new Date(created).toISOString() : created,
    note: 'تم إنشاء السجل'
  }];
  return {
    _id: key,
    receiptNo: r.receiptNo || key,
    customerName: r.customerName || r.clientName || '-',
    customerPhone: r.customerPhone || r.clientPhone || '',
    deviceName: r.deviceName || r.deviceModel || r.brand || 'هاتف',
    deviceBrand: r.deviceBrand || r.brand || '',
    deviceColor: r.deviceColor || r.color || '',
    imei: r.imei || r.serial || '',
    problem: r.problem || r.fault || '-',
    accessories: r.accessories || '',
    price,
    paid,
    remaining: r.remaining !== undefined ? num(r.remaining) : Math.max(0, price - paid),
    status: statuses[st] ? st : 'received',
    notes: r.notes || r.diagnosis || '',
    expectedDate: r.expectedDate || '',
    createdAt: typeof created === 'number' ? new Date(created).toISOString() : created,
    updatedAt: r.updatedAt || created,
    timeline
  };
}

function daysSince(t) {
  const d = new Date(t);
  if (isNaN(d)) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

function latestByStatus(r, st) {
  const item = [...(r.timeline || [])].reverse().find(x => x.status === st);
  return item?.at || '';
}

function trackUrl(r) {
  const ownerId = uid() || params.get('uid') || '';
  return `${location.origin}${location.pathname}?track=1&uid=${encodeURIComponent(ownerId)}&id=${encodeURIComponent(r._id)}`;
}

// تحميل صفحة المتابعة
async function loadTrack() {
  $('#splash').classList.add('hidden');
  $('#trackView').classList.remove('hidden');
  const u = params.get('uid'), did = params.get('id');
  try {
    let s = await db.ref(`users/${u}/devices/${did}`).get();
    if (!s.exists()) s = await db.ref(`users/${u}/phones/${did}`).get();
    if (!s.exists()) s = await db.ref(`users/${u}/repairs/${did}`).get();
    if (!s.exists()) throw Error('not found');
    const r = normalizeDevice(did, s.val());
    const st = statuses[r.status] || statuses.received;
    $('#trackBox').innerHTML = `
      <div class="deviceCard">
        <h2>${esc(r.deviceName)}</h2>
        <p>الزبون: ${esc(r.customerName)}</p>
        <p>العطل: ${esc(r.problem)}</p>
        <span class="badge">${st.icon} ${st.label}</span> <span class="agePill">${daysSince(r.createdAt)} يوم</span>
        <div class="progress"><i style="width:${st.progress}%"></i></div>
        <p>نسبة الإنجاز: ${st.progress}%</p>
        <p>الباقي: <b class="money">${money(r.remaining)}</b></p>
      </div>
      ${timelineHtml(r)}
    `;
  } catch (e) {
    $('#trackBox').innerHTML = '<div class="task">الرابط غير صالح أو السجل غير موجود.</div>';
  }
}

// الإقلاع
function boot() {
  fillStatusOptions();
  setInterval(clock, 1000);
  clock();
  setTimeout(() => $('#splash').classList.add('hidden'), 600);

  if (typeof firebase === 'undefined' || typeof auth === 'undefined' || typeof db === 'undefined') {
    $('#authView')?.classList.remove('hidden');
    toast('تعذر الاتصال بخدمات Firebase. تأكد من الإنترنت ثم حدّث الصفحة.', true);
    return;
  }

  if (isTrack) return loadTrack();

  bindUI();
  auth.onAuthStateChanged(u => {
    currentUser = u;
    document.body.classList.toggle('signedIn', !!u);
    if (u) {
      $('#authView').classList.add('hidden');
      $('#appView').classList.remove('hidden');
      listen();
    } else {
      $('#authView').classList.remove('hidden');
      $('#appView').classList.add('hidden');
    }
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js?v=3001').catch(() => {});
  }
}

function clock() {
  const d = new Date();
  if ($('#liveClock')) {
    $('#liveClock').textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}

// ربط واجهة المستخدم
function bindUI() {
  $('#loginTab').onclick = () => authTab('login');
  $('#registerTab').onclick = () => authTab('register');
  $('#loginForm').onsubmit = login;
  $('#registerForm').onsubmit = register;
  $('#backBtn').onclick = () => goPage('homePage');
  $('#refreshBtn').onclick = () => location.reload();
  $('#logoutBtn').onclick = () => auth.signOut();
  $('#themeBtn').onclick = () => {
    document.body.classList.toggle('light');
    localStorage.abbasTheme = document.body.classList.contains('light') ? 'light' : 'dark';
    $('#themeBtn').textContent = document.body.classList.contains('light') ? '☀' : '◐';
  };
  if (localStorage.abbasTheme === 'light') {
    document.body.classList.add('light');
    $('#themeBtn').textContent = '☀';
  }

  $$('[data-page]').forEach(b => b.onclick = () => goPage(b.dataset.page));
  $$('[data-open-phone]').forEach(b => b.onclick = () => openDevice());
  $$('[data-modal]').forEach(b => b.onclick = () => openModal(b.dataset.modal));

  document.addEventListener('click', e => {
    const close = e.target.closest('[data-close]');
    if (close) closeModal(close.closest('.modal')?.id);
    if (e.target.classList?.contains('modal')) closeModal(e.target.id);
    const st = e.target.closest('[data-set-status]');
    if (st) setStatus(st.dataset.setStatus);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') $$('.modal:not(.hidden)').forEach(m => closeModal(m.id));
  });

  $('#deviceForm').onsubmit = saveDevice;
  $('#companyForm').onsubmit = saveProfile;
  $('#searchInput').oninput = renderDevices;
  $('#statusFilter').onchange = renderDevices;
  $('#price').oninput = calcRemain;
  $('#paid').oninput = calcRemain;
  $('#addTermBtn').onclick = addTerm;
  $('#printBtn').onclick = () => window.print();
  $('#shareBtn').onclick = shareInvoice;
  $('#exportBackupBtn').onclick = exportBackup;
  $('#importBackupBtn').onclick = () => $('#importFile').click();
  $('#importFile').onchange = importBackup;
}

function authTab(t) {
  $('#loginTab').classList.toggle('active', t === 'login');
  $('#registerTab').classList.toggle('active', t === 'register');
  $('#loginForm').classList.toggle('hidden', t !== 'login');
  $('#registerForm').classList.toggle('hidden', t !== 'register');
}

// التسجيل
async function register(e) {
  e.preventDefault();
  const ownerName = $('#ownerName').value.trim(),
        shopName = $('#shopName').value.trim(),
        phone = $('#regPhone').value.trim(),
        email = $('#regEmail').value.trim(),
        pass = $('#regPassword').value,
        pass2 = $('#regPassword2').value;
  if (!ownerName || !shopName || !phone || !email || !pass) return toast('أكمل الحقول');
  if (pass !== pass2) return toast('كلمتا المرور غير متطابقتين');
  try {
    const c = await auth.createUserWithEmailAndPassword(email, pass);
    await db.ref(`users/${c.user.uid}/profile`).set({
      ownerName, shopName, phone, email, address: '',
      terms: ['المحل غير مسؤول عن الأجهزة المتروكة أكثر من 30 يوماً بعد التبليغ.', 'الضمان يشمل العطل نفسه فقط ولا يشمل سوء الاستخدام.'],
      theme: 'dark',
      createdAt: nowISO()
    });
    await phoneIndex(phone).set({ uid: c.user.uid, email, phone, shopName });
    toast('🎉 تم إنشاء الحساب بنجاح');
  } catch (err) {
    toast('تعذر إنشاء الحساب', true);
  }
}

// الدخول
async function login(e) {
  e.preventDefault();
  const ident = $('#loginIdentity').value.trim(), pass = $('#loginPassword').value;
  if (!ident || !pass) return toast('اكتب البيانات');
  try {
    let email = ident;
    if (!ident.includes('@')) {
      const s = await phoneIndex(ident).get();
      if (!s.exists()) throw Error();
      email = s.val().email;
    }
    await auth.signInWithEmailAndPassword(email, pass);
  } catch (err) {
    toast('بيانات الدخول غير صحيحة', true);
  }
}

// الاستماع للتغييرات في Firebase
function listen() {
  root().child('profile').on('value', s => {
    profile = s.val() || {};
    applyProfile();
  });
  root().child('devices').on('value', s => {
    devices = {};
    Object.entries(s.val() || {}).forEach(([k, v]) => devices[k] = normalizeDevice(k, v));
    mergeLegacy();
  });
  root().child('phones').on('value', s => {
    rawPhones = s.val() || {};
    mergeLegacy();
  });
  root().child('repairs').on('value', s => {
    rawRepairs = s.val() || {};
    mergeLegacy();
  });
}

function mergeLegacy() {
  Object.entries(rawRepairs || {}).forEach(([k, v]) => {
    if (!devices[k]) devices[k] = normalizeDevice(k, v);
  });
  Object.entries(rawPhones || {}).forEach(([k, v]) => {
    if (!devices[k]) devices[k] = normalizeDevice(k, v);
  });
  renderAll();
}

function applyProfile() {
  $('#welcomeName').textContent = `أهلاً ${profile.ownerName || 'عباس راضي'}`;
  $('#welcomeShop').textContent = profile.shopName || 'سجل الصيانة الذكي';
  $('#setShop').value = profile.shopName || '';
  $('#setOwner').value = profile.ownerName || '';
  $('#setPhone').value = profile.phone || '';
  $('#setAddress').value = profile.address || '';
  renderTerms();
}

function arr() {
  return Object.values(devices).filter(Boolean).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function renderAll() {
  renderStats();
  renderDevices();
  renderTasks();
}

function filterList(kind) {
  const a = arr();
  const today = new Date().toISOString().slice(0, 10);
  switch (kind) {
    case 'all': return a;
    case 'open': return a.filter(r => !['delivered', 'cancelled'].includes(r.status));
    case 'ready': return a.filter(r => r.status === 'ready');
    case 'delivered': return a.filter(r => r.status === 'delivered');
    case 'debt': return a.filter(r => r.remaining > 0);
    case 'paid': return a.filter(r => r.paid > 0);
    case 'late': return a.filter(r => !['delivered', 'cancelled'].includes(r.status) && daysSince(r.createdAt) >= 7);
    case 'noDebt': return a.filter(r => r.remaining <= 0);
    case 'today': return a.filter(r => String(r.createdAt || '').slice(0, 10) === today);
    case 'cancelled': return a.filter(r => r.status === 'cancelled');
    default: return a;
  }
}


function renderSmartInsights(totals, list) {
  const safeCount = totals.count || 1;
  const debtRatio = Math.round((list.filter(r => r.remaining > 0).length / safeCount) * 100);
  const ready = list.filter(r => r.status === 'ready').length;
  const open = list.filter(r => !['delivered', 'cancelled'].includes(r.status)).length;
  const late = filterList('late').length;
  const today = filterList('today').length;
  const collectionPower = totals.price ? Math.round((totals.paid / totals.price) * 100) : 0;
  const message = late > 0 ? `يوجد ${late} جهاز متأخر يحتاج متابعة اليوم.` : ready > 0 ? `يوجد ${ready} جهاز جاهز للاستلام؛ فرصة ممتازة لتحصيل الباقي.` : open > 0 ? 'العمل تحت السيطرة، تابع الحالات للحفاظ على لوحة مرتبة.' : 'لا توجد أجهزة مفتوحة حالياً. يمكنك إضافة جهاز جديد أو مراجعة التقارير.';
  const el = $('#smartInsights');
  if (!el) return;
  el.innerHTML = `
    <button class="insightCard heroInsight" onclick="openSmartList('late','الأجهزة المتأخرة')">
      <span>تنبيه ذكي</span><b>${esc(message)}</b><em>اضغط لعرض المتأخر</em>
    </button>
    <button class="insightCard" onclick="openSmartList('debt','تحصيل الديون')">
      <span>نسبة الديون</span><b>${debtRatio}%</b><em>${money(totals.rem)} باقي</em>
    </button>
    <button class="insightCard" onclick="openSmartList('paid','التحصيل')">
      <span>قوة التحصيل</span><b>${collectionPower}%</b><em>${money(totals.paid)} واصل</em>
    </button>
    <button class="insightCard" onclick="openSmartList('today','إضافات اليوم')">
      <span>اليوم</span><b>${today}</b><em>أجهزة جديدة</em>
    </button>
  `;
}

// إحصاءات سريعة
function renderStats() {
  const a = arr();
  const totals = a.reduce((m, r) => {
    m.count++;
    m.price += r.price;
    m.paid += r.paid;
    m.rem += r.remaining;
    if (r.status === 'delivered') m.del++;
    if (r.status === 'ready') m.ready++;
    if (!['delivered', 'cancelled'].includes(r.status)) m.open++;
    return m;
  }, { count: 0, price: 0, paid: 0, rem: 0, del: 0, ready: 0, open: 0 });

  $('#quickStats').innerHTML = `
    <button class="miniStat" onclick="openSmartList('all','كل الهواتف')">
      <span>📱 الهواتف</span><b>${totals.count}</b><em>كل السجلات</em>
    </button>
    <button class="miniStat" onclick="openSmartList('open','الأجهزة المفتوحة')">
      <span>🧰 المفتوحة</span><b>${totals.open}</b><em>قيد العمل</em>
    </button>
    <button class="miniStat" onclick="openSmartList('ready','جاهز للاستلام')">
      <span>✅ جاهز</span><b>${totals.ready}</b><em>اتصل بالزبون</em>
    </button>
    <button class="miniStat" onclick="openSmartList('paid','الأجهزة التي بها واصل')">
      <span>💰 الواصل</span><b>${money(totals.paid)}</b><em>تحصيل</em>
    </button>
    <button class="miniStat dangerStat" onclick="openSmartList('debt','الأجهزة التي عليها باقي')">
      <span>📉 الباقي</span><b>${money(totals.rem)}</b><em>ديون</em>
    </button>
    <button class="miniStat" onclick="openSmartList('today','أجهزة مضافة اليوم')">
      <span>📅 اليوم</span><b>${filterList('today').length}</b><em>مضاف حديثاً</em>
    </button>
  `;
  renderSmartInsights(totals, a);

  const cards = [
    ['all', 'عدد الهواتف', totals.count],
    ['open', 'الأجهزة المفتوحة', totals.open],
    ['ready', 'جاهز للاستلام', totals.ready],
    ['delivered', 'تم التسليم', totals.del],
    ['all', 'المبلغ الكلي', money(totals.price)],
    ['paid', 'الواصل', money(totals.paid)],
    ['debt', 'الديون', money(totals.rem)],
    ['debt', 'متوسط الباقي', totals.count ? money(Math.round(totals.rem / totals.count)) : money(0)]
  ];


  const score = Math.max(35, Math.min(100, 100 - (totals.rem > 0 ? 14 : 0) - (filterList('late').length * 7) + (totals.ready ? 4 : 0)));
  const hs = $('#healthScore');
  if (hs) hs.innerHTML = `<b>${score}%</b><span>${score >= 85 ? 'ممتاز' : score >= 65 ? 'جيد يحتاج متابعة' : 'يحتاج ترتيب'}</span>`;

  $('#statsGrid').innerHTML = cards.map(x =>
    `<button type="button" class="statCard smartCard" onclick="openSmartList('${x[0]}','${x[1]}')">
      <span>${x[1]}</span><b>${x[2]}</b><em>اضغط للعرض</em>
    </button>`
  ).join('');
}

// مهام اليوم
function renderTasks() {
  const ready = filterList('ready'), late = filterList('late'), debt = filterList('debt'), today = filterList('today');
  $('#todayHint').textContent = `${late.length} متأخر`;
  $('#todayTasks').innerHTML = `
    <button class="task smartTask" onclick="openSmartList('ready','أجهزة جاهزة للاستلام')">
      ✅ أجهزة جاهزة للاستلام: <b>${ready.length}</b><span>عرض الأجهزة</span>
    </button>
    <button class="task smartTask" onclick="openSmartList('late','أجهزة مر عليها أكثر من 7 أيام')">
      ⏱️ أجهزة مر عليها أكثر من 7 أيام: <b>${late.length}</b><span>عرض المتأخرة</span>
    </button>
    <button class="task smartTask" onclick="openSmartList('debt','زبائن عليهم باقي')">
      💰 زبائن عليهم باقي: <b>${debt.length}</b><span>عرض الديون</span>
    </button>
    <button class="task smartTask" onclick="openSmartList('today','أجهزة مضافة اليوم')">
      📅 أجهزة مضافة اليوم: <b>${today.length}</b><span>عرض اليوم</span>
    </button>
  `;
}

// قائمة ذكية
function openSmartList(kind, title) {
  const list = filterList(kind);
  let modal = $('#smartModal');
  if (!modal) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="smartModal" class="modal hidden">
        <div class="sheet smartSheet">
          <div class="sheetHead">
            <b id="smartTitle">النتائج</b>
            <button type="button" onclick="closeModal('smartModal')">✕</button>
          </div>
          <div id="smartSummary" class="smartSummary"></div>
          <div id="smartList" class="cards smartList"></div>
        </div>
      </div>
    `);
    modal = $('#smartModal');
  }
  const sum = list.reduce((m, r) => { m.price += r.price; m.paid += r.paid; m.rem += r.remaining; return m; }, { price: 0, paid: 0, rem: 0 });
  $('#smartTitle').textContent = title;
  $('#smartSummary').innerHTML = `
    <div><span>العدد</span><b>${list.length}</b></div>
    <div><span>الواصل</span><b>${money(sum.paid)}</b></div>
    <div><span>الباقي</span><b>${money(sum.rem)}</b></div>
  `;
  $('#smartList').innerHTML = list.map(cardHtml).join('') || '<div class="task">لا توجد نتائج داخل هذا القسم.</div>';
  openModal('smartModal');
}

// عرض الأجهزة
function renderDevices() {
  const q = ($('#searchInput')?.value || '').toLowerCase();
  const sf = $('#statusFilter')?.value || 'all';
  const list = arr().filter(r =>
    (sf === 'all' || r.status === sf) &&
    `${r.customerName} ${r.customerPhone} ${r.deviceName} ${r.deviceBrand} ${r.imei} ${r.problem} ${r.receiptNo}`.toLowerCase().includes(q)
  );
  $('#devicesList').innerHTML = list.map(cardHtml).join('') || '<div class="task">لا توجد أجهزة مطابقة.</div>';
}

function cardHtml(r) {
  const st = statuses[r.status] || statuses.received;
  return `
    <article class="deviceCard">
      <div class="deviceTop">
        <div>
          <h3>${esc(r.deviceName)}</h3>
          <p>${esc(r.customerName)} - ${esc(r.customerPhone)}</p>
          <span class="badge">${st.icon} ${st.label}</span> <span class="agePill">${daysSince(r.createdAt)} يوم</span>
        </div>
        <b class="money">${money(r.remaining)}</b>
      </div>
      <p>العطل: ${esc(r.problem)}</p>
      <p>رقم الاستلام: ${esc(r.receiptNo)}</p>
      <div class="progress"><i style="width:${st.progress}%"></i></div>
      <div class="cardActions">
        <button onclick="openDevice('${r._id}')">✏️ تعديل</button>
        <button onclick="openStatus('${r._id}')">🔄 حالة</button>
        <button onclick="showInvoice('${r._id}')">🧾 فاتورة</button>
        <button onclick="whatsappFollow('${r._id}')">📱 متابعة</button>
        <button onclick="removeDevice('${r._id}')">🗑️ حذف</button>
      </div>
      ${timelineHtml(r, 3)}
    </article>
  `;
}

function timelineHtml(r, limit = 99) {
  const items = (r.timeline || []).slice(-limit).reverse();
  return `
    <div class="timeline">
      ${items.map(x =>
        `<div class="timeItem">
          <b>${fmt(x.at)}</b>
          <span>${esc(statuses[x.status]?.icon || '•')} ${esc(x.label || statuses[x.status]?.label || x.status)}${x.note ? ` — ${esc(x.note)}` : ''}</span>
        </div>`
      ).join('')}
    </div>
  `;
}

function goPage(page) {
  const target = $('#' + page);
  if (!target) return;
  $$('.page').forEach(p => p.classList.remove('active'));
  target.classList.add('active');
  $('#backBtn').classList.toggle('hidden', page === 'homePage');
  $$('[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  scrollTo({ top: 0, behavior: 'smooth' });
}

function openModal(id) {
  const modal = $('#' + id);
  if (!modal) return;
  modal.classList.remove('hidden');
  document.body.classList.add('modalOpen');
}
function closeModal(id) {
  if (id) $('#' + id)?.classList.add('hidden');
  if (!$('.modal:not(.hidden)')) document.body.classList.remove('modalOpen');
}

function calcRemain() {
  $('#remaining').value = Math.max(0, num($('#price').value) - num($('#paid').value));
}

// فتح جهاز للتعديل أو الإضافة
function openDevice(did) {
  $('#deviceForm').reset();
  $('#editingId').value = '';
  $('#deviceModalTitle').textContent = '📱 إضافة هاتف';
  $('#statusSelect').value = 'received';
  $('#expectedDate').value = '';
  if (did) {
    const r = devices[did];
    $('#editingId').value = did;
    $('#deviceModalTitle').textContent = '✏️ تعديل الهاتف';
    $('#customerName').value = r.customerName;
    $('#customerPhone').value = r.customerPhone;
    $('#deviceName').value = r.deviceName;
    $('#deviceBrand').value = r.deviceBrand;
    $('#deviceColor').value = r.deviceColor;
    $('#imei').value = r.imei;
    $('#problem').value = r.problem;
    $('#accessories').value = r.accessories;
    $('#price').value = r.price;
    $('#paid').value = r.paid;
    $('#remaining').value = r.remaining;
    $('#statusSelect').value = r.status;
    $('#expectedDate').value = r.expectedDate;
    $('#notes').value = r.notes;
  }
  openModal('deviceModal');
}

async function saveDevice(e) {
  e.preventDefault();
  const did = $('#editingId').value || id();
  const old = devices[did];
  const st = $('#statusSelect').value;
  const price = num($('#price').value);
  const paid = num($('#paid').value);
  const data = {
    receiptNo: old?.receiptNo || did,
    customerName: $('#customerName').value.trim(),
    customerPhone: $('#customerPhone').value.trim(),
    deviceName: $('#deviceName').value.trim(),
    deviceBrand: $('#deviceBrand').value.trim(),
    deviceColor: $('#deviceColor').value.trim(),
    imei: $('#imei').value.trim(),
    problem: $('#problem').value.trim(),
    accessories: $('#accessories').value.trim(),
    price,
    paid,
    remaining: Math.max(0, price - paid),
    status: st,
    expectedDate: $('#expectedDate').value,
    notes: $('#notes').value.trim(),
    createdAt: old?.createdAt || nowISO(),
    updatedAt: nowISO(),
    timeline: old?.timeline || [{ status: st, label: statuses[st].label, at: nowISO(), note: 'تم استلام الجهاز' }]
  };
  if (!data.customerName || !data.deviceName || !data.problem) return toast('اكتب اسم الزبون ونوع الجهاز والعطل');
  if (data.paid > data.price && data.price > 0) return toast('الواصل لا يمكن أن يكون أكبر من السعر', true);
  if (old && old.status !== st) {
    data.timeline = [...(old.timeline || []), { status: st, label: statuses[st].label, at: nowISO(), note: 'تغيير من نموذج الجهاز' }];
  }
  try {
    await root().child('devices').child(did).set(data);
    closeModal('deviceModal');
    goPage('devicesPage');
    toast('💾 تم حفظ الجهاز');
  } catch (err) {
    toast('تعذر الحفظ', true);
  }
}

// تغيير الحالة
function openStatus(did) {
  $('#statusDeviceId').value = did;
  $('#statusNote').value = '';
  openModal('statusModal');
}

async function setStatus(st) {
  const did = $('#statusDeviceId').value;
  const r = devices[did];
  if (!r || !statuses[st]) return;
  const note = $('#statusNote').value.trim();
  const item = { status: st, label: statuses[st].label, at: nowISO(), note };
  try {
    await root().child('devices').child(did).update({
      status: st,
      updatedAt: nowISO(),
      timeline: [...(r.timeline || []), item]
    });
    closeModal('statusModal');
    toast('✅ تم تحديث الحالة');
  } catch (err) {
    toast('تعذر تحديث الحالة', true);
  }
}

async function removeDevice(did) {
  if (!confirm('🗑️ حذف هذا الجهاز؟')) return;
  try {
    await root().child('devices').child(did).remove();
    toast('تم الحذف');
  } catch (e) {
    toast('تعذر الحذف', true);
  }
}

// الفاتورة
function showInvoice(did) {
  const r = devices[did];
  if (!r) return;
  activeInvoiceId = did;
  const st = statuses[r.status] || statuses.received;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(trackUrl(r))}`;
  const terms = (profile.terms || []).map((t, i) => `<p>${i+1}. ${esc(t)}</p>`).join('') || '<p>لا توجد شروط.</p>';
  $('#invoiceBox').innerHTML = `
    <div class="invoice">
      <div class="invHead">
        <div>
          <h2>${esc(profile.shopName || 'عباس راضي')}</h2>
          <p>سجل الصيانة الذكي</p>
          <small>${esc(profile.phone || '')} ${esc(profile.address || '')}</small>
        </div>
        <b>${esc(r.receiptNo)}</b>
      </div>
      <div class="invGrid">
        <div class="invBox">
          <div class="row"><b>الزبون</b><span>${esc(r.customerName)}</span></div>
          <div class="row"><b>رقم الهاتف</b><span>${esc(r.customerPhone)}</span></div>
          <div class="row"><b>الجهاز</b><span>${esc(r.deviceName)} ${esc(r.deviceBrand)}</span></div>
          <div class="row"><b>IMEI</b><span>${esc(r.imei || '-')}</span></div>
          <div class="row"><b>العطل</b><span>${esc(r.problem)}</span></div>
          <div class="row"><b>الحالة</b><span>${st.icon} ${st.label}</span></div>
          <div class="row"><b>السعر</b><span>${money(r.price)}</span></div>
          <div class="row"><b>الواصل</b><span>${money(r.paid)}</span></div>
          <div class="row"><b>الباقي</b><span>${money(r.remaining)}</span></div>
        </div>
        <div class="invBox qr">
          <img src="${qr}" alt="QR">
          <p>📱 مسح للمتابعة</p>
        </div>
      </div>
      <div class="invBox" style="margin-top:12px">
        <b>📋 السجل الزمني</b>
        ${timelineHtml(r, 99)}
      </div>
      <div class="invBox" style="margin-top:12px">
        <b>📜 الشروط</b>
        ${terms}
      </div>
    </div>
  `;
  openModal('invoiceModal');
}

// مشاركة الفاتورة عبر WhatsApp
function shareInvoice() {
  const r = devices[activeInvoiceId];
  if (!r) return;
  const msg = `🧾 فاتورة صيانة\n\nالزبون: ${r.customerName}\nالجهاز: ${r.deviceName}\nالعطل: ${r.problem}\nالسعر: ${money(r.price)}\nالواصل: ${money(r.paid)}\nالباقي: ${money(r.remaining)}\nالحالة: ${statuses[r.status]?.label}\nرقم الاستلام: ${r.receiptNo}\n\nللمتابعة: ${trackUrl(r)}`;
  const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

// متابعة عبر WhatsApp
function whatsappFollow(did) {
  const r = devices[did];
  if (!r) return;
  const phone = iraqPhone(r.customerPhone);
  if (!phone) return toast('لا يوجد رقم زبون', true);
  const deliveredAt = latestByStatus(r, 'delivered') || latestByStatus(r, 'ready') || r.createdAt;
  const d = daysSince(deliveredAt);
  const st = statuses[r.status]?.label || 'تحت المتابعة';
  const msg = `السلام عليكم ${r.customerName}\nمعك محل ${profile.shopName || 'عباس راضي'} لصيانة الهواتف.\nجهازكم: ${r.deviceName}\nالحالة الحالية: ${st}\nمر ${d} يوم على آخر تحديث.\nرقم الاستلام: ${r.receiptNo}\nشكراً لكم 🌹`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

// الملف الشخصي
async function saveProfile(e) {
  e.preventDefault();
  try {
    await root().child('profile').update({
      shopName: $('#setShop').value.trim(),
      ownerName: $('#setOwner').value.trim(),
      phone: $('#setPhone').value.trim(),
      address: $('#setAddress').value.trim(),
      updatedAt: nowISO()
    });
    closeModal('companyModal');
    toast('💾 تم حفظ التفاصيل');
  } catch (err) {
    toast('تعذر الحفظ', true);
  }
}

function renderTerms() {
  const terms = profile.terms || [];
  $('#termsList').innerHTML = terms.map((t, i) =>
    `<div class="term">
      <span>${esc(t)}</span>
      <button type="button" onclick="deleteTerm(${i})">🗑️</button>
    </div>`
  ).join('') || '<div class="task">لا توجد شروط.</div>';
}

async function addTerm() {
  const v = $('#newTerm').value.trim();
  if (!v) return toast('اكتب الشرط');
  const terms = [...(profile.terms || []), v];
  try {
    await root().child('profile/terms').set(terms);
    $('#newTerm').value = '';
    toast('✅ تمت الإضافة');
  } catch (e) {
    toast('تعذر إضافة الشرط', true);
  }
}

async function deleteTerm(i) {
  const terms = [...(profile.terms || [])];
  terms.splice(i, 1);
  await root().child('profile/terms').set(terms);
}

// النسخ الاحتياطي
async function exportBackup() {
  try {
    const snap = await root().get();
    const data = snap.val() || {};
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `abbas_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('📤 تم تصدير النسخة');
  } catch (e) {
    toast('تعذر التصدير', true);
  }
}

async function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.devices && !data.profile) throw new Error('ملف غير صالح');
    if (!confirm('⚠️ سيتم استبدال جميع البيانات الحالية. هل أنت متأكد؟')) return;
    await root().set(data);
    toast('📥 تم استيراد النسخة');
    location.reload();
  } catch (err) {
    toast('تعذر الاستيراد: ملف غير صالح', true);
  }
}

// تصدير الدوال للاستخدام العالمي
window.openDevice = openDevice;
window.openStatus = openStatus;
window.showInvoice = showInvoice;
window.whatsappFollow = whatsappFollow;
window.removeDevice = removeDevice;
window.deleteTerm = deleteTerm;
window.openSmartList = openSmartList;
window.shareInvoice = shareInvoice;
window.exportBackup = exportBackup;
window.importBackup = importBackup;
window.closeModal = closeModal;

document.addEventListener('DOMContentLoaded', boot);
