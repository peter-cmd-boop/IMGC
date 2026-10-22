// IMGC Windows Dashboard Controller
let stagedFile = null;
let activeCategory = 'image';
let activeTab = 'formats'; // 'formats' or 'tools'
let settings = {};

// Elements
const dropZone = document.getElementById('drop-zone');
const fileSelector = document.getElementById('file-selector');
const dropPrompt = document.getElementById('drop-prompt');
const stagedCard = document.getElementById('staged-card');
const stagedFilename = document.getElementById('staged-filename');
const stagedMeta = document.getElementById('staged-meta');
const stagedIcon = document.getElementById('staged-icon');
const btnClearStaged = document.getElementById('btn-clear-staged');
const targetFormatsGrid = document.getElementById('target-formats-grid');
const tabFormats = document.getElementById('tab-formats');
const tabTools = document.getElementById('tab-tools');
const conversionProgress = document.getElementById('conversion-progress');
const progressText = document.getElementById('progress-text');

const historyCount = document.getElementById('history-count');
const historyEmpty = document.getElementById('history-empty');
const historyItems = document.getElementById('history-items');
const btnClearHistory = document.getElementById('btn-clear-history');
const btnCreateSample = document.getElementById('btn-create-sample');
const btnTriggerRadial = document.getElementById('btn-trigger-radial');

const settingsModal = document.getElementById('settings-modal');
const btnSettings = document.getElementById('btn-settings');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnSaveSettings = document.getElementById('btn-save-settings');
const settingShortcut = document.getElementById('setting-shortcut');
const settingQuality = document.getElementById('setting-quality');
const qualityVal = document.getElementById('quality-val');
const settingAutoOpen = document.getElementById('setting-auto-open');
const settingSound = document.getElementById('setting-sound');

// Initialize
async function initDashboard() {
  await loadSettings();
  await loadHistory();

  // Listen for background conversions
  window.tangerine.onConversionComplete((item) => {
    loadHistory();
  });
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Media Category quick filter switcher
function switchCategory(cat) {
  activeCategory = cat;
  document.querySelectorAll('.type-pill').forEach(p => p.classList.remove('active'));
  const activePill = document.getElementById(`pill-${cat}`);
  if (activePill) activePill.classList.add('active');

  if (stagedFile) {
    stagedFile.category = cat;
    stagedMeta.textContent = `${formatBytes(stagedFile.size)} • ${FORMAT_CATEGORIES[cat].name}`;
    stagedIcon.textContent = cat === 'image' ? '🖼️' : cat === 'video' ? '🎬' : '🎵';
    renderTargetGrid();
  }
}

// Staging File
function stageFile(file) {
  const filePath = window.tangerine.getPathForFile(file);
  const detectedCat = detectCategory(file.name);
  activeCategory = detectedCat;

  stagedFile = {
    name: file.name,
    size: file.size,
    path: filePath,
    category: detectedCat
  };

  // Update pills
  document.querySelectorAll('.type-pill').forEach(p => p.classList.remove('active'));
  const activePill = document.getElementById(`pill-${detectedCat}`);
  if (activePill) activePill.classList.add('active');

  dropPrompt.classList.add('hidden');
  stagedCard.classList.remove('hidden');

  stagedFilename.textContent = file.name;
  stagedMeta.textContent = `${formatBytes(file.size)} • ${FORMAT_CATEGORIES[stagedFile.category].name}`;
  stagedIcon.textContent = stagedFile.category === 'image' ? '🖼️' : stagedFile.category === 'video' ? '🎬' : '🎵';

  renderTargetGrid();
}

function clearStagedFile() {
  stagedFile = null;
  dropPrompt.classList.remove('hidden');
  stagedCard.classList.add('hidden');
  fileSelector.value = '';
}

function renderTargetGrid() {
  targetFormatsGrid.innerHTML = '';
  if (!stagedFile) return;

  const catData = FORMAT_CATEGORIES[stagedFile.category] || FORMAT_CATEGORIES.image;
  const items = activeTab === 'formats' ? catData.formats : catData.tools;

  items.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'format-card-btn';
    btn.innerHTML = `
      <span class="format-btn-icon">${item.icon}</span>
      <span class="format-btn-label">${item.label}</span>
      <span class="format-btn-desc">${item.desc}</span>
    `;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      runConversion(item);
    });

    targetFormatsGrid.appendChild(btn);
  });
}

async function runConversion(targetItem) {
  if (!stagedFile || !stagedFile.path) return;

  sounds.playDrop();
  conversionProgress.classList.remove('hidden');
  targetFormatsGrid.classList.add('hidden');
  progressText.textContent = `Convertendo para ${targetItem.label} (offline)...`;

  try {
    const options = {
      quality: parseInt(settings.defaultImageQuality || 85, 10)
    };

    const res = await window.tangerine.convertFile(stagedFile.path, targetItem.id, options);
    progressText.textContent = `✓ Criado com sucesso (${res.durationMs}ms)!`;

    setTimeout(async () => {
      conversionProgress.classList.add('hidden');
      targetFormatsGrid.classList.remove('hidden');
      clearStagedFile();
      await loadHistory();
    }, 1000);
  } catch (err) {
    progressText.textContent = `Falha na conversão: ${err.message}`;
    setTimeout(() => {
      conversionProgress.classList.add('hidden');
      targetFormatsGrid.classList.remove('hidden');
    }, 2000);
  }
}

