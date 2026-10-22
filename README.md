# IMGC — Zero-Click Offline Media Converter

> **Conversor contextual de mídia ultrarrápido, 100% offline e com interface radial flutuante para Windows e Linux.**  
> Projetado para transformar arquivos de Imagem, Vídeo e Áudio com um único gesto de arrastar e soltar.

---

## 🤖 Aviso de Desenvolvimento (Built with AI)

Este projeto foi **concebido, arquitetado e desenvolvido em colaboração com Inteligência Artificial**, passando por auditorias e refinamentos estéticos humanos para garantir um padrão visual utilitário e técnico, sem templates genéricos, e com engenharia de alta performance voltada para ambientes desktop (Windows e Linux).

---

## ⚡ O que é o IMGC?

Inspirado no conceito do utilitário *Tangerine* (macOS), o **IMGC** traz para o Windows e Linux uma experiência de conversão de mídia fluida:

1. **Zero-Click**: Arraste qualquer arquivo de imagem, vídeo ou áudio para a tela ou acione o atalho global.
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

## 📦 Como Usar (Downloads Prontos)

Baixe a versão compilada para o seu sistema na aba **[Releases](https://github.com/peter-cmd-boop/IMGC/releases)**:

### 🪟 Windows (64-bit)
1. Baixe o arquivo `IMGC-Windows-x64.zip`.
2. Extraia o conteúdo e dê dois cliques em `IMGC.exe`.
3. Pronto! O app fica disponível em segundo plano na bandeja do sistema.

### 🐧 Linux (64-bit)
1. Baixe o arquivo `IMGC-Linux-x64.tar.gz`.
2. Extraia o pacote e execute pelo terminal ou dois cliques:
```bash
tar -xzf IMGC-Linux-x64.tar.gz
cd IMGC-linux-x64
./start.sh
```

---

## 🛠️ Stack Tecnológica

* **Runtime**: [Electron](https://www.electronjs.org/) (Janela transparente circular acelerada por hardware).
* **Processamento de Imagem**: [Sharp](https://sharp.pixelplumbing.com/) (Libvips nativo de alta performance para Windows e Linux).
* **Processamento de Áudio e Vídeo**: [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-ffmpeg) com binários estáticos embutidos de [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static).
* **Interface**: Vanilla JavaScript + SVG inline vetorial com design system utilitário técnico.

---

## 📄 Licença

Distribuído sob a licença MIT. Veja `LICENSE` para mais detalhes.
