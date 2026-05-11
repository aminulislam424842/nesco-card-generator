/* =====================================================================
   NESCO Card Generator — script.js
   ===================================================================== */

let rawRows = [],
  fileColumns = [],
  excelData = [],
  filteredData = [],
  currentPage = 1;
const perPage = 12;
let isFiltered = false;

/* ─── Card field definitions ───────────────────────────────────────── */

const cardFields = [
  {
    key: "sl",
    label: "সিরিয়াল নং",
    search: true,
    keywords: ["sl", "serial", "s/n", "s.no", "head", "no", "number", "ক্রম"],
  },
  {
    key: "consumer",
    label: "কনজুমার নম্বর",
    search: true,
    keywords: [
      "consumer num",
      "consumer_num",
      "consumer",
      "consumer no",
      "consumer_no",
      "consumer number",
      "কনজুমার",
    ],
  },
  {
    key: "name",
    label: "মিটারের নাম",
    search: false,
    keywords: [
      "user name",
      "user_name",
      "name",
      "username",
      "user",
      "meter name",
      "মিটারের নাম",
      "নাম",
    ],
  },
  {
    key: "meter",
    label: "মিটার নাম্বার",
    search: true,
    keywords: [
      "meter num",
      "meter_num",
      "meter no",
      "meter_no",
      "meter number",
      "miter num",
      "miter_num",
      "miter no",
      "miter",
      "meter",
      "মিটার",
    ],
  },
  {
    key: "mobile",
    label: "মোবাইল নম্বর",
    search: true,
    keywords: ["mobile", "phone", "cell", "contact", "মোবাইল", "ফোন"],
  },
  {
    key: "reference",
    label: "রেফারেন্স নাম্বার",
    search: true,
    keywords: [
      "reference",
      "ref",
      "refff",
      "reff",
      "ref no",
      "ref_no",
      "রেফারেন্স",
    ],
  },
  {
    key: "address",
    label: "ঠিকানা",
    search: false,
    keywords: ["address", "addr", "ঠিকানা"],
  },
  {
    key: "remark",
    label: "রিমার্ক",
    search: false,
    keywords: ["remark", "re-mark", "remarks", "রিমার্ক"],
  },
  {
    key: "type",
    label: "ধরণ (বাড়ি/দোকান)",
    search: true,
    keywords: ["type", "category", "ধরণ"],
  },
  {
    key: "house_no",
    label: "বাড়ি",
    search: true,
    keywords: ["house name", "house", "holding", "house_no", "house no"],
  },
  {
    key: "shop_name",
    label: "দোকান",
    search: true,
    keywords: ["shop name", "shop", "store", "business"],
  },
];

/* ===== FILE DROP / PICK ===== */
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");

dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});
dropZone.addEventListener("dragleave", () =>
  dropZone.classList.remove("drag-over"),
);
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", (e) => {
  if (e.target.files.length) handleFile(e.target.files[0]);
});

/* ===== FILE HANDLING ===== */
function handleFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (!["xlsx", "xls", "json"].includes(ext)) {
    showToast("শুধু Excel বা JSON ফাইল আপলোড করুন", "error");
    return;
  }
  window._selectedFile = file;
  document.getElementById("fileName").textContent =
    file.name + " (" + (file.size / 1024).toFixed(1) + " KB)";
  const te = document.getElementById("fileType");
  te.textContent = ext === "json" ? "JSON" : "EXCEL";
  te.className = "ft " + (ext === "json" ? "json" : "excel");
  document.getElementById("fileInfo").classList.add("show");
  showLoading("ফাইল পড়া হচ্ছে...");
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      if (ext === "json") parseJSON(e.target.result);
      else parseExcel(e.target.result);
    } catch (err) {
      hideLoading();
      showToast("সমস্যা: " + err.message, "error");
    }
  };
  reader.onerror = function () {
    hideLoading();
    showToast("ফাইল পড়তে ব্যর্থ হয়েছে", "error");
  };
  reader.readAsArrayBuffer(file);
}

