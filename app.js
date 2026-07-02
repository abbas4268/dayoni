let currentUser=null,profile={},repairs={},lastRepairId=null,tracking=false;

const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);

const money=n=>`${Number(n||0).toLocaleString("en-US")} د.ع`;
const num=v=>Number(String(v||"").replace(/[^\d]/g,""))||0;
const ph=p=>String(p||"").replace(/[^\d]/g,"");
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));

const toast=m=>{
  const t=$("#toast");
  t.textContent=m;
  t.classList.remove("hidden");
  setTimeout(()=>t.classList.add("hidden"),3000);
};

const uidRef=()=>db.ref(`users/${currentUser.uid}`);
const phoneRef=p=>db.ref(`phoneIndex/${ph(p)}`);
const newId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);

const statuses={
  new:"جديد - تم الاستلام",
  inspection:"تحت الفحص المجهري",
  approval:"بانتظار موافقة السعر",
  waiting_part:"بانتظار قطع الغيار",
  repairing:"قيد العمل والميكرو-سولديرنج",
  completed:"مكتمل التصليح بنجاح",
  ready:"جاهز ومفحوص للاستلام",
  delivered:"تم تسليمه للعميل",
  rejected:"مرفوض لعدم الجدوى",
  cancelled:"ملغي من العميل"
};

// Automatic Luxurious Smooth Splash screen exit
setTimeout(()=>{
  const splash = $("#splash");
  if(splash) {
    splash.style.opacity = "0";
    setTimeout(()=>splash.classList.add("hidden"), 500);
  }
},1200);

// Tracking Flow Initialization
let ps=new URLSearchParams(location.search); 
if(ps.get("track")){
  tracking=true;
  $("#trackView").classList.remove("hidden");
  const splash = $("#splash"); if(splash) splash.classList.add("hidden");
  loadTrackingView(ps.get("track"));
}

// Global Core Auth State Observability
auth.onAuthStateChanged(user=>{
  if(tracking) return;
  if(user){
    currentUser=user;
    $("#authView").classList.add("hidden");
    $("#appShell").classList.remove("hidden");
    syncData();
  } else {
    currentUser=null;
    $("#appShell").classList.add("hidden");
    $("#authView").classList.remove("hidden");
  }
});

// Dynamic UI Page Switcher
function goPage(p){
  $$(".page").forEach(x=>x.classList.remove("show"));
  const activePage = $("#"+p);
  if(activePage) activePage.classList.add("show");
  
  $$(".nav").forEach(b=>b.classList.toggle("active",b.dataset.page===p));
  $("#pageTitle").textContent={
    dashboard:"لوحة التحكم الرئيسية",
    repairs:"📱 إدارة أجهزة الصيانة",
    customers:"👥 سجل دليل العملاء",
    invoices:"🧾 أرشيف المستندات والفواتير",
    reports:"📈 التقارير المالية والأرباح",
    settings:"⚙️ الإعدادات والهوية الفاخرة"
  }[p]||p;
  closeDrawer();
}

$$(".nav").forEach(b=>b.onclick=()=>goPage(b.dataset.page));
$("#menuBtn").onclick=()=>$("#drawer").classList.remove("hidden");
function closeDrawer(){ $("#drawer").classList.add("hidden"); }

