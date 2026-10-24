@echo off
title Probar NexChat Global en Celular (Expo Go)
color 0B
echo ========================================================
echo   MODO PRUEBA EN VIVO - NEXCHAT GLOBAL v3.0
echo ========================================================
echo.
set PATH=C:\nvm4w\nodejs;%APPDATA%\npm;%PATH%
cd /d "%~dp0"
if not exist "node_modules" (
  echo Instalando dependencias por primera vez...
  call npm install --legacy-peer-deps
)
call npx expo start --tunnel
pause
