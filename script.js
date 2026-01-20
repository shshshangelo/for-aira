const CONFIG = {
  // Put your images in ./photos and name them 01.jpg ... 36.jpg
  photosDir: "photos",
  count: 36,
  // Optional: change the extension if you use png/webp
  ext: "jpg",
  // Optional: customize who/when
  forName: "Aira",
  dateLabel: "January 21, 2026",
};

/** @type {{ id:number, src:string, title:string, subtitle:string }[]} */
let photos = [];
/** @type {{ id:number, src:string, title:string, subtitle:string }[]} */
let originalPhotos = [];

let lightboxIndex = 0;
let slideshowTimer = null;

function pad2(n) {
  return String(n).padStart(2, "0");
}

function buildPhotos() {
  const out = [];
  for (let i = 1; i <= CONFIG.count; i += 1) {
    const file = `${pad2(i)}.${CONFIG.ext}`;
    const src = `${CONFIG.photosDir}/${file}`;
    out.push({
      id: i,
      src,
      title: `Moment ${pad2(i)}`,
      subtitle: CONFIG.dateLabel,
    });
  }
  return out;
}

function normalizeAnswer(raw) {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function $(sel) {
  return /** @type {HTMLElement} */ (document.querySelector(sel));
}

function setHeroMeta() {
  const chips = document.querySelectorAll(".meta__chip");
  if (chips.length >= 2) {
    chips[0].textContent = `For: ${CONFIG.forName}`;
    chips[1].textContent = `Date: ${CONFIG.dateLabel}`;
  }
  $("#year").textContent = String(new Date().getFullYear());
}

function launchConfetti() {
  const layer = document.createElement("div");
  layer.className = "confetti-layer";

  const pieces = 120;
  for (let i = 0; i < pieces; i += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    const x = (Math.random() * 200 - 100).toFixed(1) + "vw";
    const delay = (Math.random() * 0.8).toFixed(2) + "s";
    const dur = (2.6 + Math.random() * 1.6).toFixed(2) + "s";
    piece.style.setProperty("--x", x);
    piece.style.setProperty("--dur", dur);
    piece.style.animationDelay = delay;
    layer.appendChild(piece);
  }

  document.body.appendChild(layer);

  window.setTimeout(() => {
    layer.remove();
  }, 4500);
}

function initGate() {
  const gate = $("#gate");
  if (!gate) return;

  const passed = window.localStorage.getItem("gatePassed") === "true";
  if (passed) {
    gate.style.display = "none";
    document.body.classList.remove("locked");
    return;
  }

  document.body.classList.add("locked");

  const input = /** @type {HTMLInputElement} */ ($("#gateAnswer"));
  const btn = $("#gateSubmit");
  const errorEl = $("#gateError");

  const check = () => {
    const value = normalizeAnswer(input.value);
    // Accept variations like "in the cafe namoo", "cafe namoo", etc.
    const isRight = /cafe\s+namoo/.test(value);

    if (isRight) {
      window.localStorage.setItem("gatePassed", "true");
      gate.classList.add("gate--hide");
      document.body.classList.remove("locked");
      errorEl.textContent = "";
      launchConfetti();
      window.setTimeout(() => {
        gate.style.display = "none";
      }, 420);
    } else {
      errorEl.textContent = "Hint: It's a Cafe at City Times Square";
    }
  };

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    check();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      check();
    }
  });
}

function renderGrid() {
  const grid = $("#grid");

  grid.innerHTML = "";
  for (let i = 0; i < photos.length; i += 1) {
    const p = photos[i];

    const tile = document.createElement("div");
    tile.className = "tile";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.addEventListener("click", () => openLightbox(i));

    const img = document.createElement("img");
    img.className = "tile__img";
    img.loading = "lazy";
    img.alt = `${p.title} — ${p.subtitle}`;
    img.src = p.src;
    img.addEventListener("error", () => {
      // If the user hasn't added photos yet, show a nice placeholder.
      img.remove();
      btn.appendChild(makePlaceholder(p.id));
    });

    btn.appendChild(img);
    tile.appendChild(btn);

    const overlay = document.createElement("div");
    overlay.className = "tile__overlay";
    tile.appendChild(overlay);

    const cap = document.createElement("div");
    cap.className = "tile__caption";
    cap.innerHTML = `<strong>${pad2(p.id)}</strong>`;
    tile.appendChild(cap);

    grid.appendChild(tile);
  }
}

