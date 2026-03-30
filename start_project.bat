@echo off
echo ==============================================
echo Starting Whistleblower-ZK Project...
echo ==============================================

echo [1/2] Starting Backend Verifier Node (Port 4000)
start "Backend Server" cmd.exe /k "cd web\server && node server.js"

echo [2/2] Starting Frontend App (Port 3000)
start "Frontend Client" cmd.exe /k "cd web\client && npm run dev"

echo Done! The applications have been launched in separate windows.
