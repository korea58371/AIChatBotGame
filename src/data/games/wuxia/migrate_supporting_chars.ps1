
$sourceDir = "j:\AI\Game\AIChatBotGame\public\assets\wuxia\SupportingCharacters"
$destBase = "j:\AI\Game\AIChatBotGame\public\assets\wuxia\characters"

# Mapping Table (Korean -> English)
$map = @{
    "개눈" = "GaeNun";
    "고준" = "GoJun";
    "공손월" = "GongSonWol";
    "금만수" = "GeumManSu";
    "김포" = "GimPo";
    "남궁진" = "NamgungJin";
    "남궁천" = "NamgungCheon";
    "남궁혁" = "NamgungHyeok";
    "남궁휘" = "NamgungHwi";
    "당명" = "TangMyeong";
    "당문식" = "TangMunSik";
    "당보" = "TangBo";
    "당비" = "TangBi";
    "도끼" = "DoKki";
    "독고천" = "DokGoCheon";
    "돌쇠" = "DolSoe";
    "마광철" = "MaGwangCheol";
    "명심" = "MyeongSim";
    "모용구" = "MoyongGu";
    "모용휘" = "MoyongHwi";
    "무영" = "MuYoung";
    "바르칸" = "Barkan";
    "박철" = "BakCheol";
    "소칠" = "SoChil";
    "연무린" = "YeonMuRin";
    "연성" = "YeonSeong";
    "왕곡추" = "WangGokChu";
    "왕노야" = "WangNoYa";
    "왕초" = "WangCho";
    "운검" = "UnGeom";
    "유성" = "YuSeong";
    "장무극" = "JangMuGeuk";
    "정허" = "JeongHeo";
    "조명" = "JoMyeong";
    "조삼" = "JoSam";
    "주진양" = "JuJinYang";
    "천위강" = "CheonWiGang";
    "청운" = "CheongUn";
    "초련" = "ChoRyeon";
    "칠성" = "ChilSeong";
    "팽대광" = "PaengDaeGwang";
    "팽무도" = "PaengMuDo";
    "하오문도_여" = "HaoMunDoYeo";
    "한철" = "HanCheol";
    "현명" = "HyeonMyeong";
    "현무" = "HyeonMu";
    "혈비" = "HyeolBi";
    "혜광" = "HyeGwang";
    "혜심" = "HyeSim";
    "홍칠" = "HongChil";
    "흑풍" = "HeukPung";
    "야율" = "YaYul"
}

# Ensure destination exists
if (-not (Test-Path $destBase)) {
    Write-Host "Destination base directory not found!"
    exit
}

foreach ($key in $map.Keys) {
    $engName = $map[$key]
    $srcFile = Join-Path $sourceDir "$key.png"
    $targetDir = Join-Path $destBase $engName
    $targetFile = Join-Path $targetDir "${engName}_Default.png"

    if (Test-Path $srcFile) {
        Write-Host "Processing $key -> $engName..."
        
        # Create Directory if not exists
        if (-not (Test-Path $targetDir)) {
            New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
            Write-Host "  Created directory: $targetDir"
        }

        # Check if target file already exists
        if (-not (Test-Path $targetFile)) {
            Copy-Item -Path $srcFile -Destination $targetFile
            Write-Host "  Copied to $targetFile"
        } else {
            Write-Host "  Target file already exists. Skipping copy."
        }
    } else {
        Write-Host "Source file not found: $srcFile"
    }
}

Write-Host "Migration Complete."
