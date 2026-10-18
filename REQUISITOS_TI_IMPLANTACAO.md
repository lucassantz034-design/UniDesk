# 📋 GUIA DE IMPLANTAÇÃO E REQUISITOS TÉCNICOS DO SERVIDOR

> **Destinatário:** Diretoria de Tecnologia da Informação (DTI), Administradores de Redes e Infraestrutura.  
> **Sistema:** UniDesk — Helpdesk e Atendimento Acadêmico Inteligente  
> **Modelo:** Auto-hospedado (On-Premise / Servidor Local) ou Cloud Privada do Cliente (AWS, Azure, OCI).

---

## 1. ⚙️ REQUISITOS MÍNIMOS DE HARDWARE & INFRAESTRUTURA

O UniDesk foi projetado com arquitetura de alta eficiência e baixo consumo de recursos.

| Recurso | Requisito Mínimo (Até 3.000 alunos) | Recomendado (Acima de 5.000 alunos) |
| :--- | :--- | :--- |
| **Processador (vCPU)** | 2 vCPUs (x86_64 ou ARM64) | 4 vCPUs |
| **Memória RAM** | 4 GB | 8 GB |
| **Armazenamento (Disco)**| 20 GB SSD (NVMe recomendado) | 50 GB SSD |
| **Sistema Operacional** | Linux (Ubuntu Server 22.04+, Debian 12+, RHEL 9+) ou Windows Server com WSL2/Docker |
| **Ambiente de Execução**| **Docker 24.0+** e **Docker Compose v2+** |

---

## 2. 🌐 TOPOLOGIA DE REDE E PORTAS

### 2.1 Portas de Entrada (Inbound na Rede da Faculdade)
O sistema deve ser acessível apenas para os usuários autorizados na rede institucional ou via VPN/Proxy reverso:

- **Porta 80 / 443 (HTTP/HTTPS)**: Acesso dos alunos, atendentes e administradores aos portais web e WebSockets em tempo real.
- **Porta 22 (SSH)**: Acesso administrativo exclusivo da equipe de TI da faculdade.

### 2.2 Requisitos de Saída (Outbound para a Internet)
O UniDesk opera em regime **Zero Inbound**. **Nenhuma porta do servidor da faculdade precisa ser aberta para a internet pública.**

- **Porta 443 (HTTPS Outbound)**: O UniDesk realiza uma requisição de saída por dia para sincronização de licença e envio de chamados de suporte técnico do software para o fornecedor:
  - Destino: `https://central.unidesk.com.br` (ou endpoint contratado)
  - Protocolo: HTTPS / TLS 1.3 padrão

---

## 3. 🔒 PRIVACIDADE DE DADOS E LGPD (DIFERENCIAL ON-PREMISE)

1. **Soberania Total dos Dados**: Todos os bancos de dados, históricos de mensagens, cadastros de alunos e protocolos de chamados permanecem **exclusivamente armazenados dentro da infraestrutura da instituição**.
2. **Sem Vazamento para Nuvem Externa**: O fornecedor do software **não possui acesso** aos dados pessoais dos alunos ou chamados acadêmicos locais.
3. **Telemetria Anônima**: O único tráfego trocado com a Central é a validação matemática da chave de licença (`LICENSE_KEY`) e chamados abertos voluntariamente pela equipe de TI institucional.

---

## 4. 🚀 PROCEDIMENTO DE INSTALAÇÃO EM 1 COMANDO

### Passo 1: Baixar e configurar o arquivo de ambiente
```bash
# Clone ou descompacte o pacote UniDesk no servidor
cd /opt/unidesk

# Crie o arquivo .env a partir do template de produção
cp .env.production.example .env
```

Edite o arquivo `.env` inserindo a sua chave fornecida:
```ini
LICENSE_KEY=UD-PROD-SUA-CHAVE-AQUI
HOST_PORT=80
```

### Passo 2: Inicialização dos Containers
```bash
docker compose up -d
```

Pronto! O sistema estará online em menos de 2 minutos.

---

## 5. 🛡️ POLÍTICA DE BACKUP AUTOMÁTICO E DISASTER RECOVERY

O UniDesk já inclui um daemon de **Hot Backup transacional diário**:
- **Horário de Execução:** Todos os dias às 02:00 da madrugada.
- **Local dos Backups:** Diretório `/opt/unidesk/backups` (compactados em formato `.sqlite.gz`).
- **Política de Retenção:** Mantém os últimos 15 dias de backups automaticamente.
- **Restauração Rápida (Disaster Recovery):**
  ```bash
  ./scripts/restore.sh ./backups/latest_backup.sqlite.gz
  ```

---

## 6. 📞 SUPORTE TÉCNICO N2 DO FORNECEDOR
- **Central de Atendimento:** Integrada diretamente no console de Administrador da aplicação.
- **E-mail:** `suporte@unidesk.com.br`
