@echo off
cd /d C:\Users\manue\Desktop\twin_cakery\erp\server
echo Starting server tsc build (can take 30-60s)...
npm run build > compile.log 2>&1
echo TSC_EXIT:%ERRORLEVEL%
type compile.log
echo DONE