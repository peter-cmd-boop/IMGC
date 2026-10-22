// Runs the actual application in an isolated profile; never reads the user's history.
const { app, BrowserWindow, dialog } = require("electron");
const fs = require("fs");
const path = require("path");
const assert = require("assert/strict");
const sharp = require("sharp");
const root = path.join(__dirname, "smoke-profile");
fs.mkdirSync(root, { recursive: true });
app.setPath("userData", root);
app.setPath("sessionData", root);
fs.writeFileSync(
  path.join(root, "imgc_settings.json"),
  JSON.stringify({
    shortcut: "Control+Alt+Shift+F12",
    soundEnabled: false,
    defaultImageQuality: 70,
    autoOpenFolder: false,
  }),
);
let selected = [];
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: selected });
dialog.showErrorBox = (_title, text) => {
  throw new Error(text);
};
const failures = [];
app.on("web-contents-created", (_event, contents) => {
  contents.on("console-message", (event) => {
    if (event.level === "error") failures.push(event.message);
  });
  contents.on("render-process-gone", (_event, detail) =>
    failures.push(JSON.stringify(detail)),
  );
});
require("../src/main/index");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(predicate, message) {
  for (let n = 0; n < 100; n++) {
    if (await predicate()) return;
    await delay(100);
  }
  throw new Error(message);
}
app.whenReady().then(async () => {
  try {
    await until(
      () => BrowserWindow.getAllWindows().length === 2,
      "windows missing",
    );
    const windows = BrowserWindow.getAllWindows();
    await Promise.all(
      windows.map((win) =>
        win.webContents.isLoading()
          ? new Promise((resolve) =>
              win.webContents.once("did-finish-load", resolve),
            )
          : Promise.resolve(),
      ),
    );
    const dashboard = windows.find((w) =>
      w.webContents.getURL().includes("dashboard"),
    );
    const radial = windows.find((w) =>
      w.webContents.getURL().includes("radial"),
    );
    const run = (code) => dashboard.webContents.executeJavaScript(code);
    const wheel = (code) => radial.webContents.executeJavaScript(code);
    await until(
      () => run("document.getElementById('setting-quality').value === '70'"),
      "settings not loaded",
    );
    const a = path.join(root, "first.jpg"),
      b = path.join(root, "second.jpg");
    await sharp({
      create: { width: 40, height: 20, channels: 3, background: "red" },
    })
      .withMetadata({ exif: { IFD0: { Artist: "private" } } })
      .jpeg()
      .toFile(a);
    fs.copyFileSync(a, b);
    selected = [a, b];
    await run("document.getElementById('btn-select-files').click()");
    await until(() => run("stagedPaths.length === 2"), "selection failed");
    await run(
      "document.getElementById('target-formats-grid').querySelector('button').click()",
    );
    await until(
      () =>
        run(
          "!busy && document.getElementById('status-message').textContent.includes('Concluído')",
        ),
      "batch did not finish",
    );
    assert.equal((await run("window.tangerine.getHistory()")).length, 2);
    await run(
      "window.tangerine.saveSettings({shortcut:'Control+Alt+Shift+F12',defaultImageQuality:60,soundEnabled:false,autoOpenFolder:false})",
    );
    assert.equal(await wheel("sounds.enabled"), false);
    assert.equal(
      (await run("window.tangerine.getSettings()")).defaultImageQuality,
      60,
    );
    // A category change stages the file without converting a different visible slice.
    await wheel("switchCategory('video')");
    assert.equal(await wheel("stagePaths(" + JSON.stringify([a]) + ")"), false);
    assert.equal((await run("window.tangerine.getHistory()")).length, 2);
    assert.equal(await wheel("getSliceIndexFromCoords(260,260)"), -1);
    await wheel("processDropOnItem({id:'strip_exif'})");
    await until(
      () =>
        wheel(
          "!busy && document.getElementById('hub-primary-text').textContent === 'PRONTO'",
        ),
      "radial conversion failed",
    );
    const history = await run("window.tangerine.getHistory()");
    assert.equal(
      (await sharp(history[0].outputPath).metadata()).exif,
      undefined,
    );
    // Renderer errors remain visible and do not silently start another conversion.
    assert.equal(await wheel("stagePaths(['D:/unknown.exe'])"), false);
    assert.match(
      await wheel("document.getElementById('radial-status').textContent"),
      /suportados/,
    );
    dashboard.show();
    await delay(250);
    await dashboard.webContents
      .capturePage()
      .then((img) =>
        fs.writeFileSync(path.join(root, "dashboard.png"), img.toPNG()),
      );
    radial.show();
    await delay(250);
    await radial.webContents
      .capturePage()
      .then((img) =>
        fs.writeFileSync(path.join(root, "radial.png"), img.toPNG()),
      );
    await run("window.tangerine.clearHistory()");
    assert.equal((await run("window.tangerine.getHistory()")).length, 0);
    assert.deepEqual(failures, []);
    console.log(
      "PASS: actual Electron selection, batch conversion, settings, history, radial staging, EXIF and visible errors.",
    );
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
