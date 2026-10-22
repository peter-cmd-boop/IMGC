// IMGC Radial Menu — Lógica de interação completa (Imagem, Vídeo, Áudio)
// Design: Utilitária Técnica — sem emojis, traço fino 1.4px, navegação ágil
'use strict';

let activeCategory = 'image'; // 'image' | 'video' | 'audio'
let activeMode = 'formats';    // 'formats' | 'tools'
let hoveredSliceIndex = -1;
let currentDraggedPath = '';

// Dimensões do wheel
const CENTER_X     = 250;
const CENTER_Y     = 250;
const INNER_RADIUS = 84;
const OUTER_RADIUS = 218;

// ── Tokens de cor (espelha o CSS) ──────────────────────────────
const CLR = {
  surface:     '#151619',
  surfaceH:    '#1b1d1f',   // hover base
  surfaceToolH:'#1a1b14',   // hover tools (âmbar sutil)
  border:      'rgba(232,229,220,0.11)',
  borderH:     'rgba(232,229,220,0.28)',
  borderToolH: 'rgba(232,197,71,0.35)',
  text:        '#e8e5dc',
  textMute:    '#6b6d6a',
  accent:      '#e8c547',
  accentDark:  '#b89b2e',
};

// ── Ícones SVG lineares geométricos (viewBox 0 0 24 24, stroke 1.4px) ─
const ICONS = {
  // ── IMAGEM ─────────────────────────────────────────────
  webp:  `<path d="M4 4h11l5 5v11H4V4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M15 4v5h5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M7 13l3-4 3 5 2-2 2 3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>`,
  jpg:   `<rect x="3" y="3" width="18" height="18" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M7 14l4-6 3 4 2-2 2 4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>`,
  png:   `<rect x="3" y="3" width="18" height="18" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M7 14l3-5 3 4 2-2 2 3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>`,
  ico:   `<rect x="3" y="3" width="18" height="18" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="8" y="8" width="8" height="8" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.3"/>`,
  avif:  `<path d="M12 3L3 20h18L12 3z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><line x1="12" y1="10" x2="12" y2="15" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="17.5" r="0.8" fill="currentColor"/>`,
  tiff:  `<rect x="3" y="5" width="18" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" stroke-width="1.1"/><line x1="8" y1="5" x2="8" y2="9" stroke="currentColor" stroke-width="1.1"/>`,

  // Ferramentas Imagem
  compress:    `<rect x="3" y="3" width="7" height="7" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="14" y="3" width="7" height="7" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="8.5" y="8.5" width="7" height="7" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.4"/>`,
  strip_exif:  `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.4"/><line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="1.4"/><line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="1.4"/>`,
  resize_50:   `<path d="M4 4h6v6H4V4zM14 14h6v6h-6v-6z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M10 10l4 4M10 10h3M10 10v3" fill="none" stroke="currentColor" stroke-width="1.3"/>`,
  to_grayscale:`<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M12 3v18" stroke="currentColor" stroke-width="1.1"/><path d="M12 3a9 9 0 0 1 0 18" fill="currentColor" fill-opacity="0.25"/>`,

  // ── VÍDEO ──────────────────────────────────────────────
  mp4:  `<rect x="3" y="5" width="13" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M16 9.5l5-3v11l-5-3v-5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>`,
  webm: `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M10 8.5l6 3.5-6 3.5v-7z" fill="currentColor"/>`,
  gif:  `<rect x="3" y="4" width="18" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M7 10h3M7 10v4M7 14h3M14 10v4M14 12h2.5" fill="none" stroke="currentColor" stroke-width="1.3"/>`,
  mov:  `<rect x="3" y="4" width="18" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><line x1="8" y1="4" x2="8" y2="20" stroke="currentColor" stroke-width="1.2"/><line x1="16" y1="4" x2="16" y2="20" stroke="currentColor" stroke-width="1.2"/>`,
  mkv:  `<rect x="3" y="5" width="18" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M7 9v6M7 12l4-3M7 12l4 3M14 9v6M14 12l3-3M14 12l3 3" fill="none" stroke="currentColor" stroke-width="1.3"/>`,
  video_mp3: `<path d="M9 18V6l11-3v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 15a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>`,

  // Ferramentas Vídeo
  discord_compress: `<path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-4l-3 3-3-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><circle cx="9" cy="11" r="1" fill="currentColor"/><circle cx="15" cy="11" r="1" fill="currentColor"/>`,
  strip_audio:      `<path d="M9 18V6l11-3v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 15a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" stroke-width="1.5"/>`,
  speed_2x:         `<path d="M4 5l8 7-8 7V5zM12 5l8 7-8 7V5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>`,
  extract_wav:      `<path d="M2 12h3l2-5 3 10 3-10 3 10 2-5h3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`,

  // ── ÁUDIO ──────────────────────────────────────────────
  mp3:  `<path d="M9 18V6l11-3v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 15a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>`,
  wav:  `<path d="M2 12h3l2-5 3 10 3-10 3 10 2-5h3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  flac: `<rect x="3" y="3" width="18" height="18" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 8h8M8 12h5M8 16h8" stroke="currentColor" stroke-width="1.3"/>`,
  aac:  `<path d="M4 4h16v16H4V4z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 15l4-7 4 7M10 13h4" fill="none" stroke="currentColor" stroke-width="1.3"/>`,
  ogg:  `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 12a4 4 0 1 0 8 0 4 4 0 1 0-8 0" fill="none" stroke="currentColor" stroke-width="1.3"/>`,
  opus: `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M7 12c1-3 3-5 5-5s4 2 5 5-2 5-5 5" fill="none" stroke="currentColor" stroke-width="1.3"/>`,

  // Ferramentas Áudio
  normalize:    `<line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="1.1" stroke-dasharray="2 2"/><rect x="8" y="6" width="8" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><line x1="12" y1="3" x2="12" y2="21" stroke="currentColor" stroke-width="1.3"/>`,
  to_mono:      `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.4"/><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="1.3"/>`,
  speed_15:     `<path d="M5 5l10 7-10 7V5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><line x1="17" y1="6" x2="17" y2="18" stroke="currentColor" stroke-width="1.5"/>`,
  silence_trim: `<path d="M3 12h4M17 12h4" stroke="currentColor" stroke-width="1.5"/><path d="M7 12l2-4 2 8 2-8 2 8 2-4" fill="none" stroke="currentColor" stroke-width="1.3"/>`,

  default: `<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.4"/><line x1="12" y1="8" x2="12" y2="13" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="15.5" r="0.8" fill="currentColor"/>`
};

