# Termo de Licença de Software Comercial Proprietário e EULA — UniDesk

**Copyright © 2026 UniDesk Soluções SaaS Ltda. Todos os direitos reservados.**

---

### IMPORTANTE — LEIA COM ATENÇÃO ANTES DE INSTALAR OU UTILIZAR ESTE SOFTWARE

O presente Contrato de Licença de Usuário Final ("EULA" ou "Licença") é um acordo legal e vinculante entre a **Instituição de Ensino Licenciada** ("LICENCIADA" ou "CLIENTE") e a **UniDesk Soluções SaaS Ltda.** ("LICENCIANTE" ou "UNIDESK"), titular exclusiva de todos os direitos autorais, de propriedade intelectual e segredos industriais sobre o software **UniDesk — Helpdesk Universitário Inteligente** ("SOFTWARE"), compreendendo seu código-fonte, código compilado, componentes de frontend, backend, bancos de dados, scripts de automação, interfaces e documentações associadas.

Ao descompactar, instalar, copiar, executar recipientes Docker ou de qualquer forma utilizar o SOFTWARE, a LICENCIADA concorda integralmente com as disposições desta Licença. Caso não concorde, o SOFTWARE não deve ser instalado, devendo ser imediatamente destruído e desinstalado de qualquer infraestrutura física ou em nuvem.

---

### 1. NATUREZA PROPRIETÁRIA E AUSÊNCIA DE CÓDIGO ABERTO
1.1. O SOFTWARE é protegido pelas leis de direitos autorais (Lei Federal nº 9.609/1998 — Lei do Software e Lei Federal nº 9.610/1998 — Lei de Direitos Autorais), bem como por tratados internacionais de propriedade intelectual.  
1.2. O SOFTWARE **NÃO É DE CÓDIGO ABERTO** (Open Source) e **NÃO É DISTRIBUÍDO SOB LICENÇA MIT, GPL, APACHE OU SIMILARES**.  
1.3. A concessão de acesso aos arquivos locais para fins de hospedagem *on-premise* ou em nuvem própria do CLIENTE **não transfere nem cede a titularidade** do código-fonte ou da propriedade intelectual à LICENCIADA.

---

### 2. CONCESSÃO DE LICENÇA DE USO
2.1. Mediante a contratação e manutenção regular de uma assinatura comercial ativa, a UNIDESK concede à LICENCIADA uma licença de uso **temporária, não-exclusiva, intransferível, não sublicenciável e revogável**, estritamente limitada ao uso institucional interno pelo prazo de vigência do contrato comercial.  
2.2. A licença autoriza a execução de instâncias do SOFTWARE estritamente nos limites e dimensões contratados no plano de subscrição e associados à chave de licença (*License Key*) institucional atribuída.

---

### 3. RESTRIÇÕES EXPRESSAS E VEDAÇÕES
É expressamente vedado à LICENCIADA, seus prepostos, colaboradores ou terceiros:
* **a) Engenharia Reversa:** Descompilar, desmontar, aplicar engenharia reversa, decodificar ou tentar obter a lógica interna, chaves criptográficas ou algoritmos não autorizados do SOFTWARE;
* **b) Redistribuição e Comercialização:** Vender, alugar, arrendar, sublicenciar, distribuir, ceder, emprestar, hospedar em modelo *multi-tenant* para terceiros alheios à instituição ou disponibilizar o SOFTWARE para qualquer terceiro sem prévia e expressa autorização por escrito da UNIDESK;
* **c) Criação de Obras Derivadas:** Modificar, alterar, criar forks, remover notificações de direitos autorais ou marcas registradas existentes no SOFTWARE ou na interface do usuário;
* **d) Burlar Mecanismos de Proteção:** Contornar, desabilitar ou neutralizar os módulos de validação de licença, rotinas de *heartbeat* criptográfico, verificação de integridade ou bloqueio por inadimplência.

---

### 4. VINCULAÇÃO À ASSINATURA ATIVA E HEARTBEAT CRIPTOGRÁFICO
4.1. A continuidade operacional do SOFTWARE é tecnicamente subordinada à verificação de conformidade com os servidores da Central UniDesk (*Heartbeat* via conexões criptografadas outbound HTTPS).  
4.2. O SOFTWARE implementa tolerância a falhas temporárias de rede por meio de um período de carência (*Grace Period*) de 15 (quinze) dias. Decorrido o período de carência sem regularização financeira ou conexão com a Central, o SOFTWARE entrará automaticamente em modo bloqueado (*LOCKED*), ressalvada a integridade e exportação dos dados do CLIENTE.  
4.3. A regularização do pagamento ou inserção de token criptográfico válido restabelece imediatamente as funções operacionais do SOFTWARE.

---

### 5. PRIVACIDADE, SOBERANIA DE DADOS E LGPD
5.1. **Soberania dos Dados Acadêmicos:** Todo o banco de dados institucional (contendo cadastros de alunos, professores, técnicos, chamados acadêmicos e notas) reside sob custódia e controle exclusivo da LICENCIADA em sua própria infraestrutura (*On-Premise*).  
5.2. **Conformidade com a Lei Geral de Proteção de Dados (Lei Federal nº 13.709/2018 - LGPD):**
* As comunicações de telemetria e validação de licença (*Heartbeat*) trafegam **exclusivamente dados técnicos anônimos** (versão do runtime, métricas de capacidade e status de saúde do sistema).
* O módulo de suporte técnico integrado opera rotinas de higienização automatizada (*sanitization*), expurgando ou mascarando identificadores pessoais (nomes, CPFs, e-mails de alunos) de quaisquer diagnósticos ou logs transmitidos à Central da UNIDESK, em estrito atendimento aos princípios de necessidade, finalidade e segurança da LGPD.

---

### 6. RESCISÃO
6.1. Esta Licença vigorará enquanto o contrato de prestação de serviços e licenciamento estiver vigente e pontualmente adimplido.  
6.2. O descumprimento de qualquer cláusula deste instrumento implicará na rescisão imediata e de pleno direito da licença concedida, independentemente de notificação judicial ou extrajudicial, sujeitando a parte infratora às penalidades civis e criminais cabíveis nos termos da legislação brasileira.

---

### 7. LIMITAÇÃO DE RESPONSABILIDADE E FORO
7.1. O SOFTWARE é fornecido "no estado em que se encontra" (*as-is*), com as garantias de suporte, manutenção e correções previstas no Acordo de Nível de Serviço (SLA) contratado.  
7.2. Fica eleito o Foro da Comarca de São Paulo/SP como o único competente para dirimir quaisquer dúvidas ou litígios decorrentes deste instrumento, com renúncia expressa a qualquer outro, por mais privilegiado que seja.
