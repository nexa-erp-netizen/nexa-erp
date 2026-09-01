# Nexa ERP v3.49.4 — alinhar Build para 34904
$ErrorActionPreference = "Stop"
$raiz = (Get-Location).Path
$alterados = @()
$utf8 = New-Object System.Text.UTF8Encoding($false)

foreach ($pasta in @("src","public")) {
  $alvo = Join-Path $raiz $pasta
  if (Test-Path $alvo) {
    Get-ChildItem $alvo -Recurse -File |
      Where-Object { $_.Extension -in @(".js",".jsx",".ts",".tsx",".json",".html",".md",".txt") } |
      ForEach-Object {
        $conteudo = Get-Content -Raw -LiteralPath $_.FullName
        $novo = $conteudo.Replace("Build 34903","Build 34904").Replace("34903","34904")
        if ($novo -ne $conteudo) {
          [System.IO.File]::WriteAllText($_.FullName, $novo, $utf8)
          $alterados += (Resolve-Path -Relative $_.FullName)
        }
      }
  }
}

if ($alterados.Count) {
  Write-Host "Build atualizado para 34904:" -ForegroundColor Green
  $alterados | Sort-Object -Unique | ForEach-Object { Write-Host " - $_" }
} else {
  Write-Host "Nenhum Build 34903 encontrado." -ForegroundColor Yellow
}
