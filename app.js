// ==================== داده‌ها و وضعیت ====================
const SECTIONS = [
  "املاک",
  "کلنگی",
  "زمین",
  "کارخانه",
  "آهن",
  "LC",
  "اتومبیل",
  "فلزات رنگی",
  "متفرقه",
  "وکیل",
  "یادآوری",
  "ضایعات"
];

let currentSection = null;
let currentPersonId = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

// ==================== ذخیره‌سازی ====================
function getData() {
  const raw = localStorage.getItem("boosone_data");
  if (!raw) {
    // ساختار اولیه
    const initial = {};
    SECTIONS.forEach(s => initial[s] = []);
    localStorage.setItem("boosone_data", JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(raw);
}

function saveData(data) {
  localStorage.setItem("boosone_data", JSON.stringify(data));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// ==================== ناوبری صفحات ====================
function showPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(pageId).classList.add("active");
}

function goHome() {
  currentSection = null;
  currentPersonId = null;
  showPage("home-page");
}

function goToSection() {
  currentPersonId = null;
  if (currentSection) {
    openSection(currentSection);
  } else {
    goHome();
  }
}

// ==================== صفحه اصلی ====================
function renderHome() {
  const grid = document.getElementById("sections-grid");
  grid.innerHTML = "";

  SECTIONS.forEach((name, index) => {
    const btn = document.createElement("button");
    btn.className = "section-btn";
    btn.textContent = name;
    btn.onclick = () => openSection(name);
    // انیمیشن با تأخیر متفاوت
    btn.style.animationDelay = (index * 0.08) + "s";
    grid.appendChild(btn);
  });
}

// ==================== صفحه بخش (لیست افراد) ====================
function openSection(sectionName) {
  currentSection = sectionName;
  document.getElementById("section-title").textContent = sectionName;
  hideAddPersonForm();
  renderPersonsList();
  showPage("section-page");
}

function renderPersonsList() {
  const data = getData();
  const list = data[currentSection] || [];
  const container = document.getElementById("persons-list");
  container.innerHTML = "";

  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state">هنوز هیچ شخصی اضافه نشده است.<br>روی دکمه «افزودن شخص جدید» بزنید.</div>`;
    return;
  }

  list.forEach(person => {
    const item = document.createElement("div");
    item.className = "person-item";
    item.onclick = () => openPerson(person.id);

    const voiceCount = (person.voices && person.voices.length) ? person.voices.length : 0;

    item.innerHTML = `
      <div class="name">${person.name || "بدون نام"}</div>
      <div class="voice-count">${voiceCount} ویس</div>
    `;
    container.appendChild(item);
  });
}

function showAddPersonForm() {
  document.getElementById("add-person-form").classList.remove("hidden");
  document.getElementById("person-name").value = "";
  document.getElementById("person-info").value = "";
  document.getElementById("person-name").focus();
}

function hideAddPersonForm() {
  document.getElementById("add-person-form").classList.add("hidden");
}

function savePerson() {
  const name = document.getElementById("person-name").value.trim();
  const info = document.getElementById("person-info").value.trim();

  if (!name) {
    alert("لطفاً نام شخص را وارد کنید.");
    return;
  }

  const data = getData();
  if (!data[currentSection]) data[currentSection] = [];

  const newPerson = {
    id: generateId(),
    name: name,
    info: info,
    voices: [],
    createdAt: new Date().toISOString()
  };

  data[currentSection].unshift(newPerson); // جدیدترین بالا
  saveData(data);

  hideAddPersonForm();
  renderPersonsList();
}

// ==================== صفحه شخص ====================
function openPerson(personId) {
  currentPersonId = personId;
  const data = getData();
  const person = (data[currentSection] || []).find(p => p.id === personId);

  if (!person) {
    alert("شخص پیدا نشد.");
    goToSection();
    return;
  }

  document.getElementById("person-title").textContent = person.name;
  document.getElementById("person-info-text").textContent = person.info || "اطلاعاتی ثبت نشده است.";
  renderVoicesList(person);
  showPage("person-page");
}

function renderVoicesList(person) {
  const container = document.getElementById("voices-list");
  container.innerHTML = "";

  const voices = person.voices || [];

  if (voices.length === 0) {
    container.innerHTML = `<div class="empty-state">هنوز ویسی ضبط نشده است.</div>`;
    return;
  }

  voices.forEach((voice, index) => {
    const item = document.createElement("div");
    item.className = "voice-item";

    const dateStr = voice.date ? new Date(voice.date).toLocaleString("fa-IR") : "بدون تاریخ";

    item.innerHTML = `
      <div class="voice-info">
        ویس ${index + 1}<br>
        <small style="color:#8b7355">${dateStr}</small>
      </div>
      <div class="voice-actions">
        <button class="btn-play" onclick="playVoice('${voice.id}')">▶ پخش</button>
        <button class="btn-delete-voice" onclick="deleteVoice('${voice.id}')">حذف</button>
      </div>
    `;
    container.appendChild(item);
  });
}

function editPersonInfo() {
  const data = getData();
  const person = (data[currentSection] || []).find(p => p.id === currentPersonId);
  if (!person) return;

  const newInfo = prompt("اطلاعات جدید را وارد کنید:", person.info || "");
  if (newInfo === null) return;

  person.info = newInfo.trim();
  saveData(data);
  document.getElementById("person-info-text").textContent = person.info || "اطلاعاتی ثبت نشده است.";
}

// ==================== ضبط و پخش ویس ====================
async function startRecording() {
  if (isRecording) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: "audio/webm" });
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result;
        saveNewVoice(base64);
      };
      reader.readAsDataURL(blob);

      // توقف میکروفون
      stream.getTracks().forEach(track => track.stop());
    };

    mediaRecorder.start();
    isRecording = true;
    document.getElementById("recording-status").classList.remove("hidden");
  } catch (err) {
    alert("دسترسی به میکروفون ممکن نشد.\nلطفاً اجازه دسترسی بدهید و دوباره تلاش کنید.");
    console.error(err);
  }
}

