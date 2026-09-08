// ==================== داده‌ها و وضعیت ====================
const SECTIONS = [
  "املاک", "کلنگی", "زمین", "کارخانه",
  "آهن", "LC", "اتومبیل", "فلزات رنگی",
  "متفرقه", "وکیل", "یادآوری", "ضایعات",
  "تهاطر",
  "مواد غذایی",
  "هوش مصنوعی"
];

// ==================== اتصال امن BOOS ONE AI ====================
// کلید Gemini هرگز در GitHub یا مرورگر ذخیره نمی‌شود.
// درخواست‌ها فقط به Cloudflare Worker ارسال می‌شوند.
const AI_PROXY_URL = "https://boosone-ai.mnboosone.workers.dev";

let currentSection = null;
let currentPersonId = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

// ==================== ذخیره‌سازی ====================
function getData() {
  const raw = localStorage.getItem("boosone_data");
  if (!raw) {
    const initial = {};
    SECTIONS.forEach(s => {
      if (s !== "هوش مصنوعی") initial[s] = [];
    });
    initial._textReminders = [];
    localStorage.setItem("boosone_data", JSON.stringify(initial));
    return initial;
  }

  const data = JSON.parse(raw);

  if (!data._textReminders) data._textReminders = [];

  SECTIONS.forEach(s => {
    if (s !== "هوش مصنوعی" && !data[s]) data[s] = [];
  });

  return data;
}

function saveData(data) {
  localStorage.setItem("boosone_data", JSON.stringify(data));
}

function generateId() {
  return Date.now().toString(36) +
    Math.random().toString(36).substr(2, 5);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateFa(iso) {
  try {
    return new Date(iso).toLocaleDateString("fa-IR");
  } catch {
    return iso;
  }
}

// ==================== ناوبری ====================
function showPage(pageId) {
  document
    .querySelectorAll(".page")
    .forEach(p => p.classList.remove("active"));

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
    if (name === "هوش مصنوعی") {
      btn.classList.add("ai-btn");
    }

    btn.textContent = name;

    btn.onclick = () => openSection(name);

    btn.style.animationDelay =
      (index * 0.08) + "s";

    grid.appendChild(btn);
  });
}

// ==================== باز کردن بخش ====================
function openSection(sectionName) {

  if (sectionName === "هوش مصنوعی") {
    showPage("ai-page");
    return;
  }

  currentSection = sectionName;

  document.getElementById("section-title").textContent =
    sectionName;

  const normalUI =
    document.getElementById("normal-section-ui");

  const reminderUI =
    document.getElementById("reminder-section-ui");

  if (sectionName === "یادآوری") {

    normalUI.classList.add("hidden");

    reminderUI.classList.remove("hidden");

    hideAddReminderForm();

    renderRemindersList();

  } else {

    reminderUI.classList.add("hidden");

    normalUI.classList.remove("hidden");

    hideAddPersonForm();

    renderPersonsList();
  }

  showPage("section-page");
}

// ==================== لیست افراد ====================
function renderPersonsList() {

  const data = getData();

  const list =
    data[currentSection] || [];

  const container =
    document.getElementById("persons-list");

  container.innerHTML = "";

  if (list.length === 0) {

    container.innerHTML =
      `<div class="empty-state">
        هنوز هیچ شخصی اضافه نشده است.
        <br>
        روی دکمه «افزودن شخص جدید» بزنید.
      </div>`;

    return;
  }

  list.forEach(person => {

    const item =
      document.createElement("div");

    item.className = "person-item";

    item.onclick =
      () => openPerson(person.id);

    const voiceCount =
      (person.voices && person.voices.length)
        ? person.voices.length
        : 0;

    item.innerHTML = `
      <div class="name">
        ${person.name || "بدون نام"}
      </div>

      <div class="voice-count">
        ${voiceCount} ویس
      </div>
    `;

    container.appendChild(item);
  });
}

