let currentUser=null, profile={}, devices={}, lastInvoice=null, tracking=false;
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const money=n=>`${Number(n||0).toLocaleString("en-US")} د.ع`;
const num=v=>Number(String(v||"").replace(/[^\d]/g,""))||0;
const clean=p=>String(p||"").replace(/[^\d]/g,"");
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const toast=m=>{$("#toast").textContent=m;$("#toast").classList.remove("hidden");setTimeout(()=>$("#toast").classList.add("hidden"),2200)};
const newId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const userRoot=()=>db.ref(`users/${currentUser.uid}`);
const phoneRef=p=>db.ref(`phoneIndex/${clean(p)}`);
const statuses={new:"جديد",inspection:"قيد الفحص",approval:"بانتظار موافقة",waiting_part:"بانتظار قطعة",repairing:"قيد التصليح",testing:"تحت الاختبار",ready:"جاهز للاستلام",delivered:"تم التسليم",rejected:"مرفوض",cancelled:"ملغي"};
setTimeout(()=>$("#splash").classList.add("hidden"),650);

const params=new URLSearchParams(location.search);
if(params.get("track")){tracking=true;$("#splash").classList.add("hidden");$("#trackView").classList.remove("hidden");loadTrack(params.get("uid"),params.get("track"))}
async function loadTrack(uid,id){
  try{let s=await db.ref(`users/${uid}/repairs/${id}`).get(), p=await db.ref(`users/${uid}/profile`).get(), r=s.val(), prof=p.val()||{};
  if(!r) throw Error();
  $("#trackBox").innerHTML=`<div class="invBox"><h2>${esc(r.deviceName)} ${esc(r.deviceModel||"")}</h2><p>المركز: ${esc(prof.shopName||"")}</p><p>الزبون: ${esc(r.customerName)}</p><p>الحالة: <b>${statuses[r.status]||r.status}</b></p><p>العطل: ${esc(r.fault)}</p><p>المتبقي: ${money(Math.max(0,Number(r.price||0)-Number(r.paid||0)))}</p><p>موعد التسليم: ${esc(r.dueDate||"-")}</p></div>`}
  catch(e){$("#trackBox").textContent="الرابط غير صالح."}
}