// High-End Pseudo AI Cognitive Diagnostic Engine
$("#aiBtn").onclick=()=>{
  let text=$("#aiInput").value.trim().toLowerCase();
  let resBox=$("#aiResult");
  if(!text) return;
  
  resBox.classList.remove("hidden");
  resBox.innerHTML = "<div class='modern-loader'></div> جاري تحليل الإشارات والدوائر هندسياً...";

  setTimeout(()=>{
    let solution = "";
    if(text.includes("شحن") || text.includes("بطارية") || text.includes("تفريغ") || text.includes("يسخن")) {
      solution = `<b>📊 التقرير التشخيصي الذكي (دائرة الطاقة والشحن):</b><br>
                  • <b>الخطوة 1:</b> فحص فلاتة وسوكت الشحن وممانعة مسار VBUS (يجب أن يعطي 5V ثابتة).<br>
                  • <b>الخطوة 2:</b> التحقق من سلامة فلاتة البطارية واختبار تيار سحب الباور سبلاي قبل وبعد الضغط على زر الباور.<br>
                  • <b>الخطوة 3:</b> الاشتباه الهندسي يتجه نحو آيسي الشحن (Tristar/Hydra أو U2) أو منظم الجهد الرئيسي بسبب شواحن غير أصلية. افحص التسريب بالكاميرا الحرارية.`;
    } else if(text.includes("شاشة") || text.includes("لمس") || text.includes("اضاءة") || text.includes("سوداء")) {
      solution = `<b>📊 التقرير التشخيصي الذكي (منظومة العرض والبيانات):</b><br>
                  • <b>الخطوة 1:</b> فحص كونكتر الشاشة مجهرياً ونظفه باستخدام الكحول الآيزوبروبيلي.<br>
                  • <b>الخطوة 2:</b> قياس ممانعات مسارات MIPI الخاصة بالبيانات ومسارات الإضاءة العالية (LCM_BACKLIGHT).<br>
                  • <b>الخطوة 3:</b> في حال غياب الإضاءة مع وجود البيانات، افحص ديود الإضاءة (Backlight Diode) وملف الرفع (Coil).`;
    } else if(text.includes("شعار") || text.includes("تفاحة") || text.includes("يفتح ويطفي") || text.includes("ريستارت")) {
      solution = `<b>📊 التقرير التشخيصي الذكي (إقلاع النظام والسوفتوير):</b><br>
                  • <b>الخطوة 1:</b> افحص خط الـ الناند (NAND) ومسارات البيانات ومساحة التخزين الممتلئة.<br>
                  • <b>الخطوة 2:</b> افصل فلاتة الحساس العلوي (Proximity/Ear Speaker) واختبر الإقلاع، حيث يتسبب تضررها بآثار ماء في تعليق معالج الجهاز (Boot loop).<br>
                  • <b>الخطوة 3:</b> اربط الهاتف ببرنامج 3uTools واقرأ كود الخطأ (Error Code) لتحديد العطل برمجياً بدقة متناهية.`;
    } else {
      solution = `<b>📊 تحليل عام للنظام الذكي:</b><br>
                  لم يتم التعرف التلقائي المباشر على الكود الدقيق للعطل. يوصى ببدء قياس الممانعة على ريش البطارية ومسار VDD_MAIN، تتبع خطوط التغذية المرجعية، والتأكد من سلامة اللوحة الأم من أي انحناء أو دخول سوائل.`;
    }
    resBox.innerHTML = solution;
  }, 750);
};

// Sync and Aggregations Core
function syncData(){
  uidRef().on('value', snapshot => {
    let data = snapshot.val() || {};
    profile = data.profile || {};
    repairs = data.repairs || {};
    
    // Update Shop Identity UI elements
    $("#userShopName").textContent = profile.shopName || "المركز الفخم";
    
    // Apply configurations if present
    if(profile.theme) document.body.dataset.theme = profile.theme;
    if(profile.accent) document.body.dataset.accent = profile.accent;

    calculateMetrics();
    renderRepairs();
    renderCustomersAndReports();
  });
}

function calculateMetrics(){
  let active = 0, earnings = 0, completedNotDelivered = 0;
  Object.values(repairs).forEach(r => {
    if(r.status !== 'delivered' && r.status !== 'cancelled' && r.status !== 'rejected') {
      active++;
    }
    if(r.status === 'completed' || r.status === 'ready') {
      completedNotDelivered++;
    }
    earnings += (num(r.repairPrice) - num(r.partsCost));
  });
  
  $("#statActive").textContent = active;
  $("#statEarnings").textContent = money(earnings);
  $("#statCompleted").textContent = completedNotDelivered;
}

