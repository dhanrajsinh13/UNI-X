# MongoDB Community Server Quick Setup for Windows
Write-Host "MongoDB Local Setup Script" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Check if MongoDB is already installed
$mongoInstalled = Get-Command mongod -ErrorAction SilentlyContinue

if ($mongoInstalled) {
    Write-Host "MongoDB is already installed!" -ForegroundColor Green
    Write-Host "Location: $($mongoInstalled.Source)`n"
    
    # Check if service exists
    $mongoService = Get-Service MongoDB -ErrorAction SilentlyContinue
    
    if ($mongoService) {
        Write-Host "MongoDB Service Status: $($mongoService.Status)" -ForegroundColor Yellow
        
        if ($mongoService.Status -ne "Running") {
            Write-Host "Starting MongoDB service..." -ForegroundColor Yellow
            try {
                Start-Service MongoDB
                Write-Host "MongoDB service started!" -ForegroundColor Green
            }
            catch {
                Write-Host "Failed to start MongoDB service. Run as Administrator!" -ForegroundColor Red
                Write-Host "Manual start: net start MongoDB`n" -ForegroundColor Yellow
            }
        }
        else {
            Write-Host "MongoDB service is running!" -ForegroundColor Green
        }
    }
    else {
        Write-Host "MongoDB installed but service not found" -ForegroundColor Yellow
        Write-Host "Starting MongoDB manually..." -ForegroundColor Yellow
        
        # Create data directory
        $dataDir = "C:\data\db"
        if (-not (Test-Path $dataDir)) {
            New-Item -Path $dataDir -ItemType Directory -Force | Out-Null
            Write-Host "Created data directory: $dataDir" -ForegroundColor Green
        }
        
        Write-Host "`nTo start MongoDB manually, run:" -ForegroundColor Yellow
        Write-Host "mongod --dbpath `"$dataDir`"`n" -ForegroundColor Cyan
    }
    
    Write-Host "`nMongoDB is ready!" -ForegroundColor Green
    Write-Host "Connection: mongodb://localhost:27017" -ForegroundColor Cyan
    Write-Host "`nTest connection:" -ForegroundColor Yellow
    Write-Host "node test-mongo-connection.js`n" -ForegroundColor Cyan
}
else {
    Write-Host "MongoDB is not installed`n" -ForegroundColor Red
    
    Write-Host "Download MongoDB Community Server:" -ForegroundColor Yellow
    Write-Host "https://www.mongodb.com/try/download/community`n" -ForegroundColor Cyan
    
    Write-Host "Installation Steps:" -ForegroundColor Yellow
    Write-Host "1. Download MongoDB 7.0 MSI installer (Windows)" -ForegroundColor White
    Write-Host "2. Run installer and choose Complete" -ForegroundColor White
    Write-Host "3. Check Install MongoDB as a Service" -ForegroundColor White
    Write-Host "4. Complete installation" -ForegroundColor White
    Write-Host "5. Run this script again`n" -ForegroundColor White
    
    Write-Host "Quick Download Link:" -ForegroundColor Yellow
    $downloadUrl = "https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.14-signed.msi"
    Write-Host "$downloadUrl`n" -ForegroundColor Cyan
    
    $response = Read-Host "Would you like to open the download page? (Y/N)"
    if ($response -eq "Y" -or $response -eq "y") {
        Start-Process "https://www.mongodb.com/try/download/community"
    }
}

Write-Host "`nFor detailed instructions, see: SETUP_LOCAL_MONGODB.md" -ForegroundColor Cyan
