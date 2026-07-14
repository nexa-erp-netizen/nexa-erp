# Nexa v3.6.8 — Filtro de Empresas Ativas

## Objetivo

Impedir que clientes avulsos ou empresas sem operação ativa entrem automaticamente na rotina diária da Nexa.

## Regra aplicada

A empresa participa da automação quando:

- não está cadastrada no regime `Avulso`; e
- sua situação está como `Ativa`/`Ativo`.

Cadastros antigos sem situação informada continuam compatíveis, exceto quando forem do tipo Avulso.

## Áreas afetadas

- Assistente do Dia
- Painel Diário
- Priorizações do Dashboard
- Planejamento Anual automático
- Sugestões automáticas de WhatsApp
- Próximos vencimentos e documentos pendentes

## Observação

Clientes excluídos da rotina automática continuam disponíveis normalmente no cadastro, histórico, documentos e relatórios.
