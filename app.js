'use strict';

let currentUser=null, profile={}, phones={}, rawPhones={}, rawRepairs={}, lastInvoiceId=null, trackingMode=false;
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const num=v=>Number(String(v??'').replace(/[^\d.]/g,''))||0;
const clean=v=>String(v??'').replace(/[^\d]/g,'');
const money=n=>`${Number(n||0).toLocaleString('en-US')} د.ع`;
const newId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const uid=()=>currentUser?.uid;
const root=()=>db.ref(`users/${uid()}`);
const phoneIndex=p=>db.ref(`phoneIndex/${clean(p)}`);
const statusText={under:'تحت الصيانة',done:'تم الاكتمال',delivered:'تم التسليم',rejected:'مرفوض'};
const statusIcon={under:'🔧',done:'✅',delivered:'📦',rejected:'⛔'};
const oldStatusMap={new:'under',inspection:'under',approval:'under',waiting_part:'under',repairing:'under',testing:'under',ready:'done',completed:'done',delivered:'delivered',rejected:'rejected',cancelled:'rejected'};

function safe(fn){try{fn()}catch(e){console.error(e);toast('حدث خطأ بسيط، أعد المحاولة')}}
function toast(msg){const t=$('#toast'); if(!t)return; t.textContent=msg; t.classList.remove('hidden'); clearTimeout(t._timer); t._timer=setTimeout(()=>t.classList.add('hidden'),2200)}
function show(id){const el=$('#'+id); if(el){el.classList.remove('hidden');el.setAttribute('aria-hidden','false')}}
function hide(id){const el=$('#'+id); if(el){el.classList.add('hidden');el.setAttribute('aria-hidden','true')}}
function formatDate(d=new Date()){const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`}

window.addEventListener('load',()=>setTimeout(()=>$('#splash')?.classList.add('hidden'),450));

document.addEventListener('DOMContentLoaded',()=>{
  bindEvents();
  const params=new URLSearchParams(location.search);
  if(params.get('track')){
    trackingMode=true;
    $('#splash')?.classList.add('hidden');
    show('trackView');
    loadTrack(params.get('uid'),params.get('id'));
  }
});

function bindEvents(){
  $('#loginTab')?.addEventListener('click',()=>authTab('login'));
  $('#registerTab')?.addEventListener('click',()=>authTab('register'));
  $('#loginForm')?.addEventListener('submit',loginSubmit);
  $('#registerForm')?.addEventListener('submit',registerSubmit);
  $('#phoneForm')?.addEventListener('submit',savePhone);
  $('#companyForm')?.addEventListener('submit',saveCompany);
  $('#repairPrice')?.addEventListener('input',calculate);
  $('#paidPrice')?.addEventListener('input',calculate);
  $('#remainPrice')?.addEventListener('input',()=>{});
  $('#searchPhone')?.addEventListener('input',renderPhones);
  $('#filterStatus')?.addEventListener('change',renderPhones);
  $('#backBtn')?.addEventListener('click',()=>goPage('homePage','الرئيسية'));
  $('#quickAddBtn')?.addEventListener('click',()=>openPhone());
  $('#companyBtn')?.addEventListener('click',openCompany);
  $('#themesBtn')?.addEventListener('click',()=>show('themesModal'));
  $('#termsBtn')?.addEventListener('click',openTerms);
  $('#backupBtn')?.addEventListener('click',downloadBackup);
  $('#logoutBtn')?.addEventListener('click',()=>auth.signOut());
  $('#addTermBtn')?.addEventListener('click',addTerm);
  $('#newTerm')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addTerm()}});
  $('#printInvoiceBtn')?.addEventListener('click',printInvoiceNow);
  $('#copyTrackBtn')?.addEventListener('click',copyTrack);
  $('#shareWhatsBtn')?.addEventListener('click',shareWhatsApp);

  document.addEventListener('click',e=>{
    const close=e.target.closest('[data-close]'); if(close) hide(close.dataset.close);
    const page=e.target.closest('[data-page]'); if(page) goPage(page.dataset.page,page.dataset.title||'');
    const open=e.target.closest('[data-open-phone]'); if(open) openPhone();
    const theme=e.target.closest('[data-theme-pick]'); if(theme) setTheme(theme.dataset.themePick);
    const status=e.target.closest('[data-status]'); if(status) setPickedStatus(status.dataset.status);
    if(e.target.classList.contains('modal')) e.target.classList.add('hidden');
  });
}

function authTab(t){
  $('#loginTab')?.classList.toggle('active',t==='login');
  $('#registerTab')?.classList.toggle('active',t==='register');
  $('#loginForm')?.classList.toggle('hidden',t!=='login');
  $('#registerForm')?.classList.toggle('hidden',t!=='register');
}

async function registerSubmit(e){
  e.preventDefault();
  const ownerName=$('#ownerName').value.trim(), shopName=$('#shopName').value.trim(), phone=$('#regPhone').value.trim(), email=$('#regEmail').value.trim(), pass=$('#regPassword').value, pass2=$('#regPassword2').value;
  if(!ownerName||!shopName||!phone||!email||!pass) return toast('أكمل كل الحقول');
  if(clean(phone).length<10) return toast('رقم الهاتف غير صحيح');
  if(pass.length<6) return toast('كلمة المرور أقل من 6 أحرف');
  if(pass!==pass2) return toast('كلمة المرور غير متطابقة');
  try{
    const c=await auth.createUserWithEmailAndPassword(email,pass);
    await db.ref(`users/${c.user.uid}/profile`).set({ownerName,shopName,phone,email,address:'',logo:'',terms:defaultTerms(),theme:'royal',createdAt:Date.now()});
    await phoneIndex(phone).set({uid:c.user.uid,email,phone:clean(phone),shopName});
    toast('تم إنشاء الحساب بنجاح');
  }catch(err){console.error(err);toast(firebaseMessage(err,'تعذر إنشاء الحساب'))}
}

async function loginSubmit(e){
  e.preventDefault();
  const id=$('#loginIdentity').value.trim(), pass=$('#loginPassword').value;
  if(!id||!pass) return toast('اكتب بيانات الدخول');
  try{
    let email=id;
    if(!id.includes('@')){
      const s=await phoneIndex(id).get();
      if(!s.exists()) throw new Error('phone-not-found');
      email=s.val().email;
    }
    await auth.signInWithEmailAndPassword(email,pass);
  }catch(err){console.error(err);toast('بيانات الدخول غير صحيحة')}
}

function firebaseMessage(err, fallback){
  const code=err?.code||'';
  if(code.includes('email-already-in-use')) return 'هذا الإيميل مسجل سابقاً';
  if(code.includes('invalid-email')) return 'الإيميل غير صحيح';
  if(code.includes('weak-password')) return 'كلمة المرور ضعيفة';
  return fallback;
}

if(typeof auth!=='undefined'){
  auth.onAuthStateChanged(user=>{
    if(trackingMode) return;
    currentUser=user;
    if(user){hide('authView');show('appView');listen()}
    else{show('authView');hide('appView')}
  });
}

function listen(){
  root().child('profile').on('value',s=>{profile=s.val()||{};applyProfile();fillCompany();renderTerms();renderAll()});
  root().child('phones').on('value',s=>{rawPhones=s.val()||{};mergeAndRender()});
  root().child('repairs').on('value',s=>{rawRepairs=s.val()||{};mergeAndRender()});
}

function applyProfile(){
  $('#welcomeName').textContent=`أهلاً ${profile.ownerName||''}`.trim();
  $('#welcomeShop').textContent=profile.shopName||'نظام إدارة الصيانة';
  $('#topSub').textContent=profile.shopName||'RepairOS Pro';
  document.body.dataset.theme=localStorage.getItem('repair_theme')||profile.theme||'royal';
}

function normalizePhone(id,r){
  if(!r) return null;
  const price=num(r.price ?? r.repairPrice ?? r.total);
  const paid=num(r.paid ?? r.paidAmount ?? r.received);
  const remaining=r.remaining!==undefined?num(r.remaining):Math.max(0,price-paid);
  const created=r.createdAt||Date.now();
  return {_id:id,deviceName:r.deviceName||r.deviceModel||r.brand||'هاتف',clientName:r.clientName||r.customerName||'-',clientPhone:r.clientPhone||r.customerPhone||'',problem:r.problem||r.fault||'-',price,paid,remaining,notes:r.notes||r.diagnosis||'',status:oldStatusMap[r.status]||r.status||'under',createdAt:typeof created==='number'?created:(Date.parse(created)||Date.now()),createdAtText:r.createdAtText||(typeof created==='number'?formatDate(new Date(created)):String(created).replace('T',' ').slice(0,16)),updatedAt:r.updatedAt||0};
}

function mergeAndRender(){
  phones={};
  Object.entries(rawRepairs||{}).forEach(([id,r])=>{const n=normalizePhone(id,r);if(n)phones[id]=n});
  Object.entries(rawPhones||{}).forEach(([id,r])=>{const n=normalizePhone(id,r);if(n)phones[id]=n});
  renderAll();
}
function arr(){return Object.entries(phones).sort((a,b)=>(b[1].createdAt||0)-(a[1].createdAt||0))}
function renderAll(){renderMiniStats();renderPhones();renderStats()}

function totals(){
  const t={count:0,total:0,paid:0,rem:0,under:0,done:0,delivered:0,rejected:0};
  Object.values(phones).forEach(r=>{t.count++;t.total+=r.price||0;t.paid+=r.paid||0;t.rem+=r.remaining||0;t[r.status]=(t[r.status]||0)+1});
  return t;
}
function renderMiniStats(){
  const box=$('#miniStats'); if(!box) return; const t=totals();
  box.innerHTML=`<div class="miniBox"><span>الهواتف</span><b>${t.count}</b></div><div class="miniBox"><span>الواصل</span><b>${money(t.paid)}</b></div><div class="miniBox"><span>الباقي</span><b>${money(t.rem)}</b></div>`;
}
function renderStats(){
  const box=$('#statsBox'); if(!box) return; const t=totals();
  box.innerHTML=`
  <div class="statCard"><span>عدد الهواتف</span><b>${t.count}</b></div>
  <div class="statCard"><span>المبلغ الكلي</span><b>${money(t.total)}</b></div>
  <div class="statCard"><span>المستلم</span><b>${money(t.paid)}</b></div>
  <div class="statCard"><span>الباقي دين</span><b>${money(t.rem)}</b></div>
  <div class="statCard"><span>تحت الصيانة</span><b>${t.under}</b></div>
  <div class="statCard"><span>تم الاكتمال</span><b>${t.done}</b></div>
  <div class="statCard"><span>تم التسليم</span><b>${t.delivered}</b></div>
  <div class="statCard"><span>مرفوض</span><b>${t.rejected}</b></div>`;
}

function renderPhones(){
  const box=$('#phonesList'); if(!box) return;
  const q=($('#searchPhone')?.value||'').trim().toLowerCase();
  const sf=$('#filterStatus')?.value||'all';
  const list=arr().filter(([id,r])=>{
    const hay=`${r.deviceName} ${r.clientName} ${r.clientPhone} ${r.problem} ${r.notes}`.toLowerCase();
    return (sf==='all'||r.status===sf)&&hay.includes(q);
  });
  box.innerHTML=list.map(([id,r])=>`<article class="phoneCard">
    <div class="phoneTop"><div><h3>${esc(r.deviceName)}</h3><p>${esc(r.clientName)} ${r.clientPhone?'- '+esc(r.clientPhone):''}</p><span class="badge ${esc(r.status)}">${statusIcon[r.status]||''} ${statusText[r.status]||esc(r.status)}</span></div><b class="price">${money(r.remaining)}</b></div>
    <p>${esc(r.problem)}</p><p>📅 ${esc(r.createdAtText||'')}</p>
    <div class="actions">
      <button type="button" onclick="openPhone('${id}')">تعديل</button>
      <button type="button" onclick="quickStatus('${id}')">حالة</button>
      <button type="button" onclick="showInvoice('${id}')">فاتورة</button>
      <button type="button" onclick="copyPhoneLink('${id}')">رابط</button>
      <button type="button" class="dangerBtn" onclick="delPhone('${id}')">حذف</button>
    </div>
  </article>`).join('')||`<div class="empty">لا توجد هواتف حالياً. اضغط + وأضف أول جهاز… الموقع جاهز، باقي الزبائن 😄</div>`;
}

function calculate(){
  const total=num($('#repairPrice')?.value), paid=num($('#paidPrice')?.value), rem=$('#remainPrice');
  if(rem) rem.value=Math.max(0,total-paid);
}

window.openPhone=function(id=null){
  safe(()=>{
    $('#phoneForm').reset(); $('#editingId').value=''; $('#phoneModalTitle').textContent='إضافة هاتف'; $('#status').value='under'; $('#createdAtText').value=formatDate();
    if(id){
      const r=phones[id]; if(!r) return toast('لم أجد الهاتف');
      $('#phoneModalTitle').textContent='تعديل الهاتف'; $('#editingId').value=id;
      $('#deviceName').value=r.deviceName||''; $('#clientName').value=r.clientName||''; $('#clientPhone').value=r.clientPhone||''; $('#problem').value=r.problem||'';
      $('#repairPrice').value=r.price||''; $('#paidPrice').value=r.paid||''; $('#remainPrice').value=r.remaining||''; $('#notes').value=r.notes||''; $('#status').value=r.status||'under'; $('#createdAtText').value=r.createdAtText||formatDate();
    }
    show('phoneModal'); setTimeout(()=>$('#deviceName')?.focus(),80);
  });
}

async function savePhone(e){
  e.preventDefault(); calculate();
  const id=$('#editingId').value||newId(), old=phones[id]||{}, now=Date.now();
  const data={deviceName:$('#deviceName').value.trim(),clientName:$('#clientName').value.trim(),clientPhone:$('#clientPhone').value.trim(),problem:$('#problem').value.trim(),price:num($('#repairPrice').value),paid:num($('#paidPrice').value),remaining:num($('#remainPrice').value),notes:$('#notes').value.trim(),status:$('#status').value,createdAt:old.createdAt||now,createdAtText:$('#createdAtText').value.trim()||formatDate(),updatedAt:now};
  if(!data.deviceName||!data.clientName) return toast('اسم الهاتف واسم الزبون مطلوبين');
  if(!statusText[data.status]) data.status='under';
  try{await root().child('phones').child(id).set(data);hide('phoneModal');goPage('phonesPage','قائمة الهواتف');toast('تم حفظ الهاتف بنجاح')}catch(err){console.error(err);toast('فشل الحفظ، تحقق من الإنترنت')}
}

window.quickStatus=function(id){if(!phones[id]) return toast('الهاتف غير موجود'); $('#statusEditingId').value=id; show('statusModal')}
async function setPickedStatus(v){
  const id=$('#statusEditingId').value; if(!id||!statusText[v]) return;
  try{await root().child('phones').child(id).update({status:v,updatedAt:Date.now()});hide('statusModal');toast('تم تغيير الحالة')}catch(err){console.error(err);toast('تعذر تغيير الحالة')}
}
window.delPhone=function(id){if(!phones[id]) return; if(confirm('هل تريد حذف هذا الهاتف نهائياً؟')) root().child('phones').child(id).remove().then(()=>toast('تم الحذف'))}

window.goPage=function(id,title){
  $$('.page').forEach(p=>p.classList.remove('show'));
  $('#'+id)?.classList.add('show');
  $('#topTitle').textContent=title||'RepairOS Pro';
  $('#backBtn').classList.toggle('hidden',id==='homePage');
  window.scrollTo({top:0,behavior:'smooth'});
}

function trackUrl(id){return `${location.origin}${location.pathname}?uid=${encodeURIComponent(uid())}&id=${encodeURIComponent(id)}&track=1`}
function invoiceTerms(){const terms=Array.isArray(profile.terms)?profile.terms:[];return terms.map((t,i)=>`<div>${i+1}. ${esc(t)}</div>`).join('')||'<div>لا توجد شروط مسجلة</div>'}
window.showInvoice=function(id){
  const r=phones[id]; if(!r) return toast('الهاتف غير موجود'); lastInvoiceId=id;
  const qr=`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(trackUrl(id))}`;
  const logo=profile.logo?`<img class="invLogo" src="${esc(profile.logo)}" alt="logo" onerror="this.style.display='none'">`:'';
  $('#invoicePreview').innerHTML=`<div class="invoice">
    <div class="invHead"><div class="invBrand">${logo}<div><h2>${esc(profile.shopName||'RepairOS Pro')}</h2><small>${esc(profile.phone||'')} ${profile.address?' - '+esc(profile.address):''}</small></div></div><div class="invNo"><div>فاتورة صيانة</div><small>#${esc(id.slice(-7).toUpperCase())}</small></div></div>
    <div>
      <div class="invBody">
        <div class="invBox">
          <div class="row"><b>الزبون</b><span>${esc(r.clientName)}</span></div>
          <div class="row"><b>رقم الهاتف</b><span>${esc(r.clientPhone||'-')}</span></div>
          <div class="row"><b>الجهاز</b><span>${esc(r.deviceName)}</span></div>
          <div class="row"><b>المشكلة</b><span>${esc(r.problem)}</span></div>
          <div class="row"><b>الحالة</b><span>${statusIcon[r.status]||''} ${statusText[r.status]||esc(r.status)}</span></div>
          <div class="row"><b>التاريخ</b><span>${esc(r.createdAtText)}</span></div>
          <div class="row"><b>ملاحظات</b><span>${esc(r.notes||'-')}</span></div>
        </div>
        <div class="invBox qr"><img src="${qr}" alt="QR"><p>باركود متابعة حالة الهاتف</p></div>
      </div>
      <div class="moneyBox" style="margin-top:10px"><div class="invBox"><span>السعر</span><b>${money(r.price)}</b></div><div class="invBox"><span>الواصل</span><b>${money(r.paid)}</b></div><div class="invBox"><span>الباقي</span><b>${money(r.remaining)}</b></div></div>
    </div>
    <div class="invFoot"><b>الشروط:</b>${invoiceTerms()}</div>
  </div>`;
  show('invoiceModal');
}
function printInvoiceNow(){show('invoiceModal');setTimeout(()=>{window.focus();window.print()},180)}
async function copyTrack(){if(!lastInvoiceId)return toast('افتح فاتورة أولاً');await copyText(trackUrl(lastInvoiceId));toast('تم نسخ رابط المتابعة')}
window.copyPhoneLink=async function(id){await copyText(trackUrl(id));toast('تم نسخ رابط المتابعة')}
function shareWhatsApp(){if(!lastInvoiceId)return toast('افتح فاتورة أولاً');const r=phones[lastInvoiceId];const text=`فاتورة صيانة ${r.deviceName}\nالزبون: ${r.clientName}\nالحالة: ${statusText[r.status]||r.status}\nالباقي: ${money(r.remaining)}\nرابط المتابعة: ${trackUrl(lastInvoiceId)}`;location.href=`https://wa.me/?text=${encodeURIComponent(text)}`}
async function copyText(text){try{await navigator.clipboard.writeText(text)}catch(e){const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}}

