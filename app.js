let currentUser=null,profile={},phones={},rawPhones={},rawRepairs={},lastInvoice=null,tracking=false;
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const num=v=>Number(String(v||"").replace(/[^\d]/g,""))||0;
const money=n=>`${Number(n||0).toLocaleString("en-US")} د.ع`;
const clean=p=>String(p||"").replace(/[^\d]/g,"");
const toast=m=>{$("#toast").textContent=m;$("#toast").classList.remove("hidden");setTimeout(()=>$("#toast").classList.add("hidden"),1900)};
const newId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const uid=()=>currentUser.uid, root=()=>db.ref(`users/${uid()}`), phoneIndex=p=>db.ref(`phoneIndex/${clean(p)}`);
const statusText={under:"تحت الصيانة",done:"تم الاكتمال",delivered:"تم التسليم",rejected:"مرفوض"};
const oldStatusMap={new:"under",inspection:"under",approval:"under",waiting_part:"under",repairing:"under",testing:"under",ready:"done",completed:"done",delivered:"delivered",rejected:"rejected",cancelled:"rejected"};
setTimeout(()=>$("#splash").classList.add("hidden"),550);

const params=new URLSearchParams(location.search);
if(params.get("track")){tracking=true;$("#splash").classList.add("hidden");$("#trackView").classList.remove("hidden");loadTrack(params.get("uid"),params.get("id"))}
async function loadTrack(u,id){
  try{
    let s=await db.ref(`users/${u}/phones/${id}`).get();
    if(!s.exists()) s=await db.ref(`users/${u}/repairs/${id}`).get();
    let r=normalizePhone(id,s.val());
    if(!r) throw Error();
    $("#trackBox").innerHTML=`<div class="invBox"><h2>${esc(r.deviceName)}</h2><p>الزبون: ${esc(r.clientName)}</p><p>المشكلة: ${esc(r.problem)}</p><p>الحالة: <b>${statusText[r.status]||r.status}</b></p><p>الباقي: ${money(r.remaining)}</p></div>`
  }catch(e){$("#trackBox").textContent="الرابط غير صالح"}
}

$("#loginTab").onclick=()=>authTab("login");
$("#registerTab").onclick=()=>authTab("register");
function authTab(t){
  $("#loginTab").classList.toggle("active",t==="login");
  $("#registerTab").classList.toggle("active",t==="register");
  $("#loginForm").classList.toggle("hidden",t!=="login");
  $("#registerForm").classList.toggle("hidden",t!=="register");
}
$("#registerForm").onsubmit=async e=>{
  e.preventDefault();
  let ownerName=$("#ownerName").value.trim(), shopName=$("#shopName").value.trim(), phone=$("#regPhone").value.trim(), email=$("#regEmail").value.trim(), pass=$("#regPassword").value, pass2=$("#regPassword2").value;
  if(!ownerName||!shopName||!phone||!email||!pass) return toast("أكمل الحقول");
  if(pass!==pass2) return toast("كلمة المرور غير متطابقة");
  try{
    let c=await auth.createUserWithEmailAndPassword(email,pass);
    await db.ref(`users/${c.user.uid}/profile`).set({ownerName,shopName,phone,email,address:"",logo:"",terms:[],theme:"light"});
    await phoneIndex(phone).set({uid:c.user.uid,email,phone,shopName});
  }catch(e){toast("تعذر إنشاء الحساب")}
};
$("#loginForm").onsubmit=async e=>{
  e.preventDefault();
  let id=$("#loginIdentity").value.trim(), pass=$("#loginPassword").value;
  if(!id||!pass) return toast("اكتب البيانات");
  try{
    let email=id;
    if(!id.includes("@")){
      let s=await phoneIndex(id).get();
      if(!s.exists()) throw Error();
      email=s.val().email;
    }
    await auth.signInWithEmailAndPassword(email,pass);
  }catch(e){toast("بيانات الدخول غير صحيحة")}
};
auth.onAuthStateChanged(u=>{
  if(tracking) return;
  currentUser=u;
  if(u){$("#authView").classList.add("hidden");$("#appView").classList.remove("hidden");listen()}
  else{$("#authView").classList.remove("hidden");$("#appView").classList.add("hidden")}
});

