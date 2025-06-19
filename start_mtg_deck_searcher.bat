@echo on
start cmd /k npm run dev
timeout /t 5 >nul
start "" "http://localhost:3000"