const ICON_MAP = {
  // Imagem
  'webp': 'webp', 'jpg': 'jpg', 'png': 'png', 'ico': 'ico', 'avif': 'avif', 'tiff': 'tiff',
  'compress': 'compress', 'strip_exif': 'strip_exif', 'resize_50': 'resize_50', 'to_grayscale': 'to_grayscale',
  // Vídeo
  'mp4': 'mp4', 'webm': 'webm', 'gif': 'gif', 'mov': 'mov', 'mkv': 'mkv',
  'discord_compress': 'discord_compress', 'strip_audio': 'strip_audio', 'speed_2x': 'speed_2x', 'extract_wav': 'extract_wav',
  // Áudio
  'mp3': 'mp3', 'wav': 'wav', 'flac': 'flac', 'aac': 'aac', 'ogg': 'ogg', 'opus': 'opus',
  'normalize': 'normalize', 'to_mono': 'to_mono', 'speed_15': 'speed_15', 'silence_trim': 'silence_trim',
};

const CAT_LABEL = {
  image: 'IMG',
  video: 'VID',
  audio: 'ÁUD',
};

// ── Funções trigonométricas ───────────────────────────────────
function polarToCartesian(cx, cy, r, deg) {
  const rad = (deg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(x, y, r1, r2, a1, a2) {
  const s2 = polarToCartesian(x, y, r2, a2);
  const e2 = polarToCartesian(x, y, r2, a1);
  const s1 = polarToCartesian(x, y, r1, a2);
  const e1 = polarToCartesian(x, y, r1, a1);
  const sweep = a2 - a1 <= 180 ? '0' : '1';
  return [
    'M', s2.x, s2.y,
    'A', r2, r2, 0, sweep, 0, e2.x, e2.y,
    'L', e1.x, e1.y,
    'A', r1, r1, 0, sweep, 1, s1.x, s1.y,
    'Z'
  ].join(' ');
}

function getItems() {
  const cat = FORMAT_CATEGORIES[activeCategory] || FORMAT_CATEGORIES.image;
  return cat[activeMode] || cat.formats;
}

// ── Alternador de categoria ───────────────────────────────────
function switchCategory(newCat) {
  if (newCat && newCat !== activeCategory && FORMAT_CATEGORIES[newCat]) {
    activeCategory = newCat;
    if (typeof sounds !== 'undefined') sounds.playSwitch();
    renderRadialWheel();
  }
}

function cycleCategory() {
  const next = getNextCategory ? getNextCategory(activeCategory) : (
    activeCategory === 'image' ? 'video' : activeCategory === 'video' ? 'audio' : 'image'
  );
  switchCategory(next);
}

// ── Render do Wheel ───────────────────────────────────────────
function renderRadialWheel() {
  const slicesGroup = document.getElementById('slices-group');
  if (!slicesGroup) return;
  slicesGroup.innerHTML = '';

  const items    = getItems();
  const count    = items.length;
  const degSlice = 360 / count;
  const gap      = 3.2;
  const midR     = (INNER_RADIUS + OUTER_RADIUS) / 2;
  const isTools  = activeMode === 'tools';

  items.forEach((item, i) => {
    const a1 = i * degSlice + gap / 2;
    const a2 = (i + 1) * degSlice - gap / 2;
    const mid = (a1 + a2) / 2;

    const iconR  = midR - 24;
    const labelR = midR + 14;
    const iconPos  = polarToCartesian(CENTER_X, CENTER_Y, iconR, mid);
    const labelPos = polarToCartesian(CENTER_X, CENTER_Y, labelR, mid);

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'radial-slice');
    g.setAttribute('id', `slice-${i}`);
    g.setAttribute('data-index', i);

    // Fatia
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', describeArc(CENTER_X, CENTER_Y, INNER_RADIUS, OUTER_RADIUS, a1, a2));
    path.setAttribute('fill', 'url(#sliceBase)');
    path.setAttribute('stroke', isTools ? 'rgba(232,197,71,0.12)' : CLR.border);
    path.setAttribute('stroke-width', '1');
    g.appendChild(path);

    // Ícone SVG
    let iconKey = ICON_MAP[item.id] || 'default';
    if (activeCategory === 'video' && item.id === 'mp3') iconKey = 'video_mp3';
    const iconSvg   = ICONS[iconKey] || ICONS.default;
    const iconSize  = 16;
    const iconScale = iconSize / 24;
    const iconColor = isTools ? CLR.accent : CLR.textMute;

    const iconG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    iconG.setAttribute('transform',
      `translate(${iconPos.x - iconSize/2}, ${iconPos.y - iconSize/2}) scale(${iconScale})`
    );
    iconG.setAttribute('color', iconColor);
    iconG.setAttribute('stroke', iconColor);
    iconG.setAttribute('fill', 'none');
    iconG.setAttribute('stroke-linecap', 'round');
    iconG.innerHTML = iconSvg;
    g.appendChild(iconG);

    // Texto do label
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', labelPos.x);
    label.setAttribute('y', labelPos.y + 4);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('fill', CLR.text);
    label.setAttribute('font-size', count > 6 ? '9' : '10');
    label.setAttribute('font-weight', '700');
    label.setAttribute('font-family', "Consolas, 'Lucida Console', monospace");
    label.setAttribute('letter-spacing', '0.04em');
    label.setAttribute('class', 'slice-text');
    label.textContent = item.label;
    g.appendChild(label);

    // Eventos
    g.addEventListener('mouseenter', () => highlightSlice(i));
    g.addEventListener('mouseleave', () => unhighlightSlice());
    g.addEventListener('click', () => {
      if (currentDraggedPath) processDropOnItem(item);
    });

    slicesGroup.appendChild(g);
  });

  updateModeBadge();
}

// ── Highlight / Hover ─────────────────────────────────────────
function highlightSlice(index) {
  if (hoveredSliceIndex === index) return;
  unhighlightSlice();

  const items = getItems();
  if (index < 0 || index >= items.length) return;
  hoveredSliceIndex = index;

  const item    = items[index];
  const sliceEl = document.getElementById(`slice-${index}`);
  if (sliceEl) {
    const path  = sliceEl.querySelector('path');
    const iconG = sliceEl.querySelectorAll('g')[0];
    if (path) {
      const isTools = activeMode === 'tools';
      path.setAttribute('fill', isTools ? 'url(#sliceToolsHover)' : 'url(#sliceHover)');
      path.setAttribute('stroke', isTools ? CLR.borderToolH : CLR.borderH);
      path.setAttribute('stroke-width', '1.5');
    }
    if (iconG) {
      iconG.setAttribute('color', CLR.accent);
      iconG.setAttribute('stroke', CLR.accent);
    }
    sliceEl.classList.add('hovered');
  }

  if (typeof sounds !== 'undefined') sounds.playHover();

  // Tooltip
  const tooltip = document.getElementById('slice-tooltip');
  if (tooltip) {
    document.getElementById('tooltip-title').textContent = item.label;
    document.getElementById('tooltip-desc').textContent  = item.desc;
    tooltip.classList.add('visible');
  }

  // Hub central
  const hubPrimary = document.getElementById('hub-primary-text');
  const hubSub     = document.getElementById('hub-secondary-text');
  if (hubPrimary && hubSub) {
    hubPrimary.textContent = item.label;
    hubPrimary.setAttribute('fill', CLR.accent);
    hubSub.textContent = 'soltar p/ converter';
    hubSub.setAttribute('fill', CLR.textMute);
  }
}

function unhighlightSlice() {
  if (hoveredSliceIndex >= 0) {
    const sliceEl = document.getElementById(`slice-${hoveredSliceIndex}`);
    if (sliceEl) {
      const path  = sliceEl.querySelector('path');
      const iconG = sliceEl.querySelectorAll('g')[0];
      if (path) {
        path.setAttribute('fill', 'url(#sliceBase)');
        path.setAttribute('stroke', activeMode === 'tools' ? 'rgba(232,197,71,0.12)' : CLR.border);
        path.setAttribute('stroke-width', '1');
      }
      if (iconG) {
        const iconColor = activeMode === 'tools' ? CLR.accent : CLR.textMute;
        iconG.setAttribute('color', iconColor);
        iconG.setAttribute('stroke', iconColor);
      }
      sliceEl.classList.remove('hovered');
    }
  }
  hoveredSliceIndex = -1;

  const tooltip = document.getElementById('slice-tooltip');
  if (tooltip) tooltip.classList.remove('visible');

  const hubPrimary = document.getElementById('hub-primary-text');
  const hubSub     = document.getElementById('hub-secondary-text');
  if (hubPrimary && hubSub) {
    hubPrimary.textContent = 'IMGC';
    hubPrimary.setAttribute('fill', '#e8e5dc');
    hubSub.textContent = 'ZERO-CLICK';
    hubSub.setAttribute('fill', '#3f4039');
  }
}

// ── Atualização do Badge de Modo ──────────────────────────────
function updateModeBadge() {
  const catLabel  = document.getElementById('category-label');
  const modeLabel = document.getElementById('mode-label');

  if (catLabel) {
    catLabel.textContent = CAT_LABEL[activeCategory] || 'IMG';
  }

  if (modeLabel) {
    if (activeMode === 'formats') {
      modeLabel.textContent = 'formatos';
      modeLabel.className   = '';
    } else {
      modeLabel.textContent = 'ferramentas';
      modeLabel.className   = 'tools-active';
    }
  }
}

// ── Trigonometria de coordenadas do cursor ───────────────────
function getSliceIndexFromCoords(clientX, clientY) {
  const svg = document.getElementById('radial-svg');
  if (!svg) return -1;
  const rect = svg.getBoundingClientRect();
  const svgX = (clientX - rect.left) * (500 / rect.width);
  const svgY = (clientY - rect.top)  * (500 / rect.height);

  const dx   = svgX - CENTER_X;
  const dy   = svgY - CENTER_Y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < INNER_RADIUS || dist > OUTER_RADIUS) return -1;

  let angle = (Math.atan2(dy, dx) * 180 / Math.PI) + 90;
  if (angle < 0) angle += 360;

  const items       = getItems();
  const degPerSlice = 360 / items.length;
  const idx = Math.floor(angle / degPerSlice);
  return idx >= 0 && idx < items.length ? idx : -1;
}

