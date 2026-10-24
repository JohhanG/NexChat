@echo off
title Publicar Actualizacion Automatica OTA - NexChat Global
color 0E
echo ========================================================
echo   PUBLICAR ACTUALIZACION OTA A TODOS LOS CELULARES
echo ========================================================
echo.
set PATH=C:\nvm4w\nodejs;%APPDATA%\npm;%PATH%
cd /d "%~dp0"
call npx eas-cli update --channel preview --message "Actualizacion global NexChat"
echo.
echo Listo! Todos los celulares con el APK recibiran los cambios al abrir la app.
pause