function stopRecording() {
  if (!isRecording || !mediaRecorder) return;
  mediaRecorder.stop();
  isRecording = false;
  document.getElementById("recording-status").classList.add("hidden");
}

function saveNewVoice(base64Data) {
  const data = getData();
  const person = (data[currentSection] || []).find(p => p.id === currentPersonId);
  if (!person) return;

  if (!person.voices) person.voices = [];

  const newVoice = {
    id: generateId(),
    data: base64Data,
    date: new Date().toISOString()
  };

  person.voices.push(newVoice);
  saveData(data);

  // به‌روزرسانی صفحه
  renderVoicesList(person);

  // به‌روزرسانی شمارنده در لیست افراد (اگر برگشت)
  // (فعلاً هنگام بازگشت خودکار به‌روز می‌شود)
}

function playVoice(voiceId) {
  const data = getData();
  const person = (data[currentSection] || []).find(p => p.id === currentPersonId);
  if (!person) return;

  const voice = (person.voices || []).find(v => v.id === voiceId);
  if (!voice || !voice.data) {
    alert("ویس پیدا نشد.");
    return;
  }

  const audio = new Audio(voice.data);
  audio.play().catch(err => {
    alert("پخش ویس ممکن نشد.");
    console.error(err);
  });
}

function deleteVoice(voiceId) {
  if (!confirm("آیا مطمئن هستید که می‌خواهید این ویس را حذف کنید؟")) return;

  const data = getData();
  const person = (data[currentSection] || []).find(p => p.id === currentPersonId);
  if (!person) return;

  person.voices = (person.voices || []).filter(v => v.id !== voiceId);
  saveData(data);
  renderVoicesList(person);
}

// ==================== شروع برنامه ====================
document.addEventListener("DOMContentLoaded", () => {
  renderHome();
  showPage("home-page");
});