$("#loginTab").onclick=()=>authTab("login");$("#registerTab").onclick=()=>authTab("register");
function authTab(t){$("#loginTab").classList.toggle("active",t==="login");$("#registerTab").classList.toggle("active",t==="register");$("#loginForm").classList.toggle("hidden",t!=="login");$("#registerForm").classList.toggle("hidden",t!=="register")}
$("#registerForm").onsubmit=async e=>{
  e.preventDefault();
  let ownerName=$("#ownerName").value.trim(),shopName=$("#shopName").value.trim(),phone=$("#regPhone").value.trim(),email=$("#regEmail").value.trim().toLowerCase(),pass=$("#regPassword").value,pass2=$("#regPassword2").value;
  if(!ownerName||!shopName||!phone||!email||!pass)return toast("أكمل الحقول");
  if(pass!==pass2)return toast("كلمة المرور غير متطابقة");
  try{let c=await auth.createUserWithEmailAndPassword(email,pass);
    let data={ownerName,shopName,phone,email,province:$("#province").value,city:$("#city").value,address:"",theme:"titanium",accent:"gold",terms:[],createdAt:Date.now()};
    await db.ref(`users/${c.user.uid}/profile`).set(data); await phoneRef(phone).set({uid:c.user.uid,email,phone,shopName});
  }catch(e){toast("تعذر إنشاء الحساب")}
};
$("#loginForm").onsubmit=async e=>{
  e.preventDefault(); let id=$("#loginIdentity").value.trim().toLowerCase(), pass=$("#loginPassword").value;
  if(!id||!pass)return toast("اكتب بيانات الدخول");
  try{let email=id;if(!id.includes("@")){let s=await phoneRef(id).get();if(!s.exists())throw Error();email=s.val().email} await auth.signInWithEmailAndPassword(email,pass)}
  catch(e){toast("بيانات الدخول غير صحيحة")}
};
auth.onAuthStateChanged(u=>{if(tracking)return;currentUser=u;if(u){$("#authView").classList.add("hidden");$("#appView").classList.remove("hidden");listen()}else{$("#authView").classList.remove("hidden");$("#appView").classList.add("hidden")}});
function listen(){
  userRoot().child("profile").on("value",s=>{profile=s.val()||{};applyProfile();renderSettings()});
  userRoot().child("repairs").on("value",s=>{devices=s.val()||{};renderAll()});
}
function applyProfile(){
  $("#sideShop").textContent=profile.shopName||"Enterprise";$("#welcomeTitle").textContent=`أهلاً ${profile.ownerName||""}`;$("#shopSubtitle").textContent=profile.shopName||"مركز الصيانة";
  document.body.dataset.theme=localStorage.theme||profile.theme||"titanium";document.body.dataset.accent=localStorage.accent||profile.accent||"gold";
}
function arr(){return Object.entries(devices).sort((a,b)=>(b[1].createdAt||0)-(a[1].createdAt||0))}
function renderAll(){renderStats();renderCards();renderClients();renderFinance();renderStatusBoard()}
function renderStats(){
 let all=0,work=0,ready=0,late=0,debt=0,today=0,now=Date.now(),tk=new Date().toISOString().slice(0,10);
 Object.values(devices).forEach(r=>{all++; if(["inspection","approval","waiting_part","repairing","testing"].includes(r.status))work++; if(["ready","delivered"].includes(r.status))ready++; if(r.dueDate&&new Date(r.dueDate).getTime()<now&&!["delivered","cancelled"].includes(r.status))late++; debt+=Math.max(0,Number(r.price||0)-Number(r.paid||0)); if(new Date(r.createdAt||Date.now()).toISOString().slice(0,10)===tk)today+=Number(r.paid||0)});
 $("#statAll").textContent=all;$("#statWork").textContent=work;$("#statReady").textContent=ready;$("#statLate").textContent=late;$("#statDebt").textContent=money(debt);$("#statToday").textContent=money(today);
}
function badge(s){return `<span class="badge b-${s}">${statuses[s]||s}</span>`}
function deviceCard(id,r,mini=false){
 lastInvoice=lastInvoice||id; let rem=Math.max(0,Number(r.price||0)-Number(r.paid||0));
 return `<article class="deviceCard">
  <div class="deviceTop"><div><h3>${esc(r.customerName)} - ${esc(r.deviceName)} ${esc(r.deviceModel||"")}</h3><p>${esc(r.fault||"")}</p>${badge(r.status||"new")}</div><b class="price">${money(rem)}</b></div>
  ${mini?"":`<p>هاتف: ${esc(r.customerPhone||"-")} | الفني: ${esc(r.technician||"-")}</p><p>السعر: ${money(r.price)} | المدفوع: ${money(r.paid)}</p>
  <div class="actions"><button onclick="editDevice('${id}')">تعديل</button><button onclick="changeStatus('${id}')">الحالة</button><button onclick="showInvoice('${id}')">فاتورة</button><a target="_blank" href="https://wa.me/964${clean(r.customerPhone).replace(/^0/,'')}?text=${encodeURIComponent(invoiceText(id,r))}">واتساب</a><button onclick="deleteDevice('${id}')">حذف</button></div>`}
 </article>`
}
function renderCards(){
 let q=($("#deviceSearch")?.value||$("#globalSearch")?.value||"").toLowerCase(), sf=$("#statusFilter")?.value||"all";
 let f=arr().filter(([id,r])=>(sf==="all"||r.status===sf)&&`${r.customerName} ${r.customerPhone} ${r.deviceName} ${r.deviceModel} ${r.fault} ${r.imei}`.toLowerCase().includes(q));
 $("#latestList").innerHTML=arr().slice(0,3).map(([id,r])=>deviceCard(id,r,true)).join("")||"<p>لا توجد أجهزة.</p>";
 $("#devicesList").innerHTML=f.slice(0,8).map(([id,r])=>deviceCard(id,r)).join("")||"<p>لا توجد نتائج.</p>";
}
function renderStatusBoard(){let c={};Object.values(devices).forEach(r=>c[r.status]=(c[r.status]||0)+1);$("#statusBoard").innerHTML=Object.entries(statuses).slice(0,8).map(([k,v])=>`<div class="statusPill"><span>${v}</span><b>${c[k]||0}</b></div>`).join("")}
function renderClients(){let m={};Object.values(devices).forEach(r=>{let k=r.customerPhone||r.customerName;if(!m[k])m[k]={name:r.customerName,phone:r.customerPhone,count:0,debt:0};m[k].count++;m[k].debt+=Math.max(0,Number(r.price||0)-Number(r.paid||0))});$("#clientsList").innerHTML=Object.values(m).slice(0,8).map(c=>`<article class="deviceCard"><h3>${esc(c.name)}</h3><p>${esc(c.phone)}</p><p>الأجهزة: ${c.count}</p><b class="price">${money(c.debt)}</b></article>`).join("")||"<p>لا يوجد عملاء.</p>"}
function renderFinance(){let total=0,paid=0,parts=0;Object.values(devices).forEach(r=>{total+=Number(r.price||0);paid+=Number(r.paid||0);parts+=Number(r.partsCost||0)});$("#financeBox").innerHTML=`<article class="deviceCard"><h3>ملخص المحاسبة</h3><p>إجمالي الفواتير: ${money(total)}</p><p>المقبوض: ${money(paid)}</p><p>تكلفة القطع: ${money(parts)}</p><b class="price">ربح تقريبي: ${money(total-parts)}</b></article>`}
$("#deviceSearch").oninput=renderCards;$("#globalSearch").oninput=renderCards;$("#statusFilter").onchange=renderCards;$("#newDeviceTop").onclick=()=>openDevice();
function openDevice(id=null){$("#deviceForm").reset();$("#editingId").value="";$("#modalTitle").textContent="استلام جهاز"; if(id){let r=devices[id];$("#editingId").value=id;$("#modalTitle").textContent="تعديل جهاز";["customerName","customerPhone","brand","deviceName","deviceModel","imei","devicePass","technician","fault","diagnosis","notes","status","dueDate"].forEach(k=>$("#"+k).value=r[k]||"");$("#price").value=r.price||"";$("#paid").value=r.paid||"";$("#partsCost").value=r.partsCost||""}$("#deviceModal").classList.remove("hidden")}
function closeDevice(){$("#deviceModal").classList.add("hidden")}function editDevice(id){openDevice(id)}
$("#deviceForm").onsubmit=async e=>{e.preventDefault();let id=$("#editingId").value||newId(),old=devices[id]||{},r={customerName:$("#customerName").value.trim(),customerPhone:$("#customerPhone").value.trim(),brand:$("#brand").value.trim(),deviceName:$("#deviceName").value.trim(),deviceModel:$("#deviceModel").value.trim(),imei:$("#imei").value.trim(),devicePass:$("#devicePass").value.trim(),technician:$("#technician").value.trim(),fault:$("#fault").value.trim(),diagnosis:$("#diagnosis").value.trim(),notes:$("#notes").value.trim(),price:num($("#price").value),paid:num($("#paid").value),partsCost:num($("#partsCost").value),status:$("#status").value,dueDate:$("#dueDate").value,createdAt:old.createdAt||Date.now(),updatedAt:Date.now()};if(!r.customerName||!r.deviceName)return toast("أكمل اسم الزبون والجهاز");await userRoot().child("repairs").child(id).set(r);closeDevice();toast("تم الحفظ")}
function changeStatus(id){let v=prompt(Object.entries(statuses).map(([k,v])=>`${k} = ${v}`).join("\n"),devices[id].status);if(v&&statuses[v])userRoot().child("repairs").child(id).update({status:v,updatedAt:Date.now()})}
function deleteDevice(id){if(confirm("حذف الجهاز؟"))userRoot().child("repairs").child(id).remove()}
function trackUrl(id){return `${location.origin}${location.pathname}?uid=${currentUser.uid}&track=${id}`}
function invoiceText(id,r){return `${profile.shopName||"RepairOS"}\nالزبون: ${r.customerName}\nالجهاز: ${r.deviceName} ${r.deviceModel||""}\nالحالة: ${statuses[r.status]||r.status}\nالمتبقي: ${money(Math.max(0,Number(r.price||0)-Number(r.paid||0)))}\nتتبع: ${trackUrl(id)}`}
function showInvoice(id){let r=devices[id];lastInvoice=id;let rem=Math.max(0,Number(r.price||0)-Number(r.paid||0)),url=trackUrl(id),qr=`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`;let terms=(profile.terms||[]).filter(Boolean).map((t,i)=>`<div>${i+1}. ${esc(t)}</div>`).join("")||"<div>لا توجد شروط محفوظة.</div>";
$("#invoicePreview").innerHTML=`<div class="invoice">
  <div class="invHead"><div><h2>${esc(profile.shopName||"RepairOS")}</h2><small>${esc(profile.phone||"")} - ${esc(profile.address||"")}</small></div><b>#${id.slice(-6).toUpperCase()}</b></div>
  <div class="invBody">
    <div>
      <div class="invBox">
        <div class="row"><b>العميل</b><span>${esc(r.customerName)}</span></div><div class="row"><b>هاتف العميل</b><span>${esc(r.customerPhone)}</span></div>
        <div class="row"><b>الجهاز</b><span>${esc(r.brand||"")} ${esc(r.deviceName)} ${esc(r.deviceModel||"")}</span></div><div class="row"><b>IMEI</b><span>${esc(r.imei||"-")}</span></div>
        <div class="row"><b>الفني</b><span>${esc(r.technician||"-")}</span></div><div class="row"><b>الحالة</b><span>${statuses[r.status]||r.status}</span></div>
        <div class="row"><b>العطل</b><span>${esc(r.fault||"-")}</span></div><div class="row"><b>التشخيص</b><span>${esc(r.diagnosis||"-")}</span></div>
        <div class="row"><b>الملاحظات</b><span>${esc(r.notes||"-")}</span></div><div class="row"><b>الموعد</b><span>${esc(r.dueDate||"-")}</span></div>
      </div>
      <div class="invBox"><div class="row"><b>السعر</b><span>${money(r.price)}</span></div><div class="row"><b>المدفوع</b><span>${money(r.paid)}</span></div><div class="row"><b>المتبقي</b><span>${money(rem)}</span></div></div>
    </div>
    <div class="invBox qr"><img src="${qr}"><p>امسح QR لمتابعة الجهاز</p><small>${esc(url)}</small></div>
  </div>
  <div class="invFoot"><b>الشروط:</b>${terms}</div>
</div>`;
$("#invoiceModal").classList.remove("hidden")}
function closeInvoice(){$("#invoiceModal").classList.add("hidden")}function printLast(){lastInvoice?showInvoice(lastInvoice):toast("لا توجد فاتورة")}
function goPage(p){$$(".page").forEach(x=>x.classList.remove("show"));$("#"+p).classList.add("show");$$(".sideBtn,.mob").forEach(b=>b.classList.toggle("active",b.dataset.page===p));$("#pageTitle").textContent={dashboard:"الرئيسية",devices:"الأجهزة",clients:"العملاء",invoices:"الفواتير",finance:"المحاسبة",settings:"الإعدادات"}[p]||p}
$$(".sideBtn,.mob").forEach(b=>b.onclick=()=>goPage(b.dataset.page));
$("#menuBtn").onclick=()=>$("#drawer").classList.remove("hidden");function closeDrawer(){$("#drawer").classList.add("hidden")}
$("#logoutBtn").onclick=()=>auth.signOut();
$("#themeQuick").onclick=()=>setTheme(document.body.dataset.theme==="light"?"titanium":"light");
function setTheme(t){document.body.dataset.theme=t;localStorage.theme=t;if(currentUser)userRoot().child("profile/theme").set(t)}
function setAccent(a){document.body.dataset.accent=a;localStorage.accent=a;if(currentUser)userRoot().child("profile/accent").set(a)}
function renderSettings(){["ShopName","OwnerName","Phone","Address"].forEach(k=>{let map={ShopName:"shopName",OwnerName:"ownerName",Phone:"phone",Address:"address"};let el=$("#set"+k);if(el)el.value=profile[map[k]]||""});renderTerms()}
async function saveProfile(){let patch={shopName:$("#setShopName").value.trim(),ownerName:$("#setOwnerName").value.trim(),phone:$("#setPhone").value.trim(),address:$("#setAddress").value.trim()};await userRoot().child("profile").update(patch);toast("تم حفظ بيانات المركز")}
function renderTerms(){let terms=profile.terms||[];$("#termsList").innerHTML=terms.map((t,i)=>`<div class="term"><span>${esc(t)}</span><button onclick="deleteTerm(${i})">حذف</button></div>`).join("")||"<p>لا توجد شروط بعد.</p>"}
async function addTerm(){let val=$("#newTerm").value.trim();if(!val)return toast("اكتب الشرط");let terms=profile.terms||[];terms.push(val);await userRoot().child("profile/terms").set(terms);$("#newTerm").value="";$("#newTerm").focus()}
async function deleteTerm(i){let terms=profile.terms||[];terms.splice(i,1);await userRoot().child("profile/terms").set(terms)}
function exportBackup(){let blob=new Blob([JSON.stringify({profile,devices},null,2)],{type:"application/json"});let a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="repair-os-backup.json";a.click()}
$("#aiBtn").onclick=()=>{let t=$("#aiInput").value;if(!t)return;let r=t.includes("شحن")?"سوكت الشحن، بطارية، IC شحن، قياس أمبير.":t.includes("شاشة")?"تجربة شاشة، فلاتة، إضاءة، كونكتور.":"افحص السوفتوير، الفولت، آثار الماء، والقطعة المرتبطة.";$("#aiResult").textContent=r}
if("serviceWorker"in navigator)navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister()));
