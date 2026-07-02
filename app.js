let currentUser=null, profile=null, repairs={}, inventory={}, lastRepairId=null;
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const money=n=>`${Number(n||0).toLocaleString("en-US")} د.ع`;
const onlyNum=v=>Number(String(v||"").replace(/[^\d]/g,""))||0;
const cleanPhone=p=>String(p||"").replace(/[^\d]/g,"");
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const toast=msg=>{$("#toast").textContent=msg;$("#toast").classList.remove("hidden");setTimeout(()=>$("#toast").classList.add("hidden"),2600)};
const id=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const root=()=>db.ref(`users/${currentUser.uid}`);
const phoneIndexRef=phone=>db.ref(`phoneIndex/${cleanPhone(phone)}`);
setTimeout(()=>$("#splash").classList.add("hidden"),900);

const statuses={new:"جديد",inspection:"قيد الفحص",approval:"بانتظار موافقة",waiting_part:"بانتظار قطعة",repairing:"قيد التصليح",completed:"مكتمل",ready:"جاهز للاستلام",delivered:"تم التسليم",rejected:"مرفوض",cancelled:"ملغي"};
const statusColors={new:"#5fa3ff",inspection:"#5fa3ff",approval:"#ffb250",waiting_part:"#b889ff",repairing:"#79c7ff",completed:"#44e18c",ready:"#44e18c",delivered:"#ddd",rejected:"#ff6262",cancelled:"#999"};

$("#loginTab").onclick=()=>switchAuth("login");$("#registerTab").onclick=()=>switchAuth("register");
function switchAuth(mode){$("#loginTab").classList.toggle("active",mode==="login");$("#registerTab").classList.toggle("active",mode==="register");$("#loginForm").classList.toggle("hidden",mode!=="login");$("#registerForm").classList.toggle("hidden",mode!=="register")}

$("#registerForm").onsubmit=async e=>{
 e.preventDefault();
 const ownerName=$("#ownerName").value.trim(),shopName=$("#shopName").value.trim(),phone=$("#regPhone").value.trim(),email=$("#regEmail").value.trim().toLowerCase(),pass=$("#regPassword").value,pass2=$("#regPassword2").value,province=$("#province").value.trim(),city=$("#city").value.trim();
 if(!ownerName||!shopName||!phone||!email||!pass)return toast("أكمل الحقول المطلوبة");
 if(pass.length<6)return toast("كلمة المرور يجب أن تكون 6 أحرف أو أكثر");
 if(pass!==pass2)return toast("كلمتا المرور غير متطابقتين");
 try{const cred=await auth.createUserWithEmailAndPassword(email,pass);const uid=cred.user.uid;const data={ownerName,shopName,phone,email,province,city,createdAt:Date.now(),plan:"ultra",version:"4.0.0"};await db.ref(`users/${uid}/profile`).set(data);await phoneIndexRef(phone).set({uid,email,phone,shopName});toast("تم إنشاء الحساب")}catch(e){toast(errMsg(e))}
};
$("#loginForm").onsubmit=async e=>{
 e.preventDefault();let identity=$("#loginIdentity").value.trim().toLowerCase(),pass=$("#loginPassword").value;if(!identity||!pass)return toast("اكتب بيانات الدخول");
 try{let email=identity;if(!identity.includes("@")){const snap=await phoneIndexRef(identity).get();if(!snap.exists())throw new Error("لا يوجد حساب بهذا الرقم");email=snap.val().email}await auth.signInWithEmailAndPassword(email,pass)}catch(e){toast(errMsg(e))}
};
function errMsg(e){const c=e.code||"";if(c.includes("email-already"))return"هذا البريد مستخدم";if(c.includes("weak-password"))return"كلمة المرور ضعيفة";if(c.includes("invalid")||c.includes("wrong")||c.includes("not-found"))return"بيانات الدخول غير صحيحة";return e.message||"حدث خطأ"}
$("#forgotBtn").onclick=async()=>{const email=$("#loginIdentity").value.trim().toLowerCase();if(!email.includes("@"))return toast("اكتب الإيميل");try{await auth.sendPasswordResetEmail(email);toast("تم إرسال رابط الاستعادة")}catch(e){toast(errMsg(e))}};

