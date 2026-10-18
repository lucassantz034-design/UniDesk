@echo off
title UniDesk - Helpdesk Universitario
echo ====================================================================
echo  UNIDESK - HELPDESK UNIVERSITARIO INTELIGENTE
echo ====================================================================
echo Servidor iniciando em: http://localhost:3000
echo Pressione Ctrl+C para encerrar.
echo.
set PORT=3000
:: Node.js (`node server.js`) é o motor oficial em produção.
:: O backend Go (`backend/`) é um protótipo de provedor (POC) e NÃO
:: implementa autenticação, license Ed25519, bloqueio de 15 dias e o
:: ecossistema de suporte; por isso NÃO deve ser iniciado por padrão.
node server.js
pause
