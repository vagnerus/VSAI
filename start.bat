@echo off
title NexusAI - Servidor e Painel
color 0A

echo ========================================================
echo                 INICIANDO FlasHAI
echo ========================================================
echo.

echo Encerrando processos anteriores na porta 3777...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3777" ^| find "LISTENING"') do taskkill /F /PID %%a >nul 2>&1

echo Instalando dependencias se necessario...
call npm install --no-fund --no-audit --silent

echo.
echo Iniciando Servidor e Painel...
call npm run dev

echo.
echo O servidor foi encerrado inesperadamente. Veja o erro acima.
pause
