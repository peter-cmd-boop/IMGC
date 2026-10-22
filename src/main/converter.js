const path = require('path');
const fs = require('fs');

// Lazy-loaded dependencies to minimize startup RAM & CPU
let _sharp = null;
let _ffmpeg = null;

function getSharp() {
  if (!_sharp) {
    _sharp = require('sharp');
  }
  return _sharp;
}

function getFfmpeg() {
  if (!_ffmpeg) {
    _ffmpeg = require('fluent-ffmpeg');
    const ffmpegPath = require('ffmpeg-static');
    if (ffmpegPath && fs.existsSync(ffmpegPath)) {
      _ffmpeg.setFfmpegPath(ffmpegPath);
    }
  }
  return _ffmpeg;
}

/**
 * Determine unique output file path avoiding overwriting
 */
function getUniqueOutputPath(sourcePath, newExtension, suffix = '') {
  const dir = path.dirname(sourcePath);
  const ext = path.extname(sourcePath);
  const baseName = path.basename(sourcePath, ext);
  const targetExt = newExtension.startsWith('.') ? newExtension : `.${newExtension}`;
  
  let candidate = path.join(dir, `${baseName}${suffix ? '_' + suffix : ''}${targetExt}`);
  if (!fs.existsSync(candidate)) return candidate;

  let counter = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${baseName}${suffix ? '_' + suffix : ''}_${counter}${targetExt}`);
    counter++;
  }
  return candidate;
}

/**
 * Main conversion dispatcher
 */
async function convertFile(inputPath, targetFormatOrTool, options = {}) {
  const startTime = Date.now();
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Arquivo não encontrado: ${inputPath}`);
  }

  const stat = fs.statSync(inputPath);
  const originalSize = stat.size;
  const ext = path.extname(inputPath).toLowerCase().replace('.', '');

  let result = null;

  // Decide category
  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'avif', 'tiff', 'gif', 'svg', 'bmp'].includes(ext);
  const isVideo = ['mp4', 'mov', 'mkv', 'webm', 'avi', 'wmv', 'flv'].includes(ext);
  const isAudio = ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'wma', 'opus'].includes(ext);

  if (isImage) {
    result = await handleImageConversion(inputPath, targetFormatOrTool, options);
  } else if (isVideo) {
    result = await handleVideoConversion(inputPath, targetFormatOrTool, options);
  } else if (isAudio) {
    result = await handleAudioConversion(inputPath, targetFormatOrTool, options);
  } else {
    throw new Error(`Tipo de arquivo não suportado (.${ext})`);
  }

  const outputStat = fs.statSync(result.outputPath);
  const durationMs = Date.now() - startTime;
  const newSize = outputStat.size;
  const ratio = originalSize > 0 ? ((1 - (newSize / originalSize)) * 100).toFixed(1) : 0;

  return {
    success: true,
    inputPath,
    outputPath: result.outputPath,
    format: targetFormatOrTool,
    originalSize,
    newSize,
    savedPercentage: parseFloat(ratio),
    durationMs
  };
}

/**
 * Image Conversion Pipeline (Sharp - Lazy Loaded)
 */
