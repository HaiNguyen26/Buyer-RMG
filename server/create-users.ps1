# Script tao 2 tai khoan mac dinh (PowerShell)
# Cach su dung: Dam bao server dang chay (npm run dev), sau do chay script nay

$baseUrl = "http://localhost:5000/api/auth/register"

$users = @(
    @{
        username = "buyer"
        email = "buyer@rmg.vn"
        password = "RMG123@"
        role = "BUYER"
        location = "HCM"
    },
    @{
        username = "buyer_manage"
        email = "buyer_manage@rmg.vn"
        password = "RMG123@"
        role = "BUYER"
        location = "HCM"
    }
)

Write-Host "Dang tao tai khoan..." -ForegroundColor Cyan
Write-Host ""

foreach ($user in $users) {
    try {
        $body = $user | ConvertTo-Json
        $response = Invoke-RestMethod -Uri $baseUrl -Method Post -Body $body -ContentType "application/json"
        
        Write-Host "Da tao tai khoan: $($user.username)" -ForegroundColor Green
        Write-Host "   Email: $($user.email)"
        Write-Host "   Role: $($user.role)"
        Write-Host ""
    }
    catch {
        if ($_.Exception.Response.StatusCode -eq 400) {
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $responseBody = $reader.ReadToEnd()
                $errorObj = $responseBody | ConvertFrom-Json
                
                if ($errorObj.error -eq "User already exists") {
                    Write-Host "Tai khoan $($user.username) da ton tai (bo qua)" -ForegroundColor Yellow
                    Write-Host ""
                } else {
                    Write-Host "Loi khi tao $($user.username): $($errorObj.error)" -ForegroundColor Red
                    Write-Host ""
                }
            }
            catch {
                Write-Host "Loi khi tao $($user.username): $_" -ForegroundColor Red
                Write-Host ""
            }
        } else {
            Write-Host "Loi khi tao $($user.username): $_" -ForegroundColor Red
            Write-Host "   Kiem tra xem server co dang chay khong (npm run dev)" -ForegroundColor Yellow
            Write-Host ""
        }
    }
}

Write-Host "Hoan thanh!" -ForegroundColor Green
Write-Host ""
Write-Host "Thong tin dang nhap:"
Write-Host "   Username: buyer hoac buyer_manage"
Write-Host "   Password: RMG123@"
Write-Host ""
