@echo off
echo ==========================================
echo   VSAI - IA Desktop - Gerador One-Click
echo ==========================================
echo.
cd /d "%~dp0"

echo [1/3] Instalando dependencias (Electron/Build)...
call npm install

echo [2/3] Compilando Frontend React...
call npm run build

echo [3/3] Criando Executavel Portatil...
call npm run dist

echo.
echo ==========================================
echo   PROCESSO CONCLUIDO! 
echo   O VSAI - IA.exe esta na pasta:
echo   .\dist_electron\VSAI - IA.exe
echo ==========================================
pause
