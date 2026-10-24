@echo off
title Compilar APK Oficial de NexChat Global (EAS Cloud)
color 0A
echo ========================================================
echo   COMPILADOR DE APK ANDROID - NEXCHAT GLOBAL v3.0
echo ========================================================
echo.
set PATH=C:\nvm4w\nodejs;%APPDATA%\npm;%PATH%
set EAS_BUILD_SKIP_LOCKFILE_CHECK=1
cd /d "%~dp0"

if not exist ".git" (
  git init
  git add -A
  git commit -m "NexChat Global v3.0"
)

echo [1/2] Verificando sesion de Expo...
call npx eas-cli whoami
echo.
echo [2/2] Enviando proyecto ligero (~200 KB) a los servidores de Expo...
echo Cuando termine, te dara el link directo para descargar tu archivo .APK
echo.
call npx eas-cli build -p android --profile preview
echo.
pause
