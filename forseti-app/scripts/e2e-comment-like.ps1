$ErrorActionPreference='Stop'
$base='http://localhost:4000'
$creds = @{ email='jordan@forseti.com'; password='demo' } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "$base/api/auth/login" -Method Post -Body $creds -ContentType 'application/json'
$token=$login.token
$hdr = @{ Authorization = "Bearer $token" }
Write-Host 'Logged in as:' $login.user.username

# 1) Dashboard: post comment and like
$acts = Invoke-RestMethod -Uri "$base/api/activities?filter=my" -Method Get -Headers $hdr
Write-Host 'My activities count:' ($acts | Measure-Object).Count
if (($acts | Measure-Object).Count -gt 0) {
  $first = $acts[0]
  Write-Host 'Testing activity id:' $first.id
  $commentBody = @{ text = "E2E test comment " + [guid]::NewGuid().ToString(); mentionedUsernames = @('jordanalbert') } | ConvertTo-Json
  $posted = Invoke-RestMethod -Uri "$base/api/activities/$($first.id)/comments" -Method Post -Headers $hdr -Body $commentBody -ContentType 'application/json'
  Write-Host 'Posted comment id:' $posted.id
  $like = Invoke-RestMethod -Uri "$base/api/activities/$($first.id)/like" -Method Post -Headers $hdr
  Write-Host 'Like result:' ($like | ConvertTo-Json)
  $fresh = Invoke-RestMethod -Uri "$base/api/activities/$($first.id)" -Method Get -Headers $hdr
  Write-Host 'Comments now:' ($fresh.comments | Measure-Object).Count
  Write-Host 'Likes now:' ($fresh.likes | Measure-Object).Count
} else {
  Write-Host 'No dashboard activities'
}

# 2) Profile flow
$profile = Invoke-RestMethod -Uri "$base/api/users/jordanalbert" -Method Get -Headers $hdr
$acts2 = Invoke-RestMethod -Uri "$base/api/activities/user/$($profile.id)" -Method Get -Headers $hdr
Write-Host "Their activities count:" ($acts2 | Measure-Object).Count
if (($acts2 | Measure-Object).Count -gt 0) {
  $a = $acts2[0]
  $commentBody2 = @{ text = "E2E profile comment " + [guid]::NewGuid().ToString(); mentionedUsernames = @() } | ConvertTo-Json
  $posted2 = Invoke-RestMethod -Uri "$base/api/activities/$($a.id)/comments" -Method Post -Headers $hdr -Body $commentBody2 -ContentType 'application/json'
  Write-Host 'Posted comment id (profile):' $posted2.id
  $like2 = Invoke-RestMethod -Uri "$base/api/activities/$($a.id)/like" -Method Post -Headers $hdr
  Write-Host 'Like result (profile):' ($like2 | ConvertTo-Json)
  $fresh2 = Invoke-RestMethod -Uri "$base/api/activities/$($a.id)" -Method Get -Headers $hdr
  Write-Host 'Comments now (profile):' ($fresh2.comments | Measure-Object).Count
  Write-Host 'Likes now (profile):' ($fresh2.likes | Measure-Object).Count
} else {
  Write-Host 'No activities on profile to test'
}

Write-Host 'E2E script completed'