[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $ApiBaseUrl,

    [ValidateSet('physical', 'emulator')]
    [string] $Target = 'physical',

    [ValidateRange(1, 2147483647)]
    [int] $VersionCode = 0,

    [string] $VersionName
)

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$tvProjectRoot = Join-Path $repositoryRoot 'apps\tv-shell'
$gradleWrapper = Join-Path $tvProjectRoot 'gradlew.bat'

try {
    $apiUri = [Uri] $ApiBaseUrl
} catch {
    throw 'ApiBaseUrl must be an absolute HTTP(S) URL, for example http://192.168.1.20:3000/api/v1/.'
}

if (-not $apiUri.IsAbsoluteUri -or $apiUri.Scheme -notin @('http', 'https')) {
    throw 'ApiBaseUrl must be an absolute HTTP(S) URL.'
}

$gradleArguments = @(
    ':app:assembleDebug',
    ':app:testDebugUnitTest',
    '--no-daemon',
    "-PtvApiBaseUrl=$ApiBaseUrl",
    "-PtvTarget=$Target"
)
if ($VersionCode -gt 0) {
    $gradleArguments += "-PtvVersionCode=$VersionCode"
}
if (-not [string]::IsNullOrWhiteSpace($VersionName)) {
    $gradleArguments += "-PtvVersionName=$VersionName"
}

Push-Location $tvProjectRoot
try {
    & $gradleWrapper @gradleArguments
    if ($LASTEXITCODE -ne 0) {
        throw 'Debug APK build or unit tests failed.'
    }
} finally {
    Pop-Location
}

$apkPath = Join-Path $tvProjectRoot 'app\build\outputs\apk\debug\app-debug.apk'
if (-not (Test-Path -LiteralPath $apkPath -PathType Leaf)) {
    throw "Debug APK was not found at $apkPath."
}

[pscustomobject]@{
    ApkPath = $apkPath
    Sha256 = (Get-FileHash -LiteralPath $apkPath -Algorithm SHA256).Hash.ToUpperInvariant()
    ApiBaseUrl = $ApiBaseUrl
    Target = $Target
} | Format-List
