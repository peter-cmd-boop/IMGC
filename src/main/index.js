const fs = require('fs');
const path = require('path');
const logFile = path.join(__dirname, 'debug.log');

function log(...args) {
  const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ') + '\n';
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}`);
  } catch (e) {}
  console.log(...args);
}

log('Initializing IMGC Zero-Click Engine...');

process.on('uncaughtException', (err) => {
  log('UNCAUGHT EXCEPTION:', err.stack || err.message);
});

process.on('unhandledRejection', (reason) => {
  log('UNHANDLED REJECTION:', reason);
});

const { app, BrowserWindow, ipcMain, screen, globalShortcut, Tray, Menu, shell, nativeImage, Notification } = require('electron');
const { convertFile } = require('./converter');

// Set Application User Model ID for Windows Taskbar & Notifications
app.setAppUserModelId('com.imgc.app');

// Remove default Electron menu bar
Menu.setApplicationMenu(null);

// Enforce single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  log('Another instance already running. Exiting secondary instance.');
  app.quit();
  process.exit(0);
}

let radialWindow = null;
let tray = null;
let conversionHistory = [];
const historyPath = path.join(app.getPath('userData'), 'imgc_history.json');
const settingsPath = path.join(app.getPath('userData'), 'imgc_settings.json');

let appSettings = {
  shortcut: 'Alt+P',
  soundEnabled: true,
  defaultImageQuality: 85,
  defaultAudioBitrate: '320k',
  autoOpenFolder: false
};

try {
  if (fs.existsSync(historyPath)) {
    conversionHistory = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  }
  if (fs.existsSync(settingsPath)) {
    appSettings = { ...appSettings, ...JSON.parse(fs.readFileSync(settingsPath, 'utf8')) };
  }
} catch (e) {
  log('Settings warning:', e.message);
}

function saveHistory() {
  try {
    fs.writeFileSync(historyPath, JSON.stringify(conversionHistory.slice(0, 50), null, 2), 'utf8');
  } catch (e) {}
}

/**
 * Creates the Radial Menu Overlay Window (Sole UI Window)
 */
function createRadialWindow() {
  log('Creating radial overlay window...');
  const iconPath = path.join(__dirname, '..', '..', 'assets', 'app_icon.ico');

  radialWindow = new BrowserWindow({
    width: 520,
    height: 520,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    hasShadow: false,
    focusable: true,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: true,
      spellcheck: false
    }
  });

  radialWindow.loadFile(path.join(__dirname, '..', 'renderer', 'radial', 'radial.html'));
  radialWindow.setAlwaysOnTop(true, 'screen-saver');
  log('Radial overlay window ready.');
}

/**
 * Hides radial window and releases temporary Escape listener
 */
function hideRadialWindow() {
  if (radialWindow && radialWindow.isVisible()) {
    radialWindow.hide();
    log('Radial window hidden.');
    try {
      globalShortcut.unregister('Escape');
    } catch (e) {}
  }
}

/**
 * Summons Radial Menu centered at current cursor point with screen clamping
 */
function toggleRadialAtCursor(fileInfo = null) {
  log('toggleRadialAtCursor invoked!');
  if (!radialWindow || radialWindow.isDestroyed()) {
    createRadialWindow();
  }

  if (radialWindow.isVisible()) {
    log('Radial already visible, toggling off.');
    hideRadialWindow();
    return;
  }

  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor) || screen.getPrimaryDisplay();
  const bounds = display.bounds;

  const width = 520;
  const height = 520;
  let x = Math.round(cursor.x - (width / 2));
  let y = Math.round(cursor.y - (height / 2));

  // If cursor is at origin, center on active screen
  if (cursor.x <= 10 && cursor.y <= 10) {
    x = Math.round(bounds.x + (bounds.width - width) / 2);
    y = Math.round(bounds.y + (bounds.height - height) / 2);
  } else {
    // Strictly clamp within display boundaries so it is ALWAYS 100% visible
    const minX = bounds.x + 10;
    const maxX = bounds.x + bounds.width - width - 10;
    const minY = bounds.y + 10;
    const maxY = bounds.y + bounds.height - height - 10;

    x = Math.max(minX, Math.min(x, maxX));
    y = Math.max(minY, Math.min(y, maxY));
  }

  log(`Displaying radial at (${x}, ${y}) on monitor bounds [${bounds.x}, ${bounds.y}, ${bounds.width}x${bounds.height}]`);
  
  radialWindow.setPosition(x, y, false);
  radialWindow.setAlwaysOnTop(true, 'screen-saver');
  radialWindow.show();
  radialWindow.focus();
  radialWindow.moveTop();
  radialWindow.webContents.send('radial-activate', { cursor, fileInfo });

  // Register Escape key to dismiss radial menu anywhere in Windows
  try {
    globalShortcut.register('Escape', () => {
      log('Escape detected, closing radial.');
      hideRadialWindow();
    });
  } catch (err) {
    log('Error registering Escape hotkey:', err);
  }
}

/**
 * System Tray Setup with Custom IMGC Icon
 */
function setupTray() {
  log('Setting up system tray...');
  try {
    const trayImgPath = path.join(__dirname, '..', '..', 'assets', 'tray_icon.png');
    let trayImage = null;
    if (fs.existsSync(trayImgPath)) {
      trayImage = nativeImage.createFromPath(trayImgPath);
    } else {
      trayImage = nativeImage.createFromBuffer(
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAP0lEQVR42mP8z8AARAEwAwPDf1Twf0hQZMAUjRpj0ABhQ2eYEYwGBmO/oTPIkGvoUj00DAkGGBoaY4EBAwMAf/503x1hG/gAAAAASUVORK5CYII=',
          'base64'
        )
      );
    }

    tray = new Tray(trayImage);
    tray.setToolTip('IMGC - Roda de Funções (Alt+P ou F8)');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '⚡ Abrir Roda de Funções (Alt+P ou F8)',
        click: () => toggleRadialAtCursor()
      },
      { type: 'separator' },
      {
        label: 'Iniciar com o Windows',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => {
          app.setLoginItemSettings({
            openAtLogin: item.checked,
            path: process.execPath
          });
        }
      },
      { type: 'separator' },
      {
        label: 'Sair do IMGC',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      toggleRadialAtCursor();
    });
    tray.on('double-click', () => {
      toggleRadialAtCursor();
    });
    log('Tray setup complete.');
  } catch (err) {
    log('Error creating tray:', err.stack || err.message);
  }
}

function registerHotkeys() {
  globalShortcut.unregisterAll();

  // Alt+P
  const r1 = globalShortcut.register('Alt+P', () => {
    log('Hotkey Alt+P triggered!');
    toggleRadialAtCursor();
  });
  log('Registered Alt+P:', r1);

  // F8 (tecla única direta)
  const r2 = globalShortcut.register('F8', () => {
    log('Hotkey F8 triggered!');
    toggleRadialAtCursor();
  });
  log('Registered F8:', r2);

  // Alt+C (C de Converter)
  const r3 = globalShortcut.register('Alt+C', () => {
    log('Hotkey Alt+C triggered!');
    toggleRadialAtCursor();
  });
  log('Registered Alt+C:', r3);

  // Alt+Shift+P / Shift+P
  try {
    const r4 = globalShortcut.register('Alt+Shift+P', () => {
      log('Hotkey Alt+Shift+P triggered!');
      toggleRadialAtCursor();
    });
    log('Registered Alt+Shift+P:', r4);
  } catch (e) {}

  try {
    const r5 = globalShortcut.register('CommandOrControl+Shift+P', () => {
      log('Hotkey Ctrl+Shift+P triggered!');
      toggleRadialAtCursor();
    });
    log('Registered Ctrl+Shift+P:', r5);
  } catch (e) {}
}

// Second instance triggers the radial menu
app.on('second-instance', () => {
  log('Second instance launched - opening radial at cursor.');
  if (radialWindow) {
    if (!radialWindow.isVisible()) {
      toggleRadialAtCursor();
    } else {
      radialWindow.focus();
      radialWindow.moveTop();
    }
  } else {
    toggleRadialAtCursor();
  }
});

// App lifecycle
app.whenReady().then(() => {
  log('App whenReady event.');
  createRadialWindow();
  setupTray();
  registerHotkeys();

  // Immediately display the radial menu on launch so the user sees it immediately
  setTimeout(() => {
    log('Opening radial wheel immediately on application startup.');
    toggleRadialAtCursor();
  }, 400);

  // Notify user once on launch that IMGC is ready in background
  try {
    if (Notification.isSupported()) {
      new Notification({
        title: 'IMGC Ativo',
        body: 'Pressione Alt+P ou F8 para abrir a roda de funções.',
        icon: path.join(__dirname, '..', '..', 'assets', 'app_icon.png')
      }).show();
    }
  } catch (e) {}
});

// Pure background daemon - never terminate when windows are closed
app.on('window-all-closed', () => {
  // Stays alive in system tray for Alt+P / F8
});

app.on('will-quit', () => {
  log('App will-quit, cleaning up hotkeys.');
  globalShortcut.unregisterAll();
});

// IPC Handlers
ipcMain.handle('convert-file', async (event, { filePath, formatOrTool, options }) => {
  try {
    const opts = {
      ...(options || {}),
      onProgress: (progress) => {
        try {
          if (event.sender && !event.sender.isDestroyed()) {
            event.sender.send('conversion-progress', progress);
          }
        } catch (e) {}
      }
    };
    const result = await convertFile(filePath, formatOrTool, opts);
    const historyItem = {
      id: Date.now().toString(),
      fileName: path.basename(filePath),
      outputName: path.basename(result.outputPath),
      inputPath: filePath,
      outputPath: result.outputPath,
      format: result.format,
      originalSize: result.originalSize,
      newSize: result.newSize,
      savedPercentage: result.savedPercentage,
      durationMs: result.durationMs,
      timestamp: new Date().toISOString()
    };

    conversionHistory.unshift(historyItem);
    saveHistory();

    // Show completion notification
    try {
      if (Notification.isSupported()) {
        new Notification({
          title: `✓ IMGC: ${historyItem.outputName}`,
          body: `Salvo no mesmo diretório em ${result.durationMs}ms`,
          icon: path.join(__dirname, '..', '..', 'assets', 'app_icon.png')
        }).show();
      }
    } catch (e) {}

    return result;
  } catch (err) {
    log('Conversion error:', err);
    throw err;
  }
});

ipcMain.handle('show-item-in-folder', (event, filePath) => {
  if (fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return true;
  }
  return false;
});

ipcMain.on('radial-close', () => {
  hideRadialWindow();
});

ipcMain.handle('get-history', () => conversionHistory);
ipcMain.handle('get-settings', () => appSettings);
