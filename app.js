let currentUser=null, profile=null, repairs={}, inventory={};
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const money=n=>`${Number(n||0).toLocaleString("en-US")} د.ع`;
const onlyNum=v=>Number(String(v||"").replace(/[^\d]/g,""))||0;
const cleanPhone=p=>String(p||"").replace(/[^\d]/g,"");
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const toast=msg=>{$("#toast").textContent=msg;$("#toast").classList.remove("hidden");setTimeout(()=>$("#toast").classList.add("hidden"),2600)};
const makeId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const todayKey=()=>new Date().toISOString().slice(0,10);
const monthKey=()=>new Date().toISOString().slice(0,7);

setTimeout(()=>$("#splash").classList.add("hidden"),1100);
function root(){return db.ref(`users/${currentUser.uid}`)}
function phoneIndexRef(phone){return db.ref(`phoneIndex/${cleanPhone(phone)}`)}

$("#loginTab").onclick=()=>switchAuth("login");$("#registerTab").onclick=()=>switchAuth("register");
function switchAuth(mode){$("#loginTab").classList.toggle("active",mode==="login");$("#registerTab").classList.toggle("active",mode==="register");$("#loginForm").classList.toggle("hidden",mode!=="login");$("#registerForm").classList.toggle("hidden",mode!=="register")}

$("#registerForm").onsubmit=async e=>{
  e.preventDefault();
  const ownerName=$("#ownerName").value.trim(),shopName=$("#shopName").value.trim(),phone=$("#regPhone").value.trim();
  const email=$("#regEmail").value.trim().toLowerCase(),pass=$("#regPassword").value,pass2=$("#regPassword2").value;
  const province=$("#province").value.trim(),city=$("#city").value.trim();
  if(!ownerName||!shopName||!phone||!email||!pass)return toast("أكمل كل الحقول الأساسية");
  if(pass.length<6)return toast("كلمة المرور يجب أن تكون 6 أحرف أو أكثر");
  if(pass!==pass2)return toast("كلمتا المرور غير متطابقتين");
  try{
    const cred=await auth.createUserWithEmailAndPassword(email,pass);
    const uid=cred.user.uid;
    const data={ownerName,shopName,phone,email,province,city,createdAt:Date.now(),plan:"founder",theme:"enterprise-gold",version:"2.0.0"};
    await db.ref(`users/${uid}/profile`).set(data);
    await phoneIndexRef(phone).set({uid,email,phone,shopName});
    toast("تم إنشاء الحساب بنجاح");
  }catch(err){toast(arErr(err))}
};

$("#loginForm").onsubmit=async e=>{
  e.preventDefault();
  let identity=$("#loginIdentity").value.trim().toLowerCase(),pass=$("#loginPassword").value;
  if(!identity||!pass)return toast("اكتب بيانات الدخول");
  try{
    let email=identity;
    if(!identity.includes("@")){
      const snap=await phoneIndexRef(identity).get();
      if(!snap.exists())throw new Error("لا يوجد حساب بهذا الرقم");
      email=snap.val().email;
    }
    await auth.signInWithEmailAndPassword(email,pass);
  }catch(err){toast(arErr(err))}
};

function arErr(err){
  const c=err.code||"";
  if(c.includes("email-already-in-use"))return "هذا البريد مستخدم مسبقاً";
  if(c.includes("invalid-email"))return "البريد الإلكتروني غير صحيح";
  if(c.includes("weak-password"))return "كلمة المرور ضعيفة";
  if(c.includes("wrong-password")||c.includes("invalid-credential"))return "بيانات الدخول غير صحيحة";
  if(c.includes("user-not-found"))return "لا يوجد حساب بهذه البيانات";
  return err.message||"حدث خطأ";
}

$("#forgotBtn").onclick=async()=>{const email=$("#loginIdentity").value.trim().toLowerCase();if(!email.includes("@"))return toast("اكتب الإيميل لاستعادة كلمة المرور");try{await auth.sendPasswordResetEmail(email);toast("تم إرسال رابط الاستعادة")}catch(e){toast(arErr(e))}};
$("#logoutBtn").onclick=()=>auth.signOut();

auth.onAuthStateChanged(user=>{currentUser=user;if(user){$("#authView").classList.add("hidden");$("#appView").classList.remove("hidden");listenData()}else{$("#authView").classList.remove("hidden");$("#appView").classList.add("hidden")}});

function listenData(){
  root().child("profile").on("value",s=>{profile=s.val()||{};$("#welcomeTitle").textContent=`مرحباً ${profile.ownerName||""}`;$("#shopSubtitle").textContent=profile.shopName?`لوحة ${profile.shopName} السحابية`:"لوحة إدارة ذكية";$("#sideShop").textContent=profile.shopName||"Enterprise";renderProfile()});
  root().child("repairs").on("value",s=>{repairs=s.val()||{};render()});
  root().child("inventory").on("value",s=>{inventory=s.val()||{};renderInventory()});
}

