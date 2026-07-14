# Changelog

## v3.4.1 — DNA Empresarial
- Cadastro do DNA tributário da empresa.
- Compatibilidade mantida com clientes existentes.
- Fundação do Motor Tributário criada.
- Campos do Simples Nacional exibidos somente quando aplicáveis.

## v3.4.2 — Biblioteca Tributária do Simples Nacional
- Criadas tabelas centralizadas dos Anexos I, II, III, IV e V.
- Incluídas seis faixas por anexo, alíquotas nominais e parcelas a deduzir.
- Criada busca segura de anexo.
- Criada localização da faixa pela RBT12.
- Adicionadas validações para anexo inválido, RBT12 negativa e receita acima do limite geral.
- Biblioteca versionada e documentada; sem cálculo de DAS nesta Sprint.

## v3.4.3 — Sprint 03: Alíquota Efetiva
- Criada função centralizada para cálculo da alíquota efetiva do Simples Nacional.
- Aplicada a fórmula legal com RBT12, alíquota nominal e parcela a deduzir.
- Adicionada memória de cálculo completa e explicação textual do resultado.
- Incluídas validações para RBT12 igual ou inferior a zero e resultados inválidos.
- Mantida separação entre cálculo da alíquota e futuro cálculo do DAS.
- Documentadas limitações para início de atividade, Fator R, segregações e sublimites.

## v3.4.4 — Sprint 04: Fator R e Consultoria Tributária
- Criado cálculo centralizado do Fator R para a regra geral, mês de abertura e início de atividade.
- Implementadas as situações especiais de folha ou receita iguais a zero.
- Aplicado o critério do PGDAS-D de duas casas decimais sem arredondamento.
- Adicionada indicação técnica entre Anexo III e Anexo V para atividades sujeitas ao Fator R.
- Criado cálculo da folha matemática necessária para atingir 28%, com alertas profissionais.
- Criada comparação estimativa entre os Anexos III e V para a receita do período.
- Incluídas memória de cálculo, explicação e recomendações revisáveis pelo contador.

## v3.4.4.1 — Sprint 04.1: Laboratório Tributário
- Nova tela administrativa para simulações tributárias.
- Cálculo integrado de Fator R e alíquota efetiva.
- Estimativa simplificada do DAS do período.
- Comparação Anexo III x Anexo V.
- Explicação e memória do cálculo.

## v3.4.5 — Sprint 05: Motor do DAS

- Criado o cálculo centralizado do DAS-base estimado.
- Adicionada memória completa do cálculo.
- Integrado o Motor do DAS ao Laboratório Tributário.
- Adicionadas explicações e alertas sobre as limitações da simulação.
- Corrigida opção duplicada no seletor do Laboratório Tributário.

## v3.4.6 — Sprint 06 — Planejamento Tributário Inteligente
- Radar Tributário com pontuação e classificação de risco.
- Alertas para limite do Simples, mudança de faixa e Fator R.
- Oportunidades de simulação entre Anexos III e V.
- Parecer consultivo e explicável da Nexa.
- Integração com o Laboratório Tributário.

## v3.6.2 — Módulo 2, Etapa 2: Checklist Inteligente

- Checklist operacional complementado conforme o regime tributário do cliente.
- Conferências específicas para MEI, Simples Nacional, Lucro Presumido e Lucro Real.
- Validação de sequência de parcelamentos.
- Verificação de recibo de honorários e registro documental.
- Mantida a regra de gerar ações somente a partir de dados reais.

## v3.6.3 — Módulo 2 / Etapa 3

- Priorização automática dos clientes do Assistente do Dia.
- Score de 0 a 100.
- Classificação Crítico, Alto, Médio e Baixo.
- Motivos objetivos da prioridade.
- Ordenação da fila e abertura do cliente mais prioritário ao iniciar o dia.

## v3.6.4 — Módulo 2, Etapa 4 — Planejamento Anual

- Agenda Inteligente com planejamento anual por cliente.
- DAS, PGDAS-D, honorários, recibos e documentos mensais.
- Parcelamentos futuros gerados com sequência de parcelas.
- Progresso anual e conclusão individual das ações.
- Integração das ações programadas com o Assistente do Dia.

## v3.6.5 — Módulo 2 Etapa 5

- Integração da Agenda Inteligente com o WhatsApp.
- Modelos automáticos por tipo de ação.
- Prévia editável antes da abertura.
- Registro de histórico e conclusão da ação.

## v3.6.6 — Módulo 2 / Etapa 6 — Painel Diário da Nexa

- Criado o resumo diário inteligente no Dashboard.
- Integrados progresso do expediente e última ação salva.
- Adicionados indicadores operacionais e recomendação do próximo cliente.

## v3.6.7 — Módulo 2 / Etapa 7 — Revisão e Integração Final

- Centralizado o salvamento e a leitura da jornada diária em um serviço único.
- Corrigida a geração da chave diária para usar a data local e evitar troca indevida de dia pelo UTC.
- Sincronizado o progresso do Assistente do Dia com o Dashboard em tempo real.
- Padronizados restauração, salvamento e reinício do expediente.
- Consolidada a integração final do Módulo 2 — Agenda Inteligente.

## v3.6.8 — Filtro de Empresas Ativas

- Assistente do Dia limitado a empresas operacionais ativas.
- Clientes do regime Avulso removidos das rotinas automáticas.
- Empresas inaptas, baixadas, suspensas ou em constituição não geram prioridades automáticas.
- Planejamento anual passa a ser gerado apenas para empresas ativas.
- Dashboard, WhatsApp e vencimentos seguem a mesma regra centralizada.