// ==================== افزودن شخص ====================
function showAddPersonForm() {

  document
    .getElementById("add-person-form")
    .classList
    .remove("hidden");

  document.getElementById("person-name").value = "";

  document.getElementById("person-info").value = "";

  document.getElementById("person-name").focus();
}

function hideAddPersonForm() {

  document
    .getElementById("add-person-form")
    .classList
    .add("hidden");
}

function savePerson() {

  const name =
    document
      .getElementById("person-name")
      .value
      .trim();

  const info =
    document
      .getElementById("person-info")
      .value
      .trim();

  if (!name) {

    alert("لطفاً نام شخص را وارد کنید.");

    return;
  }

  const data = getData();

  if (!data[currentSection]) {
    data[currentSection] = [];
  }

  data[currentSection].unshift({

    id: generateId(),

    name,

    info,

    voices: [],

    createdAt:
      new Date().toISOString()

  });

  saveData(data);

  hideAddPersonForm();

  renderPersonsList();
}

// ==================== صفحه شخص ====================
function openPerson(personId) {

  currentPersonId = personId;

  const data = getData();

  const person =
    (data[currentSection] || [])
      .find(p => p.id === personId);

  if (!person) {

    alert("شخص پیدا نشد.");

    goToSection();

    return;
  }

  document
    .getElementById("person-title")
    .textContent =
      person.name;

  document
    .getElementById("person-info-text")
    .textContent =
      person.info ||
      "اطلاعاتی ثبت نشده است.";

  renderVoicesList(person);

  showPage("person-page");
}

// ==================== لیست ویس‌ها ====================
function renderVoicesList(person) {

  const container =
    document.getElementById("voices-list");

  container.innerHTML = "";

  const voices =
    person.voices || [];

  if (voices.length === 0) {

    container.innerHTML =
      `<div class="empty-state">
        هنوز ویسی ضبط نشده است.
      </div>`;

    return;
  }

  voices.forEach((voice, index) => {

    const item =
      document.createElement("div");

    item.className = "voice-item";

    const dateStr =
      voice.date
        ? new Date(voice.date)
            .toLocaleString("fa-IR")
        : "";

    const rem =
      voice.reminder || {};

    const checked =
      rem.enabled
        ? "checked"
        : "";

    const daysVal =
      rem.days || 1;

    item.innerHTML = `

      <div style="flex:1">

        <div class="voice-info">

          ویس ${index + 1}

          <br>

          <small style="color:#8b7355">
            ${dateStr}
          </small>

        </div>

        <div class="voice-reminder-box">

          <label>

            <input
              type="checkbox"
              ${checked}

              onchange="toggleVoiceReminder(
                '${voice.id}',
                this.checked,
                this.parentElement.parentElement
              )"
            >

            یادآوری

          </label>

          <span>بعد از</span>

          <input
            type="number"
            min="1"
            max="30"
            value="${daysVal}"

            onchange="updateVoiceReminderDays(
              '${voice.id}',
              this.value
            )"

            onclick="event.stopPropagation()"
          >

          <span>روز</span>

        </div>

      </div>

      <div class="voice-actions">

        <button
          class="btn-play"
          onclick="playVoice('${voice.id}')"
        >
          ▶ پخش
        </button>

        <button
          class="btn-delete-voice"
          onclick="deleteVoice('${voice.id}')"
        >
          حذف
        </button>

      </div>
    `;

    container.appendChild(item);
  });
}

// ==================== یادآوری ویس ====================
function toggleVoiceReminder(
  voiceId,
  enabled,
  boxEl
) {

  const data = getData();

  const person =
    (data[currentSection] || [])
      .find(p => p.id === currentPersonId);

  if (!person) return;

  const voice =
    (person.voices || [])
      .find(v => v.id === voiceId);

  if (!voice) return;

  const daysInput =
    boxEl.querySelector(
      'input[type="number"]'
    );

  const days =
    parseInt(daysInput.value) || 1;

  if (enabled) {

    voice.reminder = {

      enabled: true,

      days: days,

      remindAt:
        addDays(
          new Date(),
          days
        ).toISOString(),

      createdAt:
        new Date().toISOString()

    };

  } else {

    voice.reminder = {
      enabled: false
    };
  }

  saveData(data);
}