async function handleImageConversion(inputPath, target, options) {
  const sharp = getSharp();
  const quality = options.quality || 85;
  let pipeline = sharp(inputPath, { failOn: 'none' });

  switch (target.toLowerCase()) {
    case 'webp': {
      const outputPath = getUniqueOutputPath(inputPath, 'webp');
      await pipeline.webp({ quality, effort: 4 }).toFile(outputPath);
      return { outputPath };
    }
    case 'jpg':
    case 'jpeg': {
      const outputPath = getUniqueOutputPath(inputPath, 'jpg');
      await pipeline.jpeg({ quality, mozjpeg: true }).toFile(outputPath);
      return { outputPath };
    }
    case 'png': {
      const outputPath = getUniqueOutputPath(inputPath, 'png');
      await pipeline.png({ compressionLevel: 8 }).toFile(outputPath);
      return { outputPath };
    }
    case 'avif': {
      const outputPath = getUniqueOutputPath(inputPath, 'avif');
      await pipeline.avif({ quality: Math.min(quality, 75), effort: 4 }).toFile(outputPath);
      return { outputPath };
    }
    case 'ico': {
      const outputPath = getUniqueOutputPath(inputPath, 'ico');
      const pngBuffer = await pipeline.resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      const icoBuffer = createIcoFromPng(pngBuffer, 256, 256);
      fs.writeFileSync(outputPath, icoBuffer);
      return { outputPath };
    }
    case 'tiff': {
      const outputPath = getUniqueOutputPath(inputPath, 'tiff');
      await pipeline.tiff({ compression: 'lzw' }).toFile(outputPath);
      return { outputPath };
    }
    case 'compress':
    case 'otimizar': {
      const ext = path.extname(inputPath).replace('.', '') || 'jpg';
      const outputPath = getUniqueOutputPath(inputPath, ext, 'optimized');
      if (ext === 'png') {
        await pipeline.png({ quality: 80, compressionLevel: 9 }).toFile(outputPath);
      } else if (ext === 'webp') {
        await pipeline.webp({ quality: 75 }).toFile(outputPath);
      } else {
        await pipeline.jpeg({ quality: 75, mozjpeg: true }).toFile(outputPath);
      }
      return { outputPath };
    }
    case 'strip_exif': {
      const ext = path.extname(inputPath).replace('.', '') || 'jpg';
      const outputPath = getUniqueOutputPath(inputPath, ext, 'no_exif');
      await pipeline.withMetadata(false).toFile(outputPath);
      return { outputPath };
    }
    case 'resize_50': {
      const ext = path.extname(inputPath).replace('.', '') || 'png';
      const meta = await sharp(inputPath).metadata();
      const newWidth = Math.round((meta.width || 1000) * 0.5);
      const outputPath = getUniqueOutputPath(inputPath, ext, 'half');
      await pipeline.resize({ width: newWidth }).toFile(outputPath);
      return { outputPath };
    }
    case 'to_grayscale': {
      const ext = path.extname(inputPath).replace('.', '') || 'png';
      const outputPath = getUniqueOutputPath(inputPath, ext, 'gray');
      await pipeline.grayscale().toFile(outputPath);
      return { outputPath };
    }
    default: {
      const outputPath = getUniqueOutputPath(inputPath, 'webp');
      await pipeline.webp({ quality }).toFile(outputPath);
      return { outputPath };
    }
  }
}

function createIcoFromPng(pngBuffer, width, height) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry.writeUInt8(width >= 256 ? 0 : width, 0);
  entry.writeUInt8(height >= 256 ? 0 : height, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(22, 12);

  return Buffer.concat([header, entry, pngBuffer]);
}

/**
 * Video Conversion Pipeline (FFmpeg - Lazy Loaded)
 */