// History
async function loadHistory() {
  const history = await window.tangerine.getHistory();
  historyCount.textContent = `${history.length} ${history.length === 1 ? 'arquivo' : 'arquivos'}`;

  if (!history || history.length === 0) {
    historyEmpty.classList.remove('hidden');
    historyItems.classList.add('hidden');
    return;
  }

  historyEmpty.classList.add('hidden');
  historyItems.classList.remove('hidden');
  historyItems.innerHTML = '';

  history.forEach(item => {
    const row = document.createElement('div');
    row.className = 'history-row';

    const ratioText = item.savedPercentage > 0 ? `-${item.savedPercentage}%` : `+${Math.abs(item.savedPercentage)}%`;
    const cat = detectCategory(item.fileName);
    const icon = cat === 'image' ? '🖼️' : cat === 'video' ? '🎬' : '🎵';

    row.innerHTML = `
      <div class="history-row-left">
        <span class="history-icon">${icon}</span>
        <div>
          <div class="history-name">${item.outputName || item.fileName}</div>
          <div class="history-sub">${formatBytes(item.originalSize)} → ${formatBytes(item.newSize)} • ${item.durationMs}ms</div>
        </div>
      </div>
      <div class="history-row-right">
        <span class="ratio-badge">${ratioText}</span>
        <button class="btn-open-explorer" data-path="${item.outputPath}">Abrir no Explorer</button>
      </div>
    `;

    row.querySelector('.btn-open-explorer').addEventListener('click', () => {
      window.tangerine.showItemInFolder(item.outputPath);
    });

    historyItems.appendChild(row);
  });
}

// Settings
async function loadSettings() {
  settings = await window.tangerine.getSettings();
  settingShortcut.value = 'Alt+P ou F8';
  settingQuality.value = settings.defaultImageQuality || 85;
  qualityVal.textContent = `${settingQuality.value}%`;
  settingAutoOpen.checked = !!settings.autoOpenFolder;
  settingSound.checked = settings.soundEnabled !== false;
  sounds.enabled = settingSound.checked;
}

// Event Listeners
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    stageFile(e.dataTransfer.files[0]);
  }
});

fileSelector.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    stageFile(e.target.files[0]);
  }
});

btnClearStaged.addEventListener('click', (e) => {
  e.stopPropagation();
  clearStagedFile();
});

tabFormats.addEventListener('click', (e) => {
  e.stopPropagation();
  activeTab = 'formats';
  tabFormats.classList.add('active');
  tabTools.classList.remove('active');
  renderTargetGrid();
});

tabTools.addEventListener('click', (e) => {
  e.stopPropagation();
  activeTab = 'tools';
  tabTools.classList.add('active');
  tabFormats.classList.remove('active');
  renderTargetGrid();
});

btnClearHistory.addEventListener('click', async () => {
  await window.tangerine.clearHistory();
  await loadHistory();
});

btnTriggerRadial.addEventListener('click', () => {
  alert('Dica IMGC: Pressione Alt+P ou F8 a qualquer momento no Windows, ou solte qualquer arquivo diretamente nesta tela!');
});

// Helper: Generate a real sample image with the IMGC logo
btnCreateSample.addEventListener('click', () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');

  // Modern Titanium Slate gradient background
  const grad = ctx.createLinearGradient(0, 0, 1200, 800);
  grad.addColorStop(0, '#0a0b0e');
  grad.addColorStop(0.5, '#161822');
  grad.addColorStop(1, '#252938');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1200, 800);

  // Load and draw the uploaded IMGC hexagon logo onto the sample image
  const img = new Image();
  img.src = '../../../assets/logo.png';
  img.onload = () => {
    ctx.drawImage(img, 475, 200, 250, 210);

    // Typography
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('IMGC Media Engine', 600, 520);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '22px -apple-system, sans-serif';
    ctx.fillText('Amostra de Imagem • Zero-Click Offline Converter', 600, 570);

    canvas.toBlob((blob) => {
      const file = new File([blob], 'imgc_sample.png', { type: 'image/png' });
      stageFile(file);
    }, 'image/png');
  };
});

// Settings Modal
btnSettings.addEventListener('click', () => settingsModal.classList.remove('hidden'));
btnCloseSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));

settingQuality.addEventListener('input', (e) => {
  qualityVal.textContent = `${e.target.value}%`;
});

btnSaveSettings.addEventListener('click', async () => {
  const newSettings = {
    defaultImageQuality: parseInt(settingQuality.value, 10),
    autoOpenFolder: settingAutoOpen.checked,
    soundEnabled: settingSound.checked
  };

  sounds.enabled = newSettings.soundEnabled;
  await window.tangerine.saveSettings(newSettings);
  settingsModal.classList.add('hidden');
});

initDashboard();
