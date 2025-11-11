# Create test users for UNI-X

$users = @(
    @{
        name = "Sarah Wilson"
        username = "swilson"
        email = "sarah@gmail.com"
        password = "test123"
        college_id = "111222112"
        department = "Computer Science"
        year = 1
    },
    @{
        name = "Mike Chen"
        username = "mchen"
        email = "mike@gmail.com"
        password = "test123"
        college_id = "111222113"
        department = "Computer Science"
        year = 1
    },
    @{
        name = "Emma Davis"
        username = "edavis"
        email = "emma@gmail.com"
        password = "test123"
        college_id = "111222114"
        department = "Computer Science"
        year = 2
    },
    @{
        name = "Alex Johnson"
        username = "ajohnson"
        email = "alex@gmail.com"
        password = "test123"
        college_id = "111222115"
        department = "Engineering"
        year = 1
    },
    @{
        name = "Lisa Martinez"
        username = "lmartinez"
        email = "lisa@gmail.com"
        password = "test123"
        college_id = "111222116"
        department = "Computer Science"
        year = 3
    }
)

Write-Host "Creating test users..." -ForegroundColor Cyan

foreach ($user in $users) {
    $body = $user | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/register" `
            -Method POST `
            -ContentType "application/json" `
            -Body $body `
            -ErrorAction Stop
        
        Write-Host "Created user: $($user.name) ($($user.username))" -ForegroundColor Green
    }
    catch {
        if ($_.Exception.Response.StatusCode -eq 409) {
            Write-Host "User already exists: $($user.name)" -ForegroundColor Yellow
        }
        else {
            Write-Host "Failed to create user: $($user.name) - $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    Start-Sleep -Milliseconds 500
}

Write-Host "`nAll done! Created 5 test users." -ForegroundColor Green
