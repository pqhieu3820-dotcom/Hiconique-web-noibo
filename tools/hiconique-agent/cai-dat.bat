@echo off
chcp 65001 >nul
rem Cài HICONIQUE Agent: chạy nền mỗi khi đăng nhập Windows. Cần Python 3 (python.org) và file config.json cùng thư mục.
cd /d "%~dp0"
if not exist config.json (
  echo Chua co config.json. Sao chep config.example.json thanh config.json va dien memberId truoc.
  pause & exit /b 1
)
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
> "%STARTUP%\HiconiqueAgent.bat" echo @echo off
>> "%STARTUP%\HiconiqueAgent.bat" echo cd /d "%~dp0"
>> "%STARTUP%\HiconiqueAgent.bat" echo start "" pythonw agent.py
start "" pythonw agent.py
echo Da cai dat va dang chay. Du lieu cua ban: %LOCALAPPDATA%\HiconiqueAgent\hoat-dong-hom-nay.txt
pause
