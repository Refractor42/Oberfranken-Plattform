$headers = @{
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxanNzY2p6dGZnbnpqZmV0d3R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExOTA2OTAsImV4cCI6MjEwNjc2NjY5MH0.IKborNQNIUCFgm33_81aTyIftzR0Lt-mYgY5QJBVb-M"
    "Content-Type" = "application/json"
}

$regions = @("Kronach", "Coburg", "Wunsiedel", "Kulmbach", "Lichtenfels")

foreach ($region in $regions) {
    Write-Host ("Fetching data for " + $region + "...")
    $url = "https://cqjsscjztfgnzjfetwtw.supabase.co/functions/v1/fetch-regional-data?region=" + $region
    try {
        $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers
        $json = $response | ConvertTo-Json -Depth 5
        Write-Host ("Result for " + $region + ": " + $json)
    } catch {
        Write-Host ("Error for " + $region + ": " + $_.Exception.Message)
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $errorBody = $reader.ReadToEnd()
            Write-Host ("Error details: " + $errorBody)
        }
    }
    Write-Host ""
}