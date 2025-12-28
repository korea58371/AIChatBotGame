$targetDir = "j:\AI\Game\AIChatBotGame\public\assets\wuxia\BGM"
$files = Get-ChildItem -Path $targetDir -Filter "*.mp3"

foreach ($file in $files) {
    if ($file.Name -match "\((.+?)\)(_\d+)?\.mp3$") {
        $englishName = $matches[1]
        $suffix = $matches[2] # This captures _0, _1 etc.
        
        # Clean up English name: Remove spaces, special chars, make PascalCase friendly
        # Simple approach: remove spaces & '&' 
        $cleanName = $englishName -replace "[^a-zA-Z0-9]", ""
        
        $newName = "${cleanName}${suffix}.mp3"
        
        Write-Host "Renaming '$($file.Name)' to '$newName'"
        Rename-Item -Path $file.FullName -NewName $newName
    }
    else {
        Write-Host "Skipping '$($file.Name)' (No match)"
    }
}
