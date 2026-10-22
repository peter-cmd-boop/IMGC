# IMGC

Conversor local de imagens, vídeos e áudio para Windows e Linux, com painel e menu radial.

## Downloads — versão 1.0.2

- [Windows x64](https://github.com/peter-cmd-boop/IMGC/releases/download/v1.0.2/IMGC-Windows-x64-1.0.2.zip): extraia e execute `IMGC.exe` dentro da pasta extraída.
- [Linux x64 (glibc)](https://github.com/peter-cmd-boop/IMGC/releases/download/v1.0.2/IMGC-Linux-x64-1.0.2.tar.gz): extraia e execute `./start.sh`.
- [Notas da versão e arquivos de verificação SHA-256](https://github.com/peter-cmd-boop/IMGC/releases/tag/v1.0.2).

Feche a versão anterior pela bandeja antes de abrir a atualização. A interface foi testada no Windows. O pacote Linux teve seus arquivos, binários e permissões verificados, mas não foi executado neste ambiente.

## Usar

- Abra o app e clique em **Selecionar arquivos**, ou arraste arquivos para o painel.
- Escolha arquivos de uma mesma categoria por lote (até 200).
- Selecione o formato ou a ferramenta. A fila processa um arquivo por vez.
- **Cancelar lote** interrompe o vídeo/áudio em execução e cancela os itens pendentes. Uma imagem em processamento termina internamente antes de seu resultado ser descartado.
- Os resultados ficam nas pastas dos originais, com nomes únicos. Os originais não são sobrescritos.
- No histórico, use **Abrir pasta**. O histórico guarda as últimas 50 conversões.
- Use o menu da bandeja para abrir o painel ou a roda.
- O atalho inicial é **Alt+P**, configurável no painel. Atalhos ocupados são recusados.
- Na roda, use **1 / 2 / 3** para categorias, **Alt** para ferramentas, **Tab** para navegar pelas opções e **Enter** para selecionar.
- Se o arquivo pertencer a outra categoria, soltá-lo na roda apenas prepara a seleção. Soltar no centro ou fora das fatias também não inicia a conversão.
- A qualidade de imagem, os sons e a abertura automática da pasta são configuráveis e persistentes.

## Formatos e limites

- Imagens de entrada: PNG, JPG/JPEG, WebP, AVIF, TIFF, GIF estático e SVG.
- Saídas: WebP, JPG, PNG, AVIF, TIFF e ICO com 16, 32, 48, 64, 128 e 256 pixels.
- Imagens animadas e documentos com várias páginas são recusados explicitamente para evitar perda silenciosa de quadros/páginas.
- SVG é rasterizado para PNG nas ferramentas que preservam o formato das demais imagens.
- Limpar EXIF remove metadados e corrige a orientação antes de salvá-los.
- JPEG usa fundo branco quando a entrada possui transparência.
- Vídeos de entrada: MP4, MOV, MKV, WebM, AVI, WMV, FLV, M4V, 3GP, TS e MTS.
- Áudio de entrada: MP3, WAV, AAC, FLAC, OGG, M4A, OPUS, WMA, AIFF e ALAC.
- WAV é PCM de 24 bits e 48 kHz.
- A ferramenta de limite de tamanho calcula a taxa a partir da duração e verifica a saída completa. Se não atingir 24 MB, informa um erro e remove a saída; não corta o final do vídeo.
- O suporte final depende dos codecs presentes no arquivo. A extensão, por si só, não garante que um arquivo seja válido.
- Conversões com falha ou canceladas removem os arquivos parciais criados pela operação.

## Desenvolvimento

Requer Node.js e as dependências do projeto:

```sh
npm install
npm start
npm test
```

Os testes geram mídias sintéticas e verificam metadados, formatos reais, orientação, ICO, WAV, áudio/vídeo decodificáveis, cancelamento, nomes únicos e fila. As mídias temporárias ficam no diretório de testes e são removidas ao final.

Teste de integração com a interface real (perfil separado em `tests/smoke-profile`):

```sh
npx electron tests/electron-smoke.cjs
```

Empacotamento:

```sh
npm run build:exe
npm run build:linux
```

Distribuições Linux devem ser construídas/testadas com FFmpeg e Sharp compatíveis com Linux. Copiar os módulos nativos do Windows não garante um pacote Linux funcional.

## Arquitetura

- `src/main/converter.js`: conversões e proteção das saídas.
- `src/main/jobs.js`: fila sequencial, progresso por tarefa e cancelamento.
- `src/main/index.js`: janelas, bandeja, atalhos, configurações, histórico e comunicação validada.
- `src/preload.js`: API restrita para a interface.
- `src/renderer/shared/formats.js`: catálogo compartilhado entre interface e conversor.
- `src/renderer/dashboard` e `src/renderer/radial`: interfaces.

Desenvolvido com colaboração de inteligência artificial.
