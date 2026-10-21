@echo off
rem Syako map tool launcher (starts local pack server on port 8765, then opens browser)
cd /d "%~dp0"
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://127.0.0.1:8765/api/oss-pack/ping | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  start "OSS Pack Server" /min python scripts\oss_pack_server.py
  timeout /t 3 /nobreak >nul
)
start "" "http://localhost:8765/syako_map_maker.html"
