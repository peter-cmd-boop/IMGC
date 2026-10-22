# IMGC — Zero-Click Offline Media Converter

> **Conversor contextual de mídia ultrarrápido, 100% offline e com interface radial flutuante para Windows.**  
> Projetado para transformar arquivos de Imagem, Vídeo e Áudio com um único gesto de arrastar e soltar.

---

## 🤖 Aviso de Desenvolvimento (Built with AI)

Este projeto foi **concebido, arquitetado e desenvolvido em colaboração com Inteligência Artificial**, passando por auditorias e refinamentos estéticos humanos para garantir um padrão visual utilitário e técnico, sem templates genéricos, e com engenharia de alta performance voltada para o ambiente desktop nativo do Windows.

---

## ⚡ O que é o IMGC?

Inspirado no conceito do utilitário *Tangerine* (macOS), o **IMGC** traz para o Windows uma experiência de conversão de mídia fluida:

1. **Zero-Click**: Basta arrastar qualquer arquivo de imagem, vídeo ou áudio para o centro da tela.
2. A **Roda Radial Flutuante** surge instantaneamente sob o cursor.
3. Solte o arquivo na fatia do formato ou ferramenta desejada. O arquivo convertido é gravado no mesmo diretório em milissegundos.

O app opera em segundo plano na bandeja do sistema (*System Tray*), consumindo menos de **30 MB de memória RAM** em repouso.

---

## 🎯 Capacidades e Formatos

### 🖼️ Imagem (Engine: Sharp)
* **Formatos**: `WEBP`, `JPG` (90%), `PNG` (sem perdas), `ICO` (16 a 256px), `AVIF`, `TIFF`.
* **Ferramentas (`Alt`)**:
  * **Otimizar**: Compressão sem perda perceptível de nitidez.
  * **Limpar EXIF**: Remoção de metadados de câmera, data e localização GPS.
  * **Reduzir 50%**: Redimensionamento proporcional pela metade.
  * **Monocromo**: Conversão calibrada para escala de cinza.

### 🎬 Vídeo (Engine: FFmpeg)
* **Formatos**: `MP4` (H.264 + AAC com *faststart*), `WEBM` (VP9), `GIF` (paleta otimizada em 2 passadas sem granulação), `MOV`, `MKV`, `Extrair MP3`.
* **Ferramentas (`Alt`)**:
  * **Discord 25MB**: Compressão inteligente calculada para o limite de envio de chats.
  * **Mudo**: Remoção instantânea da faixa de áudio via *stream copy* (`-c:v copy -an`) em menos de 400ms.
  * **Timelapse 2X**: Aceleração de vídeo e áudio preservando o pitch sonoro.
  * **Extrair WAV**: Extração direta da trilha original em PCM 48kHz de estúdio.

### 🎵 Áudio (Engine: FFmpeg)
* **Formatos**: `MP3 320K` (CBR constante), `WAV` (PCM 24-bit 48kHz), `FLAC` (lossless), `AAC/M4A`, `OGG` (Vorbis), `OPUS`.
* **Ferramentas (`Alt`)**:
  * **Normalizar**: Nivelamento no padrão broadcast internacional EBU R128 (-14 LUFS).
  * **Canal Mono**: Mescla canais estéreo para narração e podcasts centrados.
  * **Velocidade 1.5X**: Acelera a fala preservando o tom acústico original.
  * **Cortar Mudo**: Remoção automática de trechos de silêncio do início e do final.

---

## ⌨️ Atalhos e Navegação

| Atalho | Ação |
| :--- | :--- |
| **`Alt + P`** ou **`F8`** ou **`Alt + C`** | Abre a roda radial na posição exata do cursor |
| **`Tab`** ou clique no badge | Alterna entre as categorias: **`[ IMG ]`** $\leftrightarrow$ **`[ VID ]`** $\leftrightarrow$ **`[ ÁUD ]`** |
| **`1`**, **`2`**, **`3`** | Seleção direta de categoria (1 = Imagem, 2 = Vídeo, 3 = Áudio) |
| **`Alt`** (segurar) | Alterna entre **Formatos Rápidos** e **Ferramentas Avançadas** |
| **`Esc`** | Fecha a roda imediatamente |

---

## 🛠️ Stack Tecnológica

* **Runtime**: [Electron](https://www.electronjs.org/) (Processo em background sem molduras, janela transparente circular acelerada por hardware).
* **Processamento de Imagem**: [Sharp](https://sharp.pixelplumbing.com/) (Bindings nativos em C++ via libvips para conversões ultrarrápidas).
* **Processamento de Áudio e Vídeo**: [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-ffmpeg) com binários estáticos offline de [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static).
* **Interface**: Vanilla JavaScript + SVG inline vetorial com design system utilitário técnico (sem dependências de frameworks pesados).

---

## 🚀 Como Executar ou Compilar

### Pré-requisitos
* [Node.js](https://nodejs.org/) (v18 ou superior)
* Windows 10 ou 11 (64-bit)

### Instalação
```bash
git clone https://github.com/seu-usuario/imgc.git
cd imgc
npm install
```

### Desenvolvimento
```bash
npm start
```

### Gerar o Executável (.exe)
```bash
npm run build:exe
```
O executável autônomo será gerado na pasta `dist/IMGC-win32-x64/IMGC.exe`.

---

## 📄 Licença

Distribuído sob a licença MIT. Veja `LICENSE` para mais detalhes.