function parseJSON(buf) {
  let j = JSON.parse(new TextDecoder("utf-8").decode(buf));
  if (!Array.isArray(j)) {
    if (typeof j === "object") j = [j];
    else throw new Error("অ্যারে হতে হবে");
  }
  if (!j.length) throw new Error("খালি ফাইল");
  const cs = new Set();
  j.forEach((o) => Object.keys(o).forEach((k) => cs.add(k)));
  fileColumns = Array.from(cs);
  rawRows = j;
  hideLoading();
  buildMappingUI();
}

function parseExcel(buf) {
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
  const d = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    header: 1,
  });
  if (d.length < 2) throw new Error("ডাটা নেই");
  fileColumns = d[0].map((h, i) => (h || "").toString().trim() || "Col_" + i);
  rawRows = [];
  for (let i = 1; i < d.length; i++) {
    const r = d[i];
    if (!r || !r.length) continue;
    if (
      r.every(
        (c) =>
          c === "*" || c === undefined || c === null || String(c).trim() === "",
      )
    )
      continue;
    const obj = {};
    fileColumns.forEach((col, idx) => {
      obj[col] = r[idx] !== undefined ? r[idx] : "";
    });
    rawRows.push(obj);
  }
  hideLoading();
  buildMappingUI();
}

/* ===== MAPPING UI ===== */
function buildMappingUI() {
  const c = document.getElementById("mappingRows");
  c.innerHTML = "";
  cardFields.forEach((f) => {
    const row = document.createElement("div");
    row.className = "mapping-row";
    const lbl = document.createElement("label");
    lbl.textContent = f.label + (f.search ? " *" : "");
    const sel = document.createElement("select");
    sel.id = "map_" + f.key;
    const def = document.createElement("option");
    def.value = "";
    def.textContent = "-- বেছে নিন --";
    sel.appendChild(def);
    fileColumns.forEach((col) => {
      const o = document.createElement("option");
      o.value = col;
      o.textContent = col;
      sel.appendChild(o);
    });
    const m = autoDetect(f.keywords, fileColumns);
    if (m) sel.value = m;
    row.appendChild(lbl);
    row.appendChild(sel);
    c.appendChild(row);
  });
  document.getElementById("mappingPanel").classList.add("show");
  document.getElementById("generateBtn").classList.add("show");
}

function autoDetect(kws, cols) {
  for (const kw of kws)
    for (const c of cols)
      if (
        c.toLowerCase().replace(/[_\-\s]/g, "") ===
        kw.toLowerCase().replace(/[_\-\s]/g, "")
      )
        return c;
  for (const kw of kws)
    for (const c of cols)
      if (c.toLowerCase().includes(kw.toLowerCase())) return c;
  return null;
}

/* ===== PROCESS FILE → CARDS ===== */
function processFile() {
  const mapping = {};
  cardFields.forEach((f) => {
    mapping[f.key] = document.getElementById("map_" + f.key).value;
  });
  excelData = [];
  rawRows.forEach((row) => {
    const item = {};
    cardFields.forEach((f) => {
      const cn = mapping[f.key];
      item[f.key] =
        cn && row[cn] !== undefined && row[cn] !== null
          ? String(row[cn]).trim()
          : "";
    });
    if (item.name || item.consumer) excelData.push(item);
  });
  if (!excelData.length) {
    showToast("কোনো ডাটা পাওয়া যায়নি", "error");
    return;
  }
  filteredData = [...excelData];
  isFiltered = false;
  currentPage = 1;
  showToast(toBn(excelData.length) + "টি কার্ড তৈরি হয়েছে", "success");
  document.getElementById("uploadSection").style.display = "none";
  document.getElementById("cardsSection").classList.add("show");
  updateUI();
  renderCards();
}

/* ===== SMART SEARCH ===== */
function handleSearch() {
  const raw = document.getElementById("searchBox").value.trim();
  document
    .getElementById("searchClear")
    .classList.toggle("show", raw.length > 0);

  if (!raw) {
    filteredData = [...excelData];
    isFiltered = false;
  } else {
    const query = raw.toLowerCase();
    filteredData = excelData.filter((item) => {
      return cardFields.some((field) => {
        const val = item[field.key];
        if (val === undefined || val === null || val === "") return false;
        return String(val).toLowerCase().trim() === query;
      });
    });
    isFiltered = true;
  }
  currentPage = 1;
  updateUI();
  renderCards();
}

