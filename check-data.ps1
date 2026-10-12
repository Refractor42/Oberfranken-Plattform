$headers = @{
    "apikey" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxanNzY2p6dGZnbnpqZmV0d3R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExOTA2OTAsImV4cCI6MjEwNjc2NjY5MH0.IKborNQNIUCFgm33_81aTyIftzR0Lt-mYgY5QJBVb-M"
}

$regions = @("Kronach", "Coburg", "Wunsiedel", "Kulmbach", "Lichtenfels")

foreach ($region in $regions) {
    Write-Host ("Checking data for " + $region + "...")
    $url = "https://cqjsscjztfgnzjfetwtw.supabase.co/rest/v1/regional_places?region=eq." + $region + "&select=category,name"
    try {
        $response = Invoke-RestMethod -Uri $url -Method Get -Headers $headers
        $count = $response.Count
        $categories = $response | Group-Object category | Select-Object Name, Count | Sort-Object Count -Descending
        Write-Host ("Total places: " + $count)
        $categories | Format-Table -AutoSize | Out-String | Write-Host
    } catch {
        Write-Host ("Error for " + $region + ": " + $_.Exception.Message)
    }
    Write-Host ""
}