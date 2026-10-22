@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo   IMGC - Zero-Click Offline Media Converter
echo ========================================================
echo.

if exist "%~dp0dist\IMGC-win32-x64\IMGC.exe" (
    echo Iniciando o executavel IMGC.exe...
    start "" "%~dp0dist\IMGC-win32-x64\IMGC.exe"
    exit /b 0
)

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [AVISO] Voce baixou o codigo-fonte do GitHub sem o executavel compilado!
    echo.
    echo Para usar o IMGC direto sem precisar do Node.js:
    echo Baixe o executavel (.zip pronto) na aba RELEASES do GitHub:
    echo https://github.com/peter-cmd-boop/IMGC/releases
    echo.
    echo --------------------------------------------------------
    echo Ou instale o Node.js em https://nodejs.org para rodar pelo codigo.
    echo ========================================================
    pause
    exit /b 1
)

if not exist "%~dp0node_modules" (
    echo Instalando modulos do projeto pela primeira vez...
    echo Aguarde...
    call npm install
)

echo Iniciando IMGC via Electron...
call npm start
pause
