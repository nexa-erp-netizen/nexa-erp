param(
  [string]$Language = "pt-BR"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = [Console]::OutputEncoding

function Send-NexaEvent {
  param([hashtable]$Payload)

  try {
    $json = $Payload | ConvertTo-Json -Compress -Depth 6
    [Console]::Out.WriteLine($json)
    [Console]::Out.Flush()
  } catch {
    # A comunicação com o Electron é auxiliar; não encerre o reconhecedor por falha de log.
  }
}

try {
  Add-Type -AssemblyName System.Speech

  $recognizers = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers()
  $recognizerInfo = $recognizers |
    Where-Object { $_.Culture.Name -eq $Language } |
    Select-Object -First 1

  if (-not $recognizerInfo) {
    $recognizerInfo = $recognizers |
      Where-Object { $_.Culture.TwoLetterISOLanguageName -eq "pt" } |
      Select-Object -First 1
  }

  if (-not $recognizerInfo) {
    Send-NexaEvent @{
      type = "error"
      code = "pt-br-recognizer-not-installed"
      message = "O reconhecimento de fala em Português (Brasil) não está instalado no Windows."
    }
    exit 2
  }

  $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine($recognizerInfo)
  $grammar = New-Object System.Speech.Recognition.DictationGrammar
  $engine.LoadGrammar($grammar)
  $engine.SetInputToDefaultAudioDevice()

  $script:running = $false

  $engine.add_SpeechRecognized({
    param($sender, $eventArgs)

    $text = [string]$eventArgs.Result.Text
    $confidence = [double]$eventArgs.Result.Confidence

    if (-not [string]::IsNullOrWhiteSpace($text) -and $confidence -ge 0.12) {
      Send-NexaEvent @{
        type = "transcript"
        text = $text.Trim()
        confidence = [Math]::Round($confidence, 4)
      }
    }
  })

  $engine.add_SpeechRecognitionRejected({
    Send-NexaEvent @{
      type = "status"
      status = "speech-rejected"
      message = "Fala detectada, mas não reconhecida."
    }
  })

  $engine.add_AudioStateChanged({
    param($sender, $eventArgs)
    Send-NexaEvent @{
      type = "audio-state"
      state = [string]$eventArgs.AudioState
    }
  })

  $engine.add_RecognizeCompleted({
    $script:running = $false
    Send-NexaEvent @{
      type = "status"
      status = "stopped"
      message = "Reconhecimento pausado."
    }
  })

  function Start-NexaRecognition {
    if ($script:running) { return }

    try {
      $engine.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)
      $script:running = $true
      Send-NexaEvent @{
        type = "status"
        status = "listening"
        message = "Reconhecimento nativo do Windows ativo."
      }
    } catch {
      Send-NexaEvent @{
        type = "error"
        code = "recognizer-start-failed"
        message = $_.Exception.Message
      }
    }
  }

  function Pause-NexaRecognition {
    if (-not $script:running) { return }

    try {
      $engine.RecognizeAsyncCancel()
      $script:running = $false
      Start-Sleep -Milliseconds 120
    } catch {
      $script:running = $false
    }
  }

  Send-NexaEvent @{
    type = "ready"
    language = $recognizerInfo.Culture.Name
    name = $recognizerInfo.Name
    description = $recognizerInfo.Description
  }

  Start-NexaRecognition

  while ($true) {
    $command = [Console]::In.ReadLine()
    if ($null -eq $command) { break }

    switch ($command.Trim().ToUpperInvariant()) {
      "RESUME" { Start-NexaRecognition }
      "PAUSE" { Pause-NexaRecognition }
      "STOP" {
        Pause-NexaRecognition
        break
      }
      "PING" {
        Send-NexaEvent @{
          type = "status"
          status = $(if ($script:running) { "listening" } else { "paused" })
          message = "Reconhecimento nativo disponível."
        }
      }
    }

    if ($command.Trim().ToUpperInvariant() -eq "STOP") { break }
  }

  Pause-NexaRecognition
  $engine.Dispose()
} catch {
  Send-NexaEvent @{
    type = "error"
    code = "native-recognizer-failed"
    message = $_.Exception.Message
  }
  exit 1
}
