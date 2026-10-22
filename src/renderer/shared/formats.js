// Definição de formatos e ferramentas suportadas pelo IMGC
// Categorias: image, video, audio
"use strict";

const FORMAT_CATEGORIES = {
  image: {
    id: "image",
    name: "Imagem",
    badge: "IMG",
    extensions: ["png", "jpg", "jpeg", "webp", "avif", "tiff", "gif", "svg"],
    formats: [
      {
        id: "webp",
        label: "WEBP",
        desc: "Até 85% mais leve com transparência",
      },
      {
        id: "jpg",
        label: "JPG",
        desc: "Fotografias com qualidade configurável",
      },
      { id: "png", label: "PNG", desc: "Compressão sem perdas com canal alfa" },
      {
        id: "ico",
        label: "ICO",
        desc: "Ícone multi-tamanho para Windows (16-256px)",
      },
      {
        id: "avif",
        label: "AVIF",
        desc: "Codec AV1 ultra-compacto de nova geração",
      },
      { id: "tiff", label: "TIFF", desc: "Padrão editorial sem perdas (LZW)" },
    ],
    tools: [
      {
        id: "compress",
        label: "OTIMIZAR",
        desc: "Reduz peso sem perda perceptível",
      },
      {
        id: "strip_exif",
        label: "LIMPAR EXIF",
        desc: "Remove GPS, câmera e metadados",
      },
      {
        id: "resize_50",
        label: "REDUZIR 50%",
        desc: "Reduz largura e altura pela metade",
      },
      {
        id: "to_grayscale",
        label: "MONOCROMO",
        desc: "Converte tons de cinza calibrados",
      },
    ],
  },
  video: {
    id: "video",
    name: "Vídeo",
    badge: "VID",
    extensions: [
      "mp4",
      "mov",
      "mkv",
      "webm",
      "avi",
      "wmv",
      "flv",
      "m4v",
      "3gp",
      "ts",
      "mts",
    ],
    formats: [
      {
        id: "mp4",
        label: "MP4",
        desc: "H.264 + AAC padrão universal web/mobile",
      },
      {
        id: "webm",
        label: "WEBM",
        desc: "VP9 + Opus aberto e leve para navegadores",
      },
      { id: "gif", label: "GIF", desc: "Animação 15fps com paleta otimizada" },
      { id: "mov", label: "MOV", desc: "Container QuickTime para edição" },
      { id: "mkv", label: "MKV", desc: "Vídeo H.264 e áudio AAC em Matroska" },
      {
        id: "mp3",
        label: "EXTRAIR MP3",
        desc: "Despeja trilha de áudio em 320kbps",
      },
    ],
    tools: [
      {
        id: "discord_compress",
        label: "DISCORD 25M",
        desc: "Comprime para limite de 24.5MB",
      },
      {
        id: "strip_audio",
        label: "MUDO",
        desc: "Remove áudio via stream copy rápido",
      },
      {
        id: "speed_2x",
        label: "TIMELAPSE 2X",
        desc: "Dobra velocidade de vídeo e som",
      },
      {
        id: "extract_wav",
        label: "EXTRAIR WAV",
        desc: "Áudio PCM 48kHz de estúdio sem perdas",
      },
    ],
  },
  audio: {
    id: "audio",
    name: "Áudio",
    badge: "ÁUD",
    extensions: [
      "mp3",
      "wav",
      "aac",
      "flac",
      "ogg",
      "m4a",
      "opus",
      "wma",
      "aiff",
      "alac",
    ],
    formats: [
      {
        id: "mp3",
        label: "MP3 320K",
        desc: "MPEG Layer-3 bitrate constante máximo",
      },
      {
        id: "wav",
        label: "WAV",
        desc: "PCM 24-bit 48kHz de estúdio sem compressão",
      },
      {
        id: "flac",
        label: "FLAC",
        desc: "Compressão 100% sem perdas (lossless)",
      },
      {
        id: "aac",
        label: "AAC / M4A",
        desc: "Padrão moderno de alta eficiência",
      },
      { id: "ogg", label: "OGG", desc: "Codec Vorbis ideal para jogos e web" },
      {
        id: "opus",
        label: "OPUS",
        desc: "Codec ultra-eficiente para voz e streaming",
      },
    ],
    tools: [
      {
        id: "normalize",
        label: "NORMALIZAR",
        desc: "Normaliza o volume para -14 LUFS",
      },
      {
        id: "to_mono",
        label: "CANAL MONO",
        desc: "Mescla estéreo em canal centralizado",
      },
      {
        id: "speed_15",
        label: "VELOCIDADE 1.5X",
        desc: "Acelera fala preservando tom original",
      },
      {
        id: "silence_trim",
        label: "CORTAR MUDO",
        desc: "Remove silêncio do início e do fim",
      },
    ],
  },
};

const CATEGORY_ORDER = ["image", "video", "audio"];

function detectCategory(fileName) {
  if (!fileName) return null;
  const ext = fileName.split(".").pop().toLowerCase();
  for (const [catKey, catData] of Object.entries(FORMAT_CATEGORIES)) {
    if (catData.extensions.includes(ext)) {
      return catKey;
    }
  }
  return null;
}

function getNextCategory(currentCategory) {
  const idx = CATEGORY_ORDER.indexOf(currentCategory);
  const nextIdx = (idx + 1) % CATEGORY_ORDER.length;
  return CATEGORY_ORDER[nextIdx];
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    FORMAT_CATEGORIES,
    CATEGORY_ORDER,
    detectCategory,
    getNextCategory,
  };
}
