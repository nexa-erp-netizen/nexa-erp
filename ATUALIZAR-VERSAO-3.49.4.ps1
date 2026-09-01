# Nexa ERP — atualizar versão 3.49.3 para 3.49.4
# Execute na raiz do projeto.

$ErrorActionPreference = "Stop"
$antiga = "3.49.3"
$nova = "3.49.4"
$raiz = (Get-Location).Path
$alterados = @()

function Atualizar-Texto([string]$arquivo) {
    if (-not (Test-Path -LiteralPath $arquivo)) { return }
    $conteudo = Get-Content -Raw -LiteralPath $arquivo
    if ($conteudo -notlike "*$antiga*") { return }

    $novo = $conteudo.Replace("v$antiga", "v$nova").Replace($antiga, $nova)
    if ($novo -ne $conteudo) {
        Set-Content -LiteralPath $arquivo -Value $novo -Encoding UTF8
        $script:alterados += (Resolve-Path -Relative $arquivo)
    }
}

foreach ($pasta in @("src", "public")) {
    $alvo = Join-Path $raiz $pasta
    if (Test-Path $alvo) {
        Get-ChildItem $alvo -Recurse -File |
            Where-Object { $_.Extension -in @(".js",".jsx",".ts",".tsx",".json",".html",".css",".md",".txt") } |
            ForEach-Object { Atualizar-Texto $_.FullName }
    }
}

# package.json: somente a versão do aplicativo.
$package = Join-Path $raiz "package.json"
if (Test-Path $package) {
    $conteudo = Get-Content -Raw $package
    $novo = [regex]::Replace($conteudo, '("version"\s*:\s*")3\.49\.3(")', '${1}3.49.4${2}', 1)
    if ($novo -ne $conteudo) {
        Set-Content $package -Value $novo -Encoding UTF8
        $alterados += ".\package.json"
    }
}

Write-Host ""
if ($alterados.Count -eq 0) {
    Write-Host "Nenhuma ocorrência de 3.49.3 encontrada." -ForegroundColor Yellow
} else {
    Write-Host "Versão atualizada para Nexa ERP v3.49.4:" -ForegroundColor Green
    $alterados | Sort-Object -Unique | ForEach-Object { Write-Host " - $_" }
}
Write-Host ""
