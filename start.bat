@echo off
if exist "%~dp0dist\IMGC-win32-x64\IMGC.exe" (
    start "" "%~dp0dist\IMGC-win32-x64\IMGC.exe"
) else (
    echo Iniciando IMGC via Node/Electron...
    cd /d "%~dp0"
    npm start
)
