@echo off
title Probar NexChat Global en Celular (Expo Go)
color 0B
echo ========================================================
echo   MODO PRUEBA EN VIVO - NEXCHAT GLOBAL v3.0
echo ========================================================
echo.
set PATH=C:\nvm4w\nodejs;%APPDATA%\npm;%PATH%
cd /d "%~dp0"
call npx expo start --tunnel
pause
