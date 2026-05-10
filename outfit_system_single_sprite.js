// Split-JSON dress-up system. One image per item: {prefix}.png
// Branch 3 logic:
// - Pet 1 is girl: top underwear + bottom underwear, or one-piece underwear.
// - Pet 2 is boy: bottom underwear / boxers only.
// - Girl one-piece clears top/bottom underwear.
// - Girl top/bottom underwear clears one-piece and auto-pairs the matching set number.
// - Dress clears top + bottom; top or bottom clears dress.
(() => {
  const CAT_FILE = "dressup_categories.json";
  const DEFAULT_FILE = "dressup_defaults.json";
  const DEFAULT_COLOR = "Original";
  const COLORS = {
    Original: null,
    Red: "#ff3b30", Orange: "#ff9500", Yellow: "#ffcc00",
    Green: "#34c759", Cyan: "#32ade6", Blue: "#007aff",
    Purple: "#af52de", Pink: "#ff2d55",
  };

  const FALLBACK_CATS = [
    { key: "topUnderwear", label: "Top Underwear", z: 60, file: "dressup_top_underwear.json" },
    { key: "bottomUnderwear", label: "Bottom Underwear / Boxers", z: 50, file: "dressup_bottom_underwear.json" },
    { key: "onepieceUnderwear", label: "One-Piece Underwear", z: 65, file: "dressup_onepiece_underwear.json" },
    { key: "top", label: "Top", z: 120, file: "dressup_top.json" },
    { key: "bottom", label: "Pants / Skirt", z: 110, file: "dressup_bottom.json" },
    { key: "dress", label: "Dress", z: 130, file: "dressup_dress.json" },
    { key: "shoes", label: "Shoes", z: 90, file: "dressup_shoes.json" },
    { key: "hat", label: "Hat", z: 180, file: "dressup_hat.json" },
  ];

  function img(src) {
    const im = new Image();
    im._failed = false;
    im.onerror = () => { im._failed = true; };
    im.src = src;
    return im;
  }

  function itemFrom(raw) {
    const id = raw.id || raw.prefix;
    const prefix = raw.prefix || raw.id;
    if (!id || !prefix) return null;
    return { id, label: raw.label || id, img: img(`${prefix}.png`) };
  }

  function emptyCat(def) {
    return {
      label: def.label || def.key,
      z: Number(def.z) || 100,
      items: { 0: { id: 0, label: "None", img: null } },
    };
  }

  async function getJson(file, fallback) {
    try {
      const r = await fetch(`${file}?v=${Date.now()}`);
      if (!r.ok) throw new Error(file);
      return await r.json();
    } catch (e) {
      console.warn("Dress-up JSON fallback:", file, e);
      return fallback;
    }
  }

  function fallbackDefaults() {
    return {
      0: { topUnderwear: "topunderwear1", bottomUnderwear: "bottomunderwear1", onepieceUnderwear: 0, top: 0, bottom: 0, dress: 0, shoes: 0, hat: 0 },
      1: { topUnderwear: 0, bottomUnderwear: "bottomunderwear1_2", onepieceUnderwear: 0, top: 0, bottom: 0, dress: 0, shoes: 0, hat: 0 },
    };
  }

  function fallbackCatalog(cats) {
    const catalog = { 0: {}, 1: {} };
    [0, 1].forEach(p => cats.forEach(c => catalog[p][c.key] = emptyCat(c)));
    const add = (p, cat, id, label) => {
      if (!catalog[p][cat]) return;
      catalog[p][cat].items[id] = { id, label, img: img(`${id}.png`) };
    };
    add(0, "topUnderwear", "topunderwear1", "Top Underwear 1");
    add(0, "bottomUnderwear", "bottomunderwear1", "Bottom Underwear 1");
    add(0, "onepieceUnderwear", "onepieceunderwear1", "One-Piece Underwear 1");
    add(0, "top", "top1", "Top 1");
    add(0, "bottom", "pants1", "Pants 1");
    add(0, "bottom", "skirt1", "Skirt 1");
    add(0, "dress", "dress1", "Dress 1");
    add(0, "shoes", "shoes1", "Shoes 1");
    add(0, "hat", "hat1", "Hat 1");
    add(1, "bottomUnderwear", "bottomunderwear1_2", "Bottom Underwear 1");
    add(1, "bottomUnderwear", "boxers1_2", "Boxers 1");
    add(1, "top", "top1_2", "Top 1");
    add(1, "bottom", "pants1_2", "Pants 1");
    add(1, "bottom", "skirt1_2", "Skirt 1");
    add(1, "dress", "dress1_2", "Dress 1");
    add(1, "shoes", "shoes1_2", "Shoes 1");
    add(1, "hat", "hat1_2", "Hat 1");
    return catalog;
  }

  let cats = FALLBACK_CATS;
  let defaults = fallbackDefaults();
  window.dressUpCatalog = fallbackCatalog(cats);
  if (typeof window.activePetIndex !== "number") window.activePetIndex = 0;

  function makeSelected() {
    return [0, 1].map(p => {
      const d = defaults[p] || defaults[String(p)] || {};
      const o = {};
      cats.forEach(c => o[c.key] = d[c.key] ?? 0);
      return o;
    });
  }

  function makeColors() {
    return [0, 1].map(() => {
      const o = {};
      cats.forEach(c => o[c.key] = DEFAULT_COLOR);
      return o;
    });
  }

  window.selectedClothes = window.selectedClothes || makeSelected();
  window.clothingColors = window.clothingColors || makeColors();
  window.currentOutfits = [0, 0];
  window.currentOutfit = 0;

  function activePet() {
    const n = Number(window.activePetIndex);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, Math.floor(n))) : 0;
  }

  function catKeys(p = activePet()) {
  const catalog = window.dressUpCatalog[p] || window.dressUpCatalog[0] || {};

  return cats
    .map(c => c.key)
    .filter(k => {
      if (!catalog[k]) return false;

      // Remove these categories only for base_2 / Pet 2
      if (p === 1 && (k === "topUnderwear" || k === "onepieceUnderwear")) {
        return false;
      }

      return true;
    });
}

  function normalizeState() {
    const sel = makeSelected();
    const cols = makeColors();
    [0, 1].forEach(p => {
      window.selectedClothes[p] = window.selectedClothes[p] || {};
      window.clothingColors[p] = window.clothingColors[p] || {};
      cats.forEach(c => {
        if (window.selectedClothes[p][c.key] === undefined) window.selectedClothes[p][c.key] = sel[p][c.key] ?? 0;
        if (window.clothingColors[p][c.key] === undefined) window.clothingColors[p][c.key] = cols[p][c.key];
      });
    });
  }

  async function loadCatalog() {
    cats = await getJson(CAT_FILE, FALLBACK_CATS);
    if (!Array.isArray(cats) || !cats.length) cats = FALLBACK_CATS;
    defaults = await getJson(DEFAULT_FILE, fallbackDefaults());

    const catalog = { 0: {}, 1: {} };
    [0, 1].forEach(p => cats.forEach(c => catalog[p][c.key] = emptyCat(c)));

    await Promise.all(cats.map(async c => {
      if (!c.file) return;
      const data = await getJson(c.file, {});
      [0, 1].forEach(p => {
        const list = data[p] || data[String(p)] || [];
        if (!Array.isArray(list)) return;
        list.forEach(raw => {
          const it = itemFrom(raw);
          if (it) catalog[p][c.key].items[it.id] = it;
        });
      });
    }));

    window.dressUpCatalog = catalog;
    normalizeState();
    if (!catKeys().includes(selectedCategory)) selectedCategory = catKeys()[0] || "topUnderwear";
    renderPanel();
    updateButtonLabel();
  }

  function setNumberFromId(id) {
    const m = String(id || "").match(/(\d+)(?:_\d+)?$/);
    return m ? m[1] : null;
  }

  function findItemBySetNumber(p, category, n) {
    if (!n) return 0;
    const items = window.dressUpCatalog[p]?.[category]?.items || {};
    const entries = Object.keys(items).filter(id => id !== "0");
    return entries.find(id => setNumberFromId(id) === String(n)) || 0;
  }

  function applyUnderwearRules(p, category, id) {
    // Girl-only underwear pairing rules. Pet index 0 = pet1/girl.
    if (p !== 0) return;
    if (id === 0 || id === "0") return;

    if (category === "onepieceUnderwear") {
      window.selectedClothes[p].topUnderwear = 0;
      window.selectedClothes[p].bottomUnderwear = 0;
      return;
    }

    if (category === "topUnderwear" || category === "bottomUnderwear") {
      const n = setNumberFromId(id);
      window.selectedClothes[p].onepieceUnderwear = 0;

      const topMatch = findItemBySetNumber(p, "topUnderwear", n);
      const bottomMatch = findItemBySetNumber(p, "bottomUnderwear", n);

      if (topMatch) window.selectedClothes[p].topUnderwear = topMatch;
      if (bottomMatch) window.selectedClothes[p].bottomUnderwear = bottomMatch;
    }
  }

  function applyDressRules(p, category, id) {
    if (id === 0 || id === "0") return;

    if (category === "dress") {
      window.selectedClothes[p].top = 0;
      window.selectedClothes[p].bottom = 0;
      return;
    }

    if (category === "top" || category === "bottom") {
      window.selectedClothes[p].dress = 0;
    }
  }

  function applyClothingRules(p, category, id) {
    applyUnderwearRules(p, category, id);
    applyDressRules(p, category, id);
  }

  const tintCache = new Map();
  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
  }

  function tintedImage(source, hex) {
    if (!hex || !source || source._failed || !source.complete || !source.naturalWidth) return source;
    const key = `${source.src}|${hex}`;
    if (tintCache.has(key)) return tintCache.get(key);
    const rgb = hexToRgb(hex);
    if (!rgb) return source;

    const cv = document.createElement("canvas");
    cv.width = source.naturalWidth;
    cv.height = source.naturalHeight;
    const cx = cv.getContext("2d", { willReadFrequently: true });
    try {
      cx.drawImage(source, 0, 0);
      const imageData = cx.getImageData(0, 0, cv.width, cv.height);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        const lum = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
        const shade = Math.max(0.18, Math.min(1.25, lum * 1.35));
        d[i] = Math.min(255, rgb.r * shade);
        d[i + 1] = Math.min(255, rgb.g * shade);
        d[i + 2] = Math.min(255, rgb.b * shade);
      }
      cx.putImageData(imageData, 0, 0);
    } catch (_) {
      return source;
    }
    const out = new Image();
    out.src = cv.toDataURL("image/png");
    tintCache.set(key, out);
    return out;
  }

  function safeDraw(ctx, image, x, y, w, h) {
    if (!image || image._failed || !image.complete || !image.naturalWidth) return false;
    ctx.drawImage(image, x, y, w, h);
    return true;
  }

  let selectedCategory = "topUnderwear";
  const btnCss = "border:0;border-radius:9px;padding:7px 10px;margin:3px;background:rgba(0,0,0,.08);cursor:pointer;font-size:13px;white-space:nowrap;";

  function btn(text) {
    const b = document.createElement("button");
    b.textContent = text;
    b.style.cssText = btnCss;
    return b;
  }

  let dressBtn = document.getElementById("dressup-btn");
  if (!dressBtn) {
    dressBtn = document.createElement("button");
    dressBtn.id = "dressup-btn";
    dressBtn.style.cssText = "position:fixed;right:10px;bottom:calc(65px + env(safe-area-inset-bottom));z-index:9998;padding:6px 12px;font-size:clamp(11px,2.5vw,14px);cursor:pointer;border-radius:8px;border:none;background:rgba(255,255,255,.92);box-shadow:0 2px 8px rgba(0,0,0,.15);white-space:nowrap;";
    document.body.appendChild(dressBtn);
  }
  window.clothesBtn = dressBtn;

  let panel = document.getElementById("dressup-panel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "dressup-panel";
    panel.style.cssText = "position:fixed;right:10px;bottom:calc(108px + env(safe-area-inset-bottom));width:min(360px,calc(100vw - 20px));max-height:54vh;overflow:auto;display:none;z-index:9999;padding:10px;border-radius:12px;background:rgba(255,255,255,.95);box-shadow:0 6px 24px rgba(0,0,0,.22);font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;";
    document.body.appendChild(panel);
  }

  function updateButtonLabel() {
    const p = activePet();
    const count = catKeys(p).map(k => window.selectedClothes[p]?.[k]).filter(v => v !== 0 && v !== "0").length;
    dressBtn.textContent = `Dress Up (Pet ${p + 1}: ${count} item${count === 1 ? "" : "s"})`;
  }

  function renderPanel() {
    const p = activePet();
    const catalog = window.dressUpCatalog[p] || window.dressUpCatalog[0] || {};
    const keys = catKeys(p);
    if (!keys.includes(selectedCategory)) selectedCategory = keys[0] || "topUnderwear";
    panel.innerHTML = "";

    const title = document.createElement("div");
    title.style.cssText = "font-weight:700;margin-bottom:8px;display:flex;justify-content:space-between;gap:8px;align-items:center;";
    title.innerHTML = `<span>Pet ${p + 1} Dress Up</span>`;
    const close = btn("✕");
    close.style.padding = "4px 8px";
    close.onclick = () => panel.style.display = "none";
    title.appendChild(close);
    panel.appendChild(title);

    const row = document.createElement("div");
    row.style.cssText = "display:flex;overflow-x:auto;padding-bottom:4px;margin-bottom:8px;";
    keys.forEach(k => {
      const b = btn(catalog[k].label || k);
      if (k === selectedCategory) b.style.cssText += "background:rgba(0,0,0,.22);font-weight:700;";
      b.onclick = () => { selectedCategory = k; renderPanel(); };
      row.appendChild(b);
    });
    panel.appendChild(row);

    const cat = catalog[selectedCategory];
    if (!cat) return;

    const itemTitle = document.createElement("div");
    itemTitle.textContent = "Item";
    itemTitle.style.cssText = "font-weight:600;margin:8px 0 4px;";
    panel.appendChild(itemTitle);

    const items = document.createElement("div");
    items.style.cssText = "display:flex;flex-wrap:wrap;gap:2px;margin-bottom:8px;";
    Object.entries(cat.items || {}).forEach(([id, it]) => {
      const active = String(window.selectedClothes[p]?.[selectedCategory]) === String(id);
      const b = btn(it.label || String(id));
      if (active) b.style.cssText += "background:rgba(0,0,0,.22);font-weight:700;";
      b.onclick = () => {
        window.selectedClothes[p][selectedCategory] = id === "0" ? 0 : id;
        applyClothingRules(p, selectedCategory, window.selectedClothes[p][selectedCategory]);
        renderPanel();
        updateButtonLabel();
      };
      items.appendChild(b);
    });
    panel.appendChild(items);

    const colorTitle = document.createElement("div");
    colorTitle.textContent = "Color";
    colorTitle.style.cssText = "font-weight:600;margin:8px 0 4px;";
    panel.appendChild(colorTitle);

    const colorRow = document.createElement("div");
    colorRow.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;";
    Object.entries(COLORS).forEach(([name, hex]) => {
      const active = (window.clothingColors[p]?.[selectedCategory] || DEFAULT_COLOR) === name;
      const b = btn(name === DEFAULT_COLOR ? DEFAULT_COLOR : "");
      b.title = name;
      b.style.cssText += `min-width:${name === DEFAULT_COLOR ? "72px" : "30px"};height:30px;border:${active ? "2px solid #111" : "1px solid rgba(0,0,0,.2)"};background:${hex || "linear-gradient(45deg,#fff,#ddd)"};`;
      b.onclick = () => {
        window.clothingColors[p][selectedCategory] = name;
        renderPanel();
      };
      colorRow.appendChild(b);
    });
    panel.appendChild(colorRow);

    const note = document.createElement("div");
    note.textContent = "Girl: one-piece clears top/bottom underwear; choosing top/bottom auto-pairs the matching set number. Dress clears top + pants/skirt; choosing top or pants/skirt clears dress.";
    note.style.cssText = "font-size:11px;opacity:.65;margin-top:8px;";
    panel.appendChild(note);
    updateButtonLabel();
  }

  dressBtn.onclick = () => {
    if (window._modeName === "shower") return;
    panel.style.display = panel.style.display === "none" ? "block" : "none";
    renderPanel();
  };

  window.drawOutfitOverlay = function (ctx, state, x, y, w, h, petIndex) {
    if (window._modeName === "shower") return false;
    const p = typeof petIndex === "number" ? petIndex : activePet();
    const catalog = window.dressUpCatalog[p] || window.dressUpCatalog[0] || {};
    let drew = false;
    catKeys(p).sort((a, b) => (catalog[a].z || 0) - (catalog[b].z || 0)).forEach(k => {
      const id = window.selectedClothes[p]?.[k] ?? 0;
      if (id === 0 || id === "0") return;
      const it = catalog[k]?.items?.[id];
      if (!it || !it.img || it.img._failed) return;
      const hex = COLORS[window.clothingColors[p]?.[k] || DEFAULT_COLOR] || null;
      const drawImg = hex ? tintedImage(it.img, hex) : it.img;
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
      Object.keys(next).forEach(k => next[k] = 0);
      return next;
    });
    dressBtn.style.display = "none";
    panel.style.display = "none";
    updateButtonLabel();
  };

  window.exitShowerClothesRules = function () {
    if (Array.isArray(window._prevDressUpBeforeShower)) {
      window.selectedClothes = window._prevDressUpBeforeShower.map(p => ({ ...p }));
      delete window._prevDressUpBeforeShower;
    }
    dressBtn.style.display = "block";
    updateButtonLabel();
  };

  window.setActivePet = function (idx) {
    const n = Number(idx);
    if (!Number.isFinite(n)) return;
    window.activePetIndex = Math.max(0, Math.min(1, Math.floor(n)));
    renderPanel();
    updateButtonLabel();
  };

  normalizeState();
  renderPanel();
  updateButtonLabel();
  loadCatalog();
})();
