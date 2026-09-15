@echo off
chcp 65001 > nul
setlocal

set "SCRIPT_DIR=%~dp0"
set "PYTHON_EXE=python"

echo ========================================================
echo   車庫証明申請簿 自動転記同期システム
echo   Googleスプレッドシート（GAS） =^> Excel最新化
echo ========================================================
echo.

cd /d "%SCRIPT_DIR%"
"%PYTHON_EXE%" "%SCRIPT_DIR%export_to_shinsei_book.py"

if %ERRORLEVEL% equ 0 (
    echo.
    echo [成功] 申請簿Excelの同期・追記が正常に完了しました。
) else (
    echo.
    echo [エラー] 同期処理中に問題が発生しました。詳細はログをご確認ください。
)

echo.
timeout /t 5 > nul
