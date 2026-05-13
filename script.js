// ============================================================
//  KATIPUNAN SMP — MAIN SCRIPT
//  Firebase: Read events + announcements + gallery
// ============================================================

import { initializeApp }  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue }
                          from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

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

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// ============================================================
//  UTILITIES
// ============================================================
function formatDate(isoStr) {
  if (!isoStr) return "TBA";
  const d = new Date(isoStr);
  if (isNaN(d)) return "TBA";
  return d.toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

function timeUntil(isoStr) {
  const diff = new Date(isoStr) - Date.now();
  if (diff <= 0) return null;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (d > 0) return d + "d " + h + "h " + m + "m";
  if (h > 0) return h + "h " + m + "m " + s + "s";
  return m + "m " + s + "s";
}

const EVENT_ICONS = {
  "build-contest":"🏗️","pvp":"⚔️","treasure-hunt":"🗺️",
  "elytra-race":"🦅","festival":"🎆","barangay-war":"🏰",
  "fishing":"🎣","boss-raid":"👾","lore":"📜","other":"🎉"
};

function sanitize(str) {
  if (!str) return "";
  const d = document.createElement("div");
  d.textContent = String(str);
  return d.innerHTML;
}

// ============================================================
//  SCROLL REVEAL — Triple-layered fallback
// ============================================================
let _revealIO = null;

function setupReveal() {
  _checkReveal();
  if ("IntersectionObserver" in window) {
    _revealIO = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          _revealIO.unobserve(e.target);
        }
      });
    }, { threshold: 0, rootMargin: "0px 0px -20px 0px" });
    _attachIO();
  }
  window.addEventListener("scroll", _checkReveal, { passive: true });
  setTimeout(_showAll, 1500);
}

function _attachIO() {
  if (!_revealIO) return;
  document.querySelectorAll(
    ".reveal:not(.visible),.reveal-left:not(.visible),.reveal-right:not(.visible)"
  ).forEach(el => _revealIO.observe(el));
}

function _checkReveal() {
  const vh = window.innerHeight + 80;
  document.querySelectorAll(
    ".reveal:not(.visible),.reveal-left:not(.visible),.reveal-right:not(.visible)"
  ).forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.top < vh && r.bottom > -80) el.classList.add("visible");
  });
}

function _showAll() {
  document.querySelectorAll(
    ".reveal:not(.visible),.reveal-left:not(.visible),.reveal-right:not(.visible)"
  ).forEach(el => el.classList.add("visible"));
}

function observeReveal() {
  _checkReveal();
  _attachIO();
}

// ============================================================
//  BANNERS
// ============================================================
window.closeBanner = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("hidden");
  sessionStorage.setItem("banner-closed-" + id, "1");
};

function showAnnouncementBanner(text) {
  if (sessionStorage.getItem("banner-closed-announcement-banner")) return;
  const banner = document.getElementById("announcement-banner");
  const textEl  = document.getElementById("announcement-text");
  if (!banner || !textEl) return;
  textEl.textContent = text;
  banner.classList.remove("hidden");
}

// ============================================================
//  EVENT COUNTDOWN BANNER
// ============================================================
let _cdInterval = null;

function checkEventBanner(events) {
  if (sessionStorage.getItem("banner-closed-event-banner")) return;
  const now = Date.now();
  const next = events
    .filter(e => e.date && (new Date(e.date) - now) > 0 && (new Date(e.date) - now) <= 72 * 3600000)
    .sort((a,b) => new Date(a.date) - new Date(b.date))[0];

  if (!next) return;

  const banner  = document.getElementById("event-banner");
  const nameEl  = document.getElementById("event-banner-name");
  const countEl = document.getElementById("event-countdown");
  if (!banner || !nameEl || !countEl) return;

  nameEl.textContent = next.title;
  banner.classList.remove("hidden");

  const tick = () => {
    const t = timeUntil(next.date);
    countEl.textContent = t || "Starting now!";
    if (!t) clearInterval(_cdInterval);
  };
  if (_cdInterval) clearInterval(_cdInterval);
  _cdInterval = setInterval(tick, 1000);
  tick();
}