auth.onAuthStateChanged(user=>{currentUser=user;if(user){$("#authView").classList.add("hidden");$("#appView").classList.remove("hidden");listen()}else{$("#authView").classList.remove("hidden");$("#appView").classList.add("hidden")}});

function listen(){
 root().child("profile").on("value",s=>{profile=s.val()||{};$("#welcomeTitle").textContent=`مرحباً بك، ${profile.ownerName||""}`;$("#shopSubtitle").textContent=`لوحة ${profile.shopName||"محلك"} السحابية`;$("#sideShop").textContent=profile.shopName||"RepairOS X";$("#sideOwner").textContent=profile.ownerName||"Ultra";$("#drawerShop").textContent=profile.shopName||"القائمة الجانبية";renderProfile()});
 root().child("repairs").on("value",s=>{repairs=s.val()||{};renderAll()});
 root().child("inventory").on("value",s=>{inventory=s.val()||{};renderInventory()});
}

function renderAll(){renderStats();renderRepairs();renderCustomers();renderFinance();renderReports();renderDonut();}
function arr(){return Object.entries(repairs).sort((a,b)=>(b[1].createdAt||0)-(a[1].createdAt||0))}
function renderStats(){
 let all=0,working=0,done=0,delivered=0,debt=0,today=0;const tk=new Date().toISOString().slice(0,10);
 Object.values(repairs).forEach(r=>{all++;if(["inspection","approval","waiting_part","repairing"].includes(r.status))working++;if(["completed","ready"].includes(r.status))done++;if(r.status==="delivered")delivered++;debt+=Math.max(0,Number(r.price||0)-Number(r.paid||0));if(new Date(r.createdAt||Date.now()).toISOString().slice(0,10)===tk)today+=Number(r.paid||0)});
 $("#statAll").textContent=all;$("#statWorking").textContent=working;$("#statDone").textContent=done;$("#statDelivered").textContent=delivered;$("#statDebt").textContent=money(debt);$("#statToday").textContent=money(today);$("#donutTotal").textContent=all;
}
function renderDonut(){
 const counts={};Object.values(repairs).forEach(r=>counts[r.status]=(counts[r.status]||0)+1);
 $("#statusLegend").innerHTML=Object.entries(statuses).filter(([k])=>counts[k]).map(([k,v])=>`<div><i style="background:${statusColors[k]}"></i>${v}: ${counts[k]}</div>`).join("")||"<div>لا توجد بيانات</div>";
}
function badge(s){return `<span class="badge b-${s}">${statuses[s]||s}</span>`}
function card(rid,r){
 const remain=Math.max(0,Number(r.price||0)-Number(r.paid||0)); lastRepairId=lastRepairId||rid;
 return `<article class="repair-card">
  <div class="repair-top"><div><h3>${esc(r.customerName)} - ${esc(r.deviceName)} ${esc(r.deviceModel||"")}</h3><p>${esc(r.brand||"")} | ${esc(r.fault||"")}</p>${badge(r.status||"new")}</div><div class="price">${money(remain)}</div></div>
  <p>رقم الزبون: ${esc(r.customerPhone||"")} ${r.imei?` | IMEI: ${esc(r.imei)}`:""}</p>
  <p>السعر: ${money(r.price)} | المدفوع: ${money(r.paid)} | تكلفة القطع: ${money(r.partsCost)}</p>
  ${r.dueDate?`<p>موعد التسليم: ${esc(r.dueDate)}</p>`:""}
  <div class="actions-row">
    <button class="glass-btn mini" onclick="editRepair('${rid}')">تعديل</button>
    <button class="glass-btn mini" onclick="statusMenu('${rid}')">الحالة</button>
    <button class="glass-btn mini" onclick="printInvoice('${rid}')">طباعة</button>
    <a class="glass-btn mini" target="_blank" href="https://wa.me/964${cleanPhone(r.customerPhone).replace(/^0/,'')}?text=${encodeURIComponent(invoiceText(r))}">واتساب</a>
    <button class="glass-btn mini" onclick="deleteRepair('${rid}')">حذف</button>
  </div>
 </article>`
}
function renderRepairs(){
 const q=($("#repairSearch")?.value||$("#globalSearch")?.value||"").toLowerCase(), sf=$("#statusFilter")?.value||"all";
 const filtered=arr().filter(([rid,r])=>(sf==="all"||r.status===sf)&&`${r.customerName} ${r.customerPhone} ${r.deviceName} ${r.deviceModel} ${r.brand} ${r.fault} ${r.imei}`.toLowerCase().includes(q));
 $("#latestRepairs").innerHTML=arr().slice(0,4).map(([rid,r])=>card(rid,r)).join("")||`<p class="muted">لا توجد أجهزة بعد.</p>`;
 $("#repairsList").innerHTML=filtered.map(([rid,r])=>card(rid,r)).join("")||`<p class="muted">لا توجد نتائج.</p>`;
}
function renderCustomers(){
 const map={};Object.values(repairs).forEach(r=>{const key=r.customerPhone||r.customerName;if(!map[key])map[key]={name:r.customerName,phone:r.customerPhone,count:0,debt:0};map[key].count++;map[key].debt+=Math.max(0,Number(r.price||0)-Number(r.paid||0))});
 $("#customersList").innerHTML=Object.values(map).map(c=>`<article class="repair-card"><h3>${esc(c.name)}</h3><p>${esc(c.phone)}</p><p>عدد الأجهزة: ${c.count}</p><b class="price">${money(c.debt)}</b></article>`).join("")||`<p class="muted">لا يوجد عملاء.</p>`
}
function renderFinance(){
 const total=Object.values(repairs).reduce((s,r)=>s+Number(r.price||0),0),paid=Object.values(repairs).reduce((s,r)=>s+Number(r.paid||0),0),parts=Object.values(repairs).reduce((s,r)=>s+Number(r.partsCost||0),0);
 $("#financeList").innerHTML=`<article class="repair-card"><h3>ملخص مالي</h3><p>إجمالي الفواتير: ${money(total)}</p><p>المقبوض: ${money(paid)}</p><p>تكلفة القطع: ${money(parts)}</p><b class="price">ربح تقريبي: ${money(total-parts)}</b></article>`+arr().filter(([id,r])=>Number(r.price)>Number(r.paid)).map(([id,r])=>card(id,r)).join("");
}
function renderInventory(){const e=Object.entries(inventory||{});$("#inventoryList").innerHTML=e.map(([pid,p])=>`<article class="repair-card"><h3>${esc(p.name)}</h3><p>العدد: ${p.qty||0}</p><p>شراء: ${money(p.buy)} | بيع: ${money(p.sell)}</p></article>`).join("")||`<p class="muted">لا توجد قطع بعد.</p>`}
function renderReports(){const counts={};Object.values(repairs).forEach(r=>counts[r.status]=(counts[r.status]||0)+1);$("#reportsBox").innerHTML=Object.entries(statuses).map(([k,v])=>`<article class="repair-card"><h3>${v}</h3><b class="price">${counts[k]||0}</b></article>`).join("")}
function renderProfile(){ $("#profileBox").innerHTML=`<article class="repair-card"><h3>${esc(profile.shopName||"")}</h3><p>المالك: ${esc(profile.ownerName||"")}</p><p>الهاتف: ${esc(profile.phone||"")}</p><p>الإيميل: ${esc(profile.email||"")}</p><p>${esc(profile.province||"")} - ${esc(profile.city||"")}</p></article>` }