function statusText(s){return{inspection:"قيد الفحص",repairing:"قيد التصليح",ready:"جاهز للاستلام",delivered:"تم التسليم",cancelled:"ملغي"}[s]||s}
function render(){
  let total=0,active=0,ready=0,debt=0,today=0,month=0;
  Object.values(repairs).forEach(r=>{
    total++; if(["inspection","repairing"].includes(r.status))active++; if(r.status==="ready")ready++;
    debt+=Math.max(0,Number(r.price||0)-Number(r.paid||0));
    const d=new Date(r.createdAt||Date.now()).toISOString();
    const profit=Math.max(0,Number(r.price||0)-Number(r.partsCost||0));
    if(d.slice(0,10)===todayKey())today+=Number(r.paid||0);
    if(d.slice(0,7)===monthKey())month+=profit;
  });
  $("#statRepairs").textContent=total;$("#statActive").textContent=active;$("#statReady").textContent=ready;$("#statDebt").textContent=money(debt);$("#statToday").textContent=money(today);$("#statMonth").textContent=money(month);
  renderRepairLists();renderCustomers();renderFinance();
}

function repairCard(id,r){
 const remain=Math.max(0,Number(r.price||0)-Number(r.paid||0));
 return `<article class="repair-card">
  <div class="repair-head"><div><h3>${esc(r.customerName)} - ${esc(r.deviceName)}</h3><p>${esc(r.brand||"")} ${esc(r.deviceModel||"")} | ${esc(r.fault||"")}</p><span class="badge">${statusText(r.status)}</span></div><div class="price">${money(remain)}</div></div>
  <p>رقم الزبون: ${esc(r.customerPhone||"")} ${r.imei?`| IMEI: ${esc(r.imei)}`:""}</p>
  <p>السعر: ${money(r.price)} | المدفوع: ${money(r.paid)} | تكلفة القطع: ${money(r.partsCost)}</p>
  ${r.dueDate?`<p>موعد التسليم: ${esc(r.dueDate)}</p>`:""}
  <div class="actions-row"><a class="ghost-btn" href="tel:${esc(r.customerPhone||"")}">اتصال</a><a class="ghost-btn" target="_blank" href="https://wa.me/964${cleanPhone(r.customerPhone).replace(/^0/,'')}?text=${encodeURIComponent(receiptText(r))}">واتساب</a><button class="ghost-btn" onclick="markReady('${id}')">جاهز</button><button class="ghost-btn" onclick="deleteRepair('${id}')">حذف</button></div>
 </article>`
}
function arrRepairs(){return Object.entries(repairs).sort((a,b)=>(b[1].createdAt||0)-(a[1].createdAt||0))}
function renderRepairLists(){
 const arr=arrRepairs();$("#latestRepairs").innerHTML=arr.slice(0,5).map(([id,r])=>repairCard(id,r)).join("")||`<p class="muted">لا توجد أجهزة بعد.</p>`;
 const q=($("#repairSearch")?.value||"").toLowerCase();
 $("#repairsList").innerHTML=arr.filter(([id,r])=>`${r.customerName} ${r.deviceName} ${r.customerPhone} ${r.deviceModel} ${r.brand}`.toLowerCase().includes(q)).map(([id,r])=>repairCard(id,r)).join("")||`<p class="muted">لا توجد نتائج.</p>`;
}
function renderCustomers(){
 const map={};Object.values(repairs).forEach(r=>{const key=r.customerPhone||r.customerName;if(!map[key])map[key]={name:r.customerName,phone:r.customerPhone,count:0,debt:0};map[key].count++;map[key].debt+=Math.max(0,Number(r.price||0)-Number(r.paid||0))});
 $("#customersList").innerHTML=Object.values(map).map(c=>`<article class="repair-card"><h3>${esc(c.name)}</h3><p>${esc(c.phone)}</p><p>عدد الأجهزة: ${c.count}</p><b class="price">${money(c.debt)}</b></article>`).join("")||`<p class="muted">لا يوجد زبائن بعد.</p>`
}
function renderFinance(){
 const totalPrice=Object.values(repairs).reduce((s,r)=>s+Number(r.price||0),0), paid=Object.values(repairs).reduce((s,r)=>s+Number(r.paid||0),0), parts=Object.values(repairs).reduce((s,r)=>s+Number(r.partsCost||0),0);
 $("#financeList").innerHTML=`<article class="repair-card"><h3>ملخص مالي</h3><p>إجمالي التصليح: ${money(totalPrice)}</p><p>المقبوض: ${money(paid)}</p><p>تكلفة القطع: ${money(parts)}</p><b class="price">ربح تقريبي: ${money(totalPrice-parts)}</b></article>` + arrRepairs().filter(([id,r])=>Number(r.price)>Number(r.paid)).map(([id,r])=>repairCard(id,r)).join("");
}
function renderProfile(){
 $("#profileBox").innerHTML=`<article class="repair-card"><h3>${esc(profile.shopName||"")}</h3><p>المالك: ${esc(profile.ownerName||"")}</p><p>الهاتف: ${esc(profile.phone||"")}</p><p>الإيميل: ${esc(profile.email||"")}</p><p>${esc(profile.province||"")} - ${esc(profile.city||"")}</p></article>`
}
function renderInventory(){
 const entries=Object.entries(inventory||{});
 $("#inventoryList").innerHTML=entries.map(([id,p])=>`<article class="repair-card"><h3>${esc(p.name)}</h3><p>العدد: ${p.qty||0}</p><p>شراء: ${money(p.buy)} | بيع: ${money(p.sell)}</p></article>`).join("")||`<p class="muted">المخزن فارغ حالياً.</p>`
}

