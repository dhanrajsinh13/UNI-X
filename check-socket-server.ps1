# Socket Server Diagnostic Script
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Socket Server Diagnostic Check" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# 1. Check if socket server is running
Write-Host "1. Checking if socket server is running..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 3 -ErrorAction Stop
    Write-Host "   ✅ Socket server is running!" -ForegroundColor Green
    Write-Host "   Response: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Socket server NOT running!" -ForegroundColor Red
    Write-Host "   Start it with: cd socket-server && npm start" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# 2. Check if JWT_SECRET exists in socket-server/.env
Write-Host "`n2. Checking JWT_SECRET configuration..." -ForegroundColor Yellow
$socketEnvPath = "socket-server\.env"
if (Test-Path $socketEnvPath) {
    $content = Get-Content $socketEnvPath -Raw
    if ($content -match "JWT_SECRET=(.+)") {
        $secret = $matches[1].Trim()
        if ($secret.Length -gt 0) {
            Write-Host "   ✅ JWT_SECRET found in socket-server/.env (${secret.Length} characters)" -ForegroundColor Green
        } else {
            Write-Host "   ❌ JWT_SECRET is empty in socket-server/.env" -ForegroundColor Red
            Write-Host "   Copy from main .env.local" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ❌ JWT_SECRET not found in socket-server/.env" -ForegroundColor Red
        Write-Host "   Add: JWT_SECRET=your-secret-from-main-env" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ❌ socket-server/.env file not found!" -ForegroundColor Red
    Write-Host "   Create it and add: JWT_SECRET=your-secret" -ForegroundColor Yellow
}

# 3. Check if JWT_SECRET matches in both files
Write-Host "`n3. Checking JWT_SECRET consistency..." -ForegroundColor Yellow
$mainEnvPath = ".env.local"
if (Test-Path $mainEnvPath) {
    $mainContent = Get-Content $mainEnvPath -Raw
    if ($mainContent -match "JWT_SECRET=(.+)") {
        $mainSecret = $matches[1].Trim()
        
        if (Test-Path $socketEnvPath) {
            $socketContent = Get-Content $socketEnvPath -Raw
            if ($socketContent -match "JWT_SECRET=(.+)") {
                $socketSecret = $matches[1].Trim()
                
                if ($mainSecret -eq $socketSecret) {
                    Write-Host "   ✅ JWT_SECRET matches in both files!" -ForegroundColor Green
                } else {
                    Write-Host "   ❌ JWT_SECRET MISMATCH!" -ForegroundColor Red
                    Write-Host "   Main .env.local: ${mainSecret.Substring(0, [Math]::Min(10, $mainSecret.Length))}..." -ForegroundColor Gray
                    Write-Host "   Socket .env:     ${socketSecret.Substring(0, [Math]::Min(10, $socketSecret.Length))}..." -ForegroundColor Gray
                    Write-Host "   They must be identical!" -ForegroundColor Yellow
                }
            }
        }
    }
}

# 4. Check MongoDB connection
Write-Host "`n4. Checking main app..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -TimeoutSec 3 -ErrorAction Stop
    Write-Host "   ✅ Main app is running!" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  Main app not responding" -ForegroundColor Yellow
    Write-Host "   Start it with: npm run dev" -ForegroundColor Gray
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Diagnostic Complete" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. If socket server is not running: cd socket-server && npm start" -ForegroundColor Gray
Write-Host "2. If JWT_SECRET mismatch: Copy JWT_SECRET from .env.local to socket-server/.env" -ForegroundColor Gray
Write-Host "3. Restart socket server after fixing .env" -ForegroundColor Gray
Write-Host "4. Clear browser cache and re-login to app`n" -ForegroundColor Gray