async function loadTrack(u,id){
  try{
    if(!u||!id) throw new Error('missing');
    let s=await db.ref(`users/${u}/phones/${id}`).get();
    if(!s.exists()) s=await db.ref(`users/${u}/repairs/${id}`).get();
    if(!s.exists()) throw new Error('not-found');
    const r=normalizePhone(id,s.val());
    $('#trackBox').innerHTML=`<div class="trackStatus"><h2>${esc(r.deviceName)}</h2><p><b>الزبون:</b> ${esc(r.clientName)}</p><p><b>المشكلة:</b> ${esc(r.problem)}</p><p><b>الحالة:</b> <span class="badge ${r.status}">${statusIcon[r.status]||''} ${statusText[r.status]||r.status}</span></p><p><b>الباقي:</b> ${money(r.remaining)}</p><p><b>التاريخ:</b> ${esc(r.createdAtText||'')}</p></div>`;
  }catch(err){console.error(err);$('#trackBox').innerHTML='<div class="empty">الرابط غير صالح أو تم حذف الفاتورة</div>'}
}

function openCompany(){fillCompany();show('companyModal')}
function fillCompany(){if(!$('#setCompany')) return; $('#setCompany').value=profile.shopName||'';$('#setOwner').value=profile.ownerName||'';$('#setCompanyPhone').value=profile.phone||'';$('#setAddress').value=profile.address||'';$('#setLogo').value=profile.logo||''}
async function saveCompany(e){
  e.preventDefault();
  try{await root().child('profile').update({shopName:$('#setCompany').value.trim(),ownerName:$('#setOwner').value.trim(),phone:$('#setCompanyPhone').value.trim(),address:$('#setAddress').value.trim(),logo:$('#setLogo').value.trim()});hide('companyModal');toast('تم حفظ تفاصيل الشركة')}catch(err){console.error(err);toast('تعذر حفظ التفاصيل')}
}
function setTheme(t){document.body.dataset.theme=t;localStorage.setItem('repair_theme',t);if(currentUser)root().child('profile/theme').set(t);hide('themesModal');toast('تم تغيير الثيم')}

