@echo off
chcp 65001 >nul
rem Gỡ HICONIQUE Agent: dừng tiến trình và xóa khỏi khởi động cùng Windows.
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\HiconiqueAgent.bat" 2>nul
taskkill /f /im pythonw.exe >nul 2>&1
echo Da go cai dat HICONIQUE Agent.
pause
