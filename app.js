let currentUser = null;
let profile = null;
let repairs = {};

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const money = n => `${Number(n||0).toLocaleString("en-US")} د.ع`;
const onlyNum = v => Number(String(v||"").replace(/[^\d]/g,"")) || 0;
const cleanPhone = p => String(p||"").replace(/[^\d]/g,"");
const esc = s => String(s ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const toast = msg => { $("#toast").textContent=msg; $("#toast").classList.remove("hidden"); setTimeout(()=>$("#toast").classList.add("hidden"),2600); };
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,8);

setTimeout(()=>{$("#splash").classList.add("hidden");},1200);

function userRoot(){ return db.ref(`users/${currentUser.uid}`); }
function phoneIndexRef(phone){ return db.ref(`phoneIndex/${cleanPhone(phone)}`); }

$("#loginTab").onclick=()=>switchAuth("login");
$("#registerTab").onclick=()=>switchAuth("register");
function switchAuth(mode){
  $("#loginTab").classList.toggle("active",mode==="login");
  $("#registerTab").classList.toggle("active",mode==="register");
  $("#loginForm").classList.toggle("hidden",mode!=="login");
  $("#registerForm").classList.toggle("hidden",mode!=="register");
}

$("#registerForm").onsubmit=async e=>{
  e.preventDefault();
  const ownerName=$("#ownerName").value.trim(), shopName=$("#shopName").value.trim(), phone=$("#regPhone").value.trim();
  const email=$("#regEmail").value.trim().toLowerCase(), pass=$("#regPassword").value, pass2=$("#regPassword2").value;
  if(!ownerName||!shopName||!phone||!email||!pass) return toast("أكمل كل الحقول");
  if(pass.length<6) return toast("كلمة المرور يجب أن تكون 6 أحرف أو أكثر");
  if(pass!==pass2) return toast("كلمتا المرور غير متطابقتين");
  try{
    const cred = await auth.createUserWithEmailAndPassword(email,pass);
    const uid = cred.user.uid;
    const data = {ownerName,shopName,phone,email,createdAt:Date.now(),plan:"founder",theme:"luxury-gold"};
    await db.ref(`users/${uid}/profile`).set(data);
    await phoneIndexRef(phone).set({uid,email,phone,shopName});
    toast("تم إنشاء الحساب بنجاح");
  }catch(err){ toast(err.message); }
};

$("#loginForm").onsubmit=async e=>{
  e.preventDefault();
  let identity=$("#loginIdentity").value.trim().toLowerCase();
  const pass=$("#loginPassword").value;
  if(!identity||!pass) return toast("اكتب بيانات الدخول");
  try{
    let email = identity;
    if(!identity.includes("@")){
      const snap = await phoneIndexRef(identity).get();
      if(!snap.exists()) throw new Error("لا يوجد حساب بهذا الرقم");
      email = snap.val().email;
    }
    await auth.signInWithEmailAndPassword(email,pass);
  }catch(err){ toast(err.message); }
};

$("#forgotBtn").onclick=async()=>{
  const identity=$("#loginIdentity").value.trim().toLowerCase();
  if(!identity || !identity.includes("@")) return toast("اكتب الإيميل لاستعادة كلمة المرور");
  try{ await auth.sendPasswordResetEmail(identity); toast("تم إرسال رابط الاستعادة"); }catch(e){ toast(e.message); }
};

$("#logoutBtn").onclick=()=>auth.signOut();

auth.onAuthStateChanged(async user=>{
  currentUser=user;
  if(user){
    $("#authView").classList.add("hidden");
    $("#appView").classList.remove("hidden");
    listenData();
  }else{
    $("#authView").classList.remove("hidden");
    $("#appView").classList.add("hidden");
  }
});

function listenData(){
  userRoot().child("profile").on("value",s=>{
    profile=s.val()||{};
    $("#welcomeTitle").textContent=`أهلاً ${profile.ownerName||""}`;
    $("#shopSubtitle").textContent=profile.shopName ? `إدارة محل ${profile.shopName}` : "لوحة إدارة ذكية لمحلك";
    $("#profileBox").innerHTML = `
      <div class="repair-card">
        <h3>${esc(profile.shopName||"")}</h3>
        <p>المالك: ${esc(profile.ownerName||"")}</p>
        <p>الهاتف: ${esc(profile.phone||"")}</p>
        <p>الإيميل: ${esc(profile.email||"")}</p>
      </div>`;
  });
  userRoot().child("repairs").on("value",s=>{ repairs=s.val()||{}; render(); });
}

function render(){
  let total=0, active=0, ready=0, debt=0;
  Object.values(repairs).forEach(r=>{
    total++;
    if(["inspection","repairing"].includes(r.status)) active++;
    if(r.status==="ready") ready++;
    debt += Math.max(0, Number(r.price||0)-Number(r.paid||0));
  });
  $("#statRepairs").textContent=total;
  $("#statActive").textContent=active;
  $("#statReady").textContent=ready;
  $("#statDebt").textContent=money(debt);
  renderRepairLists();
  renderCustomers();
  renderPayments();
}

function statusText(s){
  return {inspection:"قيد الفحص",repairing:"قيد التصليح",ready:"جاهز",delivered:"تم التسليم",cancelled:"ملغي"}[s]||s;
}

