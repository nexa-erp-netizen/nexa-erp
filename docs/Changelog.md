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