$("#addRepairBtn").onclick=()=>$("#modal").classList.remove("hidden");$("#closeModal").onclick=()=>$("#modal").classList.add("hidden");$("#repairSearch").oninput=renderRepairLists;
$("#repairForm").onsubmit=async e=>{
 e.preventDefault();
 const data={customerName:$("#customerName").value.trim(),customerPhone:$("#customerPhone").value.trim(),deviceName:$("#deviceName").value.trim(),deviceModel:$("#deviceModel").value.trim(),brand:$("#brand").value.trim(),color:$("#color").value.trim(),imei:$("#imei").value.trim(),fault:$("#fault").value.trim(),price:onlyNum($("#repairPrice").value),paid:onlyNum($("#paidAmount").value),partsCost:onlyNum($("#partsCost").value),status:$("#status").value,dueDate:$("#dueDate").value,notes:$("#notes").value.trim(),createdAt:Date.now(),updatedAt:Date.now()};
 if(!data.customerName||!data.deviceName||!data.fault)return toast("أكمل اسم الزبون والهاتف والعطل");
 await root().child("repairs").child(makeId()).set(data);$("#repairForm").reset();$("#modal").classList.add("hidden");toast("تم حفظ الجهاز");
};
function markReady(id){root().child("repairs").child(id).update({status:"ready",updatedAt:Date.now()});toast("تم تغيير الحالة إلى جاهز")}
function deleteRepair(id){if(confirm("حذف هذا الجهاز؟"))root().child("repairs").child(id).remove()}
function receiptText(r){return `وصل استلام جهاز
${profile?.shopName||"Phone Repair OS"}
الزبون: ${r.customerName}
الهاتف: ${r.deviceName} ${r.deviceModel||""}
العطل: ${r.fault}
الحالة: ${statusText(r.status)}
السعر: ${money(r.price)}
المدفوع: ${money(r.paid)}
المتبقي: ${money(Math.max(0,Number(r.price||0)-Number(r.paid||0)))}`}

$$(".nav[data-page]").forEach(btn=>btn.onclick=()=>showPage(btn.dataset.page,btn));
$$("[data-page-jump]").forEach(btn=>btn.onclick=()=>showPage(btn.dataset.pageJump,document.querySelector(`.nav[data-page="${btn.dataset.pageJump}"]`)));
function showPage(page,btn){$$(".nav").forEach(b=>b.classList.remove("active"));btn?.classList.add("active");$$(".page").forEach(p=>p.classList.add("hidden"));$("#"+page).classList.remove("hidden")}
$("#exportBtn").onclick=()=>{const data={profile,repairs,inventory,exportedAt:new Date().toISOString()};const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="repair-os-backup.json";a.click()};
$("#addPartBtn").onclick=async()=>{const name=prompt("اسم القطعة");if(!name)return;await root().child("inventory").child(makeId()).set({name,qty:0,buy:0,sell:0,createdAt:Date.now()})};

$("#aiBtn").onclick=()=>{const t=$("#aiInput").value.trim();if(!t)return toast("اكتب وصف العطل");const low=t.toLowerCase();let tips=["افحص الفولت والبطارية أولاً","افحص البورد تحت المايكروسكوب","تأكد من عدم وجود رطوبة أو قصر","راجع سوفتوير الجهاز قبل الحكم على الهاردوير"];if(low.includes("شحن")||low.includes("يشحن"))tips=["Charging Port / سوكت الشحن","Charging IC","Battery / BSI line","فحص قصر على VBUS","تجربة كيبل وأمبير قبل الفتح"];if(low.includes("شاشة")||low.includes("سوداء"))tips=["تجربة شاشة أصلية/مضمونة","فحص Backlight","فحص كونكتور الشاشة","احتمال Display IC","فحص هل الجهاز يعمل صوت/اهتزاز"];if(low.includes("شبكة"))tips=["SIM reader","Baseband","Antenna lines","تحديث/استعادة قبل الهاردوير","فحص IMEI موجود أم لا"];$("#aiResult").innerHTML=`<div class="repair-card"><h3>احتمالات الفحص</h3>${tips.map(x=>`<p>• ${x}</p>`).join("")}</div>`};

if("serviceWorker" in navigator){navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister()));}
