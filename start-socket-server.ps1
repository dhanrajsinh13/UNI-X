# Load environment variables from .env.local
$envFile = Join-Path $PSScriptRoot ".env.local"

if (Test-Path $envFile) {
    Write-Host "Loading environment variables from .env.local..." -ForegroundColor Cyan
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*)\s*=\s*(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            # Remove quotes if present
            $value = $value -replace '^[''"]|[''"]$', ''
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
            Write-Host "  ✓ $key" -ForegroundColor Green
        }
    }
    Write-Host ""
}

# Start the socket server
Write-Host "Starting Socket.IO server..." -ForegroundColor Yellow
node socket-server.js
