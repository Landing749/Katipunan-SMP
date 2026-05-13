// ============================================================
//  KATIPUNAN SMP — ADMIN PANEL SCRIPT
//  Firebase Auth + Realtime Database CRUD
// ============================================================

import { initializeApp }         from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  onValue,
  push,
  set,
  update,
  remove,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ---- Firebase Config ----
const firebaseConfig = {
  apiKey:            "AIzaSyDbEVgfgRpmOJTLDj0xP1hQEEhoR2jt0vc",
  authDomain:        "katipunan-c13fc.firebaseapp.com",
  databaseURL:       "https://katipunan-c13fc-default-rtdb.firebaseio.com",
  projectId:         "katipunan-c13fc",
  storageBucket:     "katipunan-c13fc.firebasestorage.app",
  messagingSenderId: "141516072900",
  appId:             "1:141516072900:web:9790c8fc1393582aada691",
  measurementId:     "G-XTPLWJK8S5"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getDatabase(app);

// ============================================================
//  TOAST NOTIFICATIONS
// ============================================================
function toast(msg, type = "success") {
  const el = document.getElementById("admin-toast");
  if (!el) return;
  el.textContent = msg;
  el.className   = `admin-toast ${type}`;
  el.classList.remove("hidden");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add("hidden"), 3500);
}

// ============================================================
//  AUTH — Login / Logout
// ============================================================
window.handleLogin = async function(e) {
  e.preventDefault();
  const email  = document.getElementById("login-email").value.trim();
  const pass   = document.getElementById("login-pass").value;
  const btn    = document.getElementById("login-btn");
  const errEl  = document.getElementById("login-error");

  btn.disabled = true;
  document.getElementById("login-btn-text").textContent = "Signing in…";
  errEl.classList.add("hidden");

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    // onAuthStateChanged will handle the rest
  } catch (err) {
    let msg = "Sign-in failed. Check your credentials.";
    if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") msg = "⚠ Wrong email or password.";
    if (err.code === "auth/user-not-found")   msg = "⚠ No account found for that email.";
    if (err.code === "auth/too-many-requests") msg = "⚠ Too many attempts. Try again later.";
    errEl.textContent = msg;
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    document.getElementById("login-btn-text").textContent = "🔐 Sign In";
  }
};

window.handleLogout = async function() {
  await signOut(auth);
};

// Monitor auth state
onAuthStateChanged(auth, user => {
  if (user) {
    // Show dashboard
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("dashboard").classList.remove("hidden");

    const emailEl = document.getElementById("sb-user-email");
    if (emailEl) emailEl.textContent = user.email;

    // Load all data
    loadEvents();
    loadAnnouncements();
    loadServerInfo();
    loadGallery();
    initCloudinary();
  } else {
    // Show login
    document.getElementById("login-screen").classList.remove("hidden");
    document.getElementById("dashboard").classList.add("hidden");
  }
});

// ============================================================
//  TAB SWITCHING
// ============================================================
window.switchTab = function(tabName, btn) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".sb-btn").forEach(el => el.classList.remove("active"));

  const tab = document.getElementById("tab-" + tabName);
  if (tab) tab.classList.add("active");
  if (btn) btn.classList.add("active");
};

// ============================================================
//  MODAL HELPERS
// ============================================================
window.closeModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("hidden");
};

window.closeModalOutside = function(e, id) {
  if (e.target.id === id) closeModal(id);
};

// ============================================================
//  UTILITIES
// ============================================================
const EVENT_ICONS = {
  "build-contest": "🏗️", "pvp": "⚔️", "treasure-hunt": "🗺️",
  "elytra-race": "🦅", "festival": "🎆", "barangay-war": "🏰",
  "fishing": "🎣", "boss-raid": "👾", "lore": "📜", "other": "🎉"
};

function sanitize(str) {
  const d = document.createElement("div");
  d.textContent = String(str || "");
  return d.innerHTML;
}

