$env:PORT = "3000"
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "🎓 UNIDESK — HELPDESK UNIVERSITÁRIO INTELIGENTE" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "Servidor iniciando em: http://localhost:3000" -ForegroundColor Yellow
Write-Host "Portal do Aluno:       http://localhost:3000/aluno" -ForegroundColor Gray
Write-Host "Painel do Atendente:   http://localhost:3000/atendente" -ForegroundColor Gray
Write-Host "Painel Administrativo: http://localhost:3000/admin" -ForegroundColor Gray
Write-Host "Pressione Ctrl+C para encerrar.`n" -ForegroundColor DarkGray
# Node.js (`node server.js`) é o motor oficial em produção.
# O backend Go (`backend/`) é um protótipo de provedor (POC) que NÃO
# implementa autenticação, licença Ed25519, bloqueio de 15 dias e o
# ecossistema de suporte; por isso NÃO deve ser iniciado por padrão.
node server.js
