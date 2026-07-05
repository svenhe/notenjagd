# build.ps1 — baut alles in EINE Datei: Notenlernspiel.html
# Aufruf:  powershell -ExecutionPolicy Bypass -File build.ps1
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

$html = Get-Content -Raw -Encoding UTF8 (Join-Path $root "index.html")

# CSS einbetten
$css = Get-Content -Raw -Encoding UTF8 (Join-Path $root "style.css")
$html = $html.Replace('<link rel="stylesheet" href="style.css">', "<style>`n$css`n</style>")

# JS-Dateien einbetten (Reihenfolge wie in index.html)
foreach ($js in @("vexflow", "theory", "sound", "pitch", "notation", "game")) {
    $code = Get-Content -Raw -Encoding UTF8 (Join-Path $root "js\$js.js")
    if ($code -match '</script') { throw "js/$js.js enthaelt '</script>' - Inlining nicht moeglich." }
    $tag = '<script src="js/' + $js + '.js"></script>'
    $html = $html.Replace($tag, "<script>`n$code`n</script>")
}

$out = Join-Path $root "Notenlernspiel.html"
[System.IO.File]::WriteAllText($out, $html, (New-Object System.Text.UTF8Encoding $false))
$kb = [math]::Round((Get-Item $out).Length / 1KB)
Write-Host "OK: $out ($kb KB)"
