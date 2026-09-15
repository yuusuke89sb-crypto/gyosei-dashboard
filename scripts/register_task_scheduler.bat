@echo off
chcp 65001 > nul
setlocal

echo ========================================================
echo   Windowsタスクスケジューラ 登録スクリプト
echo   タスク名: Gyosei_Sync_ShinseiBook
echo   実行頻度: 毎日 18:30 (業務終了時)
echo ========================================================
echo.

set "TASK_NAME=Gyosei_Sync_ShinseiBook"
set "BAT_PATH=d:\行政書士\開業\gyosei-dashboard\scripts\run_sync_shinsei_book.bat"

schtasks /create /tn "%TASK_NAME%" /tr "\"%BAT_PATH%\"" /sc daily /st 18:30 /f

if %ERRORLEVEL% equ 0 (
    echo.
    echo ✅ タスク「%TASK_NAME%」の登録に成功しました！
    echo 毎日 18:30 にバックグラウンドで自動実行されます。
) else (
    echo.
    echo ⚠️ 登録に失敗しました。管理者権限のコマンドプロンプトで実行してください。
)

echo.
pause
