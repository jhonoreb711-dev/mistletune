$ErrorActionPreference = 'Stop'
$serverDir = (Resolve-Path $PSScriptRoot).Path
$downloadDir = Join-Path $serverDir '.cache\setup\crispasr'
$extractDir = Join-Path $downloadDir 'extract'
$zipPath = Join-Path $downloadDir 'crispasr-windows-x86_64-cpu.zip'
$binDir = Join-Path $serverDir 'bin'
$driveName = [System.IO.Path]::GetPathRoot($serverDir)
$drive = [System.IO.DriveInfo]::new($driveName)
if ($drive.AvailableFreeSpace -lt 4GB) {
    throw 'At least 4 GB of free disk space is required for the Voxtral runtime and quantized models.'
}

New-Item -ItemType Directory -Path $downloadDir, $extractDir, $binDir -Force | Out-Null
$release = Invoke-RestMethod -Uri 'https://api.github.com/repos/CrispStrobe/CrispASR/releases/latest' -Headers @{ 'User-Agent' = 'MistleTune-local-setup' }
$asset = $release.assets | Where-Object { $_.name -eq 'crispasr-windows-x86_64-cpu.zip' } | Select-Object -First 1
if (-not $asset) { throw "The latest CrispASR release ($($release.tag_name)) has no Windows CPU package." }

$installedExe = Join-Path $binDir 'crispasr.exe'
if (-not (Test-Path -LiteralPath $installedExe -PathType Leaf)) {
    Write-Host "Downloading CrispASR $($release.tag_name) from its GitHub release..."
    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath
    Expand-Archive -LiteralPath $zipPath -DestinationPath $extractDir -Force
    $runtimeExe = Get-ChildItem -LiteralPath $extractDir -Filter 'crispasr.exe' -File -Recurse | Select-Object -First 1
    if (-not $runtimeExe) { throw 'The downloaded CrispASR archive did not contain crispasr.exe.' }
    Get-ChildItem -LiteralPath $runtimeExe.DirectoryName -Force | Copy-Item -Destination $binDir -Recurse -Force
}

if (-not (Test-Path -LiteralPath $installedExe -PathType Leaf)) { throw 'CrispASR was not installed into server/bin.' }
& $installedExe --version
if ($LASTEXITCODE -ne 0) { throw 'The CrispASR runtime failed its version check.' }

$modelCache = Join-Path $env:USERPROFILE '.cache\crispasr'
New-Item -ItemType Directory -Path $modelCache -Force | Out-Null
$downloads = @(
    @{ Name = 'voxtral-mini-4b-realtime-q4_k.gguf'; Url = 'https://huggingface.co/cstr/voxtral-mini-4b-realtime-GGUF/resolve/main/voxtral-mini-4b-realtime-q4_k.gguf'; MinimumBytes = 2GB },
    @{ Name = 'canary-ctc-aligner-q4_k.gguf'; Url = 'https://huggingface.co/cstr/canary-ctc-aligner-GGUF/resolve/main/canary-ctc-aligner-q4_k.gguf'; MinimumBytes = 392167040 }
)
foreach ($download in $downloads) {
    $modelPath = Join-Path $modelCache $download.Name
    if ((Test-Path -LiteralPath $modelPath -PathType Leaf) -and (Get-Item -LiteralPath $modelPath).Length -ge $download.MinimumBytes) {
        Write-Host "$($download.Name) is already installed."
        continue
    }
    $partialPath = "$modelPath.part"
    Write-Host "Downloading $($download.Name)..."
    Invoke-WebRequest -Uri $download.Url -OutFile $partialPath
    if ((Get-Item -LiteralPath $partialPath).Length -lt $download.MinimumBytes) {
        throw "The downloaded $($download.Name) file is incomplete."
    }
    Move-Item -LiteralPath $partialPath -Destination $modelPath -Force
}
Write-Host 'CrispASR, Voxtral, and the CTC word aligner are ready.'