function renderRepairs(){
  const grid = $("#repairsGrid");
  if(!grid) return;
  grid.innerHTML = "";
  
  let search = $("#searchRepair").value.toLowerCase();
  let filter = $("#filterStatus").value;
  
  Object.keys(repairs).reverse().forEach(id => {
    let r = repairs[id];
    let matchText = `${r.customerName} ${r.deviceModel} ${r.fault} ${id}`.toLowerCase();
    if(search && !matchText.includes(search)) return;
    if(filter !== 'all' && r.status !== filter) return;
    
    lastRepairId = id; // track last for quick printing
    
    let card = document.createElement("div");
    card.className = "repairCard";
    card.innerHTML = `
      <div class="card-header-main">
        <div>
          <div class="card-title">${esc(r.deviceModel)}</div>
          <div class="card-meta">العميل: ${esc(r.customerName)} | كود: ${id}</div>
        </div>
        <span class="badge-status status-${r.status}">${statuses[r.status] || r.status}</span>
      </div>
      <div style="font-size:13px; margin: 4px 0;"><b>العطل:</b> ${esc(r.fault)}</div>
      <div style="font-size:13px; color:var(--accent); font-weight:700;">الحساب: ${money(r.repairPrice)}</div>
      <div style="display:flex; gap:8px; margin-top:8px;">
        <button onclick="editRepair('${id}')" class="icon-btn" style="width:100%; font-size:13px; font-weight:700;">⚙️ تعديل وتحديث</button>
        <button onclick="printInvoice('${id}')" class="icon-btn" style="width:45px;">🖨️</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

$("#searchRepair").oninput = renderRepairs;
$("#filterStatus").onchange = renderRepairs;

function renderCustomersAndReports(){
  const custBody = $("#customersTableBody");
  const repBody = $("#reportsTableBody");
  const invBody = $("#invoicesTableBody");
  
  if(custBody) custBody.innerHTML = "";
  if(repBody) repBody.innerHTML = "";
  if(invBody) invBody.innerHTML = "";
  
  let totalPaid = 0, totalParts = 0, netProfit = 0;
  
  Object.keys(repairs).forEach(id => {
    let r = repairs[id];
    totalPaid += num(r.paidAmount);
    totalParts += num(r.partsCost);
    let individualProfit = num(r.repairPrice) - num(r.partsCost);
    netProfit += individualProfit;
    
    // Render Invoices archive
    if(invBody) {
      let row = document.createElement("tr");
      row.innerHTML = `
        <td><b>#INV-${id}</b></td>
        <td>${esc(r.dueDate || 'غير محدد')}</td>
        <td>${esc(r.customerName)} (${esc(r.deviceModel)})</td>
        <td class="gold-text">${money(r.repairPrice)}</td>
        <td><button onclick="printInvoice('${id}')" class="icon-btn" style="height:32px; width:80px; font-size:12px; font-weight:700;">🖨️ طباعة</button></td>
      `;
      invBody.appendChild(row);
    }

    // Render reports
    if(repBody) {
      let row = document.createElement("tr");
      row.innerHTML = `
        <td>${id}</td>
        <td>${esc(r.deviceModel)}</td>
        <td style="color:var(--red);">${money(r.partsCost)}</td>
        <td style="color:var(--green);">${money(r.repairPrice)}</td>
        <td><b>${money(individualProfit)}</b></td>
      `;
      repBody.appendChild(row);
    }
  });

  if($("#reportTotalPaid")) $("#reportTotalPaid").textContent = money(totalPaid);
  if($("#reportTotalParts")) $("#reportTotalParts").textContent = money(totalParts);
  if($("#reportNetProfit")) $("#reportNetProfit").textContent = money(netProfit);
}

// Modal handling logic
let currentEditingId = null;
function openNewRepair(){
  currentEditingId = null;
  $("#repairForm").reset();
  $("#modalTitle").textContent = "إدخال جهاز صيانة سحابي جديد";
  $("#repairModal").classList.remove("hidden");
}
function closeRepairModal(){ $("#repairModal").classList.add("hidden"); }

function editRepair(id) {
  currentEditingId = id;
  let r = repairs[id];
  $("#customerName").value = r.customerName || "";
  $("#customerPhone").value = r.customerPhone || "";
  $("#deviceModel").value = r.deviceModel || "";
  $("#imei").value = r.imei || "";
  $("#color").value = r.color || "";
  $("#devicePass").value = r.devicePass || "";
  $("#fault").value = r.fault || "";
  $("#diagnosis").value = r.diagnosis || "";
  $("#repairPrice").value = r.repairPrice || "";
  $("#paidAmount").value = r.paidAmount || "";
  $("#partsCost").value = r.partsCost || "";
  $("#status").value = r.status || "new";
  $("#dueDate").value = r.dueDate || "";
  $("#notes").value = r.notes || "";
  
  $("#modalTitle").textContent = `تحديث بيانات الجهاز كود: ${id}`;
  $("#repairModal").classList.remove("hidden");
}

$("#repairForm").onsubmit = (e) => {
  e.preventDefault();
  let id = currentEditingId || newId();
  let repairData = {
    customerName: $("#customerName").value,
    customerPhone: $("#customerPhone").value,
    deviceModel: $("#deviceModel").value,
    imei: $("#imei").value,
    color: $("#color").value,
    devicePass: $("#devicePass").value,
    fault: $("#fault").value,
    diagnosis: $("#diagnosis").value,
    repairPrice: $("#repairPrice").value,
    paidAmount: $("#paidAmount").value,
    partsCost: $("#partsCost").value,
    status: $("#status").value,
    dueDate: $("#dueDate").value,
    notes: $("#notes").value
  };
  
  uidRef().child(`repairs/${id}`).set(repairData)
    .then(() => {
      toast("تم حفظ البيانات وتأمينها سحابياً بنجاح الفخم.");
      closeRepairModal();
    })
    .catch(err => toast("خطأ في الاتصال بالسحابة: " + err.message));
};

// Premium Document & Invoice Layout Generation Engine
function printInvoice(id) {
  let r = repairs[id];
  if(!r) return;
  let w = window.open();
  w.document.write(`
    <html>
    <head>
      <title>فاتورة صيانة رقم ${id}</title>
      <style>
        body { font-family: 'Tajawal', sans-serif; direction: rtl; text-align: right; padding: 40px; color:#222; }
        .invoice-box { max-width: 800px; margin: auto; border: 1px solid #eee; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.05); }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #dca842; padding-bottom: 25px; }
        .title { font-size: 26px; font-weight: 800; color: #111; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0; }
        .item-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; font-size: 15px; }
        .total-box { background: #fdfaf2; padding: 15px; border-radius: 8px; border: 1px solid #f0e2c3; margin-top: 20px; text-align: left; font-size: 18px; font-weight: 800; color: #b88626; }
        button { background:#dca842; color:#fff; padding: 10px 20px; border:none; border-radius: 5px; font-weight:700; cursor:pointer; margin-top:20px; }
        @media print { button { display:none; } }
      </style>
    </head>
    <body>
      <div class="invoice-box">
        <div class="header">
          <div>
            <div class="title">${esc(profile.shopName || 'مركز الصيانة الاحترافي')}</div>
            <div>فاتورة صيانة سحابية موثقة</div>
          </div>
          <div>
            <div><b>رقم الفاتورة:</b> REQ-${id}</div>
            <div><b>التاريخ:</b> ${new Date().toLocaleDateString('ar-IQ')}</div>
          </div>
        </div>
        <div class="grid">
          <div>
            <h3>بيانات العميل</h3>
            <div><b>الاسم:</b> ${esc(r.customerName)}</div>
            <div><b>الهاتف:</b> ${esc(r.customerPhone)}</div>
          </div>
          <div>
            <h3>تفاصيل الجهاز صيانة</h3>
            <div><b>الهاتف:</b> ${esc(r.deviceModel)}</div>
            <div><b>العطل:</b> ${esc(r.fault)}</div>
            <div><b>حالة الإجراء:</b> ${statuses[r.status] || r.status}</div>
          </div>
        </div>
        <div class="item-row"><span>أجر العمل والإصلاح الفني:</span> <b>${money(r.repairPrice)}</b></div>
        <div class="item-row"><span>المبلغ المدفوع سلفاً:</span> <b>${money(r.paidAmount)}</b></div>
        <div class="total-box">المتبقي الصافي للامتثال: ${money(num(r.repairPrice) - num(r.paidAmount))}</div>
        <center><button onclick="window.print()">🖨️ بدء أمر الطباعة الفوري</button></center>
      </div>
    </body>
    </html>
  `);
  w.document.close();
}

function printLast(){ lastRepairId ? printInvoice(lastRepairId) : toast("لا توجد فاتورة مسجلة حالياً."); }

// Setting customizations
function setTheme(t){
  document.body.dataset.theme=t;
  localStorage.theme=t;
  if(currentUser) uidRef().child("profile/theme").set(t);
}
function setAccent(a){
  document.body.dataset.accent=a;
  localStorage.accent=a;
  if(currentUser) uidRef().child("profile/accent").set(a);
}

// Backup logic
function exportBackup(){
  let blob=new Blob([JSON.stringify({profile,repairs},null,2)],{type:"application/json"});
  let a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`RepairOS_Luxury_Backup_${Date.now()}.json`;
  a.click();
}

// Public live tracking implementation
function loadTrackingView(id){
  db.ref(`users`).once('value', snapshot => {
    let allUsers = snapshot.val() || {};
    let foundRepair = null;
    let foundShop = "مركز صيانة معتمد";
    
    Object.values(allUsers).forEach(u => {
      if(u.repairs && u.repairs[id]) {
        foundRepair = u.repairs[id];
        if(u.profile && u.profile.shopName) foundShop = u.profile.shopName;
      }
    });
    
    if(foundRepair) {
      $("#trackMeta").innerHTML = `جهاز: <b>${esc(foundRepair.deviceModel)}</b> | المركز: <b>${esc(foundShop)}</b>`;
      let b = $("#trackStatusBadge");
      b.textContent = statuses[foundRepair.status] || foundRepair.status;
      b.className = `track-status-badge status-${foundRepair.status}`;
      
      let progress = { new: 15, inspection: 35, approval: 50, waiting_part: 65, repairing: 80, completed: 95, ready: 100, delivered: 100 }[foundRepair.status] || 50;
      $("#trackProgress").style.width = `${progress}%`;
    } else {
      $("#trackMeta").textContent = "عذراً، كود التتبع هذا غير صالح أو تم أرشفته.";
    }
  });
}

// Authentic Auth Form submission listeners
$("#loginForm").onsubmit=(e)=>{
  e.preventDefault();
  let email = $("#loginIdentity").value;
  let pass = $("#loginPassword").value;
  if(!email.includes("@")) email += "@repair.os"; // smart autocomplete for convenience
  auth.signInWithEmailAndPassword(email, pass)
    .then(()=>toast("أهلاً بك مجدداً في نظامك الفاخر."))
    .catch(err=>toast("خطأ في التحقق: " + err.message));
};

$("#registerForm").onsubmit=(e)=>{
  e.preventDefault();
  let email = $("#regEmail").value;
  let pass = $("#regPassword").value;
  let sName = $("#shopName").value;
  let oName = $("#ownerName").value;
  let phone = $("#regPhone").value;
  
  auth.createUserWithEmailAndPassword(email, pass)
    .then(cred=>{
      db.ref(`users/${cred.user.uid}/profile`).set({
        shopName: sName,
        ownerName: oName,
        phone: phone,
        theme: 'dark',
        accent: 'gold'
      }).then(()=>toast("تم تأسيس مركزك الفخم بنجاح صاعق!"));
    })
    .catch(err=>toast("فشل التأسيس: " + err.message));
};

$("#loginTab").onclick=()=>{
  $("#loginTab").classList.add("active"); $("#registerTab").classList.remove("active");
  $("#loginForm").classList.remove("hidden"); $("#registerForm").classList.add("hidden");
};
$("#registerTab").onclick=()=>{
  $("#registerTab").classList.add("active"); $("#loginTab").classList.remove("active");
  $("#registerForm").classList.remove("hidden"); $("#loginForm").classList.add("hidden");
};
