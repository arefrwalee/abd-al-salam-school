@echo off
chcp 65001 >nul
title Abd Al-Salam School Server
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js غير مثبت. نزّله من https://nodejs.org ثم أعد التشغيل. & pause & exit /b 1)
start "" http://localhost:8080
node server\server.js
pause
