// ===========================================================
// 👕 outfit_system.js — Simple Dress-Up System
// Branch: dress-up-2
// Purpose: Toy-style clothes + color only, no wind, no toy system
// ===========================================================
(() => {
  // ---------- helpers ----------
  const DEFAULT_COLOR = "Original";
  const COLOR_MAP = {
    Original: null,
    Red: "#ff3b30",
    Orange: "#ff9500",
    Yellow: "#ffcc00",
    Green: "#34c759",
    Cyan: "#32ade6",
    Blue: "#007aff",
    Purple: "#af52de",
    Pink: "#ff2d55",
  };

  function createImg(src) {
    const img = new Image();
    img._failed = false;
    img.onerror = () => { img._failed = true; };
    img.src = src;
    return img;
  }

  function loadClothingSet(prefix) {
    return {
      stand: createImg(`${prefix}_stand.png`),
      fall: createImg(`${prefix}_fall.png`),
      fly0: createImg(`${prefix}_fly0.png`),
      fly1: createImg(`${prefix}_fly1.png`),
      sleep: createImg(`${prefix}_sleep.png`),
    };
  }

  function ensureArray(value, fallback) {
    return Array.isArray(value) ? value : fallback;
  }

  function petIndex() {
    const n = Number(window.activePetIndex);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, Math.floor(n))) : 0;
  }

  function safeDraw(ctx, img, x, y, w, h) {
    if (!img || img._failed || !img.complete || img.naturalWidth === 0) return false;
    ctx.drawImage(img, x, y, w, h);
    return true;
  }

  // ---------- clothing database ----------
  // Current assets follow the old outfit naming:
  // Pet 1: outfit1_stand.png, outfit2_stand.png, etc.
  // Pet 2: outfit1_2_stand.png, outfit2_2_stand.png, etc.
  // Add more categories later by extending window.dressUpCatalog before this file loads,
  // or by editing this catalog directly.
  const builtInCatalog = {
    0: {
      outfit: {
        label: "Outfit",
        z: 100,
        items: {
          0: { label: "Base", set: null },
          1: { label: "Outfit 1", set: loadClothingSet("outfit1") },
          2: { label: "Outfit 2", set: loadClothingSet("outfit2") },
          3: { label: "Outfit 3", set: loadClothingSet("outfit3") },
          4: { label: "Outfit 4", set: loadClothingSet("outfit4") },
        },
      },
    },
    1: {
      outfit: {
        label: "Outfit",
        z: 100,
        items: {
          0: { label: "Base", set: null },
          1: { label: "Outfit 1", set: loadClothingSet("outfit1_2") },
          2: { label: "Outfit 2", set: loadClothingSet("outfit2_2") },
          3: { label: "Outfit 3", set: loadClothingSet("outfit3_2") },
          4: { label: "Outfit 4", set: loadClothingSet("outfit4_2") },
        },
      },
    },
  };

  window.dressUpCatalog = window.dressUpCatalog || builtInCatalog;

  // ---------- global state ----------
  if (typeof window.activePetIndex !== "number") window.activePetIndex = 0;

  // selectedClothes[petIndex][category] = itemId
  window.selectedClothes = window.selectedClothes || [
    { outfit: 1 },
    { outfit: 1 },
  ];

  // clothingColors[petIndex][category] = colorName
  window.clothingColors = window.clothingColors || [
    { outfit: DEFAULT_COLOR },
    { outfit: DEFAULT_COLOR },
  ];

  // Back-compat with old outfit button system.
  window.currentOutfits = ensureArray(window.currentOutfits, [1, 1]);
  window.currentOutfit = typeof window.currentOutfits[0] === "number" ? window.currentOutfits[0] : 1;

  function syncLegacyOutfitFields() {
    for (let i = 0; i < 2; i++) {
      const selected = window.selectedClothes?.[i]?.outfit;
      window.currentOutfits[i] = typeof selected === "number" ? selected : 0;
    }
    window.currentOutfit = window.currentOutfits[0] || 0;
  }
  syncLegacyOutfitFields();

  // ---------- color tint cache ----------
  const tintCache = new Map();

  function hexToRgb(hex) {
    if (!hex) return null;
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return null;
    return {
      r: parseInt(m[1], 16),
      g: parseInt(m[2], 16),
      b: parseInt(m[3], 16),
    };
  }

  function tintedImage(img, hex) {
    if (!hex || !img || img._failed || !img.complete || img.naturalWidth === 0) return img;

    const key = `${img.src}|${hex}`;
    if (tintCache.has(key)) return tintCache.get(key);

    const rgb = hexToRgb(hex);
    if (!rgb) return img;

    const cv = document.createElement("canvas");
    cv.width = img.naturalWidth;
    cv.height = img.naturalHeight;
    const ctx = cv.getContext("2d", { willReadFrequently: true });

    try {
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, cv.width, cv.height);
      const d = data.data;

      for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3];
        if (!a) continue;

        // Preserve shadows/highlights by multiplying original luminance into target color.
        const lum = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
        const shade = Math.max(0.18, Math.min(1.25, lum * 1.35));
        d[i]     = Math.min(255, rgb.r * shade);
        d[i + 1] = Math.min(255, rgb.g * shade);
        d[i + 2] = Math.min(255, rgb.b * shade);
      }

      ctx.putImageData(data, 0, 0);
    } catch (_) {
      return img;
    }

    const out = new Image();
    out.src = cv.toDataURL("image/png");
    tintCache.set(key, out);
    return out;
  }

  // ---------- UI ----------
  let selectedCategory = "outfit";

  function makeButton(text, className) {
    const btn = document.createElement("button");
    btn.textContent = text;
    if (className) btn.className = className;
    return btn;
  }

  const panelCss = `
    position: fixed;
    right: 10px;
    bottom: calc(108px + env(safe-area-inset-bottom));
    width: min(330px, calc(100vw - 20px));
    max-height: 48vh;
    overflow: auto;
    display: none;
    z-index: 9999;
    padding: 10px;
    border-radius: 12px;
    background: rgba(255,255,255,0.95);
    box-shadow: 0 6px 24px rgba(0,0,0,0.22);
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  `;

  const btnCss = `
    border: 0;
    border-radius: 9px;
    padding: 7px 10px;
    margin: 3px;
    background: rgba(0,0,0,0.08);
    cursor: pointer;
    font-size: 13px;
    white-space: nowrap;
  `;

  let dressBtn = document.getElementById("dressup-btn");
  if (!dressBtn) {
    dressBtn = makeButton("Dress Up", "dressup-toggle");
    dressBtn.id = "dressup-btn";
    dressBtn.style.cssText = `
      position: fixed;
      right: 10px;
      bottom: calc(65px + env(safe-area-inset-bottom));
      z-index: 9998;
      padding: 6px 12px;
      font-size: clamp(11px, 2.5vw, 14px);
      cursor: pointer;
      border-radius: 8px;
      border: none;
      background: rgba(255,255,255,0.92);
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      white-space: nowrap;
    `;
    document.body.appendChild(dressBtn);
  }
  window.clothesBtn = dressBtn;

  let panel = document.getElementById("dressup-panel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "dressup-panel";
    panel.style.cssText = panelCss;
    document.body.appendChild(panel);
  }

  function getPetCatalog(i) {
    return window.dressUpCatalog?.[i] || window.dressUpCatalog?.[0] || {};
  }

  function categoryKeys(i) {
    return Object.keys(getPetCatalog(i)).sort((a, b) => {
      const ca = getPetCatalog(i)[a];
      const cb = getPetCatalog(i)[b];
      return (ca.z || 0) - (cb.z || 0);
    });
  }

  function selectedItemFor(i, cat) {
    return window.selectedClothes?.[i]?.[cat] ?? 0;
  }

  function selectedColorFor(i, cat) {
    return window.clothingColors?.[i]?.[cat] || DEFAULT_COLOR;
  }

  function setSelectedItem(i, cat, id) {
    if (!window.selectedClothes[i]) window.selectedClothes[i] = {};
    window.selectedClothes[i][cat] = Number(id);
    syncLegacyOutfitFields();
    renderPanel();
  }

  function setSelectedColor(i, cat, colorName) {
    if (!window.clothingColors[i]) window.clothingColors[i] = {};
    window.clothingColors[i][cat] = colorName;
    renderPanel();
  }

  function updateButtonLabel() {
    const i = petIndex();
    const item = selectedItemFor(i, "outfit");
    const color = selectedColorFor(i, "outfit");
    dressBtn.textContent = item === 0
      ? `Dress Up (Pet ${i + 1}: Base)`
      : `Dress Up (Pet ${i + 1}: Outfit ${item}${color !== DEFAULT_COLOR ? ", " + color : ""})`;
  }

  function renderPanel() {
    const i = petIndex();
    const catalog = getPetCatalog(i);
    const cats = categoryKeys(i);
    if (!cats.includes(selectedCategory)) selectedCategory = cats[0] || "outfit";

    panel.innerHTML = "";

    const title = document.createElement("div");
    title.style.cssText = "font-weight:700;margin-bottom:8px;display:flex;justify-content:space-between;gap:8px;align-items:center;";
    title.innerHTML = `<span>Pet ${i + 1} Dress Up</span>`;
    const close = makeButton("✕");
    close.style.cssText = btnCss + "padding:4px 8px;";
    close.onclick = () => { panel.style.display = "none"; };
    title.appendChild(close);
    panel.appendChild(title);

    const catRow = document.createElement("div");
    catRow.style.cssText = "display:flex;overflow-x:auto;padding-bottom:4px;margin-bottom:8px;";
    cats.forEach(cat => {
      const btn = makeButton(catalog[cat].label || cat);
      btn.style.cssText = btnCss + (cat === selectedCategory ? "background:rgba(0,0,0,0.22);font-weight:700;" : "");
      btn.onclick = () => { selectedCategory = cat; renderPanel(); };
      catRow.appendChild(btn);
    });
    panel.appendChild(catRow);

    const cat = selectedCategory;
    const catData = catalog[cat];
    if (!catData) {
      updateButtonLabel();
      return;
    }

    const itemsTitle = document.createElement("div");
    itemsTitle.textContent = "Clothes";
    itemsTitle.style.cssText = "font-weight:600;margin:8px 0 4px;";
    panel.appendChild(itemsTitle);

    const itemRow = document.createElement("div");
    itemRow.style.cssText = "display:flex;flex-wrap:wrap;gap:2px;margin-bottom:8px;";
    Object.entries(catData.items || {}).forEach(([id, item]) => {
      const n = Number(id);
      const active = selectedItemFor(i, cat) === n;
      const btn = makeButton(item.label || (n === 0 ? "Base" : `Item ${n}`));
      btn.style.cssText = btnCss + (active ? "background:rgba(0,0,0,0.22);font-weight:700;" : "");
      btn.onclick = () => setSelectedItem(i, cat, n);
      itemRow.appendChild(btn);
    });
    panel.appendChild(itemRow);

    const colorTitle = document.createElement("div");
    colorTitle.textContent = "Color";
    colorTitle.style.cssText = "font-weight:600;margin:8px 0 4px;";
    panel.appendChild(colorTitle);

    const colorRow = document.createElement("div");
    colorRow.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;";
    Object.entries(COLOR_MAP).forEach(([name, hex]) => {
      const active = selectedColorFor(i, cat) === name;
      const btn = makeButton(name === "Original" ? "Original" : "");
      btn.title = name;
      btn.style.cssText = btnCss + `
        min-width:${name === "Original" ? "72px" : "30px"};
        height:30px;
        border:${active ? "2px solid #111" : "1px solid rgba(0,0,0,0.2)"};
        background:${hex || "linear-gradient(45deg,#fff,#ddd)"};
      `;
      btn.onclick = () => setSelectedColor(i, cat, name);
      colorRow.appendChild(btn);
    });
    panel.appendChild(colorRow);

    updateButtonLabel();
  }

  dressBtn.onclick = () => {
    if (window._modeName === "shower") return;
    panel.style.display = panel.style.display === "none" ? "block" : "none";
    renderPanel();
  };

  // ---------- draw helper used by all pet modes ----------
  window.drawOutfitOverlay = function (ctx, state, x, y, w, h, petIndexParam) {
    if (window._modeName === "shower") return false;

    const i = typeof petIndexParam === "number" ? petIndexParam : petIndex();
    const catalog = getPetCatalog(i);
    const selected = window.selectedClothes?.[i] || {};
    const colors = window.clothingColors?.[i] || {};

    let drew = false;
    categoryKeys(i).forEach(cat => {
      const catData = catalog[cat];
      const itemId = selected[cat] ?? 0;
      if (itemId === 0) return;

      const item = catData?.items?.[itemId];
      const set = item?.set;
      if (!set) return;

      let img = set[state] || set.stand;
      if (!img || img._failed || (img.complete && img.naturalWidth === 0)) img = set.stand;

      const colorName = colors[cat] || DEFAULT_COLOR;
      const hex = COLOR_MAP[colorName] || null;
      const drawImg = hex ? tintedImage(img, hex) : img;
      if (safeDraw(ctx, drawImg, x, y, w, h)) drew = true;
    });

    return drew;
  };

  // ---------- shower compatibility ----------
  window.enterShowerClothesRules = function () {
    if (!Array.isArray(window._prevDressUpBeforeShower)) {
      window._prevDressUpBeforeShower = window.selectedClothes.map(p => ({ ...p }));
    }

    window.selectedClothes = window.selectedClothes.map(p => {
      const out = { ...p };
      Object.keys(out).forEach(cat => { out[cat] = 0; });
      return out;
    });

    syncLegacyOutfitFields();
    if (dressBtn) dressBtn.style.display = "none";
    if (panel) panel.style.display = "none";
    updateButtonLabel();
  };

  window.exitShowerClothesRules = function () {
    if (Array.isArray(window._prevDressUpBeforeShower)) {
      window.selectedClothes = window._prevDressUpBeforeShower.map(p => ({ ...p }));
      delete window._prevDressUpBeforeShower;
    }

    syncLegacyOutfitFields();
    if (dressBtn) dressBtn.style.display = "block";
    updateButtonLabel();
  };

  window.setActivePet = function (idx) {
    const n = Number(idx);
    if (!Number.isFinite(n)) return;
    window.activePetIndex = Math.max(0, Math.min(1, Math.floor(n)));
    renderPanel();
    updateButtonLabel();
  };

  renderPanel();
  updateButtonLabel();
})();