function formatDate(isoStr) {
  if (!isoStr) return "TBA";
  const d = new Date(isoStr);
  if (isNaN(d)) return "TBA";
  return d.toLocaleString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

// Convert datetime-local string to ISO (preserve local time intent)
function localToISO(localStr) {
  if (!localStr) return null;
  return new Date(localStr).toISOString();
}

// Convert ISO to datetime-local input value
function isoToLocal(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isNaN(d)) return "";
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ============================================================
//  =================== EVENTS CRUD ==========================
// ============================================================

// --- Listen & Render ---
function loadEvents() {
  const listEl = document.getElementById("events-list");
  onValue(ref(db, "events"), snapshot => {
    const events = [];
    snapshot.forEach(child => events.push({ id: child.key, ...child.val() }));
    events.sort((a, b) => new Date(a.date) - new Date(b.date));
    renderEventList(events, listEl);
  }, err => {
    if (listEl) listEl.innerHTML = `<div class="list-loading" style="color:#ff8877">⚠ Failed to load events.</div>`;
    console.error("Events load error:", err);
  });
}

function renderEventList(events, container) {
  if (!container) return;
  if (!events.length) {
    container.innerHTML = `<div class="list-empty">📭 No events yet. Create your first event!</div>`;
    return;
  }
  container.innerHTML = events.map(e => {
    const icon    = EVENT_ICONS[e.type] || "🎉";
    const active  = e.active !== false;
    const featured = !!e.featured;
    return `
      <div class="item-row ${active ? "" : "inactive"}" id="evrow-${e.id}">
        <div class="item-icon">${icon}</div>
        <div class="item-info">
          <div class="item-title">${sanitize(e.title)}</div>
          <div class="item-meta">
            📅 ${formatDate(e.date)}
            ${e.prizes ? ` · 🏆 ${sanitize(e.prizes)}` : ""}
          </div>
          <div class="item-desc">${sanitize(e.description)}</div>
          <div class="item-badges">
            <span class="badge ${active ? "badge-active" : "badge-inactive"}">${active ? "✓ ACTIVE" : "✗ HIDDEN"}</span>
            ${featured ? `<span class="badge badge-featured">⭐ FEATURED</span>` : ""}
            <span class="badge badge-type">${(e.type || "other").replace("-"," ").toUpperCase()}</span>
          </div>
        </div>
        <div class="item-actions">
          <button class="btn-admin btn-outline btn-sm" onclick="editEvent('${e.id}')">✏️ Edit</button>
          <button class="btn-admin btn-sm ${active ? "btn-outline" : "btn-gold"}"
            onclick="toggleEventActive('${e.id}', ${!active})">
            ${active ? "👁 Hide" : "👁 Show"}
          </button>
          <button class="btn-admin btn-danger btn-sm" onclick="confirmDelete('event','${e.id}','${sanitize(e.title)}')">🗑</button>
        </div>
      </div>`;
  }).join("");
}

// --- Open modal for new event ---
window.openEventModal = function() {
  document.getElementById("event-modal-title").textContent = "New Event";
  document.getElementById("event-edit-id").value = "";
  document.getElementById("event-form").reset();
  document.getElementById("ev-active").checked  = true;
  document.getElementById("event-submit-btn").textContent = "💾 Save Event";
  document.getElementById("event-modal").classList.remove("hidden");
};

// --- Open modal for editing ---
window.editEvent = function(id) {
  const row = document.getElementById("evrow-" + id);
  if (!row) return;
  // Read from Firebase directly for freshest data
  onValue(ref(db, `events/${id}`), snap => {
    if (!snap.exists()) return;
    const e = snap.val();
    document.getElementById("event-modal-title").textContent = "Edit Event";
    document.getElementById("event-edit-id").value  = id;
    document.getElementById("ev-title").value        = e.title    || "";
    document.getElementById("ev-type").value         = e.type     || "";
    document.getElementById("ev-date").value         = isoToLocal(e.date);
    document.getElementById("ev-desc").value         = e.description || "";
    document.getElementById("ev-prizes").value       = e.prizes   || "";
    document.getElementById("ev-featured").checked   = !!e.featured;
    document.getElementById("ev-active").checked     = e.active !== false;
    document.getElementById("event-submit-btn").textContent = "💾 Update Event";
    document.getElementById("event-modal").classList.remove("hidden");
  }, { onlyOnce: true });
};

// --- Submit (create or update) ---
window.submitEvent = async function(e) {
  e.preventDefault();
  const editId = document.getElementById("event-edit-id").value.trim();
  const btn    = document.getElementById("event-submit-btn");

  const payload = {
    title:       document.getElementById("ev-title").value.trim(),
    type:        document.getElementById("ev-type").value,
    date:        localToISO(document.getElementById("ev-date").value),
    description: document.getElementById("ev-desc").value.trim(),
    prizes:      document.getElementById("ev-prizes").value.trim(),
    featured:    document.getElementById("ev-featured").checked,
    active:      document.getElementById("ev-active").checked,
    updatedAt:   Date.now(),
  };

  if (!payload.title || !payload.type || !payload.date) {
    toast("⚠ Please fill in all required fields.", "error");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Saving…";

  try {
    if (editId) {
      await update(ref(db, `events/${editId}`), payload);
      toast("✓ Event updated successfully!");
    } else {
      payload.createdAt = Date.now();
      await push(ref(db, "events"), payload);
      toast("✓ Event created successfully!");
    }
    closeModal("event-modal");
  } catch (err) {
    console.error("Save event error:", err);
    toast(`⚠ Error: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = editId ? "💾 Update Event" : "💾 Save Event";
  }
};

// --- Toggle active ---
window.toggleEventActive = async function(id, newState) {
  try {
    await update(ref(db, `events/${id}`), { active: newState, updatedAt: Date.now() });
    toast(`✓ Event ${newState ? "shown" : "hidden"}.`);
  } catch (err) {
    toast(`⚠ Error: ${err.message}`, "error");
  }
};

// ============================================================
//  ================ ANNOUNCEMENTS CRUD ======================
// ============================================================

function loadAnnouncements() {
  const listEl = document.getElementById("ann-list");
  onValue(ref(db, "announcements"), snapshot => {
    const items = [];
    snapshot.forEach(child => items.push({ id: child.key, ...child.val() }));
    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    renderAnnList(items, listEl);
  }, err => {
    if (listEl) listEl.innerHTML = `<div class="list-loading" style="color:#ff8877">⚠ Failed to load.</div>`;
  });
}

function renderAnnList(items, container) {
  if (!container) return;
  if (!items.length) {
    container.innerHTML = `<div class="list-empty">📭 No announcements yet.</div>`;
    return;
  }
  container.innerHTML = items.map(a => {
    const active = a.active !== false;
    const date   = a.createdAt ? new Date(a.createdAt).toLocaleString("en-PH") : "Unknown";
    return `
      <div class="item-row ${active ? "" : "inactive"}" id="annrow-${a.id}">
        <div class="item-icon">📢</div>
        <div class="item-info">
          <div class="item-desc" style="color:var(--text);font-size:0.95rem">${sanitize(a.text)}</div>
          <div class="item-meta" style="margin-top:6px">🕐 ${date}</div>
          <div class="item-badges">
            <span class="badge ${active ? "badge-active" : "badge-inactive"}">${active ? "✓ SHOWING" : "✗ HIDDEN"}</span>
          </div>
        </div>
        <div class="item-actions">
          <button class="btn-admin btn-outline btn-sm" onclick="editAnn('${a.id}')">✏️ Edit</button>
          <button class="btn-admin btn-sm ${active ? "btn-outline" : "btn-gold"}"
            onclick="toggleAnnActive('${a.id}', ${!active})">
            ${active ? "👁 Hide" : "👁 Show"}
          </button>
          <button class="btn-admin btn-danger btn-sm" onclick="confirmDelete('ann','${a.id}','this announcement')">🗑</button>
        </div>
      </div>`;
  }).join("");
}

window.openAnnModal = function() {
  document.getElementById("ann-modal-title").textContent = "New Announcement";
  document.getElementById("ann-edit-id").value = "";
  document.getElementById("ann-form").reset();
  document.getElementById("ann-active").checked = true;
  document.getElementById("ann-modal").classList.remove("hidden");
};

window.editAnn = function(id) {
  onValue(ref(db, `announcements/${id}`), snap => {
    if (!snap.exists()) return;
    const a = snap.val();
    document.getElementById("ann-modal-title").textContent = "Edit Announcement";
    document.getElementById("ann-edit-id").value  = id;
    document.getElementById("ann-text").value     = a.text  || "";
    document.getElementById("ann-active").checked = a.active !== false;
    document.getElementById("ann-modal").classList.remove("hidden");
  }, { onlyOnce: true });
};

window.submitAnn = async function(e) {
  e.preventDefault();
  const editId = document.getElementById("ann-edit-id").value.trim();
  const text   = document.getElementById("ann-text").value.trim();
  const active = document.getElementById("ann-active").checked;

  if (!text) { toast("⚠ Announcement text is required.", "error"); return; }

  try {
    if (editId) {
      await update(ref(db, `announcements/${editId}`), { text, active, updatedAt: Date.now() });
      toast("✓ Announcement updated!");
    } else {
      await push(ref(db, "announcements"), { text, active, createdAt: Date.now() });
      toast("✓ Announcement created!");
    }
    closeModal("ann-modal");
  } catch (err) {
    toast(`⚠ Error: ${err.message}`, "error");
  }
};

window.toggleAnnActive = async function(id, newState) {
  try {
    await update(ref(db, `announcements/${id}`), { active: newState });
    toast(`✓ Announcement ${newState ? "shown" : "hidden"}.`);
  } catch (err) {
    toast(`⚠ Error: ${err.message}`, "error");
  }
};

// ============================================================
//  =================== SERVER INFO ==========================
// ============================================================

function loadServerInfo() {
  onValue(ref(db, "serverConfig"), snap => {
    if (!snap.exists()) return;
    const c = snap.val();
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ""; };
    set("sv-ip",          c.ip);
    set("sv-version",     c.version);
    set("sv-max-players", c.maxPlayers);
    set("sv-mode",        c.mode);
    set("sv-discord",     c.discord);
    set("sv-vote",        c.vote);
    set("sv-store",       c.store);
    const bEl = document.getElementById("sv-bedrock");
    if (bEl) bEl.checked = c.bedrock !== false;
  }, { onlyOnce: true });
}

window.saveServerInfo = async function() {
  const g = id => document.getElementById(id)?.value?.trim() || "";
  const payload = {
    ip:         g("sv-ip")          || "play.katipunansmp.net",
    version:    g("sv-version")     || "1.21.x",
    maxPlayers: parseInt(g("sv-max-players")) || 100,
    mode:       g("sv-mode")        || "Survival SMP",
    discord:    g("sv-discord"),
    vote:       g("sv-vote"),
    store:      g("sv-store"),
    bedrock:    document.getElementById("sv-bedrock")?.checked ?? true,
    updatedAt:  Date.now(),
  };
  try {
    await set(ref(db, "serverConfig"), payload);
    toast("✓ Server configuration saved!");
  } catch (err) {
    toast(`⚠ Error: ${err.message}`, "error");
  }
};

// ============================================================
//  CLOUDINARY UPLOAD WIDGET
//  Cloud: damr6r9op  |  Preset: org-resources
// ============================================================
let _cloudinaryWidget = null;

function initCloudinary() {
  if (typeof cloudinary === "undefined") {
    console.warn("Cloudinary widget script not loaded.");
    return;
  }
  _cloudinaryWidget = cloudinary.createUploadWidget(
    {
      cloudName:    "damr6r9op",
      uploadPreset: "org-resources",
      sources:      ["local", "url", "camera", "google_drive"],
      multiple:     true,
      maxFiles:     20,
      resourceType: "image",
      maxFileSize:  10_000_000, // 10 MB per file
      folder:       "katipunan-smp/gallery",
      tags:         ["katipunan-smp", "gallery"],
      clientAllowedFormats: ["jpg", "jpeg", "png", "webp", "gif"],
      showAdvancedOptions: false,
      cropping:     false,
      theme:        "minimal",
      styles: {
        palette: {
          window:      "#1e0e04",
          windowBorder:"D4A82A",
          tabIcon:     "#F2D15C",
          menuIcons:   "#F2D15C",
          textDark:    "#2c1a0e",
          textLight:   "#FFF8E7",
          link:        "#F2D15C",
          action:      "#F2D15C",
          inactiveTabIcon: "#7A4020",
          error:       "#e74c3c",
          inProgress:  "#6EC24A",
          complete:    "#27ae60",
          sourceBg:    "#140902",
        },
        fonts: { default: null, "'Nunito', sans-serif": { url: "https://fonts.googleapis.com/css2?family=Nunito:wght@600&display=swap", active: true } }
      }
    },
    (error, result) => {
      if (error) { console.error("Cloudinary error:", error); toast("⚠ Upload failed.", "error"); return; }
      if (result.event === "success") {
        const info = result.info;
        galleryData.push({ url: info.secure_url, caption: info.original_filename || "Gallery Image" });
        renderGalleryRows();
        toast("✓ Uploaded: " + (info.original_filename || "image"));
      }
    }
  );
}

window.openCloudinaryWidget = function() {
  if (!_cloudinaryWidget) {
    toast("⚠ Cloudinary widget not ready. Refresh the page.", "error");
    return;
  }
  _cloudinaryWidget.open();
};



let galleryData = [];

function loadGallery() {
  onValue(ref(db, "gallery"), snap => {
    galleryData = snap.exists() ? (snap.val().items || []) : [];
    renderGalleryRows();
  }, { onlyOnce: true });
}

function renderGalleryRows() {
  const container = document.getElementById("gallery-rows");
  if (!container) return;
  if (!galleryData.length) galleryData = [{ url: "", caption: "", alt: "" }];
  container.innerHTML = galleryData.map((item, i) => `
    <div class="gallery-row" id="gr-${i}">
      <div class="form-group" style="margin:0">
        <label>Image URL</label>
        <input type="url" placeholder="https://i.imgur.com/..." value="${sanitize(item.url || "")}"
          oninput="galleryData[${i}].url=this.value">
      </div>
      <div class="form-group" style="margin:0">
        <label>Caption</label>
        <input type="text" placeholder="Player Town Spawn" value="${sanitize(item.caption || "")}"
          oninput="galleryData[${i}].caption=this.value">
      </div>
      <button class="btn-admin btn-danger btn-sm" style="margin-top:22px" onclick="removeGalleryRow(${i})">🗑</button>
    </div>`).join("");
}

window.addGalleryRow = function() {
  galleryData.push({ url: "", caption: "" });
  renderGalleryRows();
};

window.removeGalleryRow = function(i) {
  galleryData.splice(i, 1);
  if (!galleryData.length) galleryData = [{ url: "", caption: "" }];
  renderGalleryRows();
};

window.saveGallery = async function() {
  const cleaned = galleryData.filter(g => g.url && g.url.startsWith("http"));
  try {
    await set(ref(db, "gallery"), { items: cleaned, updatedAt: Date.now() });
    toast(`✓ Gallery saved! (${cleaned.length} images)`);
  } catch (err) {
    toast(`⚠ Error: ${err.message}`, "error");
  }
};

// ============================================================
//  =================== DELETE CONFIRM =======================
// ============================================================

window.confirmDelete = function(type, id, label) {
  const modal = document.getElementById("confirm-modal");
  const text  = document.getElementById("confirm-text");
  const btn   = document.getElementById("confirm-yes-btn");
  if (!modal || !btn) return;

  text.textContent = `Are you sure you want to permanently delete "${label}"? This cannot be undone.`;
  modal.classList.remove("hidden");

  // Remove old listener, attach new one
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);

  newBtn.addEventListener("click", async () => {
    closeModal("confirm-modal");
    try {
      const path = type === "event" ? `events/${id}` : `announcements/${id}`;
      await remove(ref(db, path));
      toast(`✓ Deleted successfully.`);
    } catch (err) {
      toast(`⚠ Error: ${err.message}`, "error");
    }
  });
};