// ============================================================
//  FIREBASE: ANNOUNCEMENTS
// ============================================================
function listenAnnouncements() {
  onValue(ref(db, "announcements"), snapshot => {
    const items = [];
    snapshot.forEach(child => {
      const d = child.val();
      if (d.active !== false) items.push(d);
    });

    const tickerBar = document.getElementById("ticker-bar");

    if (!items.length) {
      if (tickerBar) tickerBar.style.display = "none";
      return;
    }

    if (tickerBar) tickerBar.style.display = "";
    items.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));

    showAnnouncementBanner(items[0].text);

    const ticker = document.getElementById("ticker-inner");
    if (ticker) ticker.textContent = items.map(i => "📣  " + i.text).join("     ·     ");
  }, err => console.warn("Announcements:", err));
}

// ============================================================
//  FIREBASE: EVENTS
// ============================================================
function listenEvents() {
  onValue(ref(db, "events"), snapshot => {
    const events = [];
    snapshot.forEach(child => events.push({ id: child.key, ...child.val() }));
    const active = events
      .filter(e => e.active !== false)
      .sort((a,b) => new Date(a.date) - new Date(b.date));
    renderEvents(active);
    checkEventBanner(active);
  }, () => {
    const g = document.getElementById("events-grid");
    if (g) g.innerHTML = `<div class="events-empty"><p style="color:rgba(255,200,100,.6)">⚠ Could not load events. Check Firebase rules.</p></div>`;
  });
}

function renderEvents(events) {
  const grid = document.getElementById("events-grid");
  if (!grid) return;

  if (!events.length) {
    grid.innerHTML = `
      <div class="events-empty">
        <div style="font-size:2rem;margin-bottom:12px">🌙</div>
        <p>No upcoming events right now.<br>Check back soon!</p>
      </div>`;
    return;
  }

  grid.innerHTML = events.map(e => {
    const icon     = EVENT_ICONS[e.type] || "🎉";
    const isFuture = e.date && new Date(e.date) > Date.now();
    const timer    = isFuture ? timeUntil(e.date) : null;
    return `
      <div class="event-card${e.featured?" featured":""} reveal">
        <div class="event-card-banner">
          <span style="position:relative;z-index:2;font-size:3.5rem">${icon}</span>
          ${e.featured?'<span class="event-featured-badge">⭐ FEATURED</span>':""}
          <span class="event-badge">${sanitize((e.type||"event").replace(/-/g," ")).toUpperCase()}</span>
        </div>
        <div class="event-card-body">
          <div class="event-card-title">${sanitize(e.title)}</div>
          <div class="event-card-desc">${sanitize(e.description)}</div>
          ${e.prizes?`<div class="event-prizes">🏆 ${sanitize(e.prizes)}</div>`:""}
          <div class="event-meta">
            <span class="event-date">📅 ${formatDate(e.date)}</span>
            ${timer
              ? `<span class="event-timer" data-date="${sanitize(e.date)}">⏱ ${timer}</span>`
              : (!isFuture?`<span class="event-date" style="color:#ff8c42">✅ Completed</span>`:"")}
          </div>
        </div>
      </div>`;
  }).join("");

  // Live countdown tickers in cards
  setInterval(() => {
    document.querySelectorAll(".event-timer[data-date]").forEach(el => {
      const t = timeUntil(el.dataset.date);
      el.textContent = t ? "⏱ "+t : "Starting now!";
    });
  }, 1000);

  observeReveal();
}

// ============================================================
//  CAROUSEL STATE
// ============================================================
const carousel = {
  index:    0,
  total:    0,
  autoPlay: null,
  DELAY:    4500,  // ms between auto-advances
};

function carouselGo(n, userInitiated = false) {
  if (carousel.total === 0) return;
  carousel.index = ((n % carousel.total) + carousel.total) % carousel.total;

  const track = document.getElementById("carousel-track");
  if (track) track.style.transform = `translateX(-${carousel.index * 100}%)`;

  document.querySelectorAll(".carousel-dot").forEach((d, i) => {
    d.classList.toggle("active", i === carousel.index);
  });

  if (userInitiated) carouselRestartAutoplay();
}