function listen(){
  root().child("profile").on("value",s=>{profile=s.val()||{};applyProfile();fillSettings();renderTerms()});
  root().child("phones").on("value",s=>{rawPhones=s.val()||{};mergeAndRender()});
  root().child("repairs").on("value",s=>{rawRepairs=s.val()||{};mergeAndRender()});
}
function applyProfile(){
  $("#welcomeName").textContent=`أهلاً ${profile.ownerName||""}`;
  $("#welcomeShop").textContent=profile.shopName||"نظام إدارة الصيانة";
  document.body.dataset.theme=localStorage.theme||profile.theme||"light";
}
function normalizePhone(id,r){
  if(!r) return null;
  let price=num(r.price ?? r.repairPrice);
  let paid=num(r.paid ?? r.paidAmount);
  let remaining=r.remaining!==undefined ? num(r.remaining) : Math.max(0,price-paid);
  let created=r.createdAt||Date.now();
  return {
    _id:id,
    deviceName:r.deviceName||r.deviceModel||r.brand||"هاتف",
    clientName:r.clientName||r.customerName||"-",
    clientPhone:r.clientPhone||r.customerPhone||"",
    problem:r.problem||r.fault||"-",
    price,paid,remaining,
    notes:r.notes||r.diagnosis||"",
    status:oldStatusMap[r.status]||r.status||"under",
    createdAt:typeof created==="number"?created:(Date.parse(created)||Date.now()),
    createdAtText:r.createdAtText||(typeof created==="number"?formatDate(new Date(created)):String(created).replace("T"," ").slice(0,16))
  };
}
function mergeAndRender(){
  phones={};
  Object.entries(rawRepairs||{}).forEach(([id,r])=>phones[id]=normalizePhone(id,r));
  Object.entries(rawPhones||{}).forEach(([id,r])=>phones[id]=normalizePhone(id,r));
  renderAll();
}
function arr(){return Object.entries(phones).sort((a,b)=>(b[1].createdAt||0)-(a[1].createdAt||0))}
function renderAll(){renderPhones();renderStats()}
function calculate(){
  let total=num($("#repairPrice").value), paid=num($("#paidPrice").value);
  let rem=$("#remainPrice");
  if(total && paid) rem.value=Math.max(0,total-paid);
  else if(!rem.value) rem.value=0;
}
$("#repairPrice").oninput=calculate;
$("#paidPrice").oninput=calculate;

