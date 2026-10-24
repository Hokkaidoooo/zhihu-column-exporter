@echo off
set "EXTENSION_DIR=%~dp0extension"
start "" explorer.exe "%EXTENSION_DIR%"
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "chrome://extensions/"