function updateVoiceReminderDays(
  voiceId,
  daysStr
) {

  const days =
    Math.min(
      30,
      Math.max(
        1,
        parseInt(daysStr) || 1
      )
    );

  const data = getData();

  const person =
    (data[currentSection] || [])
      .find(p => p.id === currentPersonId);

  if (!person) return;

  const voice =
    (person.voices || [])
      .find(v => v.id === voiceId);

  if (!voice) return;

  if (
    voice.reminder &&
    voice.reminder.enabled
  ) {

    voice.reminder.days = days;

    voice.reminder.remindAt =
      addDays(
        new Date(),
        days
      ).toISOString();

    saveData(data);
  }
}

// ==================== ویرایش شخص ====================
// ==================== هوش مصنوعی BOOS ONE ====================
async function sendMessage() {
  const input = document.getElementById("chat-input");
  const message = input.value.trim();

  if (!message) return;

  const messagesDiv = document.getElementById("chat-messages");

  // پیام کاربر
  const userMsg = document.createElement("div");
  userMsg.style.cssText =
    "background:#e8d5b5; padding:10px 14px; border-radius:12px; margin-bottom:10px; text-align:right;";
  userMsg.textContent = message;
  messagesDiv.appendChild(userMsg);

  input.value = "";
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  // پیام در حال پردازش
  const loadingMsg = document.createElement("div");
  loadingMsg.id = "loading-msg";
  loadingMsg.style.cssText =
    "background:#fff; padding:10px 14px; border-radius:12px; margin-bottom:10px; text-align:right; border:1px solid #e0d0b0; color:#8b7355;";
  loadingMsg.textContent = "در حال پردازش...";
  messagesDiv.appendChild(loadingMsg);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  try {
    const response = await fetch(AI_PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message })
    });

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("پاسخ معتبر از سرور دریافت نشد.");
    }

    // حذف پیام لودینگ
    document.getElementById("loading-msg")?.remove();

    const botMsg = document.createElement("div");
    botMsg.style.cssText =
      "background:#fff; padding:10px 14px; border-radius:12px; margin-bottom:10px; text-align:right; border:1px solid #e0d0b0; white-space:pre-wrap;";

    if (!response.ok || data?.error) {
      botMsg.style.background = "#fff0f0";
      botMsg.style.borderColor = "#e8b4b4";
      botMsg.style.color = "#8b3030";

      // تبدیل خطا به رشته خوانا
      let errorText = "ارتباط با سرویس BOOS ONE ناموفق بود.";

      if (typeof data?.error === "string") {
        errorText = data.error;
      } else if (data?.error?.message) {
        errorText = data.error.message;
      } else if (data?.error) {
        errorText = JSON.stringify(data.error);
      }

      botMsg.textContent = "خطا: " + errorText;
    } else if (typeof data?.text === "string" && data.text.trim()) {
      botMsg.textContent = data.text;
    } else {
      botMsg.textContent = "پاسخی دریافت نشد.";
    }

    messagesDiv.appendChild(botMsg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

  } catch (error) {
    document.getElementById("loading-msg")?.remove();

    const errorMsg = document.createElement("div");
    errorMsg.style.cssText =
      "background:#fff0f0; padding:10px 14px; border-radius:12px; margin-bottom:10px; text-align:right; border:1px solid #e8b4b4; color:#8b3030;";
    errorMsg.textContent =
      "خطای ارتباط: " + (error?.message || "ارتباط با سرویس برقرار نشد.");
    messagesDiv.appendChild(errorMsg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
}

// ==================== ضبط صدا ====================
async function startRecording() {

  if (isRecording) return;

  try {

    const stream =
      await navigator
        .mediaDevices
        .getUserMedia({
          audio: true
        });

    mediaRecorder =
      new MediaRecorder(stream);

    audioChunks = [];

    mediaRecorder.ondataavailable =
      e => {

        if (e.data.size > 0) {
          audioChunks.push(e.data);
        }

      };

    mediaRecorder.onstop = () => {

      const blob =
        new Blob(
          audioChunks,
          {
            type: "audio/webm"
          }
        );

      const reader =
        new FileReader();

      reader.onloadend =
        () => saveNewVoice(reader.result);

      reader.readAsDataURL(blob);

      stream
        .getTracks()
        .forEach(
          t => t.stop()
        );
    };

    mediaRecorder.start();

    isRecording = true;

    document
      .getElementById("recording-status")
      .classList
      .remove("hidden");

  } catch (err) {

    alert(
      "دسترسی به میکروفون ممکن نشد.\nلطفاً اجازه دسترسی بدهید."
    );
  }
}

function stopRecording() {

  if (
    !isRecording ||
    !mediaRecorder
  ) return;

  mediaRecorder.stop();

  isRecording = false;

  document
    .getElementById("recording-status")
    .classList
    .add("hidden");
}

function saveNewVoice(base64Data) {

  const data = getData();

  const person =
    (data[currentSection] || [])
      .find(p => p.id === currentPersonId);

  if (!person) return;

  if (!person.voices) {
    person.voices = [];
  }

  person.voices.push({

    id: generateId(),

    data: base64Data,

    date:
      new Date().toISOString(),

    reminder: {
      enabled: false
    }

  });

  saveData(data);

  renderVoicesList(person);
}

function playVoice(voiceId) {

  const data = getData();

  let voice = null;

  let person =
    (data[currentSection] || [])
      .find(
        p => p.id === currentPersonId
      );

  if (person) {

    voice =
      (person.voices || [])
        .find(
          v => v.id === voiceId
        );
  }

  if (!voice) {

    for (const sec of SECTIONS) {

      if (
        sec === "یادآوری" ||
        sec === "هوش مصنوعی"
      ) continue;

      for (
        const p of
        (data[sec] || [])
      ) {

        voice =
          (p.voices || [])
            .find(
              v => v.id === voiceId
            );

        if (voice) break;
      }

      if (voice) break;
    }
  }

  if (
    !voice ||
    !voice.data
  ) {

    alert("ویس پیدا نشد.");

    return;
  }

  const audio =
    new Audio(voice.data);

  audio
    .play()
    .catch(
      () =>
        alert("پخش ویس ممکن نشد.")
    );
}

function deleteVoice(voiceId) {

  if (
    !confirm(
      "آیا مطمئن هستید که می‌خواهید این ویس را حذف کنید؟"
    )
  ) return;

  const data = getData();

  const person =
    (data[currentSection] || [])
      .find(
        p => p.id === currentPersonId
      );

  if (!person) return;

  person.voices =
    (person.voices || [])
      .filter(
        v => v.id !== voiceId
      );

  saveData(data);

  renderVoicesList(person);
}

// ==================== بخش یادآوری ====================
function showAddReminderForm() {

  document
    .getElementById("add-reminder-form")
    .classList
    .remove("hidden");

  document
    .getElementById("reminder-title")
    .value = "";

  document
    .getElementById("reminder-note")
    .value = "";

  const tomorrow =
    addDays(
      new Date(),
      1
    );

  document
    .getElementById("reminder-date")
    .value =
      tomorrow
        .toISOString()
        .split("T")[0];
}

function hideAddReminderForm() {

  document
    .getElementById("add-reminder-form")
    .classList
    .add("hidden");
}

function saveTextReminder() {

  const title =
    document
      .getElementById("reminder-title")
      .value
      .trim();

  const note =
    document
      .getElementById("reminder-note")
      .value
      .trim();

  const dateVal =
    document
      .getElementById("reminder-date")
      .value;

  if (!title) {

    alert(
      "عنوان یادآوری را وارد کنید."
    );

    return;
  }

  if (!dateVal) {

    alert(
      "تاریخ را انتخاب کنید."
    );

    return;
  }

  const data = getData();

  data._textReminders.unshift({

    id: generateId(),

    title,

    note,

    remindAt:
      new Date(
        dateVal + "T12:00:00"
      ).toISOString(),

    createdAt:
      new Date().toISOString(),

    type: "text"

  });

  saveData(data);

  hideAddReminderForm();

  renderRemindersList();
}

function collectAllReminders() {

  const data = getData();

  const now =
    new Date();

  const items = [];

  (
    data._textReminders || []
  ).forEach(r => {

    const remindDate =
      new Date(r.remindAt);

    const isDue =
      remindDate <= now;

    items.push({

      id: r.id,

      type: "text",

      title: r.title,

      note: r.note || "",

      remindAt: r.remindAt,

      isDue,

      section:
        "یادآوری مستقل"

    });
  });

  SECTIONS.forEach(sec => {

    if (
      sec === "یادآوری" ||
      sec === "هوش مصنوعی"
    ) return;

    (
      data[sec] || []
    ).forEach(person => {

      (
        person.voices || []
      ).forEach(voice => {

        if (
          voice.reminder &&
          voice.reminder.enabled &&
          voice.reminder.remindAt
        ) {

          const remindDate =
            new Date(
              voice.reminder.remindAt
            );

          const isDue =
            remindDate <= now;

          items.push({

            id: voice.id,

            type: "voice",

            title:
              `ویس از «${person.name}»`,

            note:
              `بخش: ${sec}`,

            remindAt:
              voice.reminder.remindAt,

            isDue,

            section: sec,

            personName:
              person.name,

            personId:
              person.id,

            voiceId:
              voice.id

          });
        }
      });
    });
  });

  items.sort((a, b) => {

    if (a.isDue !== b.isDue) {

      return a.isDue
        ? -1
        : 1;
    }

    return (
      new Date(a.remindAt) -
      new Date(b.remindAt)
    );
  });

  return items;
}

function renderRemindersList() {

  const container =
    document.getElementById(
      "reminders-list"
    );

  const items =
    collectAllReminders();

  container.innerHTML = "";

  if (items.length === 0) {

    container.innerHTML =
      `<div class="empty-state">
        هنوز هیچ یادآوری‌ای ثبت نشده است.
        <br>
        می‌توانید یادآوری جدید بسازید یا از داخل ویس‌ها تیک یادآوری بزنید.
      </div>`;

    return;
  }

  items.forEach(item => {

    const div =
      document.createElement("div");

    div.className =
      "reminder-item" +
      (item.isDue ? " due" : "");

    const badge =
      item.isDue
        ? `<span class="badge-due">
             موعد رسیده
           </span>`
        : `<span class="badge-soon">
             آینده
           </span>`;

    let actions = "";

    if (
      item.type === "voice"
    ) {

      actions = `

        <button
          class="btn-play btn-small"
          onclick="playVoice('${item.voiceId}')"
        >
          ▶ پخش ویس
        </button>

        <button
          class="btn-secondary btn-small"
          onclick="goToVoiceSource(
            '${item.section}',
            '${item.personId}'
          )"
        >
          مشاهده شخص
        </button>
      `;

    } else {

      actions = `

        <button
          class="btn-delete-voice btn-small"
          onclick="deleteTextReminder('${item.id}')"
        >
          حذف
        </button>
      `;
    }

    div.innerHTML = `

      <div class="rem-title">
        ${badge}${item.title}
      </div>

      <div class="rem-meta">
        ${formatDateFa(item.remindAt)}
        —
        ${item.note}
      </div>

      <div class="rem-actions">
        ${actions}
      </div>
    `;

    container.appendChild(div);
  });
}

function goToVoiceSource(
  section,
  personId
) {

  currentSection = section;

  openPerson(personId);
}

function deleteTextReminder(id) {

  if (
    !confirm(
      "این یادآوری حذف شود؟"
    )
  ) return;

  const data = getData();

  data._textReminders =
    (
      data._textReminders || []
    ).filter(
      r => r.id !== id
    );

  saveData(data);

  renderRemindersList();
}

// ==================== هوش مصنوعی BOOS ONE ====================
async function sendMessage() {

  const input =
    document.getElementById("chat-input");

  const message =
    input.value.trim();

  if (!message) return;

  const messagesDiv =
    document.getElementById("chat-messages");

  // پیام کاربر
  const userMsg =
    document.createElement("div");

  userMsg.style.cssText =
    "background:#e8d5b5; padding:10px 14px; border-radius:12px; margin-bottom:10px; text-align:right;";

  userMsg.textContent = message;

  messagesDiv.appendChild(userMsg);

  input.value = "";

  messagesDiv.scrollTop =
    messagesDiv.scrollHeight;

  // پیام در حال پردازش
  const loadingMsg =
    document.createElement("div");

  loadingMsg.id = "loading-msg";

  loadingMsg.style.cssText =
    "background:#fff; padding:10px 14px; border-radius:12px; margin-bottom:10px; text-align:right; border:1px solid #e0d0b0; color:#8b7355;";

  loadingMsg.textContent =
    "در حال پردازش...";

  messagesDiv.appendChild(loadingMsg);

  messagesDiv.scrollTop =
    messagesDiv.scrollHeight;

  try {

    const response =
      await fetch(
        AI_PROXY_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              message
            })
        }
      );

    let data;

    try {

      data =
        await response.json();

    } catch {

      throw new Error(
        "پاسخ معتبر از سرور دریافت نشد."
      );
    }

    document
      .getElementById("loading-msg")
      ?.remove();

    const botMsg =
      document.createElement("div");

    botMsg.style.cssText =
      "background:#fff; padding:10px 14px; border-radius:12px; margin-bottom:10px; text-align:right; border:1px solid #e0d0b0; white-space:pre-wrap;";

    if (
      !response.ok ||
      data?.error
    ) {

      botMsg.style.background =
        "#fff0f0";

      botMsg.style.borderColor =
        "#e8b4b4";

      botMsg.style.color =
        "#8b3030";

      botMsg.textContent =
        "خطا: " +
        (
          data?.error ||
          "ارتباط با سرویس BOOS ONE ناموفق بود."
        );

    } else if (
      typeof data?.text === "string" &&
      data.text.trim()
    ) {

      botMsg.textContent =
        data.text;

    } else {

      botMsg.textContent =
        "پاسخی دریافت نشد.";
    }

    messagesDiv.appendChild(botMsg);

    messagesDiv.scrollTop =
      messagesDiv.scrollHeight;

  } catch (error) {

    document
      .getElementById("loading-msg")
      ?.remove();

    const errorMsg =
      document.createElement("div");

    errorMsg.style.cssText =
      "background:#fff0f0; padding:10px 14px; border-radius:12px; margin-bottom:10px; text-align:right; border:1px solid #e8b4b4; color:#8b3030;";

    errorMsg.textContent =
      "خطای ارتباط: " +
      (
        error?.message ||
        "ارتباط با سرویس برقرار نشد."
      );

    messagesDiv.appendChild(errorMsg);

    messagesDiv.scrollTop =
      messagesDiv.scrollHeight;
  }
}

// ==================== شروع برنامه ====================
document.addEventListener(
  "DOMContentLoaded",
  () => {

    renderHome();

    if (
      "serviceWorker" in navigator
    ) {

      navigator
        .serviceWorker
        .register("./sw.js")
        .catch(() => {});
    }

    setTimeout(() => {

      const splash =
        document.getElementById(
          "splash-screen"
        );

      if (splash) {

        splash.classList.add("hide");

        setTimeout(() => {

          splash.style.display =
            "none";

          showPage("home-page");

          const due =
            collectAllReminders()
              .filter(
                r => r.isDue
              );

          if (due.length > 0) {

            setTimeout(() => {

              alert(
                `شما ${due.length} یادآوری موعدرسیده دارید.\nبرای مشاهده به بخش «یادآوری» بروید.`
              );

            }, 500);
          }

        }, 600);

      } else {

        showPage("home-page");
      }

    }, 4000);

  }
);
