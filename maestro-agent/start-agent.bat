@echo off
title Agente do Maestro - Mobatest
cd /d "%~dp0"
echo Iniciando o agente do Maestro...
echo (Feche esta janela para parar o agente)
echo.
node agent.js
pause
