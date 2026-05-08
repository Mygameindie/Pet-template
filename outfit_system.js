// ===========================================================
// 👕 outfit_system.js (GLOBAL) — load once, used by every mode
// ===========================================================
(() => {
  // ---------- helpers ----------
  function createImg(src) {
    const img = new Image();
    img._failed = false;
    img.onerror = () => { img._failed = true; };
    img.src = src;
    return img;
  }

  function loadOutfit(prefix) {
    return {
      stand: createImg(`${prefix}_stand.png`),
      fall: createImg(`${prefix}_fall.png`),
      fly0: createImg(`${prefix}_fly0.png`),
      fly1: createImg(`${prefix}_fly1.png`),
      // ✅ add sleep state support (optional asset)
      sleep: createImg(`${prefix}_sleep.png`),
    };
  }

  // ---------- global state ----------
  // Multi-pet support:
  // - window.currentOutfits: per-pet outfit id array
  // - window.activePetIndex: which pet the clothes button controls
  // Back-compat:
  // - window.currentOutfit still exists and mirrors pet 0
  const DEFAULT_OUTFIT = 1;

  if (!Array.isArray(window.currentOutfits)) {
    // If an older build stored single outfit in window.currentOutfit, carry it over.
    const carry = (typeof window.currentOutfit === "number") ? window.currentOutfit : DEFAULT_OUTFIT;
    window.currentOutfits = [carry, carry];
  }

  if (typeof window.activePetIndex !== "number") window.activePetIndex = 0;

  // Keep legacy field in sync for pet 0
  window.currentOutfit = (typeof window.currentOutfits[0] === "number") ? window.currentOutfits[0] : DEFAULT_OUTFIT;

  // expose outfits globally (so every mode can use it)
  // Per-pet outfit sets:
  // - Pet 0 (base.png / base1) uses prefixes like: outfit1_*.png
  // - Pet 1 (base2.png / base2) uses prefixes like: outfit1_2_*.png
  // Structure: window.outfits[petIndex][outfitId] = loadOutfit(prefix)
  window.outfits = window.outfits || {
    0: {
      1: loadOutfit("outfit1"),
      2: loadOutfit("outfit2"),
      3: loadOutfit("outfit3"),
      4: loadOutfit("outfit4"),
    },
    1: {
      1: loadOutfit("outfit1_2"),
      2: loadOutfit("outfit2_2"),
      3: loadOutfit("outfit3_2"),
      4: loadOutfit("outfit4_2"),
    },
  };

  // ---------- button (idempotent; prevents stacking) ----------
  let clothesBtn = window.clothesBtn;
  if (!clothesBtn) {
    clothesBtn = document.createElement("button");
    clothesBtn.id = "clothes-btn";
    clothesBtn.innerText = "Change Clothes";
    clothesBtn.style.position = "fixed";
    clothesBtn.style.bottom = "calc(65px + env(safe-area-inset-bottom))";
    clothesBtn.style.right = "10px";
    clothesBtn.style.padding = "6px 12px";
    clothesBtn.style.fontSize = "clamp(11px, 2.5vw, 14px)";
    clothesBtn.style.cursor = "pointer";
    clothesBtn.style.zIndex = "9998";
    clothesBtn.style.borderRadius = "8px";
    clothesBtn.style.border = "none";
    clothesBtn.style.background = "rgba(255,255,255,0.92)";
    clothesBtn.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
    clothesBtn.style.whiteSpace = "nowrap";
    document.body.appendChild(clothesBtn);

    window.clothesBtn = clothesBtn;
  }

  function updateButtonLabel() {
    const i = (typeof window.activePetIndex === "number") ? window.activePetIndex : 0;
    const id = (Array.isArray(window.currentOutfits) && typeof window.currentOutfits[i] === "number")
      ? window.currentOutfits[i]
      : 0;
    clothesBtn.innerText =
      id === 0
        ? `Change Clothes (Pet ${i + 1}: Base)`
        : `Change Clothes (Pet ${i + 1}: Outfit ${id})`;
  }
  updateButtonLabel();


// Returns sorted outfit IDs for a given pet, always including base (0) at the front.
function getOutfitCycleList(petIdx) {
  const petSets = window.outfits && window.outfits[petIdx];
  const ids = petSets ? Object.keys(petSets).map(n => Number(n)).filter(n => Number.isFinite(n)) : [];
  ids.sort((a, b) => a - b);
  // Ensure base option exists in cycle
  if (!ids.includes(0)) ids.unshift(0);
  // De-dupe (just in case)
  return Array.from(new Set(ids));
}

  if (!clothesBtn._outfitListenerBound) {
    clothesBtn._outfitListenerBound = true;

    clothesBtn.addEventListener("click", () => {
      // ❌ no changing in shower
      if (window._modeName === "shower") return;

      const petIdx = (typeof window.activePetIndex === "number") ? window.activePetIndex : 0;
      if (!Array.isArray(window.currentOutfits)) window.currentOutfits = [DEFAULT_OUTFIT, DEFAULT_OUTFIT];


const cycle = getOutfitCycleList(petIdx);
if (!cycle.length) {
  window.currentOutfits[petIdx] = 0;
} else {
  // Move to next id in the cycle list
  const cur = (typeof window.currentOutfits[petIdx] === "number") ? window.currentOutfits[petIdx] : 0;
  let idx = cycle.indexOf(cur);
  if (idx < 0) idx = 0;

  // advance, skipping outfits with missing/failed stand image (common in partial asset packs)
  for (let step = 0; step < cycle.length; step++) {
    idx = (idx + 1) % cycle.length;
    const nextId = cycle[idx];
    window.currentOutfits[petIdx] = nextId;

    // keep legacy mirror for pet 0
    if (petIdx === 0) window.currentOutfit = window.currentOutfits[0];

    if (nextId === 0) break; // base is always allowed

    const set = window.outfits && window.outfits[petIdx] && window.outfits[petIdx][nextId];
    const stand = set && set.stand;

    // accept if not failed; may still be loading but will render once ready
    if (stand && !stand._failed) break;
  }
}

updateButtonLabel();
    });
  }

  // ---------- safe draw ----------
  function safeDraw(ctx, img, x, y, w, h) {
    if (!img || img._failed || !img.complete || img.naturalWidth === 0) return false;
    ctx.drawImage(img, x, y, w, h);
    return true;
  }

  // ---------- global render helper ----------
  // Call this AFTER you draw the base image in any mode.
  // state can be: "stand" | "fall" | "fly0" | "fly1" | "sleep"
  // ✅ returns true if something was drawn, else false
  // Optional petIndex param (default = activePetIndex)
  window.drawOutfitOverlay = function (ctx, state, x, y, w, h, petIndex) {
    if (window._modeName === "shower") return false;           // shower never shows clothes
    const i = (typeof petIndex === "number")
      ? petIndex
      : ((typeof window.activePetIndex === "number") ? window.activePetIndex : 0);

    // Back-compat: if currentOutfits missing, fall back to currentOutfit.
    const id = (Array.isArray(window.currentOutfits) && typeof window.currentOutfits[i] === "number")
      ? window.currentOutfits[i]
      : ((typeof window.currentOutfit === "number") ? window.currentOutfit : 0);

    if (id === 0) return false;                                 // base
    const set = window.outfits && window.outfits[i] && window.outfits[i][id];
    if (!set) return false;

    // Try requested state first; if missing/failed, fall back to stand.
    let img = set[state];
    if (!img || img._failed || (img.complete && img.naturalWidth === 0)) img = set.stand;

    return safeDraw(ctx, img, x, y, w, h);
  };

  // ---------- helpers for shower ----------
  window.enterShowerClothesRules = function () {
    // ✅ remember previous outfit so we can restore
    if (!Array.isArray(window._prevOutfitsBeforeShower)) {
      window._prevOutfitsBeforeShower = Array.isArray(window.currentOutfits)
        ? window.currentOutfits.slice()
        : [window.currentOutfit || DEFAULT_OUTFIT, window.currentOutfit || DEFAULT_OUTFIT];
    }

    if (!Array.isArray(window.currentOutfits)) window.currentOutfits = [DEFAULT_OUTFIT, DEFAULT_OUTFIT];
    window.currentOutfits[0] = 0;
    window.currentOutfits[1] = 0;
    window.currentOutfit = 0; // legacy mirror
    if (window.clothesBtn) window.clothesBtn.style.display = "none";
    updateButtonLabel();
  };

  window.exitShowerClothesRules = function () {
    // ✅ restore previous outfit if available (and not shower)
    if (Array.isArray(window._prevOutfitsBeforeShower)) {
      window.currentOutfits = window._prevOutfitsBeforeShower.slice();
      delete window._prevOutfitsBeforeShower;
      window.currentOutfit = window.currentOutfits[0] || DEFAULT_OUTFIT;
    }
    if (window.clothesBtn) window.clothesBtn.style.display = "block";
    updateButtonLabel();
  };

  // Allow modes to update active pet for outfit changes
  if (!window.setActivePet) {
    window.setActivePet = function (idx) {
      const n = Number(idx);
      if (!Number.isFinite(n)) return;
      window.activePetIndex = Math.max(0, Math.min(1, Math.floor(n)));
      updateButtonLabel();
    };
  }
})();