function handleVideoConversion(inputPath, target, options = {}) {
  const ffmpeg = getFfmpeg();
  return new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath);
    let outputPath = '';

    if (options && typeof options.onProgress === 'function') {
      command.on('progress', (progress) => {
        const pct = progress.percent ? Math.round(progress.percent) : null;
        options.onProgress({ percent: pct, timemark: progress.timemark });
      });
    }

    switch (target.toLowerCase()) {
      case 'mp4': {
        outputPath = getUniqueOutputPath(inputPath, 'mp4');
        command
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions(['-crf 23', '-preset fast', '-pix_fmt yuv420p', '-movflags +faststart']);
        break;
      }
      case 'webm': {
        outputPath = getUniqueOutputPath(inputPath, 'webm');
        command
          .videoCodec('libvpx-vp9')
          .audioCodec('libopus')
          .outputOptions(['-crf 30', '-b:v 0', '-preset fast']);
        break;
      }
      case 'gif': {
        outputPath = getUniqueOutputPath(inputPath, 'gif');
        command.complexFilter([
          'fps=15,scale=480:-1:flags=lanczos,split[s0][s1]',
          '[s0]palettegen=max_colors=256[p]',
          '[s1][p]paletteuse=dither=bayer'
        ]);
        break;
      }
      case 'mov': {
        outputPath = getUniqueOutputPath(inputPath, 'mov');
        command
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions(['-crf 20', '-preset fast']);
        break;
      }
      case 'mkv': {
        outputPath = getUniqueOutputPath(inputPath, 'mkv');
        command
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions(['-crf 22', '-preset fast']);
        break;
      }
      case 'mp3': {
        outputPath = getUniqueOutputPath(inputPath, 'mp3');
        command
          .noVideo()
          .audioCodec('libmp3lame')
          .audioBitrate('320k');
        break;
      }
      case 'discord_compress': {
        outputPath = getUniqueOutputPath(inputPath, 'mp4', 'discord25mb');
        command
          .videoCodec('libx264')
          .audioCodec('aac')
          .audioBitrate('128k')
          .outputOptions(['-fs 24M', '-preset fast', '-crf 26']);
        break;
      }
      case 'strip_audio': {
        outputPath = getUniqueOutputPath(inputPath, 'mp4', 'mudo');
        command
          .noAudio()
          .videoCodec('copy');
        break;
      }
      case 'speed_2x': {
        outputPath = getUniqueOutputPath(inputPath, 'mp4', '2x');
        command
          .videoFilters('setpts=0.5*PTS')
          .audioFilters('atempo=2.0');
        break;
      }
      case 'extract_wav': {
        outputPath = getUniqueOutputPath(inputPath, 'wav', 'audio');
        command
          .noVideo()
          .audioCodec('pcm_s16le')
          .audioFrequency(48000);
        break;
      }
      default: {
        outputPath = getUniqueOutputPath(inputPath, 'mp4');
        command.videoCodec('libx264').audioCodec('aac');
        break;
      }
    }

    command
      .output(outputPath)
      .on('end', () => resolve({ outputPath }))
      .on('error', (err) => reject(new Error(`FFmpeg erro: ${err.message}`)))
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
    let outputPath = '';

    if (options && typeof options.onProgress === 'function') {
      command.on('progress', (progress) => {
        const pct = progress.percent ? Math.round(progress.percent) : null;
        options.onProgress({ percent: pct, timemark: progress.timemark });
      });
    }

    switch (target.toLowerCase()) {
      case 'mp3': {
        outputPath = getUniqueOutputPath(inputPath, 'mp3');
        command.audioCodec('libmp3lame').audioBitrate('320k');
        break;
      }
      case 'wav': {
        outputPath = getUniqueOutputPath(inputPath, 'wav');
        command.audioCodec('pcm_s16le').audioFrequency(48000);
        break;
      }
      case 'flac': {
        outputPath = getUniqueOutputPath(inputPath, 'flac');
        command.audioCodec('flac');
        break;
      }
      case 'aac': {
        outputPath = getUniqueOutputPath(inputPath, 'm4a');
        command.audioCodec('aac').audioBitrate('256k');
        break;
      }
      case 'ogg': {
        outputPath = getUniqueOutputPath(inputPath, 'ogg');
        command.audioCodec('libvorbis').audioBitrate('192k');
        break;
      }
      case 'opus': {
        outputPath = getUniqueOutputPath(inputPath, 'opus');
        command.audioCodec('libopus').audioBitrate('128k');
        break;
      }
      case 'normalize': {
        outputPath = getUniqueOutputPath(inputPath, 'mp3', 'lufs14');
        command.audioCodec('libmp3lame').audioFilters('loudnorm=I=-14:LRA=11:TP=-1.5');
        break;
      }
      case 'to_mono': {
        outputPath = getUniqueOutputPath(inputPath, 'mp3', 'mono');
        command.audioCodec('libmp3lame').audioChannels(1);
        break;
      }
      case 'speed_15': {
        outputPath = getUniqueOutputPath(inputPath, 'mp3', '1.5x');
        command.audioCodec('libmp3lame').audioFilters('atempo=1.5');
        break;
      }
      case 'silence_trim': {
        outputPath = getUniqueOutputPath(inputPath, 'mp3', 'trimmed');
        command.audioCodec('libmp3lame').audioFilters(
          'silenceremove=start_periods=1:start_duration=0.1:start_threshold=-50dB:stop_periods=1:stop_duration=0.5:stop_threshold=-50dB'
        );
        break;
      }
      default: {
        outputPath = getUniqueOutputPath(inputPath, 'mp3');
        command.audioCodec('libmp3lame').audioBitrate('320k');
        break;
      }
    }

    command
      .output(outputPath)
      .on('end', () => resolve({ outputPath }))
      .on('error', (err) => reject(new Error(`FFmpeg áudio erro: ${err.message}`)))
      .run();
  });
}

module.exports = {
  convertFile,
  getUniqueOutputPath
};