function carouselRestartAutoplay() {
  if (carousel.autoPlay) clearInterval(carousel.autoPlay);
  carousel.autoPlay = setInterval(() => carouselGo(carousel.index + 1), carousel.DELAY);
}

window.carouselPrev = function() { carouselGo(carousel.index - 1, true); };
window.carouselNext = function() { carouselGo(carousel.index + 1, true); };

function initCarouselControls() {
  const prev = document.getElementById("carousel-prev");
  const next = document.getElementById("carousel-next");
  if (prev) prev.addEventListener("click", window.carouselPrev);
  if (next) next.addEventListener("click", window.carouselNext);

  // Keyboard navigation
  document.addEventListener("keydown", e => {
    const section = document.getElementById("gallery");
    if (!section || section.style.display === "none") return;
    if (e.key === "ArrowLeft")  window.carouselPrev();
    if (e.key === "ArrowRight") window.carouselNext();
  });

  // Touch/swipe support
  const viewport = document.querySelector(".carousel-viewport");
  if (viewport) {
    let touchStartX = 0;
    viewport.addEventListener("touchstart", e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    viewport.addEventListener("touchend", e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 40) dx < 0 ? window.carouselNext() : window.carouselPrev();
    }, { passive: true });
  }
}

// ============================================================
//  FIREBASE: GALLERY
// ============================================================
function listenGallery() {
  onValue(ref(db, "gallery"), snapshot => {
    const gallerySection = document.getElementById("gallery");

    // No data at all
    if (!snapshot.exists()) {
      if (gallerySection) gallerySection.style.display = "none";
      return;
    }

    const items = (snapshot.val().items || []).filter(i => i && i.url);

    // No images → keep section hidden
    if (!items.length) {
      if (gallerySection) gallerySection.style.display = "none";
      return;
    }

    // Show the section
    if (gallerySection) gallerySection.style.display = "";

    const track = document.getElementById("carousel-track");
    const dots  = document.getElementById("carousel-dots");
    if (!track || !dots) return;

    // Reset state
    carousel.index = 0;
    carousel.total = items.length;
    if (carousel.autoPlay) clearInterval(carousel.autoPlay);

    // Build slides
    track.innerHTML = items.map(item => `
      <div class="carousel-slide">
        <img
          src="${sanitize(item.url)}"
          alt="${sanitize(item.caption || "Community Screenshot")}"
          loading="lazy"
          onerror="this.parentElement.style.display='none';adjustCarouselTotal()"
        >
        <div class="carousel-overlay">
          <span>${sanitize(item.caption || "📸 Community Screenshot")}</span>
        </div>
      </div>`).join("");

    // Build dots
    dots.innerHTML = items.map((_, i) =>
      `<div class="carousel-dot${i === 0 ? " active" : ""}" onclick="carouselGo(${i}, true)" aria-label="Slide ${i+1}"></div>`
    ).join("");

    // Go to first slide and start autoplay
    carouselGo(0);
    carousel.autoPlay = setInterval(() => carouselGo(carousel.index + 1), carousel.DELAY);

    observeReveal();
  }, err => console.warn("Gallery:", err));
}

// Called if an image fails to load — keeps total accurate
window.adjustCarouselTotal = function() {
  const visible = document.querySelectorAll(".carousel-slide:not([style*='none'])").length;
  carousel.total = Math.max(visible, 1);
};

// ============================================================
//  SERVER STATUS
// ============================================================
async function fetchServerStatus() {
  try {
    const res  = await fetch("https://api.mcsrvstat.us/3/play.katipunansmp.net");
    const data = await res.json();
    const online = data.online === true;

    const dot     = document.getElementById("status-dot");
    const text    = document.getElementById("status-text");
    const players = document.getElementById("stat-players");
    const version = document.getElementById("stat-version");

    if (dot)  dot.className  = "status-dot " + (online ? "online" : "offline");
    if (text) text.textContent = online ? "● Online" : "● Offline";
    if (online) {
      if (players) players.textContent = (data.players?.online??0)+" / "+(data.players?.max??"?");
      if (version) version.textContent = data.version ?? "1.21.x";
    } else {
      if (players) players.textContent = "0";
    }
  } catch {
    const t = document.getElementById("status-text");
    if (t) t.textContent = "Status unavailable";
  }
}