function clearSearch() {
  document.getElementById("searchBox").value = "";
  document.getElementById("searchClear").classList.remove("show");
  filteredData = [...excelData];
  isFiltered = false;
  currentPage = 1;
  updateUI();
  renderCards();
  showToast("সব কার্ড দেখাচ্ছে", "info");
}

function updateUI() {
  const ce = document.getElementById("cardCount"),
    fi = document.getElementById("filterInfo"),
    pb = document.getElementById("printBtn");
  const t = filteredData.length;
  ce.textContent = toBn(t) + "টি";
  if (isFiltered) {
    ce.classList.add("filtered");
    fi.classList.add("show");
    document.getElementById("filterText").textContent =
      '"' +
      document.getElementById("searchBox").value.trim() +
      '" — মিলে ' +
      toBn(t) +
      "টি কার্ড পাওয়া গেছে";
    pb.innerHTML = '<i class="fas fa-print"></i> এই ' + toBn(t) + "টি প্রিন্ট";
  } else {
    ce.classList.remove("filtered");
    fi.classList.remove("show");
    pb.innerHTML = '<i class="fas fa-print"></i> সব প্রিন্ট (' + toBn(t) + ")";
  }
}

/* ===== PRINT ===== */
function printVisibleCards() {
  if (!filteredData.length) {
    showToast("কার্ড নেই", "error");
    return;
  }
  showLoading(toBn(filteredData.length) + "টি কার্ড প্রিন্ট হচ্ছে...");
  const g = document.getElementById("cardsGrid");
  g.innerHTML = "";
  filteredData.forEach((item, i) => g.appendChild(createCard(item, i + 1)));
  document.getElementById("pagination").innerHTML = "";
  setTimeout(() => {
    generateAllQR();
    setTimeout(() => {
      hideLoading();
      window.print();
      renderCards();
    }, 800);
  }, 100);
}

/* ===== RENDER CARDS ===== */
function renderCards() {
  const g = document.getElementById("cardsGrid");
  g.innerHTML = "";
  const t = filteredData.length;
  if (!t) {
    g.innerHTML =
      '<div class="no-cards-msg"><i class="fas fa-search" style="font-size:40px;margin-bottom:16px;display:block;opacity:.3"></i>"' +
      document.getElementById("searchBox").value.trim() +
      '" — মিলে কোনো কার্ড পাওয়া যায়নি</div>';
    document.getElementById("pagination").innerHTML = "";
    return;
  }
  const tp = Math.ceil(t / perPage),
    s = (currentPage - 1) * perPage;
  filteredData
    .slice(s, s + perPage)
    .forEach((item, i) => g.appendChild(createCard(item, s + i + 1)));
  renderPagination(tp);
  setTimeout(generateAllQR, 100);
}

/* ===== টাইপ চেক হেল্পার ===== */
function isShopType(val) {
  if (!val) return false;
  const v = val.toLowerCase().trim();
  return (
    v.includes("দোকান") ||
    v.includes("shop") ||
    v.includes("store") ||
    v.includes("business") ||
    v.includes("commercial")
  );
}

/* ===== AUTO FIT TEXT ===== */
function autoFitText(el, minSize, maxSize) {
  const text = el.textContent.trim();
  const len = text.length;

  let size;
  if (len <= 3)       size = maxSize;
  else if (len <= 5)  size = maxSize - 0.2;
  else if (len <= 7)  size = maxSize - 0.4;
  else if (len <= 9)  size = maxSize - 0.6;
  else if (len <= 11) size = maxSize - 0.8;
  else if (len <= 14) size = maxSize - 1.0;
  else if (len <= 17) size = maxSize - 1.2;
  else                size = minSize;

  size = Math.max(size, minSize);
  el.style.fontSize = size + "mm";
  el.style.whiteSpace = "normal";
  el.style.wordBreak = "break-word";
  el.style.lineHeight = "1.3";
}