$("#addRepairBtn").onclick=()=>openRepairModal(); $("#repairSearch").oninput=renderRepairs; $("#globalSearch").oninput=renderRepairs; $("#statusFilter").onchange=renderRepairs;
function openRepairModal(rid=null){$("#repairForm").reset();$("#editingId").value="";$("#modalTitle").textContent="استلام جهاز جديد";if(rid){const r=repairs[rid];$("#editingId").value=rid;$("#modalTitle").textContent="تعديل جهاز";["customerName","customerPhone","brand","deviceName","deviceModel","color","imei","devicePass","fault","diagnosis","status","dueDate","notes"].forEach(k=>$("#"+k).value=r[k]||"");$("#repairPrice").value=r.price||"";$("#paidAmount").value=r.paid||"";$("#partsCost").value=r.partsCost||""}$("#repairModal").classList.remove("hidden")}
function closeRepairModal(){$("#repairModal").classList.add("hidden")}
$("#repairForm").onsubmit=async e=>{
 e.preventDefault();const rid=$("#editingId").value||id();const old=repairs[rid]||{};
 const data={customerName:$("#customerName").value.trim(),customerPhone:$("#customerPhone").value.trim(),brand:$("#brand").value.trim(),deviceName:$("#deviceName").value.trim(),deviceModel:$("#deviceModel").value.trim(),color:$("#color").value.trim(),imei:$("#imei").value.trim(),devicePass:$("#devicePass").value.trim(),fault:$("#fault").value.trim(),diagnosis:$("#diagnosis").value.trim(),price:onlyNum($("#repairPrice").value),paid:onlyNum($("#paidAmount").value),partsCost:onlyNum($("#partsCost").value),status:$("#status").value,dueDate:$("#dueDate").value,notes:$("#notes").value.trim(),createdAt:old.createdAt||Date.now(),updatedAt:Date.now()};
 if(!data.customerName||!data.customerPhone||!data.deviceName||!data.fault)return toast("أكمل اسم الزبون ورقمه والجهاز والعطل");
 await root().child("repairs").child(rid).set(data);closeRepairModal();toast("تم حفظ الجهاز");
}
function editRepair(rid){openRepairModal(rid)}
function statusMenu(rid){const list=Object.entries(statuses).map(([k,v])=>`${k} = ${v}`).join("\n");const val=prompt("اكتب كود الحالة:\n"+list,repairs[rid]?.status||"inspection");if(val&&statuses[val])root().child("repairs").child(rid).update({status:val,updatedAt:Date.now()});else if(val)toast("كود الحالة غير صحيح")}
function deleteRepair(rid){if(confirm("حذف الجهاز؟"))root().child("repairs").child(rid).remove()}
function invoiceText(r){return `فاتورة صيانة
${profile?.shopName||"RepairOS X Ultra"}
الزبون: ${r.customerName}
الهاتف: ${r.deviceName} ${r.deviceModel||""}
العطل: ${r.fault}
الحالة: ${statuses[r.status]||r.status}
السعر: ${money(r.price)}
المدفوع: ${money(r.paid)}
المتبقي: ${money(Math.max(0,Number(r.price||0)-Number(r.paid||0)))}`}
function printInvoice(rid){const r=repairs[rid]; if(!r)return; lastRepairId=rid; const remain=Math.max(0,Number(r.price||0)-Number(r.paid||0)); const w=window.open("","_blank"); w.document.write(`<html dir="rtl" lang="ar"><head><title>فاتورة</title><style>body{font-family:Arial;padding:24px;color:#111}.box{border:2px solid #111;padding:22px;border-radius:16px}.top{display:flex;justify-content:space-between}.logo{font-size:28px;font-weight:bold;color:#9b6b15}.row{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:10px 0}.total{font-size:24px;font-weight:bold}.stamp{border:2px solid #9b6b15;color:#9b6b15;border-radius:50%;width:100px;height:100px;display:grid;place-items:center;margin:20px auto}.small{color:#555}button{padding:12px 20px}@media print{button{display:none}}</style></head><body><div class="box"><div class="top"><div><div class="logo">${esc(profile?.shopName||"RepairOS X")}</div><div>${esc(profile?.phone||"")}</div></div><div>فاتورة صيانة<br>${new Date().toLocaleDateString("ar")}</div></div><hr><div class="row"><b>الزبون</b><span>${esc(r.customerName)}</span></div><div class="row"><b>الهاتف</b><span>${esc(r.customerPhone)}</span></div><div class="row"><b>الجهاز</b><span>${esc(r.brand||"")} ${esc(r.deviceName)} ${esc(r.deviceModel||"")}</span></div><div class="row"><b>IMEI</b><span>${esc(r.imei||"-")}</span></div><div class="row"><b>العطل</b><span>${esc(r.fault)}</span></div><div class="row"><b>الحالة</b><span>${statuses[r.status]||r.status}</span></div><div class="row"><b>السعر</b><span>${money(r.price)}</span></div><div class="row"><b>المدفوع</b><span>${money(r.paid)}</span></div><div class="row total"><b>المتبقي</b><span>${money(remain)}</span></div><div class="stamp">ختم المحل</div><p class="small">الشروط: لا يوجد ضمان على الشاشات إلا باتفاق. يرجى إحضار الفاتورة عند الاستلام.</p><button onclick="print()">طباعة</button></div></body></html>`); w.document.close();}
function printLast(){if(lastRepairId)printInvoice(lastRepairId);else toast("لا توجد فاتورة أخيرة")}
function jumpPage(page){showPage(page,document.querySelector(`.nav[data-page="${page}"]`))}
$$(".nav[data-page]").forEach(btn=>btn.onclick=()=>showPage(btn.dataset.page,btn));
function showPage(page,btn){$$(".nav").forEach(b=>b.classList.remove("active"));btn?.classList.add("active");$$(".page").forEach(p=>p.classList.add("hidden"));$("#"+page).classList.remove("hidden")}
$("#addPartBtn").onclick=async()=>{const name=prompt("اسم القطعة");if(!name)return;const qty=onlyNum(prompt("العدد","0"));await root().child("inventory").child(id()).set({name,qty,buy:0,sell:0,createdAt:Date.now()});}
$("#aiBtn").onclick=()=>{const t=$("#aiInput").value.trim();if(!t)return toast("اكتب وصف العطل");const low=t.toLowerCase();let tips=["فحص البطارية والفولت","فحص القصر على البورد","فحص آثار الماء والكسر","استبعاد السوفتوير"];if(low.includes("شحن")||low.includes("يشحن"))tips=["سوكت الشحن","Charging IC","بطارية أو BSI","قصر VBUS","قياس الأمبير"];if(low.includes("شاشة")||low.includes("سوداء"))tips=["تجربة شاشة مضمونة","Backlight","كونكتور الشاشة","Display IC","هل الجهاز يعمل صوت؟"];if(low.includes("شبكة"))tips=["SIM reader","Baseband","Antenna Lines","IMEI","سوفتوير قبل الهاردوير"];$("#aiResult").innerHTML=`<article class="repair-card"><h3>تحليل ذكي</h3>${tips.map(x=>`<p>• ${x}</p>`).join("")}</article>`}

$("#menuBtn").onclick=()=>$("#drawer").classList.remove("hidden");$("#closeDrawer").onclick=closeDrawer;function closeDrawer(){$("#drawer").classList.add("hidden")}
function showAbout(){toast("RepairOS X Ultra - نظام إدارة صيانة فاخر");}
function toggleTheme(){document.body.classList.toggle("light");toast("تم تبديل المظهر")}
function exportBackup(){const data={profile,repairs,inventory,exportedAt:new Date().toISOString()};const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="repair-os-ultra-backup.json";a.click()}
if("serviceWorker" in navigator)navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister()));
