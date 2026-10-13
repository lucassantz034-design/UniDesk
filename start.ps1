$env:PORT = "3000"
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "🎓 UNIDESK — HELPDESK UNIVERSITÁRIO INTELIGENTE (GO API + REACT)" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "Servidor iniciando em: http://localhost:3000" -ForegroundColor Yellow
Write-Host "Portal do Aluno:       http://localhost:3000/aluno" -ForegroundColor Gray
Write-Host "Painel do Atendente:   http://localhost:3000/atendente" -ForegroundColor Gray
Write-Host "Painel Administrativo: http://localhost:3000/admin" -ForegroundColor Gray
Write-Host "Pressione Ctrl+C para encerrar.`n" -ForegroundColor DarkGray
if (Test-Path ".\backend\unidesk-server.exe") {
    & ".\backend\unidesk-server.exe"
} else {
    node server.js
}
