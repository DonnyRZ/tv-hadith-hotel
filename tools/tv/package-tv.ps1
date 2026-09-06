[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $ApiBaseUrl,

    [ValidateRange(1, 2147483647)]
    [int] $VersionCode = 0,

    [ValidateRange(0, 2147483647)]
    [int] $PreviousVersionCode = 5,

    [string] $VersionName,

    [string] $UpdateApkUrl,

    [string] $UpdateReleaseId
)

$expectedCertificateSha256 = '50dff6906e42e0ea5ee933225fadf4a55cb9a2050baaeafa3bff8b6d90820904'

$repositoryRoot = (Resolve-Path (Join-Path (Join-Path $PSScriptRoot '..') '..')).Path
$tvProjectRoot = Join-Path (Join-Path $repositoryRoot 'apps') 'tv-shell'
$isWindowsHost = [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
$gradleWrapperName = if ($isWindowsHost) { 'gradlew.bat' } else { 'gradlew' }
$gradleWrapper = Join-Path $tvProjectRoot $gradleWrapperName
$signingProperties = Join-Path $tvProjectRoot 'signing.properties'
$signingEnvironmentNames = @(
    'TV_SIGNING_STORE_FILE',
    'TV_SIGNING_STORE_PASSWORD',
    'TV_SIGNING_KEY_ALIAS',
    'TV_SIGNING_KEY_PASSWORD'
)
$hasSigningProperties = Test-Path -LiteralPath $signingProperties -PathType Leaf
$hasSigningEnvironment = @($signingEnvironmentNames | Where-Object {
        [string]::IsNullOrWhiteSpace((Get-Item -Path "Env:$($_)" -ErrorAction SilentlyContinue).Value)
    }).Count -eq 0

if (-not $hasSigningProperties -and -not $hasSigningEnvironment) {
    throw 'Release packaging requires apps/tv-shell/signing.properties or all TV_SIGNING_* environment variables. Use a real keystore outside source control.'
}

if ($VersionCode -le $PreviousVersionCode) {
    throw "VersionCode must be greater than PreviousVersionCode ($PreviousVersionCode). Pass the next monotonically increasing release version code explicitly."
}

try {
    $apiUri = [Uri] $ApiBaseUrl
} catch {
    throw 'ApiBaseUrl must be an absolute HTTPS URL, for example https://api.example.com/api/v1/.'
}

if (-not $apiUri.IsAbsoluteUri -or $apiUri.Scheme -ne 'https') {
    throw 'Release packaging requires an absolute HTTPS ApiBaseUrl. HTTP is only supported by debug builds.'
}

if ($apiUri.UserInfo.Length -gt 0 -or $null -ne $apiUri.Query -and $apiUri.Query.Length -gt 0 -or
    $null -ne $apiUri.Fragment -and $apiUri.Fragment.Length -gt 0) {
    throw 'ApiBaseUrl must not contain credentials, query parameters, or fragments.'
}

if ($apiUri.AbsolutePath.TrimEnd('/') -ne '/api/v1') {
    throw 'ApiBaseUrl must end with /api/v1/.'
}

$apiHost = $apiUri.DnsSafeHost.ToLowerInvariant()
$isIpv4Literal = $apiHost -match '^\d{1,3}(\.\d{1,3}){3}$'
$isForbiddenHost = $apiHost -in @('localhost', '127.0.0.1', '::1', '10.0.2.2', '10.0.3.2') -or
    $apiHost.EndsWith('.local') -or $isIpv4Literal
if ($isForbiddenHost) {
    throw 'Release packaging requires a deployed production hostname. Laptop IPs, localhost, emulator hosts, and .local names are forbidden.'
}

if (-not [string]::IsNullOrWhiteSpace($UpdateApkUrl)) {
    try {
        $updateUri = [Uri] $UpdateApkUrl
    } catch {
        throw 'UpdateApkUrl must be an absolute HTTPS URL when supplied.'
    }
    if (-not $updateUri.IsAbsoluteUri -or $updateUri.Scheme -ne 'https' -or
        $updateUri.UserInfo.Length -gt 0 -or
        ($null -ne $updateUri.Query -and $updateUri.Query.Length -gt 0) -or
        ($null -ne $updateUri.Fragment -and $updateUri.Fragment.Length -gt 0)) {
        throw 'UpdateApkUrl must be an absolute HTTPS URL without credentials, query parameters, or fragments.'
    }
}

$gradleArguments = @(':app:assembleRelease', '--no-daemon')
$gradleArguments += "-PtvApiBaseUrl=$ApiBaseUrl"
if ($VersionCode -gt 0) {
    $gradleArguments += "-PtvVersionCode=$VersionCode"
}
if (-not [string]::IsNullOrWhiteSpace($VersionName)) {
    $gradleArguments += "-PtvVersionName=$VersionName"
}

Push-Location $tvProjectRoot
try {
    if ($isWindowsHost) {
        & $gradleWrapper @gradleArguments
    } else {
        & bash $gradleWrapper @gradleArguments
    }
    if ($LASTEXITCODE -ne 0) {
        throw 'Release APK build failed.'
    }
} finally {
    Pop-Location
}

$appBuildRoot = Join-Path (Join-Path $tvProjectRoot 'app') 'build'
$releaseOutputRoot = Join-Path (Join-Path $appBuildRoot 'outputs') (Join-Path 'apk' 'release')
$apkPath = Join-Path $releaseOutputRoot 'app-release.apk'
if (-not (Test-Path -LiteralPath $apkPath -PathType Leaf)) {
    throw "Release APK was not found at $apkPath."
}

$metadataPath = Join-Path $releaseOutputRoot 'output-metadata.json'
if (-not (Test-Path -LiteralPath $metadataPath -PathType Leaf)) {
    throw "Release output metadata was not found at $metadataPath."
}
$metadata = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
$metadataElement = @($metadata.elements)[0]
if ($metadata.applicationId -ne 'com.roomservice.tv' -or $metadata.variantName -ne 'release' -or
    $metadataElement.outputFile -ne 'app-release.apk' -or [int]$metadataElement.versionCode -ne $VersionCode) {
    throw 'Release metadata did not match package com.roomservice.tv, release variant, and requested version code.'
}

$apksignerCommand = Get-Command apksigner -ErrorAction SilentlyContinue
$apksignerPath = $null
if ($null -ne $apksignerCommand) {
    $apksignerPath = $apksignerCommand.Source
    if ([string]::IsNullOrWhiteSpace($apksignerPath)) {
        $apksignerPath = $apksignerCommand.Path
    }
}

if ([string]::IsNullOrWhiteSpace($apksignerPath)) {
    $androidSdkRoot = $env:ANDROID_SDK_ROOT
    if ([string]::IsNullOrWhiteSpace($androidSdkRoot)) {
        $androidSdkRoot = $env:ANDROID_HOME
    }

    if (-not [string]::IsNullOrWhiteSpace($androidSdkRoot)) {
        $buildToolsRoot = Join-Path $androidSdkRoot 'build-tools'
        if (Test-Path -LiteralPath $buildToolsRoot -PathType Container) {
            $buildToolsDirectories = Get-ChildItem -LiteralPath $buildToolsRoot -Directory |
                Sort-Object Name -Descending
            foreach ($buildToolsDirectory in $buildToolsDirectories) {
                foreach ($toolName in @('apksigner.bat', 'apksigner.exe', 'apksigner')) {
                    $candidatePath = Join-Path $buildToolsDirectory.FullName $toolName
                    if (Test-Path -LiteralPath $candidatePath -PathType Leaf) {
                        $apksignerPath = $candidatePath
                        break
                    }
                }
                if (-not [string]::IsNullOrWhiteSpace($apksignerPath)) {
                    break
                }
            }
        }
    }
}

if ([string]::IsNullOrWhiteSpace($apksignerPath)) {
    throw 'apksigner was not found. Install Android SDK build-tools and add it to PATH or set ANDROID_SDK_ROOT.'
}

$signatureOutput = & $apksignerPath verify --verbose --print-certs $apkPath 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "Release APK signature verification failed for $apkPath.`n$($signatureOutput -join [Environment]::NewLine)"
}
$signatureOutputText = $signatureOutput -join [Environment]::NewLine
$certificateMatch = [regex]::Match(
    $signatureOutputText,
    'certificate SHA-256 digest:\s*([0-9A-Fa-f:]+)',
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
)
if (-not $certificateMatch.Success) {
    throw 'Could not read the release certificate SHA-256 fingerprint from apksigner output.'
}
$certificateSha256 = $certificateMatch.Groups[1].Value.Replace(':', '').ToLowerInvariant()
if ($certificateSha256 -ne $expectedCertificateSha256) {
    throw "Release certificate fingerprint mismatch. Expected $expectedCertificateSha256 but found $certificateSha256. Restore the original production signing key; do not create a new key."
}

