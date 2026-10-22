const fs = require("fs");
const path = require("path");
const logFile = path.join(__dirname, "debug.log");

function log(...args) {
  const msg =
    args.map((a) => (typeof a === "object" ? JSON.stringify(a) : a)).join(" ") +
    "\n";
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}`);
  } catch (e) {}
  console.log(...args);
}

log("Initializing IMGC Zero-Click Engine...");

process.on("uncaughtException", (err) => {
  log("UNCAUGHT EXCEPTION:", err.stack || err.message);
});

process.on("unhandledRejection", (reason) => {
  log("UNHANDLED REJECTION:", reason);
});

const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  globalShortcut,
  Tray,
  Menu,
  shell,
  nativeImage,
  Notification,
  dialog,
} = require("electron");
const { convertFile } = require("./converter");
const { JobQueue } = require("./jobs");
const {
  FORMAT_CATEGORIES,
  detectCategory,
} = require("../renderer/shared/formats");

// Set Application User Model ID for Windows Taskbar & Notifications
app.setAppUserModelId("com.imgc.app");

// Remove default Electron menu bar
Menu.setApplicationMenu(null);

// Enforce single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  log(
    "Another instance already running. Requesting main instance to open radial.",
  );
  app.quit();
} else {
  let radialWindow = null;
  let tray = null;
  let dashboardWindow = null;
  let conversionHistory = [];
  const historyPath = path.join(app.getPath("userData"), "imgc_history.json");
  const settingsPath = path.join(app.getPath("userData"), "imgc_settings.json");

  let appSettings = {
    shortcut: "Alt+P",
    soundEnabled: true,
    defaultImageQuality: 85,
    defaultAudioBitrate: "320k",
    autoOpenFolder: false,
  };

  try {
    if (fs.existsSync(historyPath)) {
      conversionHistory = JSON.parse(fs.readFileSync(historyPath, "utf8"));
    }
    if (!Array.isArray(conversionHistory)) conversionHistory = [];
    conversionHistory = conversionHistory.slice(0, 50);
    if (fs.existsSync(settingsPath)) {
      appSettings = {
        ...appSettings,
        ...JSON.parse(fs.readFileSync(settingsPath, "utf8")),
      };
    }
  } catch (e) {
    log("Settings warning:", e.message);
  }

  function saveHistory(items = conversionHistory) {
    fs.mkdirSync(path.dirname(historyPath), { recursive: true });
    fs.writeFileSync(
      historyPath + ".tmp",
      JSON.stringify(items.slice(0, 50), null, 2),
      "utf8",
    );
    fs.renameSync(historyPath + ".tmp", historyPath);
  }

  /**
   * Creates the Radial Menu Overlay Window (Sole UI Window)
   */
  function createRadialWindow() {
    log("Creating radial overlay window...");
    const iconPath = path.join(__dirname, "..", "..", "assets", "app_icon.ico");

    radialWindow = new BrowserWindow({
      width: 520,
      height: 520,
      frame: false,
      transparent: true,
      backgroundColor: "#00000000",
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      show: false,
      hasShadow: false,
      focusable: true,
      icon: fs.existsSync(iconPath) ? iconPath : undefined,
      webPreferences: {
        preload: path.join(__dirname, "..", "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: true,
        spellcheck: false,
      },
    });

    protectWindow(radialWindow);
    radialWindow.loadFile(
      path.join(__dirname, "..", "renderer", "radial", "radial.html"),
    );
    radialWindow.setAlwaysOnTop(true, "screen-saver");
    log("Radial overlay window ready.");
  }

  /**
   * Hides radial window and releases temporary Escape listener
   */
  function hideRadialWindow() {
    if (radialWindow && radialWindow.isVisible()) {
      radialWindow.hide();
      log("Radial window hidden.");
      try {
        globalShortcut.unregister("Escape");
      } catch (e) {}
    }
  }

  /**
   * Summons Radial Menu centered at current cursor point with screen clamping
   */
  function toggleRadialAtCursor(fileInfo = null) {
    log("toggleRadialAtCursor invoked!");
    if (!radialWindow || radialWindow.isDestroyed()) {
      createRadialWindow();
    }

    if (radialWindow.isVisible()) {
      log("Radial already visible, toggling off.");
      hideRadialWindow();
      return;
    }

    const cursor = screen.getCursorScreenPoint();
    const display =
      screen.getDisplayNearestPoint(cursor) || screen.getPrimaryDisplay();
    const bounds = display.workArea;

    const width = 520;
    const height = 520;
    let x = Math.round(cursor.x - width / 2);
    let y = Math.round(cursor.y - height / 2);

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

    log(
      `Displaying radial at (${x}, ${y}) on monitor bounds [${bounds.x}, ${bounds.y}, ${bounds.width}x${bounds.height}]`,
    );

    radialWindow.setPosition(x, y, false);
    radialWindow.setAlwaysOnTop(true, "screen-saver");
    radialWindow.show();
    radialWindow.focus();
    radialWindow.moveTop();
    radialWindow.webContents.send("radial-activate", { cursor, fileInfo });
  }

  /**
   * System Tray Setup with Custom IMGC Icon
   */
  function setupTray() {
    log("Setting up system tray...");
    try {
      const trayImgPath = path.join(
        __dirname,
        "..",
        "..",
        "assets",
        "tray_icon.png",
      );
      let trayImage = null;
      if (fs.existsSync(trayImgPath)) {
        trayImage = nativeImage.createFromPath(trayImgPath);
      } else {
        trayImage = nativeImage.createFromBuffer(
          Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAP0lEQVR42mP8z8AARAEwAwPDf1Twf0hQZMAUjRpj0ABhQ2eYEYwGBmO/oTPIkGvoUj00DAkGGBoaY4EBAwMAf/503x1hG/gAAAAASUVORK5CYII=",
            "base64",
          ),
        );
      }

      tray = new Tray(trayImage);
      tray.setToolTip("IMGC - Roda de Funções (atalho configurado)");

      const contextMenu = Menu.buildFromTemplate([
        {
          label: "⚡ Abrir Roda de Funções (atalho configurado)",
          click: () => toggleRadialAtCursor(),
        },
        {
          label: "Converter arquivos, configurações e histórico",
          click: openDashboard,
        },
        { type: "separator" },
        ...(process.platform === "win32"
          ? [
              {
                label: "Iniciar com o Windows",
                type: "checkbox",
                checked: app.getLoginItemSettings().openAtLogin,
                click: (item) => {
                  app.setLoginItemSettings({
                    openAtLogin: item.checked,
                    path: process.execPath,
                  });
                },
              },
            ]
          : []),
        { type: "separator" },
        {
          label: "Sair do IMGC",
          click: () => {
            app.isQuitting = true;
            app.quit();
          },
        },
      ]);

      tray.setContextMenu(contextMenu);
      tray.on("click", () => {
        toggleRadialAtCursor();
      });

      log("Tray setup complete.");
    } catch (err) {
      log("Error creating tray:", err.stack || err.message);
    }
  }

  function registerHotkeys(shortcut = appSettings.shortcut) {
    if (globalShortcut.isRegistered(shortcut)) return;
    if (!globalShortcut.register(shortcut, () => toggleRadialAtCursor()))
      throw new Error("Atalho indisponível. Escolha outra combinação.");
    if (appSettings.shortcut !== shortcut)
      globalShortcut.unregister(appSettings.shortcut);
  }

  function protectWindow(win) {
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (event) => event.preventDefault());
  }
  function openDashboard() {
    if (!dashboardWindow || dashboardWindow.isDestroyed()) {
      dashboardWindow = new BrowserWindow({
        width: 1120,
        height: 850,
        minWidth: 760,
        minHeight: 600,
        webPreferences: {
          preload: path.join(__dirname, "..", "preload.js"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      protectWindow(dashboardWindow);
      dashboardWindow.loadFile(
        path.join(__dirname, "../renderer/dashboard/dashboard.html"),
      );
      dashboardWindow.on("closed", () => {
        dashboardWindow = null;
      });
    }
    dashboardWindow.show();
    dashboardWindow.focus();
  }

  // Second instance triggers the radial menu
  app.on("second-instance", () => {
    log("Second instance launched - opening radial at cursor.");
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
    log("App whenReady event.");
    createRadialWindow();
    setupTray();
    try {
      registerHotkeys();
    } catch (error) {
      dialog.showErrorBox("Atalho IMGC", error.message);
    }
    openDashboard();

    // Notify user once on launch that IMGC is ready in background
    try {
      if (Notification.isSupported()) {
        new Notification({
          title: "IMGC Ativo",
          body:
            "Use " + appSettings.shortcut + " para abrir a roda de funções.",
          icon: path.join(__dirname, "..", "..", "assets", "app_icon.png"),
        }).show();
      }
    } catch (e) {}
  });

  // Pure background daemon - never terminate when windows are closed
  app.on("window-all-closed", () => {
    // Stays alive in system tray for Alt+P / F8
  });

  app.on("will-quit", () => {
    log("App will-quit, cleaning up hotkeys.");
    globalShortcut.unregisterAll();
  });

  // All conversion requests are serialized and carry their own progress ID.
  function broadcast(channel, data) {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) win.webContents.send(channel, data);
    });
  }
  const queue = new JobQueue(convertFile, (update) => {
    if (update.state === "done") {
      const result = update.result;
      const item = {
        ...result,
        id: update.id,
        fileName: path.basename(result.inputPath),
        outputName: path.basename(result.outputPath),
        timestamp: new Date().toISOString(),
      };
      conversionHistory = [item, ...conversionHistory].slice(0, 50);
      try {
        saveHistory();
      } catch (error) {
        update.warning =
          "Arquivo salvo, mas o histórico não pôde ser gravado: " +
          error.message;
      }
      broadcast("conversion-complete", item);
      if (appSettings.autoOpenFolder) shell.showItemInFolder(result.outputPath);
      try {
        if (Notification.isSupported()) {
          const notification = new Notification({
            title: "IMGC: conversão concluída",
            body: item.outputName,
          });
          notification.on("click", () =>
            shell.showItemInFolder(result.outputPath),
          );
          notification.show();
        }
      } catch (error) {
        log(error.message);
      }
    }
    broadcast("job-update", update);
  });
  app.on("before-quit", () =>
    queue.jobs.forEach((job) => job.controller.abort()),
  );
  function handle(channel, callback) {
    ipcMain.handle(channel, (event, ...args) => {
      if (
        ![radialWindow, dashboardWindow].some(
          (win) =>
            win && !win.isDestroyed() && win.webContents === event.sender,
        ) ||
        event.senderFrame !== event.sender.mainFrame
      )
        throw new Error("Origem não autorizada.");
      return callback(event, ...args);
    });
  }
  handle("queue-files", (event, paths, target) => {
    if (!Array.isArray(paths) || !paths.length || paths.length > 200)
      throw new Error("Selecione entre 1 e 200 arquivos.");
    for (const file of paths) {
      if (
        typeof file !== "string" ||
        !path.isAbsolute(file) ||
        !fs.statSync(file).isFile()
      )
        throw new Error("Arquivo inválido.");
      const cat = FORMAT_CATEGORIES[detectCategory(file)];
      if (
        !cat ||
        ![...cat.formats, ...cat.tools].some((item) => item.id === target)
      )
        throw new Error(
          "Escolha arquivos da mesma categoria e uma operação compatível.",
        );
    }
    return queue.add(
      paths,
      target,
      { quality: appSettings.defaultImageQuality },
      event.sender.id,
    );
  });
  handle("cancel-jobs", (event) => queue.cancel(event.sender.id));
  handle("get-history", () => conversionHistory);
  handle("clear-history", () => {
    saveHistory([]);
    conversionHistory = [];
    broadcast("history-changed");
  });
  handle("get-settings", () => appSettings);
  handle("save-settings", (_event, next) => {
    if (
      !next ||
      !Number.isInteger(next.defaultImageQuality) ||
      next.defaultImageQuality < 1 ||
      next.defaultImageQuality > 100 ||
      typeof next.soundEnabled !== "boolean" ||
      typeof next.autoOpenFolder !== "boolean" ||
      typeof next.shortcut !== "string" ||
      !next.shortcut.trim()
    )
      throw new Error("Configurações inválidas.");
    const updated = {
      shortcut: next.shortcut.trim(),
      defaultImageQuality: next.defaultImageQuality,
      soundEnabled: next.soundEnabled,
      autoOpenFolder: next.autoOpenFolder,
    };
    registerHotkeys(updated.shortcut);
    try {
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      fs.writeFileSync(settingsPath + ".tmp", JSON.stringify(updated, null, 2));
      fs.renameSync(settingsPath + ".tmp", settingsPath);
    } catch (error) {
      if (updated.shortcut !== appSettings.shortcut) {
        globalShortcut.unregister(updated.shortcut);
        registerHotkeys(appSettings.shortcut);
      }
      throw error;
    }
    appSettings = updated;
    broadcast("settings-changed", appSettings);
    return appSettings;
  });
  handle("select-files", async (event) => {
    const result = await dialog.showOpenDialog(
      BrowserWindow.fromWebContents(event.sender),
      {
        properties: ["openFile", "multiSelections"],
        filters: [
          {
            name: "Mídia",
            extensions: Object.values(FORMAT_CATEGORIES).flatMap(
              (cat) => cat.extensions,
            ),
          },
        ],
      },
    );
    return result.canceled ? [] : result.filePaths;
  });
  handle("show-item-in-folder", (_event, file) => {
    if (
      typeof file !== "string" ||
      !conversionHistory.some((item) => item.outputPath === file) ||
      !fs.existsSync(file)
    )
      throw new Error("Arquivo não encontrado.");
    shell.showItemInFolder(file);
    return true;
  });
  handle("open-dashboard", () => openDashboard());
  handle("open-radial", () => toggleRadialAtCursor());
  handle("radial-close", () => hideRadialWindow());
}
