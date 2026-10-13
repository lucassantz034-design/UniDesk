@echo off
title UniDesk - Helpdesk Universitario
echo ====================================================================
echo  UNIDESK - HELPDESK UNIVERSITARIO INTELIGENTE
echo ====================================================================
echo Servidor iniciando em: http://localhost:3000
echo Pressione Ctrl+C para encerrar.
echo.
set PORT=3000
if exist backend\unidesk-server.exe (
    backend\unidesk-server.exe
) else (
    node server.js
)
pause