function openPhone(id=null){
  $("#phoneForm").reset();
  $("#editingId").value="";
  $("#phoneModalTitle").textContent="إضافة هاتف";
  $("#status").value="under";
  $("#createdAtText").value=formatDate(new Date());
  if(id){
    let r=phones[id];
    $("#phoneModalTitle").textContent="تعديل الهاتف";
    $("#editingId").value=id;
    $("#deviceName").value=r.deviceName||"";
    $("#clientName").value=r.clientName||"";
    $("#clientPhone").value=r.clientPhone||"";
    $("#problem").value=r.problem||"";
    $("#repairPrice").value=r.price||"";
    $("#paidPrice").value=r.paid||"";
    $("#remainPrice").value=r.remaining||"";
    $("#notes").value=r.notes||"";
    $("#status").value=r.status||"under";
    $("#createdAtText").value=r.createdAtText||formatDate(new Date());
  }
  $("#phoneModal").classList.remove("hidden");
}
function closePhoneModal(){$("#phoneModal").classList.add("hidden")}
$("#phoneForm").onsubmit=async e=>{
  e.preventDefault();
  calculate();
  let id=$("#editingId").value||newId(), old=phones[id]||{}, now=new Date();
  let data={
    deviceName:$("#deviceName").value.trim(),
    clientName:$("#clientName").value.trim(),
    clientPhone:$("#clientPhone").value.trim(),
    problem:$("#problem").value.trim(),
    price:num($("#repairPrice").value),
    paid:num($("#paidPrice").value),
    remaining:num($("#remainPrice").value),
    notes:$("#notes").value.trim(),
    status:$("#status").value,
    createdAt:old.createdAt||now.getTime(),
    createdAtText:$("#createdAtText").value.trim()||formatDate(now),
    updatedAt:Date.now()
  };
  if(!data.deviceName||!data.clientName) return toast("اكتب اسم الهاتف والزبون");
  await root().child("phones").child(id).set(data);
  closePhoneModal();
  goPage("phonesPage","قائمة الهواتف");
  toast("تم الحفظ");
};
function formatDate(d){let p=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`}
function renderPhones(){
  let q=($("#searchPhone")?.value||"").toLowerCase(), sf=$("#filterStatus")?.value||"all";
  let list=arr().filter(([id,r])=>(sf==="all"||r.status===sf)&&`${r.deviceName} ${r.clientName} ${r.clientPhone}`.toLowerCase().includes(q));
  $("#phonesList").innerHTML=list.map(([id,r])=>`<article class="phoneCard">
    <div class="phoneTop"><div><h3>${esc(r.deviceName)}</h3><p>${esc(r.clientName)} - ${esc(r.clientPhone)}</p><span class="badge ${r.status}">${statusText[r.status]||r.status}</span></div><b class="price">${money(r.remaining)}</b></div>
    <p>${esc(r.problem)}</p><p>${esc(r.createdAtText||"")}</p>
    <div class="actions"><button type="button" onclick="openPhone('${id}')">تعديل</button><button type="button" onclick="quickStatus('${id}')">حالة</button><button type="button" onclick="showInvoice('${id}')">فاتورة</button><button type="button" onclick="delPhone('${id}')">حذف</button></div>
  </article>`).join("")||"<p>لا توجد هواتف</p>";
}
$("#searchPhone").oninput=renderPhones;
$("#filterStatus").onchange=renderPhones;
function quickStatus(id){
  $("#statusEditingId").value=id;
  $$(".statusPick").forEach(b=>b.classList.remove("picked"));
  $("#statusModal").classList.remove("hidden");
}
function closeStatus(){$("#statusModal").classList.add("hidden")}
async function setPickedStatus(v){
  let id=$("#statusEditingId").value;
  if(!id||!statusText[v]) return;
  await root().child("phones").child(id).update({status:v,updatedAt:Date.now()});
  closeStatus();
  toast("تم تغيير الحالة");
}
function delPhone(id){if(confirm("حذف الهاتف؟")) root().child("phones").child(id).remove()}
function renderStats(){
  let total=0,paid=0,rem=0,count=0,under=0,done=0,del=0,rej=0;
  Object.values(phones).forEach(r=>{count++;total+=Number(r.price||0);paid+=Number(r.paid||0);rem+=Number(r.remaining||0);if(r.status==="under")under++;if(r.status==="done")done++;if(r.status==="delivered")del++;if(r.status==="rejected")rej++});
  $("#statsBox").innerHTML=`<div class="statCard"><span>عدد الهواتف</span><b>${count}</b></div><div class="statCard"><span>المبلغ الكلي</span><b>${money(total)}</b></div><div class="statCard"><span>المستلم</span><b>${money(paid)}</b></div><div class="statCard"><span>الباقي دين</span><b>${money(rem)}</b></div><div class="statCard"><span>تحت الصيانة</span><b>${under}</b></div><div class="statCard"><span>مكتملة</span><b>${done}</b></div><div class="statCard"><span>تم التسليم</span><b>${del}</b></div><div class="statCard"><span>مرفوضة</span><b>${rej}</b></div>`;
}
function trackUrl(id){return `${location.origin}${location.pathname}?uid=${uid()}&id=${id}&track=1`}
function showInvoice(id){
  let r=phones[id]; lastInvoice=id;
  let qr=`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(trackUrl(id))}`;
  let terms=(profile.terms||[]).map((t,i)=>`<div>${i+1}. ${esc(t)}</div>`).join("")||"<div>لا توجد شروط</div>";
  $("#invoicePreview").innerHTML=`<div class="invoice">
    <div class="invHead"><div><h2>${esc(profile.shopName||"RepairOS")}</h2><small>${esc(profile.phone||"")} ${esc(profile.address||"")}</small></div><b>#${id.slice(-6).toUpperCase()}</b></div>
    <div class="invBody">
      <div>
        <div class="invBox">
          <div class="row"><b>الزبون</b><span>${esc(r.clientName)}</span></div>
          <div class="row"><b>رقم الزبون</b><span>${esc(r.clientPhone)}</span></div>
          <div class="row"><b>الهاتف</b><span>${esc(r.deviceName)}</span></div>
          <div class="row"><b>المشكلة</b><span>${esc(r.problem)}</span></div>
          <div class="row"><b>الحالة</b><span>${statusText[r.status]||r.status}</span></div>
          <div class="row"><b>التاريخ</b><span>${esc(r.createdAtText)}</span></div>
          <div class="row"><b>ملاحظات</b><span>${esc(r.notes||"-")}</span></div>
        </div>
        <div class="invBox">
          <div class="row"><b>السعر</b><span>${money(r.price)}</span></div>
          <div class="row"><b>الواصل</b><span>${money(r.paid)}</span></div>
          <div class="row"><b>الباقي</b><span>${money(r.remaining)}</span></div>
        </div>
      </div>
      <div class="invBox qr"><img src="${qr}" alt="QR"><p>باركود متابعة حالة الهاتف</p></div>
    </div>
    <div class="invFoot"><b>الشروط:</b>${terms}</div>
  </div>`;
  $("#invoiceModal").classList.remove("hidden");
}
function closeInvoice(){$("#invoiceModal").classList.add("hidden")}
function printInvoiceNow(){
  const m=$("#invoiceModal");
  if(m) m.classList.remove("hidden");
  setTimeout(()=>{ window.focus(); window.print(); },250);
}
function goPage(id,title){$$(".page").forEach(p=>p.classList.remove("show"));$("#"+id).classList.add("show");$("#topTitle").textContent=title;$("#backBtn").classList.toggle("hidden",id==="homePage");window.scrollTo(0,0)}
$("#backBtn").onclick=()=>goPage("homePage","الرئيسية");

function openCompany(){fillSettings();$("#companyModal").classList.remove("hidden")}
function closeCompany(){$("#companyModal").classList.add("hidden")}
function fillSettings(){
  if(!$("#setCompany")) return;
  $("#setCompany").value=profile.shopName||"";
  $("#setOwner").value=profile.ownerName||"";
  $("#setCompanyPhone").value=profile.phone||"";
  $("#setAddress").value=profile.address||"";
  $("#setLogo").value=profile.logo||"";
}
$("#companyForm").onsubmit=async e=>{
  e.preventDefault();
  await root().child("profile").update({shopName:$("#setCompany").value.trim(),ownerName:$("#setOwner").value.trim(),phone:$("#setCompanyPhone").value.trim(),address:$("#setAddress").value.trim(),logo:$("#setLogo").value.trim()});
  closeCompany(); toast("تم حفظ تفاصيل الشركة");
};
function openThemes(){$("#themesModal").classList.remove("hidden")}
function closeThemes(){$("#themesModal").classList.add("hidden")}
function setTheme(t){document.body.dataset.theme=t;localStorage.theme=t;if(currentUser)root().child("profile/theme").set(t);closeThemes()}

function openTerms(){
  renderTerms();
  const m=$("#termsModal");
  if(m) m.classList.remove("hidden");
}
function closeTerms(){$("#termsModal").classList.add("hidden")}
async function addTerm(){
  let v=$("#newTerm").value.trim();
  if(!v) return toast("اكتب الشرط");
  let terms=Array.isArray(profile.terms)?profile.terms.slice():[];
  terms.push(v);
  profile.terms=terms;
  renderTerms();
  try{
    await root().child("profile/terms").set(terms);
    toast("تمت إضافة الشرط");
  }catch(e){
    toast("لم يتم حفظ الشرط، تحقق من الاتصال");
  }
  $("#newTerm").value="";
  $("#newTerm").focus();
}
function renderTerms(){
  let box=$("#termsList"); if(!box) return;
  let terms=profile.terms||[];
  box.innerHTML=terms.map((t,i)=>`<div class="term"><span>${esc(t)}</span><button onclick="delTerm(${i})">حذف</button></div>`).join("")||"<p>لا توجد شروط</p>";
}
async function delTerm(i){let terms=profile.terms||[];terms.splice(i,1);await root().child("profile/terms").set(terms)}
if("serviceWorker"in navigator)navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister()));


/* v26 safety bindings */
document.addEventListener("DOMContentLoaded",()=>{
  const termsBtn=[...document.querySelectorAll(".settingTile")].find(b=>b.textContent.includes("شروط"));
  if(termsBtn) termsBtn.addEventListener("click",(e)=>{e.preventDefault();openTerms();});
  const companyBtn=[...document.querySelectorAll(".settingTile")].find(b=>b.textContent.includes("تفاصيل الشركة"));
  if(companyBtn) companyBtn.addEventListener("click",(e)=>{e.preventDefault();openCompany();});
});
