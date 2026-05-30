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

  function safePetBoost(index) {
    try {
      if (window.PetStats && typeof window.PetStats.play === 'function') {
        window.PetStats.play(index);
      }
    } catch (_) {}
  }

  function petHitIndex(toy) {
    const pose = typeof window.getPetPose === 'function' ? window.getPetPose() : null;
    if (!pose || !Array.isArray(pose.pets)) return -1;

    const r = toy.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const canvasRect = pose.canvasRect || document.getElementById('canvas')?.getBoundingClientRect();
    if (!canvasRect) return -1;

    const x = cx - canvasRect.left;
    const y = cy - canvasRect.top;

    for (let i = pose.pets.length - 1; i >= 0; i--) {
      const p = pose.pets[i];
      if (
        x >= p.x - p.w / 2 &&
        x <= p.x + p.w / 2 &&
        y >= p.y - p.h / 2 &&
        y <= p.y + p.h / 2
      ) {
        return i;
      }
    }
    return -1;
  }

  function checkToyCollision(toy) {
    const hit = petHitIndex(toy);
    const tid = toy.dataset.toyId;

    if (hit >= 0) {
      const key = `${tid}-${hit}`;
      if (!colliding.has(key)) {
        colliding.add(key);
        safePetBoost(hit);
        toy.classList.add('toy-touched');
        setTimeout(() => toy.classList.remove('toy-touched'), 400);
      }
    }

    [...colliding].forEach(key => {
      if (!key.startsWith(`${tid}-`)) return;
      const n = Number(key.split('-')[1]);
      if (n !== hit) colliding.delete(key);
    });
  }

  function clearToyCollisions(toy) {
    const tid = toy.dataset.toyId;
    [...colliding].forEach(key => {
      if (key.startsWith(`${tid}-`)) colliding.delete(key);
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
