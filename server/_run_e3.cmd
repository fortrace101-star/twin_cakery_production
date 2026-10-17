@echo off
REM Detached launcher for the E3 persistence gate (runs under Task Scheduler as
REM SYSTEM so no interactive session / harness timeout can kill the gate mid-run).
set PATH=C:\Program Files\nodejs;%PATH%
echo LAUNCHED %DATE% %TIME% > "%~dp0_e3.run.log"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0_e3_gate.ps1" >> "%~dp0_e3.run.log" 2>&1
echo GATE_EXIT %ERRORLEVEL% %TIME% >> "%~dp0_e3.run.log"
