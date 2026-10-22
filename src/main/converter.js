const path = require("path");
const fs = require("fs");
const { AsyncLocalStorage } = require("async_hooks");
const {
  FORMAT_CATEGORIES,
  detectCategory,
} = require("../renderer/shared/formats");
const outputs = new AsyncLocalStorage();

// Lazy-loaded dependencies to minimize startup RAM & CPU
let _sharp = null;
let _ffmpeg = null;

function getSharp() {
  if (!_sharp) {
    _sharp = require("sharp");
  }
  return _sharp;
}

function getFfmpeg() {
  if (!_ffmpeg) {
    _ffmpeg = require("fluent-ffmpeg");
    const ffmpegPath = require("ffmpeg-static");
    if (ffmpegPath && fs.existsSync(ffmpegPath)) {
      _ffmpeg.setFfmpegPath(ffmpegPath);
    }
  }
  return _ffmpeg;
}

/**
 * Determine unique output file path avoiding overwriting
 */
function getUniqueOutputPath(sourcePath, newExtension, suffix = "") {
  const dir = path.dirname(sourcePath);
  const ext = path.extname(sourcePath);
  const baseName = path.basename(sourcePath, ext);
  const targetExt = newExtension.startsWith(".")
    ? newExtension
    : `.${newExtension}`;

  for (let counter = 0; ; counter++) {
    const candidate = path.join(
      dir,
      baseName +
        (suffix ? "_" + suffix : "") +
        (counter ? "_" + counter : "") +
        targetExt,
    );
    try {
      fs.closeSync(fs.openSync(candidate, "wx"));
      outputs.getStore()?.push(candidate);
      return candidate;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
}

/**
 * Main conversion dispatcher
 */
async function convertFileInternal(
  inputPath,
  targetFormatOrTool,
  options = {},
) {
  const startTime = Date.now();
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Arquivo não encontrado: ${inputPath}`);
  }

  const stat = fs.statSync(inputPath);
  if (!stat.isFile()) throw new Error("Selecione um arquivo, não uma pasta.");
  if (options.signal?.aborted) throw new Error("Conversão cancelada.");
  const originalSize = stat.size;
  const ext = path.extname(inputPath).toLowerCase().replace(".", "");

  let result = null;

  // Decide category
  const category = detectCategory(inputPath);
  if (!category) throw new Error("Tipo de arquivo não suportado: ." + ext);
  const allowed = [
    ...FORMAT_CATEGORIES[category].formats,
    ...FORMAT_CATEGORIES[category].tools,
  ];
  if (
    typeof targetFormatOrTool !== "string" ||
    !allowed.some((item) => item.id === targetFormatOrTool)
  )
    throw new Error("Operação incompatível com este arquivo.");
  const isImage = category === "image";
  const isVideo = category === "video";
  const isAudio = category === "audio";

  if (isImage) {
    result = await handleImageConversion(
      inputPath,
      targetFormatOrTool,
      options,
    );
  } else if (isVideo) {
    result = await handleVideoConversion(
      inputPath,
      targetFormatOrTool,
      options,
    );
  } else if (isAudio) {
    result = await handleAudioConversion(
      inputPath,
      targetFormatOrTool,
      options,
    );
  } else {
    throw new Error(`Tipo de arquivo não suportado (.${ext})`);
  }

  if (options.signal?.aborted) throw new Error("Conversão cancelada.");
  const outputStat = fs.statSync(result.outputPath);
  const durationMs = Date.now() - startTime;
  const newSize = outputStat.size;
  const ratio =
    originalSize > 0 ? ((1 - newSize / originalSize) * 100).toFixed(1) : 0;

  return {
    success: true,
    inputPath,
    outputPath: result.outputPath,
    format: targetFormatOrTool,
    originalSize,
    newSize,
    savedPercentage: parseFloat(ratio),
    durationMs,
  };
}

/**
 * Image Conversion Pipeline (Sharp - Lazy Loaded)
 */
async function handleImageConversion(inputPath, target, options) {
  const sharp = getSharp();
  const quality = options.quality ?? 85;
  if (!Number.isInteger(quality) || quality < 1 || quality > 100)
    throw new Error("Qualidade deve estar entre 1 e 100.");
  const meta = await sharp(inputPath).metadata();
  if ((meta.pages || 1) > 1)
    throw new Error(
      "Imagens animadas ou com várias páginas ainda não são aceitas. Selecione uma imagem estática.",
    );
  let pipeline = sharp(inputPath).rotate();

  switch (target.toLowerCase()) {
    case "webp": {
      const outputPath = getUniqueOutputPath(inputPath, "webp");
      await pipeline.webp({ quality, effort: 4 }).toFile(outputPath);
      return { outputPath };
    }
    case "jpg":
    case "jpeg": {
      const outputPath = getUniqueOutputPath(inputPath, "jpg");
      await pipeline
        .flatten({ background: "#ffffff" })
        .jpeg({ quality, mozjpeg: true })
        .toFile(outputPath);
      return { outputPath };
    }
    case "png": {
      const outputPath = getUniqueOutputPath(inputPath, "png");
      await pipeline.png({ compressionLevel: 8 }).toFile(outputPath);
      return { outputPath };
    }
    case "avif": {
      const outputPath = getUniqueOutputPath(inputPath, "avif");
      await pipeline
        .avif({ quality: Math.min(quality, 75), effort: 4 })
        .toFile(outputPath);
      return { outputPath };
    }
    case "ico": {
      const outputPath = getUniqueOutputPath(inputPath, "ico");
      const sizes = [16, 32, 48, 64, 128, 256];
      const buffers = await Promise.all(
        sizes.map((size) =>
          pipeline
            .clone()
            .resize(size, size, {
              fit: "contain",
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .png()
            .toBuffer(),
        ),
      );
      const header = Buffer.alloc(6 + sizes.length * 16);
      header.writeUInt16LE(1, 2);
      header.writeUInt16LE(sizes.length, 4);
      let offset = header.length;
      buffers.forEach((buffer, i) => {
        const at = 6 + i * 16;
        header[at] = header[at + 1] = sizes[i] === 256 ? 0 : sizes[i];
        header.writeUInt16LE(1, at + 4);
        header.writeUInt16LE(32, at + 6);
        header.writeUInt32LE(buffer.length, at + 8);
        header.writeUInt32LE(offset, at + 12);
        offset += buffer.length;
      });
      fs.writeFileSync(outputPath, Buffer.concat([header, ...buffers]));
      return { outputPath };
    }
    case "tiff": {
      const outputPath = getUniqueOutputPath(inputPath, "tiff");
      await pipeline.tiff({ compression: "lzw" }).toFile(outputPath);
      return { outputPath };
    }
    case "compress":
    case "otimizar": {
      const inputExt = path.extname(inputPath).slice(1).toLowerCase();
      const ext = [
        "jpg",
        "jpeg",
        "png",
        "webp",
        "avif",
        "tiff",
        "gif",
      ].includes(inputExt)
        ? inputExt
        : "png";
      const outputPath = getUniqueOutputPath(inputPath, ext, "optimized");
      if (ext === "png") {
        await pipeline
          .png({ quality: 80, compressionLevel: 9 })
          .toFile(outputPath);
      } else if (ext === "webp") {
        await pipeline.webp({ quality: 75 }).toFile(outputPath);
      } else if (ext === "jpg" || ext === "jpeg") {
        await pipeline.jpeg({ quality: 75, mozjpeg: true }).toFile(outputPath);
      } else {
        await pipeline.toFormat(ext).toFile(outputPath);
      }
      return { outputPath };
    }
    case "strip_exif": {
      const ext =
        path.extname(inputPath).toLowerCase() === ".svg"
          ? "png"
          : path.extname(inputPath).slice(1).toLowerCase();
      const outputPath = getUniqueOutputPath(inputPath, ext, "no_exif");
      await pipeline.toFile(outputPath);
      return { outputPath };
    }
    case "resize_50": {
      const ext =
        path.extname(inputPath).toLowerCase() === ".svg"
          ? "png"
          : path.extname(inputPath).slice(1).toLowerCase();
      const meta = await sharp(inputPath).metadata();
      const newWidth = Math.max(
        1,
        Math.round(
          (([5, 6, 7, 8].includes(meta.orientation)
            ? meta.height
            : meta.width) || 1) * 0.5,
        ),
      );
      const outputPath = getUniqueOutputPath(inputPath, ext, "half");
      await pipeline.resize({ width: newWidth }).toFile(outputPath);
      return { outputPath };
    }
    case "to_grayscale": {
      const ext =
        path.extname(inputPath).toLowerCase() === ".svg"
          ? "png"
          : path.extname(inputPath).slice(1).toLowerCase();
      const outputPath = getUniqueOutputPath(inputPath, ext, "gray");
      await pipeline.grayscale().toFile(outputPath);
      return { outputPath };
    }
    default: {
      const outputPath = getUniqueOutputPath(inputPath, "webp");
      await pipeline.webp({ quality }).toFile(outputPath);
      return { outputPath };
    }
  }
}

/**
 * Video Conversion Pipeline (FFmpeg - Lazy Loaded)
 */
async function handleVideoConversion(inputPath, target, options = {}) {
  // Calculate a bitrate from the complete duration instead of truncating with -fs.
  let targetBitrate;
  if (target === "discord_compress") {
    const { execFile } = require("child_process");
    const stderr = await new Promise((resolve, reject) => {
      execFile(
        require("ffmpeg-static"),
        ["-hide_banner", "-i", inputPath],
        { windowsHide: true, signal: options.signal },
        (error, _stdout, stderr) => {
          if (options.signal?.aborted)
            return reject(new Error("Conversão cancelada."));
          if (error && !stderr) return reject(error);
          resolve(stderr);
        },
      );
    });
    const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    const seconds =
      match &&
      Number(match[1]) * 3600 +
        Number(match?.[2] || 0) * 60 +
        Number(match?.[3] || 0);
    if (!seconds)
      throw new Error("Não foi possível determinar a duração do vídeo.");
    targetBitrate = Math.floor(
      ((24 * 1000 * 1000 * 8 * 0.94) / seconds - 128000) / 1000,
    );
    if (targetBitrate < 100)
      throw new Error(
        "Vídeo longo demais para 24 MB. Divida o vídeo antes de comprimir.",
      );
  }
  const ffmpeg = getFfmpeg();
  return new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath);
    let outputPath = "";

    if (options && typeof options.onProgress === "function") {
      command.on("progress", (progress) => {
        const pct = Number.isFinite(progress.percent)
          ? Math.max(0, Math.min(100, Math.round(progress.percent)))
          : null;
        options.onProgress({ percent: pct, timemark: progress.timemark });
      });
    }

    switch (target.toLowerCase()) {
      case "mp4": {
        outputPath = getUniqueOutputPath(inputPath, "mp4");
        command
          .videoCodec("libx264")
          .audioCodec("aac")
          .outputOptions([
            "-crf 23",
            "-preset fast",
            "-pix_fmt yuv420p",
            "-movflags +faststart",
          ]);
        break;
      }
      case "webm": {
        outputPath = getUniqueOutputPath(inputPath, "webm");
        command
          .videoCodec("libvpx-vp9")
          .audioCodec("libopus")
          .outputOptions(["-crf 30", "-b:v 0", "-preset fast"]);
        break;
      }
      case "gif": {
        outputPath = getUniqueOutputPath(inputPath, "gif");
        command.complexFilter([
          "fps=15,scale=480:-1:flags=lanczos,split[s0][s1]",
          "[s0]palettegen=max_colors=256[p]",
          "[s1][p]paletteuse=dither=bayer",
        ]);
        break;
      }
      case "mov": {
        outputPath = getUniqueOutputPath(inputPath, "mov");
        command
          .videoCodec("libx264")
          .audioCodec("aac")
          .outputOptions(["-crf 20", "-preset fast"]);
        break;
      }
      case "mkv": {
        outputPath = getUniqueOutputPath(inputPath, "mkv");
        command
          .videoCodec("libx264")
          .audioCodec("aac")
          .outputOptions(["-crf 22", "-preset fast"]);
        break;
      }
      case "mp3": {
        outputPath = getUniqueOutputPath(inputPath, "mp3");
        command.noVideo().audioCodec("libmp3lame").audioBitrate("320k");
        break;
      }
      case "discord_compress": {
        outputPath = getUniqueOutputPath(inputPath, "mp4", "discord25mb");
        command
          .videoCodec("libx264")
          .audioCodec("aac")
          .audioBitrate("128k")
          .videoBitrate(`${targetBitrate}k`)
          .outputOptions(["-preset fast", "-movflags +faststart"]);
        break;
      }
      case "strip_audio": {
        outputPath = getUniqueOutputPath(
          inputPath,
          path.extname(inputPath),
          "mudo",
        );
        command.noAudio().videoCodec("copy");
        break;
      }
      case "speed_2x": {
        outputPath = getUniqueOutputPath(inputPath, "mp4", "2x");
        command.videoFilters("setpts=0.5*PTS").audioFilters("atempo=2.0");
        break;
      }
      case "extract_wav": {
        outputPath = getUniqueOutputPath(inputPath, "wav", "audio");
        command.noVideo().audioCodec("pcm_s24le").audioFrequency(48000);
        break;
      }
      default: {
        outputPath = getUniqueOutputPath(inputPath, "mp4");
        command.videoCodec("libx264").audioCodec("aac");
        break;
      }
    }

    const abort = () => command.kill("SIGKILL");
    if (options.signal?.aborted)
      return reject(new Error("Conversão cancelada."));
    options.signal?.addEventListener("abort", abort, { once: true });
    command.on("start", () => {
      if (options.signal?.aborted) abort();
    });
    const cleanup = () => options.signal?.removeEventListener("abort", abort);
    command.on("end", cleanup).on("error", cleanup);
    command
      .output(outputPath)
      .on("end", () => {
        if (
          target === "discord_compress" &&
          fs.statSync(outputPath).size > 24 * 1000 * 1000
        ) {
          reject(
            new Error("O vídeo completo excedeu 24 MB. Use uma duração menor."),
          );
        } else resolve({ outputPath });
      })
      .on("error", (err) => reject(new Error(`FFmpeg erro: ${err.message}`)))
      .run();
  });
}

/**
 * Audio Conversion Pipeline (FFmpeg - Lazy Loaded)
 */
function handleAudioConversion(inputPath, target, options = {}) {
  const ffmpeg = getFfmpeg();
  return new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath).noVideo();
    let outputPath = "";

    if (options && typeof options.onProgress === "function") {
      command.on("progress", (progress) => {
        const pct = Number.isFinite(progress.percent)
          ? Math.max(0, Math.min(100, Math.round(progress.percent)))
          : null;
        options.onProgress({ percent: pct, timemark: progress.timemark });
      });
    }

    switch (target.toLowerCase()) {
      case "mp3": {
        outputPath = getUniqueOutputPath(inputPath, "mp3");
        command.audioCodec("libmp3lame").audioBitrate("320k");
        break;
      }
      case "wav": {
        outputPath = getUniqueOutputPath(inputPath, "wav");
        command.audioCodec("pcm_s24le").audioFrequency(48000);
        break;
      }
      case "flac": {
        outputPath = getUniqueOutputPath(inputPath, "flac");
        command.audioCodec("flac");
        break;
      }
      case "aac": {
        outputPath = getUniqueOutputPath(inputPath, "m4a");
        command.audioCodec("aac").audioBitrate("256k");
        break;
      }
      case "ogg": {
        outputPath = getUniqueOutputPath(inputPath, "ogg");
        command.audioCodec("libvorbis").audioBitrate("192k");
        break;
      }
      case "opus": {
        outputPath = getUniqueOutputPath(inputPath, "opus");
        command.audioCodec("libopus").audioBitrate("128k");
        break;
      }
      case "normalize": {
        outputPath = getUniqueOutputPath(inputPath, "mp3", "lufs14");
        command
          .audioCodec("libmp3lame")
          .audioFilters("loudnorm=I=-14:LRA=11:TP=-1.5");
        break;
      }
      case "to_mono": {
        outputPath = getUniqueOutputPath(inputPath, "mp3", "mono");
        command.audioCodec("libmp3lame").audioChannels(1);
        break;
      }
      case "speed_15": {
        outputPath = getUniqueOutputPath(inputPath, "mp3", "1.5x");
        command.audioCodec("libmp3lame").audioFilters("atempo=1.5");
        break;
      }
      case "silence_trim": {
        outputPath = getUniqueOutputPath(inputPath, "mp3", "trimmed");
        command
          .audioCodec("libmp3lame")
          .audioFilters(
            "silenceremove=start_periods=1:start_duration=0.1:start_threshold=-50dB:stop_periods=0,areverse,silenceremove=start_periods=1:start_duration=0.1:start_threshold=-50dB,areverse",
          );
        break;
      }
      default: {
        outputPath = getUniqueOutputPath(inputPath, "mp3");
        command.audioCodec("libmp3lame").audioBitrate("320k");
        break;
      }
    }

    const abort = () => command.kill("SIGKILL");
    if (options.signal?.aborted)
      return reject(new Error("Conversão cancelada."));
    options.signal?.addEventListener("abort", abort, { once: true });
    command.on("start", () => {
      if (options.signal?.aborted) abort();
    });
    const cleanup = () => options.signal?.removeEventListener("abort", abort);
    command.on("end", cleanup).on("error", cleanup);
    command
      .output(outputPath)
      .on("end", () => resolve({ outputPath }))
      .on("error", (err) =>
        reject(new Error(`FFmpeg áudio erro: ${err.message}`)),
      )
      .run();
  });
}

async function convertFile(...args) {
  return outputs.run([], async () => {
    try {
      return await convertFileInternal(...args);
    } catch (error) {
      for (const file of outputs.getStore()) {
        try {
          fs.unlinkSync(file);
        } catch {}
      }
      throw error;
    }
  });
}

module.exports = {
  convertFile,
  getUniqueOutputPath,
};
