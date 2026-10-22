"use strict";
const api = window.tangerine,
  el = (id) => document.getElementById(id);
let submitting = false,
  earlyUpdates = [];
let stagedPaths = [],
  activeCategory = "image",
  activeTab = "formats",
  busy = false,
  pending = new Set(),
  completed = 0,
  errors = [];
const nameOf = (p) => p.split(/[\\/]/).pop();
const message = (text) => {
  el("status-message").textContent = text;
};
function switchCategory(cat) {
  if (busy) return;
  if (stagedPaths.length && detectCategory(stagedPaths[0]) !== cat) {
    message("Selecione arquivos desta categoria.");
    return;
  }
  activeCategory = cat;
  document
    .querySelectorAll(".type-pill")
    .forEach((p) => p.classList.toggle("active", p.id === "pill-" + cat));
  render();
}
function stage(paths) {
  if (busy || !paths.length) return;
  const cat = detectCategory(paths[0]);
  if (!cat || paths.some((p) => detectCategory(p) !== cat)) {
    message("Selecione arquivos suportados de uma mesma categoria por lote.");
    return;
  }
  if (paths.length > 200) {
    message("Limite de 200 arquivos por lote.");
    return;
  }
  stagedPaths = [...new Set(paths)];
  activeCategory = cat;
  el("drop-prompt").classList.add("hidden");
  el("staged-card").classList.remove("hidden");
  el("staged-filename").textContent =
    paths.length === 1
      ? nameOf(paths[0])
      : paths.length + " arquivos selecionados";
  el("staged-meta").textContent =
    FORMAT_CATEGORIES[cat].name + " • Salvos na pasta de cada original";
  el("staged-icon").textContent = FORMAT_CATEGORIES[cat].badge;
  switchCategory(cat);
  message("Escolha uma operação para o lote.");
}
function render() {
  el("target-formats-grid").replaceChildren();
  if (!stagedPaths.length) return;
  for (const item of FORMAT_CATEGORIES[activeCategory][activeTab]) {
    const button = document.createElement("button");
    button.className = "format-card-btn";
    button.disabled = busy;
    const title = document.createElement("strong");
    title.className = "format-btn-label";
    title.textContent = item.label;
    const desc = document.createElement("span");
    desc.className = "format-btn-desc";
    desc.textContent = item.desc;
    button.append(title, desc);
    button.onclick = () => run(item);
    el("target-formats-grid").append(button);
  }
}
async function run(item) {
  if (busy || !stagedPaths.length) return;
  busy = true;
  completed = 0;
  errors = [];
  render();
  el("btn-cancel").hidden = false;
  message("Preparando fila…");
  try {
    submitting = true;
    pending = new Set(await api.queueFiles(stagedPaths, item.id));
    submitting = false;
    earlyUpdates.splice(0).forEach(onJobUpdate);
    sounds.playDrop();
  } catch (e) {
    submitting = false;
    earlyUpdates = [];
    busy = false;
    el("btn-cancel").hidden = true;
    render();
    message(e.message);
  }
}
function onJobUpdate(u) {
  if (!pending.has(u.id)) {
    if (submitting) earlyUpdates.push(u);
    return;
  }
  if (u.state === "running")
    message(
      "Convertendo " +
        nameOf(u.inputPath) +
        (u.percent != null ? " • " + u.percent + "%" : "") +
        " • " +
        completed +
        "/" +
        stagedPaths.length,
    );
  if (["done", "error", "cancelled"].includes(u.state)) {
    pending.delete(u.id);
    completed++;
    if (u.warning) errors.push(u.warning);
    if (u.error) errors.push(nameOf(u.inputPath) + ": " + u.error);
    if (!pending.size) {
      busy = false;
      el("btn-cancel").hidden = true;
      render();
      message(
        errors.length
          ? errors.join(" | ")
          : "Concluído: " +
              completed +
              " arquivo(s). Use “Abrir pasta” no histórico.",
      );
    }
  }
}
api.onJobUpdate(onJobUpdate);
async function loadHistory() {
  try {
    const history = await api.getHistory();
    el("history-count").textContent = history.length + " arquivos";
    el("history-empty").classList.toggle("hidden", !!history.length);
    el("history-items").classList.toggle("hidden", !history.length);
    el("history-items").replaceChildren();
    for (const item of history) {
      const row = document.createElement("div");
      row.className = "history-row";
      const info = document.createElement("div");
      info.textContent =
        (item.outputName || item.fileName) +
        " • " +
        (item.newSize / 1024).toFixed(1) +
        " KB";
      const open = document.createElement("button");
      open.className = "btn-open-explorer";
      open.textContent = "Abrir pasta";
      open.onclick = () =>
        api.showItemInFolder(item.outputPath).catch((e) => message(e.message));
      row.append(info, open);
      el("history-items").append(row);
    }
  } catch (e) {
    message(e.message);
  }
}
function settings(s) {
  sounds.enabled = s.soundEnabled;
  el("setting-shortcut").value = s.shortcut;
  el("setting-quality").value = s.defaultImageQuality;
  el("quality-val").textContent = s.defaultImageQuality + "%";
  el("setting-auto-open").checked = s.autoOpenFolder;
  el("setting-sound").checked = s.soundEnabled;
}
el("btn-select-files").onclick = () =>
  api
    .selectFiles()
    .then(stage)
    .catch((e) => message(e.message));
el("drop-zone").ondragover = (e) => e.preventDefault();
el("drop-zone").ondrop = (e) => {
  e.preventDefault();
  try {
    stage([...e.dataTransfer.files].map((f) => api.getPathForFile(f)));
  } catch (error) {
    message(error.message);
  }
};
el("btn-clear-staged").onclick = () => {
  if (busy) return;
  stagedPaths = [];
  el("staged-card").classList.add("hidden");
  el("drop-prompt").classList.remove("hidden");
  message("");
};
el("btn-cancel").onclick = () =>
  api.cancelJobs().catch((e) => message(e.message));
for (const tab of ["formats", "tools"])
  el("tab-" + tab).onclick = () => {
    if (busy) return;
    activeTab = tab;
    for (const t of ["formats", "tools"])
      el("tab-" + t).classList.toggle("active", t === tab);
    render();
  };
el("btn-clear-history").onclick = () =>
  api
    .clearHistory()
    .then(loadHistory)
    .catch((e) => message(e.message));
el("btn-trigger-radial").onclick = () =>
  api.openRadial().catch((e) => message(e.message));
el("btn-settings").onclick = () =>
  el("settings-modal").classList.remove("hidden");
el("btn-close-settings").onclick = () =>
  el("settings-modal").classList.add("hidden");
el("setting-quality").oninput = () => {
  el("quality-val").textContent = el("setting-quality").value + "%";
};
el("btn-save-settings").onclick = async () => {
  try {
    await api.saveSettings({
      shortcut: el("setting-shortcut").value,
      defaultImageQuality: Number(el("setting-quality").value),
      autoOpenFolder: el("setting-auto-open").checked,
      soundEnabled: el("setting-sound").checked,
    });
    el("settings-error").textContent = "";
    el("settings-modal").classList.add("hidden");
    message("Configurações salvas.");
  } catch (e) {
    el("settings-error").textContent = e.message;
  }
};
api.onConversionComplete(loadHistory);
api.onHistoryChanged(loadHistory);
api.onSettingsChanged(settings);
api
  .getSettings()
  .then(settings)
  .catch((e) => message(e.message));
loadHistory();
