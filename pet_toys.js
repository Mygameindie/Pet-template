// ===== PET TEMPLATE + TOY3 TOY SYSTEM =====
// Adds Toy3-style draggable toys to the Pet-template canvas game.
// Toys are loaded from toys.json. Click the 🧸 Toys button, spawn a toy,
// drag it onto a pet, and the pet gets a small play/happiness boost.

(() => {
  const DEFAULT_TOYS = [
    { id: 'toy_1', src: 'toy_1.png', alt: 'Toy 1' },
  ];

  let toyIdCounter = 0;
  let toyTopZ = 9500;
  const colliding = new Set();

  function getPointer(e) {
    const p = e.touches ? e.touches[0] : e;
    return { x: p.clientX, y: p.clientY };
  }

  function makeButton(text, title) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.title = title || text;
    return btn;
  }

  function resolveToySrc(item) {
    const src = item.src || item.id || 'toy_1.png';
    if (/^(https?:)?\/\//i.test(src) || /^(data:|blob:)/i.test(src)) return src;
    if (src.includes('/')) return src;
    return src;
  }

  // Analog of Toy3's setGenital(num, on): hold the pet's toy-touched image
  // while a toy overlaps it, revert when the toy leaves.
  function setPetToy(index, on) {
    try {
      if (typeof window.setPetToyState === 'function') {
        window.setPetToyState(index, on);
      }
    } catch (_) {}
  }

  // Rect-overlap test (like Toy3) between the toy and each pet's belly hotspot
  // — a sub-region of the body, mirroring Toy3's belly/genital button.
  function petHitIndex(toy) {
    const pose = typeof window.getPetPose === 'function' ? window.getPetPose() : null;
    if (!pose || !Array.isArray(pose.pets)) return -1;

    const canvasRect = pose.canvasRect || document.getElementById('canvas')?.getBoundingClientRect();
    if (!canvasRect) return -1;

    const r = toy.getBoundingClientRect();
    const tl = r.left - canvasRect.left;
    const tr = r.right - canvasRect.left;
    const tt = r.top - canvasRect.top;
    const tb = r.bottom - canvasRect.top;

    for (let i = pose.pets.length - 1; i >= 0; i--) {
      const p = pose.pets[i];
      // Belly hotspot: centered horizontally, around the lower-middle of the body.
      const bw = p.w * 0.38;
      const bh = p.h * 0.30;
      const left = p.x - bw / 2;
      const right = p.x + bw / 2;
      const top = p.y + p.h * 0.10 - bh / 2;
      const bottom = p.y + p.h * 0.10 + bh / 2;

      const overlapping = !(tr < left || tl > right || tb < top || tt > bottom);
      if (overlapping) return i;
    }
    return -1;
  }

  function checkToyCollision(toy) {
    const hit = petHitIndex(toy);
    const tid = toy.dataset.toyId;

    // Enter: toy now overlaps pet `hit` → activate toy-touched state.
    if (hit >= 0) {
      const key = `${tid}-${hit}`;
      if (!colliding.has(key)) {
        colliding.add(key);
        setPetToy(hit, true);
        toy.classList.add('toy-touched');
        setTimeout(() => toy.classList.remove('toy-touched'), 400);
      }
    }

    // Exit: any pet this toy was touching but no longer is → revert.
    [...colliding].forEach(key => {
      if (!key.startsWith(`${tid}-`)) return;
      const n = Number(key.split('-')[1]);
      if (n !== hit) {
        colliding.delete(key);
        setPetToy(n, false);
      }
    });
  }

  function clearToyCollisions(toy) {
    const tid = toy.dataset.toyId;
    [...colliding].forEach(key => {
      if (key.startsWith(`${tid}-`)) {
        colliding.delete(key);
        setPetToy(Number(key.split('-')[1]), false);
      }
    });
  }

  function makeToyDraggable(toy) {
    let sx = 0, sy = 0, ox = 0, oy = 0;

    function pointerDown(e) {
      e.preventDefault();
      e.stopPropagation();
      const p = getPointer(e);
      sx = p.x;
      sy = p.y;
      ox = toy.offsetLeft;
      oy = toy.offsetTop;
      toy.style.zIndex = ++toyTopZ;
      toy.classList.add('toy-dragging');
      window.addEventListener('mousemove', pointerMove, { passive: false });
      window.addEventListener('mouseup', pointerUp);
      window.addEventListener('touchmove', pointerMove, { passive: false });
      window.addEventListener('touchend', pointerUp);
    }

    function pointerMove(e) {
      e.preventDefault();
      const p = getPointer(e);
      toy.style.left = `${ox + p.x - sx}px`;
      toy.style.top = `${oy + p.y - sy}px`;
      checkToyCollision(toy);
    }

    function pointerUp() {
      toy.classList.remove('toy-dragging');
      window.removeEventListener('mousemove', pointerMove);
      window.removeEventListener('mouseup', pointerUp);
      window.removeEventListener('touchmove', pointerMove);
      window.removeEventListener('touchend', pointerUp);
    }

    toy.addEventListener('mousedown', pointerDown);
    toy.addEventListener('touchstart', pointerDown, { passive: false });
    toy.addEventListener('dragstart', e => e.preventDefault());

    let lastTap = 0;
    toy.addEventListener('dblclick', () => { clearToyCollisions(toy); toy.remove(); });
    toy.addEventListener('touchend', () => {
      const now = Date.now();
      if (now - lastTap < 350) {
        clearToyCollisions(toy);
        toy.remove();
      }
      lastTap = now;
    });
  }

  function spawnToy(item) {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;

    const r = canvas.getBoundingClientRect();
    const toy = document.createElement('img');
    toy.className = 'toy-item';
    toy.src = resolveToySrc(item);
    toy.alt = item.alt || item.id || 'toy';
    toy.draggable = false;
    toy.dataset.toyId = String(++toyIdCounter);
    toy.style.left = `${r.left + r.width * (0.20 + Math.random() * 0.45)}px`;
    toy.style.top = `${r.top + r.height * (0.15 + Math.random() * 0.35)}px`;

    document.body.appendChild(toy);
    makeToyDraggable(toy);
  }

  async function loadToyData() {
    try {
      const res = await fetch(`toys.json?v=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length) return data;
      }
    } catch (_) {}
    return DEFAULT_TOYS;
  }

  async function initToys() {
    const modeMenu = document.getElementById('mode-menu');
    if (!modeMenu || document.getElementById('toy-button')) return;

    const toys = await loadToyData();

    const panel = document.createElement('div');
    panel.id = 'toy-panel';
    panel.className = 'toy-panel';

    toys.forEach(item => {
      const btn = makeButton('', item.alt || item.id || 'Toy');
      btn.className = 'toy-spawn-btn';
      const thumb = document.createElement('img');
      thumb.src = resolveToySrc(item);
      thumb.alt = item.alt || item.id || 'Toy';
      thumb.draggable = false;
      thumb.onerror = () => { btn.textContent = '🧸'; thumb.remove(); };
      btn.appendChild(thumb);
      btn.addEventListener('click', e => {
        e.stopPropagation();
        spawnToy(item);
        panel.style.display = 'none';
        toggleBtn.classList.remove('active');
      });
      panel.appendChild(btn);
    });

    const toggleBtn = makeButton('🧸 Toys', 'Toys');
    toggleBtn.id = 'toy-button';
    toggleBtn.addEventListener('click', e => {
      e.stopPropagation();
      const visible = panel.style.display === 'flex';
      panel.style.display = visible ? 'none' : 'flex';
      toggleBtn.classList.toggle('active', !visible);
    });

    document.body.appendChild(panel);
    modeMenu.appendChild(toggleBtn);

    document.addEventListener('click', e => {
      if (!panel.contains(e.target) && e.target !== toggleBtn) {
        panel.style.display = 'none';
        toggleBtn.classList.remove('active');
      }
    }, true);
  }

  document.addEventListener('DOMContentLoaded', initToys);
})();
