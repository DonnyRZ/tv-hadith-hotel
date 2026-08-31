[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $ApiBaseUrl,

    [ValidateRange(1, 2147483647)]
    [int] $VersionCode = 0,

    [string] $VersionName
)

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$tvProjectRoot = Join-Path $repositoryRoot 'apps\tv-shell'
$gradleWrapper = Join-Path $tvProjectRoot 'gradlew.bat'
$signingProperties = Join-Path $tvProjectRoot 'signing.properties'
$signingEnvironmentNames = @(
    'TV_SIGNING_STORE_FILE',
    'TV_SIGNING_STORE_PASSWORD',
    'TV_SIGNING_KEY_ALIAS',
    'TV_SIGNING_KEY_PASSWORD'
)
$hasSigningProperties = Test-Path -LiteralPath $signingProperties -PathType Leaf
$hasSigningEnvironment = ($signingEnvironmentNames | Where-Object {
        [string]::IsNullOrWhiteSpace((Get-Item -Path "Env:$($_)" -ErrorAction SilentlyContinue).Value)
    }).Count -eq 0

if (-not $hasSigningProperties -and -not $hasSigningEnvironment) {
    throw 'Release packaging requires apps/tv-shell/signing.properties or all TV_SIGNING_* environment variables. Use a real keystore outside source control.'
}

try {
    $apiUri = [Uri] $ApiBaseUrl
} catch {
    throw 'ApiBaseUrl must be an absolute HTTPS URL, for example https://api.example.com/api/v1/.'
}

if (-not $apiUri.IsAbsoluteUri -or $apiUri.Scheme -ne 'https') {
    throw 'Release packaging requires an absolute HTTPS ApiBaseUrl. HTTP is only supported by debug builds.'
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
    & $gradleWrapper @gradleArguments
    if ($LASTEXITCODE -ne 0) {
        throw 'Release APK build failed.'
    }
} finally {
    Pop-Location
}

$apkPath = Join-Path $tvProjectRoot 'app\build\outputs\apk\release\app-release.apk'
if (-not (Test-Path -LiteralPath $apkPath -PathType Leaf)) {
    throw "Release APK was not found at $apkPath."
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

$hash = (Get-FileHash -LiteralPath $apkPath -Algorithm SHA256).Hash.ToUpperInvariant()
$checksumPath = "$apkPath.sha256"
Set-Content -LiteralPath $checksumPath -Value "$hash *app-release.apk" -Encoding ascii

[pscustomobject]@{
    ApkPath = $apkPath
    Sha256 = $hash
    ChecksumPath = $checksumPath
    Signature = $signatureOutputText
} | Format-List