function makePlaceholder(id) {
  const wrap = document.createElement("div");
  wrap.style.aspectRatio = "1 / 1";
  wrap.style.display = "grid";
  wrap.style.placeItems = "center";
  wrap.style.padding = "16px";
  wrap.style.background =
    "linear-gradient(135deg, rgba(255,77,125,0.20), rgba(255,210,166,0.14))";
  wrap.style.color = "rgba(255,255,255,0.86)";
  wrap.style.fontWeight = "850";
  wrap.style.letterSpacing = "-0.2px";
  wrap.style.textAlign = "center";
  wrap.style.borderRadius = "16px";
  wrap.style.border = "1px solid rgba(255,255,255,0.12)";
  wrap.innerHTML = `<div>Drop photo<br><span style="opacity:.9;font-weight:900;">${pad2(
    id
  )}.${CONFIG.ext}</span></div>`;
  return wrap;
}

function openLightbox(index) {
  lightboxIndex = index;
  const lb = $("#lightbox");
  lb.setAttribute("data-open", "true");
  lb.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  renderLightbox();
}

function closeLightbox() {
  const lb = $("#lightbox");
  lb.removeAttribute("data-open");
  lb.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  stopSlideshow();
}

function renderLightbox() {
  const p = photos[lightboxIndex];
  const img = /** @type {HTMLImageElement} */ ($("#lightboxImg"));
  const caption = $("#lightboxCaption");

  img.src = p.src;
  img.alt = `${p.title} — ${p.subtitle}`;
  caption.textContent = `${pad2(p.id)} • ${p.subtitle}`;

  // Preload neighbors for smoother nav.
  preloadAt(lightboxIndex - 1);
  preloadAt(lightboxIndex + 1);
}

function preloadAt(index) {
  if (index < 0 || index >= photos.length) return;
  const pre = new Image();
  pre.src = photos[index].src;
}

function prev() {
  lightboxIndex = (lightboxIndex - 1 + photos.length) % photos.length;
  renderLightbox();
}

function next() {
  lightboxIndex = (lightboxIndex + 1) % photos.length;
  renderLightbox();
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function toggleSlideshow() {
  if (slideshowTimer) {
    stopSlideshow();
    return;
  }

  // If lightbox isn't open, open it from the first photo.
  const lbOpen = $("#lightbox").getAttribute("data-open") === "true";
  if (!lbOpen) openLightbox(0);

  $("#playBtn").textContent = "Stop slideshow";
  slideshowTimer = window.setInterval(() => {
    next();
  }, 2600);
}

function stopSlideshow() {
  if (slideshowTimer) {
    window.clearInterval(slideshowTimer);
    slideshowTimer = null;
  }
  $("#playBtn").textContent = "Play slideshow";
}

function wireEvents() {
  $("#shuffleBtn").addEventListener("click", () => {
    shuffleInPlace(photos);
    renderGrid();
  });

  $("#resetBtn").addEventListener("click", () => {
    photos = originalPhotos.map((p) => ({ ...p }));
    renderGrid();
  });

  $("#playBtn").addEventListener("click", () => toggleSlideshow());

  $("#prevBtn").addEventListener("click", () => prev());
  $("#nextBtn").addEventListener("click", () => next());

  // Close actions
  $("#lightbox").addEventListener("click", (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    if (t && t.dataset && t.dataset.close === "true") closeLightbox();
  });

  // Keyboard
  window.addEventListener("keydown", (e) => {
    const lbOpen = $("#lightbox").getAttribute("data-open") === "true";
    if (!lbOpen) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
    if (e.key === " ") {
      e.preventDefault();
      toggleSlideshow();
    }
  });

  // Simple swipe
  let startX = 0;
  let startY = 0;
  $("#lightboxImg").addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
    },
    { passive: true }
  );

  $("#lightboxImg").addEventListener(
    "touchend",
    (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx > 0) prev();
      else next();
    },
    { passive: true }
  );
}

function main() {
  initGate();
  setHeroMeta();
  photos = buildPhotos();
  originalPhotos = photos.map((p) => ({ ...p }));
  renderGrid();
  wireEvents();
}

document.addEventListener("DOMContentLoaded", main);


