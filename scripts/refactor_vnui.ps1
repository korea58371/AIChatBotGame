# PowerShell script to precisely replace inline JSX blocks in VisualNovelUI.tsx
# with new component calls. Uses line-number-based replacement for accuracy.

$file = "j:\AI\Game\AIChatBotGame\src\components\VisualNovelUI.tsx"
$lines = [System.IO.File]::ReadAllLines($file)

# === STEP 1: Add imports after line 69 (DialogueBox import) ===
$importLines = @(
    "import ChoiceOverlay from './visual_novel/ui/ChoiceOverlay'; // [Refactor] Choice UI"
    "import TopControls from './visual_novel/ui/TopControls'; // [Refactor] Top Controls"
    "import BottomControls from './visual_novel/ui/BottomControls'; // [Refactor] Bottom Controls"
    "import InputModal from './visual_novel/ui/InputModal'; // [Refactor] Input Modal"
    "import ToastContainer from './visual_novel/ui/ToastContainer'; // [Refactor] Toast UI"
)

# Insert after line 69 (0-indexed: 68)
$newLines = [System.Collections.ArrayList]::new()
for ($i = 0; $i -lt $lines.Length; $i++) {
    $null = $newLines.Add($lines[$i])
    if ($i -eq 68) {
        foreach ($imp in $importLines) {
            $null = $newLines.Add($imp)
        }
    }
}

# Convert back to array
$lines = $newLines.ToArray()

# === STEP 2: Replace Choice Overlay (original lines 5234-5368, now +5 offset = 5239-5373) ===
# Find the start: "{/* Center: Choices */}"
# Find the end: the closing "}" after the fragment on line 5368
$choiceStart = -1
$choiceEnd = -1
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i].Trim() -eq '{/* Center: Choices */}') {
        $choiceStart = $i
    }
    # Find the closing after </> ) }
    if ($choiceStart -gt 0 -and $i -gt $choiceStart) {
        if ($lines[$i].Trim() -eq '{/* Fallback for stuck state or Start Screen */}') {
            $choiceEnd = $i - 1  # Line before fallback (should be empty line or closing brace)
            # Go back to find the actual closing brace
            while ($choiceEnd -ge $choiceStart -and $lines[$choiceEnd].Trim() -eq '') {
                $choiceEnd--
            }
            $choiceEnd++  # Include the last non-empty line
            break
        }
    }
}

$choiceReplacement = @(
    '                {/* [Refactor] Choice Overlay Component */}'
    '                <ChoiceOverlay'
    '                    choices={choices}'
    '                    goals={goals}'
    '                    turnSummary={turnSummary}'
    '                    costPerTurn={costPerTurn}'
    '                    isProcessing={isProcessing}'
    '                    isLogicPending={isLogicPending}'
    '                    endingType={endingType}'
    '                    onChoiceSelect={(choice) => {'
    '                        addChoiceToHistory({ text: choice.content, type: ''input'', timestamp: Date.now() });'
    '                        handleSend(choice.content);'
    '                    }}'
    '                    onDirectInput={() => setIsInputOpen(true)}'
    '                    playSfx={playSfx}'
    '                    t={t}'
    '                />'
    ''
)

if ($choiceStart -gt 0 -and $choiceEnd -gt $choiceStart) {
    Write-Host "Replacing Choice Overlay: lines $choiceStart to $choiceEnd (0-indexed)"
    $before = $lines[0..($choiceStart - 1)]
    $after = $lines[$choiceEnd..($lines.Length - 1)]
    $lines = $before + $choiceReplacement + $after
} else {
    Write-Host "WARNING: Could not find Choice Overlay block. start=$choiceStart end=$choiceEnd"
}

# Write the result
[System.IO.File]::WriteAllLines($file, $lines)
Write-Host "Done. Total lines: $($lines.Length)"
