let clients = {};
let activeClientId = null;

const $ = s => document.querySelector(s);
const money = n => `${Number(n || 0).toLocaleString("en-US")} د.ع`;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);
const cleanPhone = p => String(p||"").replace(/[^\d]/g,"");
const esc = s => String(s ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
function toast(t){const d=document.createElement("div");d.className="toast";d.textContent=t;document.body.appendChild(d);setTimeout(()=>d.remove(),2200)}

function calc(c){
  let debt=0, paid=0;
  Object.values(c.tx||{}).forEach(t=>{let a=Number(t.amount||0); t.type==="pay"? paid+=a : debt+=a;});
  return {debt, paid, balance:debt-paid};
}

DAYONI_DB.on("value", s=>{clients=s.val()||{}; render();}, e=>toast("خطأ اتصال Firebase"));

function render(){
  const q = ($("#searchInput").value||"").toLowerCase().trim();
  const list = $("#clientsList"); list.innerHTML="";
  let totalDebt=0,totalPaid=0,count=0;
  Object.entries(clients).forEach(([id,c])=>{const m=calc(c);totalDebt+=m.debt;totalPaid+=m.paid;count++;});
  $("#statDebt").textContent=money(totalDebt); $("#statPaid").textContent=money(totalPaid);
  $("#statBalance").textContent=money(totalDebt-totalPaid); $("#statClients").textContent=count;

  Object.entries(clients).sort((a,b)=>(b[1].created||0)-(a[1].created||0)).forEach(([id,c])=>{
    const text = `${c.name||""} ${c.phone||""} ${c.address||""}`.toLowerCase();
    if(q && !text.includes(q)) return;
    const m=calc(c), phone=cleanPhone(c.phone);
    const card=document.createElement("article");
    card.className="client-card";
    card.innerHTML=`
      <div class="client-top">
        <div><h3>${esc(c.name||"بدون اسم")}</h3><p>${esc(c.phone||"بدون رقم")}</p>${c.address?`<p>${esc(c.address)}</p>`:""}</div>
        <div class="balance">${money(m.balance)}</div>
      </div>
      <div class="actions">
        <button onclick="openAccount('${id}')">الحساب</button>
        <button onclick="openClient('${id}')">تعديل</button>
        <a href="tel:${esc(c.phone||"")}">اتصال</a>
        <a target="_blank" href="https://wa.me/964${phone.replace(/^0/,'')}?text=${encodeURIComponent(statement(id))}">واتساب</a>
      </div>`;
    list.appendChild(card);
  });
}

function unlock(){
  const saved = localStorage.getItem("dayoni_pro_pin") || "1234";
  if($("#pinInput").value.trim()===saved) $("#lockScreen").classList.add("hidden");
  else toast("الرمز غير صحيح");
}
function changePin(){
  const saved=localStorage.getItem("dayoni_pro_pin")||"1234";
  const old=prompt("اكتب الرمز الحالي:");
  if(old!==saved) return toast("الرمز الحالي خطأ");
  const np=prompt("اكتب الرمز الجديد:");
  if(!np || np.length<4) return toast("الرمز يجب أن يكون 4 أرقام أو أكثر");
  localStorage.setItem("dayoni_pro_pin",np); toast("تم تغيير الرمز");
}

function showModal(title, body){$("#modalTitle").textContent=title; $("#modalBody").innerHTML=body; $("#modal").classList.remove("hidden")}
function closeModal(){$("#modal").classList.add("hidden")}

function openClient(id=""){
  const c=id?clients[id]:{};
  showModal(id?"تعديل زبون":"إضافة زبون",`
    <div class="form-grid">
      <input id="cName" placeholder="اسم الزبون" value="${esc(c.name||"")}">
      <input id="cPhone" placeholder="رقم الهاتف" inputmode="tel" value="${esc(c.phone||"")}">
      <input id="cAddress" placeholder="العنوان" value="${esc(c.address||"")}">
      <textarea id="cNote" placeholder="ملاحظات">${esc(c.note||"")}</textarea>
      <button class="gold-btn" onclick="saveClient('${id}')">حفظ</button>
      ${id?`<button class="ghost-btn danger" onclick="deleteClient('${id}')">حذف الزبون</button>`:""}
    </div>`);
}
function saveClient(id){
  const data={name:$("#cName").value.trim(),phone:$("#cPhone").value.trim(),address:$("#cAddress").value.trim(),note:$("#cNote").value.trim(),updated:Date.now()};
  if(!data.name) return toast("اكتب اسم الزبون");
  if(id) DAYONI_DB.child(id).update(data); else {data.created=Date.now();data.tx={};DAYONI_DB.child(uid()).set(data)}
  closeModal(); toast("تم الحفظ");
}
function deleteClient(id){if(confirm("تحذف الزبون وكل حسابه؟")){DAYONI_DB.child(id).remove();closeModal();toast("تم الحذف")}}

function openAccount(id){
  activeClientId=id; const c=clients[id], m=calc(c);
  const txs=Object.entries(c.tx||{}).sort((a,b)=>(b[1].date||0)-(a[1].date||0));
  showModal(c.name,`
    <div class="stats" style="margin-top:12px">
      <article><small>دين</small><b>${money(m.debt)}</b></article>
      <article><small>دفعات</small><b>${money(m.paid)}</b></article>
      <article><small>متبقي</small><b>${money(m.balance)}</b></article>
      <article><small>عمليات</small><b>${txs.length}</b></article>
    </div>
    <div class="toolbar">
      <button class="gold-btn" onclick="openTx('debt')">+ دين</button>
      <button class="ghost-btn" onclick="openTx('pay')">+ دفعة</button>
    </div>
    <div class="tx-list">
      ${txs.length?txs.map(([tid,t])=>`
        <div class="tx">
          <div><b>${esc(t.title|| (t.type==="pay"?"دفعة":"دين"))}</b><br><small>${new Date(t.date||Date.now()).toLocaleDateString("ar-IQ")}</small></div>
          <div style="text-align:left"><b class="${t.type==="pay"?"minus":"plus"}">${t.type==="pay"?"-":"+"}${money(t.amount)}</b><br><button class="ghost-btn danger" style="padding:5px 8px;margin-top:5px" onclick="deleteTx('${tid}')">حذف</button></div>
        </div>`).join(""):`<p style="text-align:center;color:var(--muted);padding:16px">لا توجد عمليات</p>`}
    </div>
  `);
}
function openTx(type){
  showModal(type==="pay"?"إضافة دفعة":"إضافة دين",`
    <div class="form-grid">
      <input id="tTitle" placeholder="العنوان: شاشة، بطارية، دفعة...">
      <input id="tAmount" placeholder="المبلغ" inputmode="numeric">
      <textarea id="tNote" placeholder="ملاحظة اختيارية"></textarea>
      <button class="gold-btn" onclick="saveTx('${type}')">حفظ</button>
      <button class="ghost-btn" onclick="openAccount(activeClientId)">رجوع</button>
    </div>`);
}
function saveTx(type){
  const amount=Number(($("#tAmount").value||"").replace(/[^\d]/g,""));
  if(!amount) return toast("اكتب المبلغ");
  DAYONI_DB.child(activeClientId).child("tx").child(uid()).set({type,amount,title:$("#tTitle").value.trim(),note:$("#tNote").value.trim(),date:Date.now()});
  toast("تمت الإضافة"); setTimeout(()=>openAccount(activeClientId),250);
}
function deleteTx(tid){if(confirm("حذف العملية؟")){DAYONI_DB.child(activeClientId).child("tx").child(tid).remove();setTimeout(()=>openAccount(activeClientId),250)}}

function statement(id){
  const c=clients[id], m=calc(c); let s=`كشف حساب - ${c.name}\n\n`;
  Object.values(c.tx||{}).sort((a,b)=>(a.date||0)-(b.date||0)).forEach(t=>s+=`${t.type==="pay"?"دفعة":"دين"} | ${t.title||""} | ${money(t.amount)}\n`);
  return s+`\nالمتبقي: ${money(m.balance)}`;
}
function summary(){
  let s="ملخص ديوني عباس\n\n";
  Object.entries(clients).forEach(([id,c])=>s+=`${c.name}: ${money(calc(c).balance)}\n`);
  showModal("ملخص الديون",`<textarea style="min-height:260px">${esc(s)}</textarea><button class="gold-btn" onclick="navigator.clipboard.writeText(document.querySelector('#modalBody textarea').value);toast('تم النسخ')">نسخ</button>`);
}
function backup(){
  const blob=new Blob([JSON.stringify(clients,null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="dayoni-backup.json"; a.click();
}

$("#loginBtn").onclick=unlock; $("#changePinBtn").onclick=changePin; $("#logoutBtn").onclick=()=>$("#lockScreen").classList.remove("hidden");
$("#addClientBtn").onclick=()=>openClient(); $("#searchInput").oninput=render; $("#closeModalBtn").onclick=closeModal;
document.querySelectorAll(".bottom-nav button").forEach(b=>b.onclick=()=>{
  document.querySelectorAll(".bottom-nav button").forEach(x=>x.classList.remove("active")); b.classList.add("active");
  if(b.dataset.action==="summary") summary();
  if(b.dataset.action==="backup") backup();
});
if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
