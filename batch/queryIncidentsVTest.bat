@echo off
REM cls
REM Run ReadyAPI queryIncident test and calculate total execution time

REM --- Capture start time ---
set "start=%time%"
echo Test starts, please wait....
echo Start time: %date% %start%

REM --- Capture end time ---
set "end=%time%"
echo Test completed! End time: %date% %end%