function repairCard(id,r){
  const remain=Math.max(0,Number(r.price||0)-Number(r.paid||0));
  return `<article class="repair-card">
    <div class="repair-head">
      <div>
        <h3>${esc(r.customerName)} - ${esc(r.deviceName)}</h3>
        <p>${esc(r.deviceModel||"")} | ${esc(r.fault||"")}</p>
        <span class="badge">${statusText(r.status)}</span>
      </div>
      <div class="price">${money(remain)}</div>
    </div>
    <p>رقم الزبون: ${esc(r.customerPhone||"")}</p>
    <p>السعر: ${money(r.price)} | المدفوع: ${money(r.paid)}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <a class="ghost-btn" style="text-decoration:none" href="tel:${esc(r.customerPhone||"")}">اتصال</a>
      <a class="ghost-btn" style="text-decoration:none" target="_blank" href="https://wa.me/964${cleanPhone(r.customerPhone).replace(/^0/,'')}?text=${encodeURIComponent(receiptText(r))}">واتساب</a>
      <button class="ghost-btn" onclick="deleteRepair('${id}')">حذف</button>
    </div>
  </article>`;
}

function renderRepairLists(){
  const arr=Object.entries(repairs).sort((a,b)=>(b[1].createdAt||0)-(a[1].createdAt||0));
  $("#latestRepairs").innerHTML = arr.slice(0,5).map(([id,r])=>repairCard(id,r)).join("") || `<p style="color:var(--muted)">لا توجد أجهزة بعد.</p>`;
  const q=($("#repairSearch")?.value||"").toLowerCase();
  $("#repairsList").innerHTML = arr.filter(([id,r])=>`${r.customerName} ${r.deviceName} ${r.customerPhone}`.toLowerCase().includes(q)).map(([id,r])=>repairCard(id,r)).join("") || `<p style="color:var(--muted)">لا توجد نتائج.</p>`;
}

function renderCustomers(){
  const map={};
  Object.values(repairs).forEach(r=>{ const key=r.customerPhone||r.customerName; if(!map[key]) map[key]={name:r.customerName,phone:r.customerPhone,count:0,debt:0}; map[key].count++; map[key].debt+=Math.max(0,Number(r.price||0)-Number(r.paid||0)); });
  $("#customersList").innerHTML = Object.values(map).map(c=>`<article class="repair-card"><h3>${esc(c.name)}</h3><p>${esc(c.phone)}</p><p>عدد الأجهزة: ${c.count}</p><b class="price">${money(c.debt)}</b></article>`).join("") || `<p style="color:var(--muted)">لا يوجد زبائن بعد.</p>`;
}

function renderPayments(){
  $("#paymentsList").innerHTML = Object.entries(repairs).filter(([id,r])=>Number(r.price||0)>Number(r.paid||0)).map(([id,r])=>repairCard(id,r)).join("") || `<p style="color:var(--muted)">لا توجد ديون حالياً.</p>`;
}

$("#addRepairBtn").onclick=()=>$("#modal").classList.remove("hidden");
$("#closeModal").onclick=()=>$("#modal").classList.add("hidden");
$("#repairSearch").oninput=renderRepairLists;

$("#repairForm").onsubmit=async e=>{
  e.preventDefault();
  const data={
    customerName:$("#customerName").value.trim(),
    customerPhone:$("#customerPhone").value.trim(),
    deviceName:$("#deviceName").value.trim(),
    deviceModel:$("#deviceModel").value.trim(),
    fault:$("#fault").value.trim(),
    price:onlyNum($("#repairPrice").value),
    paid:onlyNum($("#paidAmount").value),
    status:$("#status").value,
    notes:$("#notes").value.trim(),
    createdAt:Date.now(),
    updatedAt:Date.now()
  };
  if(!data.customerName||!data.deviceName||!data.fault) return toast("أكمل اسم الزبون والهاتف والعطل");
  await userRoot().child("repairs").child(uid()).set(data);
  $("#repairForm").reset();
  $("#modal").classList.add("hidden");
  toast("تم حفظ الجهاز");
};

function deleteRepair(id){
  if(confirm("حذف هذا الجهاز؟")) userRoot().child("repairs").child(id).remove();
}

function receiptText(r){
  return `وصل استلام جهاز
المحل: ${profile?.shopName||""}
الزبون: ${r.customerName}
الهاتف: ${r.deviceName} ${r.deviceModel||""}
العطل: ${r.fault}
الحالة: ${statusText(r.status)}
السعر: ${money(r.price)}
المدفوع: ${money(r.paid)}
المتبقي: ${money(Math.max(0,Number(r.price||0)-Number(r.paid||0)))}`;
}

$$(".nav[data-page]").forEach(btn=>btn.onclick=()=>{
  $$(".nav").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  $$(".page").forEach(p=>p.classList.add("hidden"));
  $("#"+btn.dataset.page).classList.remove("hidden");
});

$("#aiBtn").onclick=()=>{
  const t=$("#aiInput").value.trim();
  if(!t) return toast("اكتب وصف العطل");
  const low=t.toLowerCase();
  let tips=["افحص البطارية والفولت أولاً","افحص البورد تحت المايكروسكوب","تأكد من عدم وجود رطوبة أو قصر"];
  if(low.includes("شحن")||low.includes("يشحن")) tips=["Charging Port / سوكت الشحن","Charging IC","بطارية أو خط BSI","فحص قصر على VBUS"];
  if(low.includes("شاشة")||low.includes("سوداء")) tips=["فحص الشاشة بفلاتة مجربة","فحص إضاءة الشاشة Backlight","فحص كونكتور الشاشة","احتمال IC Display"];
  if(low.includes("شبكة")) tips=["فحص SIM reader","فحص Baseband","فحص Antenna lines","تحديث/استعادة قبل الهاردوير"];
  $("#aiResult").innerHTML=`<div class="repair-card"><h3>احتمالات الفحص</h3>${tips.map(x=>`<p>• ${x}</p>`).join("")}</div>`;
};

if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
