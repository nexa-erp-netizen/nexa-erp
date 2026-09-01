# Nexa ERP — Web — Proteção anti-duplicidade v2
# Execute na RAIZ do projeto Web.
# Altera somente src/pages/MovimentosCliente.jsx
# Usa regex tolerante a espaços/quebras de linha.
# Grava em UTF-8 sem BOM.

$ErrorActionPreference = "Stop"

$arquivo = Join-Path (Get-Location).Path "src\pages\MovimentosCliente.jsx"

if (-not (Test-Path $arquivo)) {
    throw "Arquivo não encontrado: $arquivo"
}

$conteudo = Get-Content -Raw -LiteralPath $arquivo
$original = $conteudo

function Trocar-RegexUmaVez {
    param(
        [string]$Texto,
        [string]$Padrao,
        [string]$Novo,
        [string]$Rotulo
    )

    $regex = [regex]::new(
        $Padrao,
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    if (-not $regex.IsMatch($Texto)) {
        throw "Não encontrei o trecho esperado: $Rotulo"
    }

    return $regex.Replace($Texto, $Novo, 1)
}

# 1) IMPORT
$conteudo = Trocar-RegexUmaVez `
    $conteudo `
    'import\s*\{\s*useEffect\s*,\s*useMemo\s*,\s*useState\s*\}\s*from\s*"react"' `
    'import { useEffect, useMemo, useRef, useState } from "react"' `
    "import React"

# 2) ESTADOS
$padraoEstado = 'const\s*\[linhas,\s*setLinhas\]\s*=\s*useState\(\s*\[\s*linhaVazia\(\)\s*,\s*linhaVazia\(\)\s*,\s*linhaVazia\(\)\s*,\s*linhaVazia\(\)\s*,\s*linhaVazia\(\)\s*,?\s*\]\s*\)'

$novoEstado = @'
const [linhas, setLinhas] = useState([
    linhaVazia(),
    linhaVazia(),
    linhaVazia(),
    linhaVazia(),
    linhaVazia(),
  ])
  const [salvando, setSalvando] = useState(false)
  const salvandoRef = useRef(false)
  const envioPendenteRef = useRef({
    assinatura: "",
    chave: "",
  })
'@

$conteudo = Trocar-RegexUmaVez `
    $conteudo `
    $padraoEstado `
    $novoEstado `
    "estado linhas"

# 3) HELPERS antes de salvarLancamentos
$helpers = @'
  function gerarChaveIdempotencia() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID()
    }

    return `nexa-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  function assinaturaDoEnvio(movimentos) {
    return JSON.stringify(
      movimentos.map((item) => ({
        cliente: item.cliente || "",
        tipo: item.tipo || "",
        data: item.data || "",
        planoContaId: item.planoContaId || null,
        planoContaNome: item.planoContaNome || "",
        forma: item.forma || "",
        formaPagamento: item.formaPagamento || "",
        descricao: item.descricao || "",
        valor: Number(item.valor || 0),
      }))
    )
  }

  function obterChaveIdempotencia(movimentos) {
    const assinatura = assinaturaDoEnvio(movimentos)
    const pendente = envioPendenteRef.current

    if (pendente.assinatura === assinatura && pendente.chave) {
      return pendente.chave
    }

    const chave = gerarChaveIdempotencia()

    envioPendenteRef.current = {
      assinatura,
      chave,
    }

    return chave
  }

'@

$conteudo = Trocar-RegexUmaVez `
    $conteudo `
    '\s{2}async\s+function\s+salvarLancamentos\s*\(\s*\)\s*\{' `
    ($helpers + '  async function salvarLancamentos() {') `
    "início salvarLancamentos"

# 4) SUBSTITUIR FUNÇÃO SALVAR INTEIRA
$padraoSalvar = '  async\s+function\s+salvarLancamentos\s*\(\s*\)\s*\{.*?(?=\r?\n\s{2}async\s+function\s+excluirMovimento)'

$novaSalvar = @'
  async function salvarLancamentos() {
    if (salvandoRef.current) return

    salvandoRef.current = true
    setSalvando(true)

    try {
      const linhaComDataInvalida = linhas.findIndex(
        (linha) => linha.data && !dataMovimentoValida(linha.data)
      )

      if (linhaComDataInvalida >= 0) {
        alert(
          `A data da linha ${linhaComDataInvalida + 1} é inválida. ` +
          "Confira principalmente o ano."
        )
        return
      }

      const linhasValidas = linhas.filter(
        (linha) =>
          linha.data &&
          linha.descricao &&
          valorSeguro(linha.valor) > 0
      )

      if (linhasValidas.length === 0) {
        alert("Preencha pelo menos uma linha com data, descrição e valor.")
        return
      }

      const novosMovimentos = []

      for (const linha of linhasValidas) {
        const dados = {
          cliente: clienteSelecionado || undefined,
          tipo: linha.tipo,
          data: linha.data,
          planoContaId: linha.planoContaId || null,
          planoContaNome: linha.planoContaNome,
          forma: linha.forma || "",
          formaPagamento: linha.forma || "",
          descricao: linha.descricao,
          valor: valorSeguro(linha.valor),
          comprovante: "",
          status: "Pendente",
        }

        if (linha.editandoId) {
          await api.put(`/movimentos-cliente/${linha.editandoId}`, dados)
        } else {
          novosMovimentos.push(dados)
        }
      }

      let duplicadoEvitado = false

      if (novosMovimentos.length > 0) {
        const chaveIdempotencia = obterChaveIdempotencia(novosMovimentos)

        const resposta = await api.post(
          "/movimentos-cliente/massa",
          {
            movimentos: novosMovimentos,
            chaveIdempotencia,
          },
          {
            headers: {
              "X-Idempotency-Key": chaveIdempotencia,
            },
          }
        )

        duplicadoEvitado = resposta.data?.duplicadoEvitado === true
      }

      envioPendenteRef.current = {
        assinatura: "",
        chave: "",
      }

      setLinhas([
        linhaVazia(),
        linhaVazia(),
        linhaVazia(),
        linhaVazia(),
        linhaVazia(),
      ])

      await carregarMovimentos(clienteSelecionado)

      if (duplicadoEvitado) {
        alert(
          "Envio confirmado. A Nexa detectou uma repetição da mesma solicitação e evitou lançamentos duplicados."
        )
      } else {
        alert("Lançamentos salvos com sucesso.")
      }
    } catch (erro) {
      console.error("Erro ao salvar lançamentos:", erro)

      const mensagem = erro?.response?.data?.message

      if (erro?.response?.data?.duplicadoEvitado) {
        alert(
          mensagem ||
          "A Nexa bloqueou um envio repetido para evitar lançamentos duplicados."
        )
      } else {
        alert(
          mensagem ||
          "Erro ao salvar lançamentos. Tente novamente; a Nexa reutilizará a identificação do envio para evitar duplicidade."
        )
      }
    } finally {
      salvandoRef.current = false
      setSalvando(false)
    }
  }
'@

$conteudo = Trocar-RegexUmaVez `
    $conteudo `
    $padraoSalvar `
    $novaSalvar `
    "função salvarLancamentos"

# 5) BOTÃO SALVAR — substituição tolerante
$padraoBotaoSalvar = '<button\b(?=[^>]*className="mv-btn mv-btn-save")(?=[^>]*onClick=\{salvarLancamentos\})[^>]*>\s*Salvar Lançamentos\s*</button>'

$novoBotaoSalvar = @'
<button
              type="button"
              className={`mv-btn mv-btn-save ${salvando ? "mv-btn-saving" : ""}`}
              onClick={salvarLancamentos}
              disabled={salvando}
              aria-busy={salvando}
            >
              {salvando ? "Salvando..." : "Salvar Lançamentos"}
            </button>
'@

$conteudo = Trocar-RegexUmaVez `
    $conteudo `
    $padraoBotaoSalvar `
    $novoBotaoSalvar `
    "botão Salvar"

# 6) BOTÃO ADICIONAR — opcional, mas deve existir
$padraoAdicionar = '<button\b(?=[^>]*className="mv-btn mv-btn-add")(?=[^>]*onClick=\{adicionarLinha\})([^>]*)>'

$regexAdicionar = [regex]::new(
    $padraoAdicionar,
    [System.Text.RegularExpressions.RegexOptions]::Singleline
)

if ($regexAdicionar.IsMatch($conteudo)) {
    $conteudo = $regexAdicionar.Replace(
        $conteudo,
        '<button$1 disabled={salvando}>',
        1
    )
}

# 7) CSS
$padraoCss = '(\.mv-btn-save\s*\{.*?\})'

$novoCss = @'
$1

        .mv-btn:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .mv-btn-saving {
          filter: saturate(.65);
        }
'@

$conteudo = Trocar-RegexUmaVez `
    $conteudo `
    $padraoCss `
    $novoCss `
    "CSS botão salvar"

# 8) VALIDAR
$obrigatorios = @(
    'useRef',
    'salvandoRef.current',
    'chaveIdempotencia',
    'X-Idempotency-Key',
    'Salvando...',
    'duplicadoEvitado',
    'disabled={salvando}'
)

foreach ($item in $obrigatorios) {
    if (-not $conteudo.Contains($item)) {
        throw "Validação falhou: $item"
    }
}

if ($conteudo -eq $original) {
    throw "Nenhuma alteração foi aplicada."
}

$backup = "$arquivo.bak-anti-duplicidade-v2"
Copy-Item -LiteralPath $arquivo -Destination $backup -Force

$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($arquivo, $conteudo, $utf8)

Write-Host ""
Write-Host "Proteção anti-duplicidade aplicada com sucesso." -ForegroundColor Green
Write-Host "Arquivo alterado: src/pages/MovimentosCliente.jsx"
Write-Host "Backup: src/pages/MovimentosCliente.jsx.bak-anti-duplicidade-v2"
Write-Host ""
Write-Host "Agora execute: npm run build" -ForegroundColor Cyan
