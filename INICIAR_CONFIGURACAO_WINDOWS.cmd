@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js 22 ou superior nao encontrado. Instale-o pelo site oficial nodejs.org e execute este arquivo novamente.
 pause
 exit /b 1
)
node scripts\setup-wizard.mjs
pause