// ============================================================
//  COPY SERVER IP
// ============================================================
window.copyIP = function() {
  const ip = "play.katipunansmp.net";
  const show = () => {
    const toast = document.getElementById("copy-toast");
    if (toast) { toast.classList.add("show"); setTimeout(()=>toast.classList.remove("show"),2500); }
  };
  if (navigator.clipboard) {
    navigator.clipboard.writeText(ip).then(show).catch(() => legacyCopy(ip, show));
  } else {
    legacyCopy(ip, show);
  }
};
function legacyCopy(text, cb) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;opacity:0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); cb(); } catch(e){}
  document.body.removeChild(ta);
}

// ============================================================
//  NAVBAR
// ============================================================
function initNavbar() {
  const nav = document.getElementById("navbar");
  if (!nav) return;
  const update = () => nav.classList.toggle("scrolled", window.scrollY > 80);
  window.addEventListener("scroll", update, { passive: true });
  update();
}

window.toggleMobileNav = function() {
  const links = document.getElementById("nav-links");
  if (!links) return;
  const open = links.classList.toggle("open");
  document.getElementById("hamburger")?.setAttribute("aria-expanded", String(open));
};

// ============================================================
//  PARALLAX
// ============================================================
function initParallax() {
  const layers = document.querySelectorAll(".layer-parallax");
  if (!layers.length) return;
  let ticking = false;
  window.addEventListener("scroll", () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const sy = window.scrollY;
        layers.forEach(el => {
          el.style.transform = "translateY("+sy*parseFloat(el.dataset.depth||0.2)+"px)";
        });
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

// ============================================================
//  PARTICLES
// ============================================================
function initParticles() {
  const canvas = document.getElementById("particles");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const resize = () => { canvas.width=canvas.offsetWidth||innerWidth; canvas.height=canvas.offsetHeight||innerHeight; };
  resize();
  window.addEventListener("resize", resize, { passive:true });

  const COLS = ["#F2D15C","#ffffff","#AEEBFF","#6EC24A","#FFF0A0"];
  const COUNT = innerWidth < 768 ? 20 : 40;
  const mk = () => ({
    x: Math.random()*canvas.width, y: Math.random()*canvas.height,
    size: (Math.floor(Math.random()*2)+1)*2,
    vx: (Math.random()-.5)*.5, vy: -(Math.random()*.5+.2),
    alpha: Math.random()*.6+.2,
    color: COLS[Math.floor(Math.random()*COLS.length)]
  });
  const ps = Array.from({length:COUNT}, mk);

  (function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ps.forEach(p => {
      ctx.globalAlpha=p.alpha; ctx.fillStyle=p.color;
      ctx.fillRect(Math.round(p.x),Math.round(p.y),p.size,p.size);
      p.x+=p.vx; p.y+=p.vy; p.alpha-=.0008;
      if (p.y<-20||p.alpha<=0) { Object.assign(p,mk()); p.y=canvas.height+10; }
    });
    ctx.globalAlpha=1;
    requestAnimationFrame(draw);
  })();
}

// ============================================================
//  STARS
// ============================================================
function initStars() {
  const layer = document.getElementById("stars-layer");
  if (!layer) return;
  for (let i=0;i<60;i++) {
    const s = document.createElement("div");
    s.className="star";
    s.style.cssText="left:"+Math.random()*100+"%;top:"+Math.random()*50+"%;opacity:"+(Math.random()*.6+.1).toFixed(2);
    layer.appendChild(s);
  }
}

// ============================================================
//  INIT
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  // Close mobile nav on link click
  document.querySelectorAll(".nav-link").forEach(a =>
    a.addEventListener("click", () => document.getElementById("nav-links")?.classList.remove("open"))
  );

  // Footer IP click
  document.getElementById("footer-ip")?.addEventListener("click", window.copyIP);

  initNavbar();
  initParallax();
  initParticles();
  initStars();
  initCarouselControls();

  // Reveal: run after first paint so layout is known
  requestAnimationFrame(() => setTimeout(setupReveal, 80));

  fetchServerStatus();
  listenAnnouncements();
  listenEvents();
  listenGallery();

  setInterval(fetchServerStatus, 120_000);
});
