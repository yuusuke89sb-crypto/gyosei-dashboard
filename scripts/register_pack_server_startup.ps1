# Register the OSS pack helper server to start automatically (hidden) at Windows logon.
# Usage:   powershell -ExecutionPolicy Bypass -File scripts\register_pack_server_startup.ps1
# Remove:  powershell -ExecutionPolicy Bypass -File scripts\register_pack_server_startup.ps1 -Remove
param([switch]$Remove)

$startup = [Environment]::GetFolderPath('Startup')
$lnk = Join-Path $startup 'OSS_Pack_Server.lnk'

if ($Remove) {
    if (Test-Path $lnk) { Remove-Item $lnk -Force; Write-Host "Removed: $lnk" } else { Write-Host "Not registered." }
    exit 0
}

$root = Split-Path -Parent $PSScriptRoot
$py = (Get-Command pythonw.exe -ErrorAction SilentlyContinue).Source
if (-not $py) {
    $p = (Get-Command python.exe -ErrorAction Stop).Source
    $py = Join-Path (Split-Path $p) 'pythonw.exe'
}
if (-not (Test-Path $py)) { throw "pythonw.exe not found" }

$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut($lnk)
$s.TargetPath = $py
$s.Arguments = '"' + (Join-Path $root 'scripts\oss_pack_server.py') + '"'
$s.WorkingDirectory = $root
$s.WindowStyle = 7
$s.Description = 'Syako map tool - OSS pack helper server (localhost:8765)'
$s.Save()
Write-Host "Registered: $lnk"
Write-Host "Python:     $py"
