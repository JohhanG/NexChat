@echo off
title Compilar APK Oficial de NexChat Global (EAS Cloud)
color 0A
echo ========================================================
echo   COMPILADOR DE APK ANDROID - NEXCHAT GLOBAL v3.0
echo ========================================================
echo.
set PATH=C:\nvm4w\nodejs;%APPDATA%\npm;%PATH%
cd /d "%~dp0"

if not exist "node_modules" (
  echo [1/3] Instalando dependencias por primera vez...
  call npm install --legacy-peer-deps
)

if not exist ".git" (
  git init
  git add -A
  git commit -m "NexChat Global v3.0"
)

echo.
echo [2/3] Verificando sesion de Expo...
call npx eas-cli whoami
echo.
echo [3/3] Enviando proyecto ligero (~200 KB) a los servidores de Expo...
echo Cuando termine, te dara el link directo para descargar tu archivo .APK
echo.
call npx eas-cli build -p android --profile preview
echo.
pause