/* ===== CREATE SINGLE CARD ===== */
function createCard(item, idx) {
  const card = document.createElement("div");
  card.className = "nesco-card";
  card.style.animationDelay = (idx % perPage) * 0.06 + "s";

  const sl = item.sl || idx;
  const shopMode = isShopType(item.type);

  /* QR ডাটা ফরম্যাট (নতুন ফিল্ড বাদ দেওয়া হয়েছে) */
  const qr = [
    "SL: " + sl,
    "Consumer: " + (item.consumer || ""),
    "Name: " + (item.name || ""),
    "Meter: " + (item.meter || ""),
    "Mobile: " + (item.mobile || ""),
  ].join("\n");


  /* ===== কন্ডিশনাল extra-box ===== */

  let extraBoxHTML;

  if (shopMode) {
    extraBoxHTML = `
      <div class="shop-icon-box">
        <i class="fas fa-store"></i>
        <span class="s-name">${item.shop_name || "-"}</span>
      </div>
    `;
  } else {
    extraBoxHTML = `
      <div class="house-icon-box">
        <i class="fas fa-home"></i>
        <span class="h-no">${item.house_no || "-"}</span>
      </div>
    `;
  }

  card.innerHTML = `
  <div class="top-bar">সকল প্রকার বিল প্রদানের নির্ভরযোগ্য সহযোগী</div>

  <div class="card-header">
    <div class="meter-logo">
      <img src="assets/sr1.png" class="sr-logo" onerror="this.style.display='none'" />
      <div class="meter-label">SR Computer<br>& Photostat</div>
    </div>

    <div class="logo-center">
      <img src="assets/nesco.png" alt="NESCO Logo" class="nesco-logo" onerror="this.style.display='none'" />
    </div>

    <div class="serial-box">
      <div class="serial-label">সিরিয়াল নং</div>
      <div class="serial-value">${sl}</div>
    </div>
  </div>

  <div class="card-title">প্রি-পেইড মিটার কার্ড</div>

  <div class="card-content">
    <div class="info-left">
      <div class="info-row"><div class="info-icon"><i class="fas fa-user"></i></div><div class="info-label">কনজুমার নং :</div><div class="info-value">${item.consumer || "-"}</div></div>
      <div class="info-row"><div class="info-icon"><i class="fas fa-id-badge"></i></div><div class="info-label">মিটারের নাম :</div><div class="info-value">${item.name || "-"}</div></div>
      <div class="info-row"><div class="info-icon"><i class="fas fa-phone-alt"></i></div><div class="info-label">মোবাইল নং :</div><div class="info-value">${item.mobile || "-"}</div></div>
      <div class="info-row"><div class="info-icon"><i class="fas fa-hashtag"></i></div><div class="info-label">মিটার নাম্বার :</div><div class="info-value">${item.meter || "-"}</div></div>
      <div class="info-row"><div class="info-icon"><i class="fas fa-link"></i></div><div class="info-label">রেফারেন্স নম্বর :</div><div class="info-value">${item.reference || "-"}</div></div>
      
      <div class="SR">এস আর কম্পিউটার এন্ড ফটোস্ট্যাটের সাথে থাকার জন্য ধন্যবাদ</div>
    </div>
    
    <div class="qr-side">
      ${extraBoxHTML}
      <div class="qr-wrap">
        <div class="qr-box" data-qr="${encodeURIComponent(qr)}" id="qr-${idx}"></div>
      </div>
      <div class="scan-btn">
        <i class="fas fa-qrcode"></i> স্ক্যান করুন
      </div>
    </div>
  </div> 

  <div class="card-footer">
    <div class="footer-left">
      <i class="fas fa-location-dot"></i>
      <span class="addr">সাগরপাড়া (মেডিসিন গ্যালারী বিপরীত পাশে), বোয়ালিয়া, রাজশাহী</span>
    </div>
    <div class="hotline">
      <i class="fas fa-phone-volume"></i>
      <span class="phone">01752127064</span>
      <span class="wa">(হোয়াটসঅ্যাপ)</span>
    </div>
  </div>
`;
  const sName = card.querySelector(".s-name");
  const hNo   = card.querySelector(".h-no");
  if (sName) autoFitText(sName, 1.6, 2.2);
  if (hNo)   autoFitText(hNo,   1.6, 2.8);
  
  return card;
}

