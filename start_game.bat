@echo off
title Comet Karts
cd /d "%~dp0"
echo Starting Comet Karts at http://localhost:8788 ...
start "" http://localhost:8788/
python serve.py 8788