// ── Drag & Drop ───────────────────────────────────────────────
window.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  const idx = getSliceIndexFromCoords(e.clientX, e.clientY);
  if (idx !== hoveredSliceIndex) {
    idx >= 0 ? highlightSlice(idx) : unhighlightSlice();
  }
});

window.addEventListener('dragleave', (e) => {
  if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
    unhighlightSlice();
  }
});

window.addEventListener('drop', async (e) => {
  e.preventDefault();
  const files = e.dataTransfer.files;
  if (!files || files.length === 0) return;

  const file     = files[0];
  const filePath = window.tangerine.getPathForFile(file);
  currentDraggedPath = filePath;

  // Detecção automática contextual ao soltar arquivo
  const detected = detectCategory(file.name);
  if (detected !== activeCategory) {
    activeCategory = detected;
    renderRadialWheel();
  }

  const idx    = getSliceIndexFromCoords(e.clientX, e.clientY);
  const items  = getItems();
  const target = (idx >= 0 && idx < items.length) ? items[idx] : items[0];
  await processDropOnItem(target, filePath);
});

// ── Processamento de Conversão ────────────────────────────────
async function processDropOnItem(targetItem, filePath = currentDraggedPath) {
  if (typeof sounds !== 'undefined') sounds.playDrop();

  const hubPrimary = document.getElementById('hub-primary-text');
  const hubSub     = document.getElementById('hub-secondary-text');
  hubPrimary.textContent = 'CONV...';
  hubPrimary.setAttribute('fill', CLR.accent);
  hubSub.textContent = 'aguarde';
  hubSub.setAttribute('fill', CLR.textMute);

  try {
    const res = await window.tangerine.convertFile(filePath, targetItem.id);
    hubPrimary.textContent = 'PRONTO';
    hubPrimary.setAttribute('fill', '#5cb87a');
    hubSub.textContent = res.durationMs > 1000 ? `${(res.durationMs/1000).toFixed(1)}s` : `${res.durationMs}ms`;
    hubSub.setAttribute('fill', CLR.textMute);

    setTimeout(() => {
      window.tangerine.closeRadial();
      unhighlightSlice();
    }, 900);
  } catch (err) {
    hubPrimary.textContent = 'ERRO';
    hubPrimary.setAttribute('fill', '#d0584a');
    hubSub.textContent = 'falha';
    hubSub.setAttribute('fill', CLR.textMute);
    setTimeout(() => unhighlightSlice(), 1600);
  }
}