/* ===== QR GENERATION ===== */
function generateAllQR() {
  document.querySelectorAll(".qr-box[data-qr]").forEach((el) => {
    if (el.querySelector("canvas") || el.querySelector("img")) return;
    el.innerHTML = "";
    try {
      const text = decodeURIComponent(el.getAttribute("data-qr"));
      if (!text || !text.trim()) {
        el.innerHTML = '<span style="font-size:9px;color:#999">No Data</span>';
        return;
      }
      new QRCode(el, {
        text: text,
        width: 90,
        height: 90,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.L,
      });
    } catch (e) {
      el.innerHTML = '<span style="font-size:9px;color:red">QR Error</span>';
      console.error("QR failed:", e.message);
    }
  });
}

/* ===== PAGINATION ===== */
function renderPagination(tp) {
  const c = document.getElementById("pagination");
  c.innerHTML = "";
  if (tp <= 1) return;
  const prev = document.createElement("button");
  prev.className = "page-btn";
  prev.innerHTML = '<i class="fas fa-chevron-left"></i>';
  prev.disabled = currentPage === 1;
  prev.onclick = () => {
    currentPage--;
    renderCards();
    sTT();
  };
  c.appendChild(prev);
  let sp = Math.max(1, currentPage - 3),
    ep = Math.min(tp, sp + 6);
  if (ep - sp < 6) sp = Math.max(1, ep - 6);
  if (sp > 1) {
    aPB(c, 1);
    if (sp > 2) aD(c);
  }
  for (let i = sp; i <= ep; i++) aPB(c, i);
  if (ep < tp) {
    if (ep < tp - 1) aD(c);
    aPB(c, tp);
  }
  const next = document.createElement("button");
  next.className = "page-btn";
  next.innerHTML = '<i class="fas fa-chevron-right"></i>';
  next.disabled = currentPage === tp;
  next.onclick = () => {
    currentPage++;
    renderCards();
    sTT();
  };
  c.appendChild(next);
}

function aPB(c, n) {
  const b = document.createElement("button");
  b.className = "page-btn" + (n === currentPage ? " active" : "");
  b.textContent = toBn(n);
  b.onclick = () => {
    currentPage = n;
    renderCards();
    sTT();
  };
  c.appendChild(b);
}
function aD(c) {
  const s = document.createElement("span");
  s.textContent = "...";
  s.style.cssText = "color:var(--muted);padding:0 4px";
  c.appendChild(s);
}
function sTT() {
  document
    .getElementById("cardsSection")
    .scrollIntoView({ behavior: "smooth" });
}

/* ===== NAVIGATION ===== */
function goBack() {
  document.getElementById("cardsSection").classList.remove("show");
  document.getElementById("uploadSection").style.display = "";
  document.getElementById("searchBox").value = "";
  document.getElementById("searchClear").classList.remove("show");
  document.getElementById("mappingPanel").classList.remove("show");
  document.getElementById("generateBtn").classList.remove("show");
  document.getElementById("fileInfo").classList.remove("show");
  document.getElementById("filterInfo").classList.remove("show");
  fileInput.value = "";
  rawRows = [];
  fileColumns = [];
  excelData = [];
  filteredData = [];
  isFiltered = false;
}

