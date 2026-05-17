# Quick launcher: starts backend + frontend in two PowerShell windows.
# Run from the repo root: .\start-dev.ps1

$root = $PSScriptRoot

Start-Process powershell -ArgumentList @(
    '-NoExit', '-Command',
    "cd '$root\backend'; if (-not (Test-Path .venv)) { python -m venv .venv }; .\.venv\Scripts\Activate.ps1; pip install -q -r requirements.txt; python run.py"
)

Start-Process powershell -ArgumentList @(
    '-NoExit', '-Command',
    "cd '$root\frontend'; if (-not (Test-Path node_modules)) { npm install }; npm run dev"
)

Write-Host "Launched backend (port 8000) and frontend (port 5173) in separate windows." -ForegroundColor Green