// ── Listener de Progresso de Conversão (FFmpeg) ───────────────
if (window.tangerine && typeof window.tangerine.onConversionProgress === 'function') {
  window.tangerine.onConversionProgress((data) => {
    const hubPrimary = document.getElementById('hub-primary-text');
    const hubSub     = document.getElementById('hub-secondary-text');
    if (!hubPrimary || !hubSub) return;

    if (data && data.percent !== null && data.percent !== undefined && data.percent > 0) {
      hubPrimary.textContent = `${data.percent}%`;
      hubPrimary.setAttribute('fill', CLR.accent);
      hubSub.textContent = 'codificando';
    } else if (data && data.timemark) {
      hubPrimary.textContent = data.timemark.split('.')[0] || 'CONV...';
      hubPrimary.setAttribute('fill', CLR.accent);
      hubSub.textContent = 'processando';
    }
  });
}

// ── Teclado & Cliques de Navegação ────────────────────────────
window.addEventListener('keydown', (e) => {
  // Tab: cicla categoria (IMG -> VID -> ÁUD -> IMG)
  if (e.key === 'Tab') {
    e.preventDefault();
    cycleCategory();
    return;
  }

  // Teclas 1, 2, 3: seleção direta
  if (e.key === '1') {
    e.preventDefault();
    switchCategory('image');
    return;
  }
  if (e.key === '2') {
    e.preventDefault();
    switchCategory('video');
    return;
  }
  if (e.key === '3') {
    e.preventDefault();
    switchCategory('audio');
    return;
  }

  // Alt: alternar entre formatos e ferramentas
  if (e.key === 'Alt') {
    e.preventDefault();
    if (activeMode !== 'tools') {
      activeMode = 'tools';
      if (typeof sounds !== 'undefined') sounds.playSwitch();
      renderRadialWheel();
    }
    return;
  }

  // Escape: fechar roda
  if (e.key === 'Escape') {
    window.tangerine.closeRadial();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'Alt') {
    if (activeMode !== 'formats') {
      activeMode = 'formats';
      if (typeof sounds !== 'undefined') sounds.playSwitch();
      renderRadialWheel();
    }
  }
});

// Clique no badge para ciclar categoria
const modeBadge = document.getElementById('mode-badge');
if (modeBadge) {
  modeBadge.addEventListener('click', () => {
    cycleCategory();
  });
}

// ── Ativação pelo Processo Principal ──────────────────────────
window.tangerine.onRadialActivate((data) => {
  if (data && data.fileInfo && data.fileInfo.name) {
    activeCategory     = detectCategory(data.fileInfo.name);
    currentDraggedPath = data.fileInfo.path || '';
  }
  renderRadialWheel();
});

// ── Render inicial ────────────────────────────────────────────
renderRadialWheel();