$hash = (Get-FileHash -LiteralPath $apkPath -Algorithm SHA256).Hash.ToUpperInvariant()
$checksumPath = "$apkPath.sha256"
Set-Content -LiteralPath $checksumPath -Value "$hash *app-release.apk" -Encoding ascii
$manifestPath = "$apkPath.manifest.json"
@{
    packageName = 'com.roomservice.tv'
    variant = 'release'
    versionCode = [int]$metadataElement.versionCode
    versionName = [string]$metadataElement.versionName
    apiBaseUrl = $ApiBaseUrl.TrimEnd('/')
    sha256 = $hash
    certificateSha256 = $certificateSha256
    builtAt = [DateTime]::UtcNow.ToString('O')
} | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding utf8

$updateManifestPath = $null
if (-not [string]::IsNullOrWhiteSpace($UpdateApkUrl)) {
    $updateManifestPath = "$apkPath.tv-update-manifest.json"
    $resolvedUpdateReleaseId = if ([string]::IsNullOrWhiteSpace($UpdateReleaseId)) {
        "tv-$([string]$metadataElement.versionName)"
    } else {
        $UpdateReleaseId.Trim()
    }
    @{
        enabled = $true
        packageName = 'com.roomservice.tv'
        latestVersionCode = [int]$metadataElement.versionCode
        latestVersionName = [string]$metadataElement.versionName
        apkUrl = $UpdateApkUrl.Trim()
        sha256 = $hash.ToLowerInvariant()
        certificateSha256 = $certificateSha256
        releaseId = $resolvedUpdateReleaseId
        mandatory = $false
        minSupportedVersionCode = 1
    } | ConvertTo-Json | Set-Content -LiteralPath $updateManifestPath -Encoding utf8
}

[pscustomobject]@{
    ApkPath = $apkPath
    Sha256 = $hash
    ChecksumPath = $checksumPath
    ManifestPath = $manifestPath
    UpdateManifestPath = $updateManifestPath
    PackageName = $metadata.applicationId
    VersionCode = [int]$metadataElement.versionCode
    CertificateSha256 = $certificateSha256
    Signature = $signatureOutputText
} | Format-List
