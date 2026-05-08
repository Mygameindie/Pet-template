// ===========================================================
// 👕 outfit_system.js — Split-JSON Layered Dress-Up + Underwear
// Branch: 3
// Purpose: Toy-style separate underwear/clothes + color only
// No wind system. No toy system.
// ===========================================================
(() => {
  const DEFAULT_COLOR = "Original";
  const CATEGORY_INDEX_FILE = "dressup_categories.json";
  const DEFAULTS_FILE = "dressup_defaults.json";

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

  // Split JSON structure:
  // - dressup_categories.json controls category order, labels, z-index, and each category JSON filename.
  // - dressup_defaults.json controls the default selected item per pet.
  // - dressup_top.json, dressup_bottom.json, etc. contain only that category's items.
  //
  // Category JSON format:
  // {
  //   "0": [{ "id": "top1", "label": "Top 1", "prefix": "top1" }],
  //   "1": [{ "id": "top1_2", "label": "Top 1", "prefix": "top1_2" }]
  // }
  //
  // Each item prefix loads:
  //   {prefix}_stand.png, {prefix}_fall.png, {prefix}_fly0.png, {prefix}_fly1.png, {prefix}_sleep.png

  const FALLBACK_CATEGORY_DEFS = [
    { key: "topUnderwear", label: "Top Underwear", z: 60, file: "dressup_top_underwear.json" },
    { key: "bottomUnderwear", label: "Bottom Underwear / Boxers", z: 50, file: "dressup_bottom_underwear.json" },
    { key: "top", label: "Top", z: 120, file: "dressup_top.json" },
    { key: "bottom", label: "Pants / Skirt", z: 110, file: "dressup_bottom.json" },
    { key: "shoes", label: "Shoes", z: 90, file: "dressup_shoes.json" },
    { key: "hat", label: "Hat", z: 180, file: "dressup_hat.json" },
  ];

  function createImg(src) {
    const img = new Image();
    img._failed = false;
    img.onerror = () => { img._failed = true; };
    img.src = src;
    return img;
  }

  function loadLayer(prefix) {
    return {
      stand: createImg(`${prefix}_stand.png`),
      fall: createImg(`${prefix}_fall.png`),
      fly0: createImg(`${prefix}_fly0.png`),
      fly1: createImg(`${prefix}_fly1.png`),
      sleep: createImg(`${prefix}_sleep.png`),
    };
  }

  function makeItemFromJson(item) {
    const id = item.id || item.prefix;
    const prefix = item.prefix || item.id;
    if (!id || !prefix) return null;
    return { id, label: item.label || id, set: loadLayer(prefix) };
  }

  function emptyCategory(def) {
    return {
      label: def.label || def.key,
      z: Number.isFinite(Number(def.z)) ? Number(def.z) : 100,
      file: def.file || null,
      items: { 0: { id: 0, label: "None", set: null } },
    };
  }

  function buildFallbackCatalog() {
    const catalog = { 0: {}, 1: {} };
    const suffixes = ["", "_2"];

    for (let petIndex = 0; petIndex <= 1; petIndex++) {
      const suffix = suffixes[petIndex];
      FALLBACK_CATEGORY_DEFS.forEach(def => { catalog[petIndex][def.key] = emptyCategory(def); });

      catalog[petIndex].topUnderwear.items[`topunderwear1${suffix}`] = { id: `topunderwear1${suffix}`, label: "Top Underwear 1", set: loadLayer(`topunderwear1${suffix}`) };
      catalog[petIndex].bottomUnderwear.items[`bottomunderwear1${suffix}`] = { id: `bottomunderwear1${suffix}`, label: "Bottom Underwear 1", set: loadLayer(`bottomunderwear1${suffix}`) };
      catalog[petIndex].bottomUnderwear.items[`boxers1${suffix}`] = { id: `boxers1${suffix}`, label: "Boxers 1", set: loadLayer(`boxers1${suffix}`) };
      catalog[petIndex].top.items[`top1${suffix}`] = { id: `top1${suffix}`, label: "Top 1", set: loadLayer(`top1${suffix}`) };
      catalog[petIndex].bottom.items[`pants1${suffix}`] = { id: `pants1${suffix}`, label: "Pants 1", set: loadLayer(`pants1${suffix}`) };
      catalog[petIndex].bottom.items[`skirt1${suffix}`] = { id: `skirt1${suffix}`, label: "Skirt 1", set: loadLayer(`skirt1${suffix}`) };
      catalog[petIndex].shoes.items[`shoes1${suffix}`] = { id: `shoes1${suffix}`, label: "Shoes 1", set: loadLayer(`shoes1${suffix}`) };
      catalog[petIndex].hat.items[`hat1${suffix}`] = { id: `hat1${suffix}`, label: "Hat 1", set: loadLayer(`hat1${suffix}`) };
    }

    return {
      categoryDefs: FALLBACK_CATEGORY_DEFS,
      catalog,
      defaults: {
        0: { topUnderwear: "topunderwear1", bottomUnderwear: "bottomunderwear1", top: 0, bottom: 0, shoes: 0, hat: 0 },
        1: { topUnderwear: "topunderwear1_2", bottomUnderwear: "bottomunderwear1_2", top: 0, bottom: 0, shoes: 0, hat: 0 },
      },
    };
  }

  async function fetchJson(path, fallback) {
    try {
      const res = await fetch(`${path}?v=${Date.now()}`);
      if (!res.ok) throw new Error(path);
      return await res.json();
    } catch (err) {
      console.warn(`Could not load ${path}; using fallback.`, err);
      return fallback;
    }
  }

  function buildCatalogShell(categoryDefs) {
    const catalog = { 0: {}, 1: {} };
    [0, 1].forEach(petIndex => {
      categoryDefs.forEach(def => { catalog[petIndex][def.key] = emptyCategory(def); });
    });
    return catalog;
  }

  async function buildCatalogFromSplitJson() {
    const categoryDefsRaw = await fetchJson(CATEGORY_INDEX_FILE, FALLBACK_CATEGORY_DEFS);
    const categoryDefs = Array.isArray(categoryDefsRaw) && categoryDefsRaw.length
      ? categoryDefsRaw
      : FALLBACK_CATEGORY_DEFS;

    const defaults = await fetchJson(DEFAULTS_FILE, {});
    const catalog = buildCatalogShell(categoryDefs);

    await Promise.all(categoryDefs.map(async def => {
      if (!def.file) return;
      const data = await fetchJson(def.file, {});

      [0, 1].forEach(petIndex => {
        const list = data?.[petIndex] || data?.[String(petIndex)] || [];
        if (!Array.isArray(list)) return;

        list.forEach(raw => {
          const item = makeItemFromJson(raw);
          if (item) catalog[petIndex][def.key].items[item.id] = item;
        });
      });
    }));

    return { categoryDefs, catalog, defaults };
  }

  let config = buildFallbackCatalog();
  let CATEGORY_DEFS = config.categoryDefs;
  window.dressUpCatalog = config.catalog;

  if (typeof window.activePetIndex !== "number") window.activePetIndex = 0;

  function makeDefaultState(defaults) {
    return [0, 1].map(i => {
      const fromJson = defaults?.[i] || defaults?.[String(i)] || {};
      const out = {};
      CATEGORY_DEFS.forEach(def => { out[def.key] = fromJson[def.key] ?? 0; });
      return out;
    });
  }

  function makeDefaultColors() {
    return [0, 1].map(() => {
      const out = {};
      CATEGORY_DEFS.forEach(def => { out[def.key] = DEFAULT_COLOR; });
      return out;
    });
  }

  window.selectedClothes = window.selectedClothes || makeDefaultState(config.defaults);
  window.clothingColors = window.clothingColors || makeDefaultColors();
  window.currentOutfits = [0, 0];
  window.currentOutfit = 0;

  function normalizeStateAfterCatalogLoad() {
    const defaultState = makeDefaultState(config.defaults);
    const defaultColors = makeDefaultColors();

    [0, 1].forEach(i => {
      if (!window.selectedClothes[i]) window.selectedClothes[i] = {};
      if (!window.clothingColors[i]) window.clothingColors[i] = {};

      CATEGORY_DEFS.forEach(def => {
        const cat = def.key;
        if (typeof window.selectedClothes[i][cat] === "undefined") window.selectedClothes[i][cat] = defaultState[i][cat] ?? 0;
        if (typeof window.clothingColors[i][cat] === "undefined") window.clothingColors[i][cat] = defaultColors[i][cat] || DEFAULT_COLOR;
      });
    });
  }

  function activePet() {
    const n = Number(window.activePetIndex);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, Math.floor(n))) : 0;
  }

  function getCatalog(petIndex) {
    return window.dressUpCatalog?.[petIndex] || window.dressUpCatalog?.[0] || {};
  }

  function getCategoryKeys(petIndex) {
    const catalog = getCatalog(petIndex);
    return CATEGORY_DEFS.map(def => def.key).filter(cat => catalog[cat]);
  }

  function getItem(catData, id) {
    if (!catData || !catData.items) return null;
    return catData.items[id] || null;
  }

  function selectedItemFor(petIndex, category) {
    return window.selectedClothes?.[petIndex]?.[category] ?? 0;
  }

  function selectedColorFor(petIndex, category) {
    return window.clothingColors?.[petIndex]?.[category] || DEFAULT_COLOR;
  }

  function setSelectedItem(petIndex, category, itemId) {
    if (!window.selectedClothes[petIndex]) window.selectedClothes[petIndex] = {};
    window.selectedClothes[petIndex][category] = itemId;
    renderPanel();
    updateButtonLabel();
  }

  function setSelectedColor(petIndex, category, colorName) {
    if (!window.clothingColors[petIndex]) window.clothingColors[petIndex] = {};
    window.clothingColors[petIndex][category] = colorName;
    renderPanel();
    updateButtonLabel();
  }

  function safeDraw(ctx, img, x, y, w, h) {
    if (!img || img._failed || !img.complete || img.naturalWidth === 0) return false;
    ctx.drawImage(img, x, y, w, h);
    return true;
  }

  const tintCache = new Map();

  function hexToRgb(hex) {
    if (!hex) return null;
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return null;
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
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
      const imageData = ctx.getImageData(0, 0, cv.width, cv.height);
      const d = imageData.data;

      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        const lum = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
        const shade = Math.max(0.18, Math.min(1.25, lum * 1.35));
        d[i] = Math.min(255, rgb.r * shade);
        d[i + 1] = Math.min(255, rgb.g * shade);
        d[i + 2] = Math.min(255, rgb.b * shade);
      }

      ctx.putImageData(imageData, 0, 0);
    } catch (_) {
      return img;
    }

    const out = new Image();
    out.src = cv.toDataURL("image/png");
    tintCache.set(key, out);
    return out;
  }

  let selectedCategory = "topUnderwear";

  function makeButton(text, className) {
    const btn = document.createElement("button");
    btn.textContent = text;
    if (className) btn.className = className;
    return btn;
  }

  const commonBtnCss = `
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
    panel.style.cssText = `
      position: fixed;
      right: 10px;
      bottom: calc(108px + env(safe-area-inset-bottom));
      width: min(360px, calc(100vw - 20px));
      max-height: 54vh;
      overflow: auto;
      display: none;
      z-index: 9999;
      padding: 10px;
      border-radius: 12px;
      background: rgba(255,255,255,0.95);
      box-shadow: 0 6px 24px rgba(0,0,0,0.22);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    `;
    document.body.appendChild(panel);
  }

  function updateButtonLabel() {
    const i = activePet();
    const chosen = getCategoryKeys(i)
      .map(cat => selectedItemFor(i, cat))
      .filter(id => id !== 0 && id !== "0").length;
    dressBtn.textContent = `Dress Up (Pet ${i + 1}: ${chosen} item${chosen === 1 ? "" : "s"})`;
  }

  function renderPanel() {
    const i = activePet();
    const catalog = getCatalog(i);
    const cats = getCategoryKeys(i);
    if (!cats.includes(selectedCategory)) selectedCategory = cats[0] || "topUnderwear";

    panel.innerHTML = "";

    const title = document.createElement("div");
    title.style.cssText = "font-weight:700;margin-bottom:8px;display:flex;justify-content:space-between;gap:8px;align-items:center;";
    title.innerHTML = `<span>Pet ${i + 1} Dress Up</span>`;
    const close = makeButton("✕");
    close.style.cssText = commonBtnCss + "padding:4px 8px;";
    close.onclick = () => { panel.style.display = "none"; };
    title.appendChild(close);
    panel.appendChild(title);

    const catRow = document.createElement("div");
    catRow.style.cssText = "display:flex;overflow-x:auto;padding-bottom:4px;margin-bottom:8px;";
    cats.forEach(cat => {
      const btn = makeButton(catalog[cat].label || cat);
      btn.style.cssText = commonBtnCss + (cat === selectedCategory ? "background:rgba(0,0,0,0.22);font-weight:700;" : "");
      btn.onclick = () => { selectedCategory = cat; renderPanel(); };
      catRow.appendChild(btn);
    });
    panel.appendChild(catRow);

    const cat = selectedCategory;
    const catData = catalog[cat];
    if (!catData) return;

    const itemTitle = document.createElement("div");
    itemTitle.textContent = "Item";
    itemTitle.style.cssText = "font-weight:600;margin:8px 0 4px;";
    panel.appendChild(itemTitle);

    const itemRow = document.createElement("div");
    itemRow.style.cssText = "display:flex;flex-wrap:wrap;gap:2px;margin-bottom:8px;";
    Object.entries(catData.items || {}).forEach(([id, item]) => {
      const active = String(selectedItemFor(i, cat)) === String(id);
      const btn = makeButton(item.label || String(id));
      btn.style.cssText = commonBtnCss + (active ? "background:rgba(0,0,0,0.22);font-weight:700;" : "");
      btn.onclick = () => setSelectedItem(i, cat, id === "0" ? 0 : id);
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
      btn.style.cssText = commonBtnCss + `
        min-width:${name === "Original" ? "72px" : "30px"};
        height:30px;
        border:${active ? "2px solid #111" : "1px solid rgba(0,0,0,0.2)"};
        background:${hex || "linear-gradient(45deg,#fff,#ddd)"};
      `;
      btn.onclick = () => setSelectedColor(i, cat, name);
      colorRow.appendChild(btn);
    });
    panel.appendChild(colorRow);

    const note = document.createElement("div");
    note.textContent = "Add items in each dressup_*.json file. Use None to remove underwear or clothing.";
    note.style.cssText = "font-size:11px;opacity:0.65;margin-top:8px;";
    panel.appendChild(note);

    updateButtonLabel();
  }

  dressBtn.onclick = () => {
    if (window._modeName === "shower") return;
    panel.style.display = panel.style.display === "none" ? "block" : "none";
    renderPanel();
  };

  window.drawOutfitOverlay = function (ctx, state, x, y, w, h, petIndexParam) {
    if (window._modeName === "shower") return false;

    const i = typeof petIndexParam === "number" ? petIndexParam : activePet();
    const catalog = getCatalog(i);
    const selected = window.selectedClothes?.[i] || {};
    const colors = window.clothingColors?.[i] || {};
    let drew = false;

    getCategoryKeys(i)
      .sort((a, b) => (catalog[a].z || 0) - (catalog[b].z || 0))
      .forEach(cat => {
        const id = selected[cat] ?? 0;
        if (id === 0 || id === "0") return;

        const item = getItem(catalog[cat], id);
        if (!item || !item.set) return;

        let img = item.set[state] || item.set.stand;
        if (!img || img._failed || (img.complete && img.naturalWidth === 0)) img = item.set.stand;
        if (!img || img._failed) return;

        const colorName = colors[cat] || DEFAULT_COLOR;
        const hex = COLOR_MAP[colorName] || null;
        const drawImg = hex ? tintedImage(img, hex) : img;
        if (safeDraw(ctx, drawImg, x, y, w, h)) drew = true;
      });

    return drew;
  };

  window.enterShowerClothesRules = function () {
    if (!Array.isArray(window._prevDressUpBeforeShower)) {
      window._prevDressUpBeforeShower = window.selectedClothes.map(p => ({ ...p }));
    }

    window.selectedClothes = window.selectedClothes.map(p => {
      const next = { ...p };
      Object.keys(next).forEach(cat => { next[cat] = 0; });
      return next;
    });

    if (dressBtn) dressBtn.style.display = "none";
    if (panel) panel.style.display = "none";
    updateButtonLabel();
  };

  window.exitShowerClothesRules = function () {
    if (Array.isArray(window._prevDressUpBeforeShower)) {
      window.selectedClothes = window._prevDressUpBeforeShower.map(p => ({ ...p }));
      delete window._prevDressUpBeforeShower;
    }

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

  async function loadSplitJsonCatalog() {
    try {
      config = await buildCatalogFromSplitJson();
      CATEGORY_DEFS = config.categoryDefs;
      window.dressUpCatalog = config.catalog;
      normalizeStateAfterCatalogLoad();
      if (!getCategoryKeys(activePet()).includes(selectedCategory)) {
        selectedCategory = getCategoryKeys(activePet())[0] || "topUnderwear";
      }
      renderPanel();
      updateButtonLabel();
    } catch (err) {
      console.warn("Using fallback dress-up catalog:", err);
      normalizeStateAfterCatalogLoad();
      renderPanel();
      updateButtonLabel();
    }
  }

  normalizeStateAfterCatalogLoad();
  renderPanel();
  updateButtonLabel();
  loadSplitJsonCatalog();
})();
