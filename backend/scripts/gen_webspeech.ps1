Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$outFile = "f:\wordlvtest\backend\scripts\tts_sample_webspeech.wav"
$synth.SetOutputToWaveFile($outFile)
$synth.Speak("Only middle school students can be in the contest.")
$synth.Dispose()
Write-Host "Done: $outFile"
