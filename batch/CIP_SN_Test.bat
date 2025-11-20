@echo off
REM cls
REM Run ReadyAPI queryIncident test and calculate total execution time

REM --- Capture start time ---
set "start=%time%"
echo Test starts, please wait....
echo Start time: %date% %start%

REM --- Run the test ---
cd "C:\Program Files\SmartBear\ReadyAPI-3.61.0\bin"
testrunner.bat -s "CIP_V2.8.3 Test Suite" -c "CIP-SN" -r "C:\Users\IltefaSy\Downloads\CIP-Automation-readyapi-project.xml" 2>nul | findstr "\[log\]"

REM --- Capture end time ---
set "end=%time%"
echo Test completed! End time: %date% %end%