/* ===== DEMO DATA (১০টি ডেমো - সেকশন বাদ) ===== */
function loadDemo() {
  rawRows = [
    {
      SL: "1",
      "Consumer Num": "33035834",
      "User Name": "MD.ASRAF ALI BISSAS",
      "Miter Num": "11011028596",
      Mobile: "01718857322",
      Address: "Chayanir 7 A",
      Refff: "হারুন",
      "Re-mark": "ফ্রি",
      Type: "বাড়ি",
      "House name": "ASRAF ALI BISSAS",
      "Shop name": "",
    },
    {
      SL: "2",
      "Consumer Num": "33009770",
      "User Name": "Md. Bahar Sheikh",
      "Miter Num": "20410021230",
      Mobile: "01671155635",
      Address: "H-113/3",
      Refff: "আরিফ",
      "Re-mark": "",
      Type: "দোকান",
      "House name": "",
      "Shop name": "বহুল্য স্টোর",
    },
    {
      SL: "3",
      "Consumer Num": "33005786",
      "User Name": "Md. Lalu Sheikh",
      "Miter Num": "11011023844",
      Mobile: "01704942199",
      Address: "সাগরপাড়া",
      Refff: "সফিকুল কাকা",
      "Re-mark": "",
      Type: "বাড়ি",
      "House name": "LH",
      "Shop name": "",
    },
    {
      SL: "4",
      "Consumer Num": "33035829",
      "User Name": "MD.ASRAF ALI BISSAS",
      "Miter Num": "11041007762",
      Mobile: "01711356468",
      Address: "SAGORPARA",
      Refff: "ছায়া নিড়",
      "Re-mark": "ফ্রি",
      Type: "বাড়ি",
      "House name": "12",
      "Shop name": "",
    },
    {
      SL: "5",
      "Consumer Num": "33035454",
      "User Name": "MD.MEDIATUL ISLAM",
      "Miter Num": "11011021720",
      Mobile: "01716297101",
      Address: "BLOVGONJ",
      Refff: "",
      "Re-mark": "",
      Type: "দোকান",
      "House name": "",
      "Shop name": "মেডিসিন হাউজ",
    },
    {
      SL: "6",
      "Consumer Num": "33009940",
      "User Name": "Md. Abu Bokker Siddik",
      "Miter Num": "11011023772",
      Mobile: "01711208087",
      Address: "H-113/3",
      Refff: "টিটু",
      "Re-mark": "১০",
      Type: "বাড়ি",
      "House name": "13",
      "Shop name": "",
    },
    {
      SL: "7",
      "Consumer Num": "33017085",
      "User Name": "MD. SADEKUL ISLAM",
      "Miter Num": "11041009860",
      Mobile: "01752127064",
      Address: "এ. আর.",
      Refff: "রোহিদ",
      "Re-mark": "ফ্রি",
      Type: "দোকান",
      "House name": "",
      "Shop name": "আর কম্পাউন্ডার",
    },
    {
      SL: "8",
      "Consumer Num": "33035454",
      "User Name": "MD.MEDIATUL ISLAM",
      "Miter Num": "11011021720",
      Mobile: "01716297101",
      Address: "BLOVGONJ",
      Refff: "",
      "Re-mark": "",
      Type: "বাড়ি",
      "House name": "15",
      "Shop name": "",
    },
    {
      SL: "9",
      "Consumer Num": "35017674",
      "User Name": "RANJIKUMAR BISWAS",
      "Miter Num": "11041015882",
      Mobile: "01759586903",
      Address: "RANIBAZER",
      Refff: "বিজেন",
      "Re-mark": "",
      Type: "দোকান",
      "House name": "",
      "Shop name": "রানী বাজার ট্রেডার্স",
    },
    {
      SL: "10",
      "Consumer Num": "33099123",
      "User Name": "KAMAL HOSSAIN",
      "Miter Num": "11041019921",
      Mobile: "01812345678",
      Address: "কাজলা",
      Refff: "সজল",
      "Re-mark": "",
      Type: "বাড়ি",
      "House name": "101/B",
      "Shop name": "",
    },
  ];
  fileColumns = Object.keys(rawRows[0]);
  document.getElementById("fileName").textContent =
    "demo-data.json (ডেমো - ১০টি)";
  const te = document.getElementById("fileType");
  te.textContent = "JSON";
  te.className = "ft json";
  document.getElementById("fileInfo").classList.add("show");
  buildMappingUI();
  showToast('ডেমো লোড হয়েছে — "1" বা "01752127064" লিখে সার্চ করুন!', "info");
}

/* ===== UTILITIES ===== */
function toBn(n) {
  return String(n).replace(/[0-9]/g, (c) => "০১২৩৪৫৬৭৮৯"[parseInt(c)]);
}
function showToast(msg, type) {
  const t = document.getElementById("toast");
  const ic = {
    success: "fa-check-circle",
    error: "fa-exclamation-circle",
    info: "fa-info-circle",
  };
  t.className = "toast " + type;
  t.innerHTML = '<i class="fas ' + (ic[type] || ic.info) + '"></i> ' + msg;
  t.classList.add("show");
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => t.classList.remove("show"), 4000);
}
function showLoading(t) {
  document.getElementById("loadingText").textContent = t || "";
  document.getElementById("loading").classList.add("show");
}
function hideLoading() {
  document.getElementById("loading").classList.remove("show");
}
