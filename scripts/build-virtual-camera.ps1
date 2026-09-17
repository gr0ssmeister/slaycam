$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$cacheRoot = Join-Path $projectRoot "native-cache"
$softcamRoot = Join-Path $cacheRoot "softcam"
$outputRoot = Join-Path $projectRoot "native-dist\virtual-camera"
$softcamCommit = "e89a699ed9932c74f57afe4f396be89665967e00"

New-Item -ItemType Directory -Force -Path $cacheRoot, (Join-Path $outputRoot "x64"), (Join-Path $outputRoot "x86") | Out-Null

if (-not (Test-Path (Join-Path $softcamRoot ".git"))) {
  git clone https://github.com/tshino/softcam.git $softcamRoot
}

git -C $softcamRoot fetch --depth 1 origin $softcamCommit
git -C $softcamRoot reset --hard $softcamCommit
git -C $softcamRoot clean -fdx

$softcamSource = Join-Path $softcamRoot "src\softcam\softcam.cpp"
$source = Get-Content $softcamSource -Raw
$source = $source.Replace("0xaef3b972, 0x5fa5, 0x4647, 0x95, 0x71, 0x35, 0x8e, 0xb4, 0x72, 0xbc, 0x9e", "0x2bb0606f, 0x077b, 0x4b5d, 0x95, 0x15, 0xa3, 0xe1, 0x6b, 0xac, 0xe7, 0xaa")
$source = $source.Replace('L"DirectShow Softcam"', 'L"SlayCam"')
Set-Content -Path $softcamSource -Value $source -Encoding UTF8

$coreSource = Join-Path $softcamRoot "src\softcamcore\DShowSoftcam.cpp"
$source = (Get-Content $coreSource -Raw).Replace('DirectShow Softcam', 'SlayCam')
Set-Content -Path $coreSource -Value $source -Encoding UTF8

$frameBufferSource = Join-Path $softcamRoot "src\softcamcore\FrameBuffer.cpp"
$source = (Get-Content $frameBufferSource -Raw).Replace('DirectShow Softcam/NamedMutex', 'SlayCam/NamedMutex').Replace('DirectShow Softcam/SharedMemory', 'SlayCam/SharedMemory')
Set-Content -Path $frameBufferSource -Value $source -Encoding UTF8

# Keep the camera self-contained: friends should not need to install the Visual C++ runtime.
Get-ChildItem (Join-Path $softcamRoot "src") -Filter "*.vcxproj" -Recurse | ForEach-Object {
  $project = Get-Content $_.FullName -Raw
  $project = $project.Replace('msvcrt.lib;', '')
  $project = $project.Replace('<ConformanceMode>true</ConformanceMode>', '<ConformanceMode>true</ConformanceMode><RuntimeLibrary>MultiThreaded</RuntimeLibrary>')
  Set-Content -Path $_.FullName -Value $project -Encoding UTF8
}

msbuild (Join-Path $softcamRoot "softcam.sln") /m /t:softcam /p:Configuration=Release /p:Platform=x64
msbuild (Join-Path $softcamRoot "softcam.sln") /m /t:softcam /p:Configuration=Release /p:Platform=Win32
msbuild (Join-Path $projectRoot "native\virtual-camera\SlayCamVcamHost.vcxproj") /m /p:Configuration=Release /p:Platform=x64

Copy-Item (Join-Path $softcamRoot "dist\bin\x64\softcam.dll") (Join-Path $outputRoot "x64\slaycam-virtualcam.dll") -Force
Copy-Item (Join-Path $softcamRoot "dist\bin\Win32\softcam.dll") (Join-Path $outputRoot "x86\slaycam-virtualcam.dll") -Force
Copy-Item (Join-Path $softcamRoot "LICENSE") (Join-Path $outputRoot "SOFTCAM-LICENSE.txt") -Force
Copy-Item (Join-Path $projectRoot "native\virtual-camera\THIRD_PARTY_NOTICES.md") (Join-Path $outputRoot "THIRD_PARTY_NOTICES.md") -Force

Write-Host "SlayCam virtual camera binaries are ready in $outputRoot"
