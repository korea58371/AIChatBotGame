
$mapFile = "j:\AI\Game\AIChatBotGame\src\data\games\wuxia\supporting_map.json"
$sourceDir = "j:\AI\Game\AIChatBotGame\public\assets\wuxia\SupportingCharacters"
$destBase = "j:\AI\Game\AIChatBotGame\public\assets\wuxia\characters"

# Load Map
$jsonContent = Get-Content -Raw -Path $mapFile -Encoding UTF8
$map = $jsonContent | ConvertFrom-Json

# Process
if (-not (Test-Path $destBase)) {
    Write-Host "Destination base directory $destBase not found!"
    exit
}

$map.PSObject.Properties | ForEach-Object {
    $key = $_.Name
    $engName = $_.Value
    
    $srcFile = Join-Path $sourceDir "$key.png"
    $targetDir = Join-Path $destBase $engName
    $targetFile = Join-Path $targetDir "${engName}_Default.png"

    if (Test-Path $srcFile) {
        Write-Host "Processing $key -> $engName..."
        
        if (-not (Test-Path $targetDir)) {
            New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
            Write-Host "  Created dir: $targetDir"
        }

        if (-not (Test-Path $targetFile)) {
            Copy-Item -Path $srcFile -Destination $targetFile
            Write-Host "  Copied to $targetFile"
        }
        else {
            Write-Host "  Target file exists. Skipping."
        }
    }
    else {
        Write-Host "Source not found: $srcFile"
    }
}
