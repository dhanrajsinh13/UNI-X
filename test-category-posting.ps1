# PowerShell script to test category posting on UNIX API
$appUrl = "https://unix-azvg.vercel.app"
$token = "YOUR_JWT_TOKEN_HERE"  # Get this from registration or login

Write-Host "🚀 Testing UNIX Category Posting..." -ForegroundColor Green
Write-Host "📍 App URL: $appUrl" -ForegroundColor Cyan

# Test 1: Get a JWT token (register first)
if ($token -eq "YOUR_JWT_TOKEN_HERE") {
    Write-Host "`n👤 Registering test user to get token..." -ForegroundColor Blue
    
    $testUser = @{
        name = "Category Test User"
        username = "cattest" + (Get-Date).Ticks
        email = "cattest" + (Get-Date).Ticks + "@example.com"
        college_id = "CATTEST" + (Get-Date).Ticks
        password = "password123"
        department = "Computer Science"
        year = "3"
    } | ConvertTo-Json

    try {
        $regResponse = Invoke-RestMethod -Uri "$appUrl/api/auth/register" -Method POST -Body $testUser -ContentType "application/json"
        $token = $regResponse.token
        Write-Host "✅ Registration successful! Got token for testing" -ForegroundColor Green
    } catch {
        Write-Host "❌ Registration failed:" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        exit
    }
}

# Test 2: Test different categories
$categories = @("general", "academic", "events", "clubs", "sports", "social")

foreach ($category in $categories) {
    Write-Host "`n📋 Testing category: $category" -ForegroundColor Blue
    
    # Create multipart form data
    $boundary = [System.Guid]::NewGuid().ToString()
    $LF = "`r`n"
    
    $bodyLines = @(
        "--$boundary",
        "Content-Disposition: form-data; name=`"caption`"$LF",
        "Test post for category: $category",
        "--$boundary",
        "Content-Disposition: form-data; name=`"category`"$LF", 
        $category,
        "--$boundary--$LF"
    ) -join $LF

    try {
        $headers = @{
            'Authorization' = "Bearer $token"
            'Content-Type' = "multipart/form-data; boundary=$boundary"
        }
        
        $response = Invoke-RestMethod -Uri "$appUrl/api/posts" -Method POST -Body $bodyLines -Headers $headers
        Write-Host "✅ Category '$category' post successful!" -ForegroundColor Green
        Write-Host "   Post ID: $($response.post.id), DB Category: $($response.post.category)" -ForegroundColor Yellow
        
    } catch {
        Write-Host "❌ Category '$category' post failed:" -ForegroundColor Red
        Write-Host "   $($_.Exception.Message)" -ForegroundColor Red
        
        if ($_.Exception.Response) {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $responseBody = $reader.ReadToEnd()
            Write-Host "   Response: $responseBody" -ForegroundColor Red
        }
    }
}

# Test 3: Verify posts were created with correct categories
Write-Host "`n📊 Verifying posts by category..." -ForegroundColor Blue

foreach ($dbCategory in @("EVENT", "WORKSHOP", "INTERNSHIP", "LIBRARY_MEMORY")) {
    try {
        $headers = @{
            'Authorization' = "Bearer $token"
        }
        
        $response = Invoke-RestMethod -Uri "$appUrl/api/posts?category=$dbCategory" -Method GET -Headers $headers
        $count = $response.posts.Count
        Write-Host "✅ Found $count posts in category: $dbCategory" -ForegroundColor Green
        
    } catch {
        Write-Host "❌ Failed to fetch posts for category: $dbCategory" -ForegroundColor Red
        Write-Host "   $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n📋 Category Mapping (Frontend -> Database):" -ForegroundColor Magenta
Write-Host "general -> EVENT" -ForegroundColor White
Write-Host "academic -> WORKSHOP" -ForegroundColor White
Write-Host "events -> EVENT" -ForegroundColor White
Write-Host "clubs -> EVENT" -ForegroundColor White
Write-Host "sports -> EVENT" -ForegroundColor White
Write-Host "social -> EVENT" -ForegroundColor White

Write-Host "`n🎯 Expected Results:" -ForegroundColor Cyan
Write-Host "• All categories should create posts successfully" -ForegroundColor White
Write-Host "• Most posts should appear in EVENT category" -ForegroundColor White
Write-Host "• Academic posts should appear in WORKSHOP category" -ForegroundColor White
Write-Host "• No posts should fail due to invalid category" -ForegroundColor White