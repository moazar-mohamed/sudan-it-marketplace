# Generates the Arabic voice-over clips (vo\<name>.wav) from vo\lines.txt with the
# Windows built-in voice "Microsoft Naayf - Arabic (Saudi)". Runs offline on this PC.
# Usage:  powershell -NoProfile -ExecutionPolicy Bypass -File make-voice.ps1 [-Rate 1.0]
param([double]$Rate = 1.0)
$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
function Await($op, [Type]$t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(); $task.Result }

$s = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$v = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.DisplayName -like '*Naayf*' } | Select-Object -First 1
if (-not $v) { throw 'Arabic voice "Microsoft Naayf" is not installed (Settings > Time & language > Speech).' }
$s.Voice = $v
$s.Options.SpeakingRate = $Rate

Get-Content (Join-Path $dir 'lines.txt') -Encoding UTF8 | Where-Object { $_ -match '\|' } | ForEach-Object {
  $name, $text = $_ -split '\|', 2
  $st = Await ($s.SynthesizeTextToStreamAsync($text.Trim())) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
  $size = [uint32]$st.Size
  $r = New-Object Windows.Storage.Streams.DataReader($st.GetInputStreamAt(0))
  $null = Await ($r.LoadAsync($size)) ([uint32])
  $b = New-Object byte[] $size; $r.ReadBytes($b)
  $out = Join-Path $dir ($name.Trim() + '.wav'); [IO.File]::WriteAllBytes($out, $b)
  # duration from the WAV header (byte rate at offset 28, data chunk size)
  $byteRate = [BitConverter]::ToInt32($b, 28)
  "{0,-10} {1,6:N2} s" -f $name.Trim(), (($b.Length - 44) / $byteRate)
}
