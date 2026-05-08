// ===========================================================
// 😈 TROLL MODE (Click hammer button -> then click/tap pet -> hammer appears AT CLICK POINT -> synced impact)
// Fixes:
// 1) Hammer ALWAYS appears where you click/tap (no drag needed)
// 2) Impact (sound + hurt) only if clicking opaque pixels of the base (pixel-perfect hit test)
// 3) Keeps original flow + safety fallback if pixel mask can't be built
// ===========================================================

(() => {
  window._modeName = "trolling";

  const canvas = document.getElementById("canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // === Resize ===
  const groundHeight = 100;
  let groundY = 0;

  // === Base Pet (per pet)
  function createImg(src) {
    const img = new Image();
    img._failed = false;
    img.onerror = () => { img._failed = true; };
    img.src = src;
    return img;
  }

  // Optional 2 art naming:
  //   base_2.png, base_disgust_2.png
  const baseSets = [
    { normal: createImg("base.png"), hurt: createImg("base_disgust.png") },
    { normal: createImg("base_2.png"), hurt: createImg("base_disgust_2.png") },
  ];

  const pets = [
    { x: 0, y: 0, w: 400, h: 450, hurtUntil: 0, recoilUntil: 0, drawFilter: "none" },
    { x: 0, y: 0, w: 400, h: 450, hurtUntil: 0, recoilUntil: 0, drawFilter: "hue-rotate(140deg) saturate(1.2)" },
  ];

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    groundY = canvas.height - groundHeight;
    // keep pets spaced after resize
    pets[0].x = canvas.width * 0.35 - pets[0].w / 2;
    pets[1].x = canvas.width * 0.65 - pets[1].w / 2;
    pets.forEach(p => { p.y = groundY - 500; });
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  // === Sounds ===
  const hammerSound = new Audio("hammer.mp3");
  if (window.SoundManager) SoundManager.register(hammerSound);

  function playHammerImpact() {
    try {
      const clone = hammerSound.cloneNode();
      clone.volume = 0.95;
      clone.currentTime = 0;
      clone.play().catch(() => {});
      if (window.SoundManager) SoundManager.register(clone);
    } catch {}
  }

  // ===========================================================
  // 🧭 TOOLBAR
  // ===========================================================
  const trollBar = document.createElement("div");
  trollBar.id = "troll-bar";
  trollBar.classList.add("combined-scroll-bar");
  trollBar.style.position = "fixed";
  trollBar.style.top = "15px";
  trollBar.style.left = "50%";
  trollBar.style.transform = "translateX(-50%)";
  trollBar.style.zIndex = "999";
  trollBar.innerHTML = `
    <button id="hammer-btn" title="Arm hammer, then tap the pet">🔨 Hammer</button>
    <button id="remove-btn" title="Clear tool & reset face">❌ Remove</button>
  `;
  document.body.appendChild(trollBar);

  // ===========================================================
  // 🔨 HAMMER (appears where you click; no drag)
  // ===========================================================
  const hammerCursor = document.createElement("div");
  hammerCursor.id = "hammer-cursor";
  hammerCursor.textContent = "🔨";
  hammerCursor.style.display = "none";
  document.body.appendChild(hammerCursor);

  // Inject minimal CSS so animation always works (even if CSS file changes)
  const style = document.createElement("style");
  style.textContent = `
    #hammer-cursor{
      position:fixed;
      left:0; top:0;
      transform: translate(-50%,-55%) rotate(-18deg);
      font-size:48px;
      pointer-events:none;
      z-index:1000;
      filter: drop-shadow(0 2px 2px rgba(0,0,0,.25));
    }
    #hammer-cursor.swing{
      animation: hammerSwing .32s ease-in-out;
      transform-origin: 70% 30%;
    }
    @keyframes hammerSwing{
      0%{ transform: translate(-50%,-55%) rotate(-18deg); }
      55%{ transform: translate(-50%,-55%) rotate(65deg) translateY(6px); }
      100%{ transform: translate(-50%,-55%) rotate(-18deg); }
    }
    #troll-bar button.active{ outline: 2px solid rgba(255,255,255,.65); }
  `;
  document.head.appendChild(style);

  let hammerArmed = false;
  let isSwinging = false;

  const hammerBtn = document.getElementById("hammer-btn");
  const removeBtn = document.getElementById("remove-btn");

  function setHammerArmed(on) {
    hammerArmed = !!on;
    hammerBtn.classList.toggle("active", hammerArmed);
    // No cursor-follow; keep hidden until click
    hammerCursor.style.display = "none";
  }

  hammerBtn.addEventListener("click", () => setHammerArmed(!hammerArmed));

  removeBtn.addEventListener("click", () => {
    setHammerArmed(false);
    pets.forEach(p => { p.hurtUntil = 0; p.recoilUntil = 0; });
  });

  // ===========================================================
  // 🎯 Pixel-perfect hit test (opaque pixels only)
  // ===========================================================
  const alphaMasks = [
    { data: null, w: 0, h: 0 },
    { data: null, w: 0, h: 0 },
  ];
  const ALPHA_THRESHOLD = 10;

  function rebuildAlphaMask(img, idx) {
    try {
      const oc = document.createElement("canvas");
      oc.width = img.naturalWidth || img.width;
      oc.height = img.naturalHeight || img.height;
      const octx = oc.getContext("2d", { willReadFrequently: true });
      octx.clearRect(0, 0, oc.width, oc.height);
      octx.drawImage(img, 0, 0);
      const id = octx.getImageData(0, 0, oc.width, oc.height);
      alphaMasks[idx] = { data: id.data, w: oc.width, h: oc.height };
    } catch (e) {
      alphaMasks[idx] = { data: null, w: 0, h: 0 };
    }
  }

  // Build masks for both pets (2 falls back to pet1 mask if its art isn't available)
  baseSets.forEach((set, i) => {
    const img = set && set.normal;
    if (!img) return;
    img.addEventListener("load", () => rebuildAlphaMask(img, i));
    if (img.complete && img.naturalWidth > 0) rebuildAlphaMask(img, i);
  });

  function getCanvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches && e.touches[0];
    const clientX = touch ? touch.clientX : e.clientX;
    const clientY = touch ? touch.clientY : e.clientY;

    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    return { x, y, clientX, clientY };
  }

  function isOpaqueHit(p, pet, idx) {
    // must be within pet rect first
    if (p.x < pet.x || p.x > pet.x + pet.w || p.y < pet.y || p.y > pet.y + pet.h) return false;

    const m = alphaMasks[idx] || alphaMasks[0];
    // If mask not ready, fallback to rectangle hit (still playable)
    if (!m.data || !m.w || !m.h) return true;

    // map canvas point -> image pixel
    const ix = Math.floor((p.x - pet.x) * (m.w / pet.w));
    const iy = Math.floor((p.y - pet.y) * (m.h / pet.h));
    if (ix < 0 || ix >= m.w || iy < 0 || iy >= m.h) return false;

    const a = m.data[(iy * m.w + ix) * 4 + 3];
    return a > ALPHA_THRESHOLD;
  }

  // ===========================================================
  // 🔨 Hit + timing
  // ===========================================================
  const SWING_MS = 320;
  const IMPACT_AT = 0.62;

  function doHammerHit(hit, clientX, clientY, hitIdx) {
    if (!hammerArmed || isSwinging) return;
    isSwinging = true;

    // Put hammer exactly where user clicked/tapped
    hammerCursor.style.left = clientX + "px";
    hammerCursor.style.top = clientY + "px";
    hammerCursor.style.display = "block";

    // restart swing animation reliably
    hammerCursor.classList.remove("swing");
    void hammerCursor.offsetWidth;
    hammerCursor.classList.add("swing");

    const impactTimer = setTimeout(() => {
      if (hit) {
        playHammerImpact();

        const idx = (typeof hitIdx === 'number' && hitIdx >= 0) ? hitIdx : 0;
        const pet = pets[idx];
        pet.recoilUntil = Date.now() + 120;
        pet.hurtUntil = Date.now() + 450;
        if (window.PetStats) window.PetStats.troll(idx);
      }
    }, Math.floor(SWING_MS * IMPACT_AT));

    setTimeout(() => {
      clearTimeout(impactTimer);
      hammerCursor.classList.remove("swing");
      hammerCursor.style.display = "none";
      isSwinging = false;
    }, SWING_MS + 30);
  }

  function onCanvasDown(e) {
    if (!hammerArmed) return;
    const p = getCanvasPoint(e);

    // Pick which pet is hit (opaque). If none, still show hammer animation.
    let hitIdx = -1;
    for (let i = pets.length - 1; i >= 0; i--) {
      if (isOpaqueHit(p, pets[i], i)) { hitIdx = i; break; }
    }
    const hit = hitIdx >= 0;

    if (hitIdx >= 0 && typeof window.setActivePet === 'function') window.setActivePet(hitIdx);

    e.preventDefault();
    doHammerHit(hit, p.clientX, p.clientY, hitIdx);
  }

  canvas.addEventListener("mousedown", onCanvasDown);
  canvas.addEventListener("touchstart", onCanvasDown, { passive: false });

  // ===========================================================
  // 🎨 DRAW LOOP
  // ===========================================================
  let running = true;
  function draw() {
    if (!running) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ground
    ctx.fillStyle = "#5c4033";
    ctx.fillRect(0, groundY, canvas.width, groundHeight);

    // pets
    const now = Date.now();
    for (let i = 0; i < pets.length; i++) {
      const pet = pets[i];
      const recoil = (pet.recoilUntil && now < pet.recoilUntil) ? 10 : 0;
      const wantHurt = (pet.hurtUntil && now < pet.hurtUntil);

      let set = baseSets[i] || baseSets[0];
      let img = wantHurt ? set.hurt : set.normal;
      let useTintFallback = false;
      if (!img || img._failed) {
        set = baseSets[0];
        img = wantHurt ? set.hurt : set.normal;
        useTintFallback = (i === 1);
      }

      if (img && !img._failed && img.complete && img.naturalWidth > 0) {
        ctx.save();
        ctx.filter = useTintFallback ? (pet.drawFilter || "none") : "none";
        ctx.drawImage(img, pet.x, pet.y + recoil, pet.w, pet.h);

        // Outfit overlay (per pet)
        if (window.drawOutfitOverlay) {
          window.drawOutfitOverlay(ctx, "stand", pet.x, pet.y + recoil, pet.w, pet.h, i);
        }
        ctx.restore();
      }
    }

    requestAnimationFrame(draw);
  }
  draw();

  // ===========================================================
  // 🧹 CLEANUP
  // ===========================================================
  window._modeCleanup = function () {
    running = false;
    trollBar?.remove();
    hammerCursor?.remove();
    style?.remove();
    window.removeEventListener("resize", resizeCanvas);
    canvas.removeEventListener("mousedown", onCanvasDown);
    canvas.removeEventListener("touchstart", onCanvasDown);
    if (window.SoundManager) SoundManager.stopAll();
  };
})();