function defaultTerms(){return ['الفاتورة تعتبر وصل استلام وليست ضماناً نهائياً قبل الفحص.','لا يتحمل المركز مسؤولية الأجهزة المتروكة أكثر من 30 يوماً.','الضمان يشمل العطل الذي تم إصلاحه فقط ولا يشمل الكسر أو سوء الاستخدام.']}
function openTerms(){if(!Array.isArray(profile.terms)) profile.terms=[]; renderTerms();show('termsModal')}
async function addTerm(){
  const input=$('#newTerm'); const v=input.value.trim(); if(!v) return toast('اكتب الشرط أولاً');
  const terms=Array.isArray(profile.terms)?profile.terms.slice():[]; terms.push(v); profile.terms=terms; renderTerms(); input.value='';
  try{await root().child('profile/terms').set(terms);toast('تمت إضافة الشرط')}catch(err){console.error(err);toast('تعذر حفظ الشرط')}
}
function renderTerms(){
  const box=$('#termsList'); if(!box) return; const terms=Array.isArray(profile.terms)?profile.terms:[];
  box.innerHTML=terms.map((t,i)=>`<div class="term"><span>${esc(t)}</span><button type="button" onclick="delTerm(${i})">حذف</button></div>`).join('')||'<div class="empty">لا توجد شروط. أضف شروطك وستظهر تلقائياً بالفاتورة.</div>';
}
window.delTerm=async function(i){const terms=Array.isArray(profile.terms)?profile.terms.slice():[];terms.splice(i,1);profile.terms=terms;renderTerms();try{await root().child('profile/terms').set(terms);toast('تم حذف الشرط')}catch(e){toast('تعذر حذف الشرط')}}

function downloadBackup(){
  const data={profile,phones:Object.fromEntries(arr().map(([id,r])=>[id,r])),exportedAt:formatDate()};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`repairos-backup-${Date.now()}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(a.href);toast('تم تنزيل النسخة الاحتياطية')
}
