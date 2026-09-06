[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateRange(1, 2147483647)]
    [int] $VersionCode,

    [Parameter(Mandatory = $true)]
    [ValidateRange(0, 2147483647)]
    [int] $PreviousVersionCode,

    [Parameter(Mandatory = $true)]
    [string] $VersionName,

    [string] $ApiBaseUrl = 'https://api-production-505c.up.railway.app/api/v1/',

    [string] $SigningCustodyDirectory = '',

    [string] $UpdateApkUrl,

    [string] $UpdateReleaseId
)

$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$defaultCustodyDirectory = 'C:\IT\hadith-hotel-secrets\tv-release'
if ([string]::IsNullOrWhiteSpace($SigningCustodyDirectory)) {
    $SigningCustodyDirectory = $env:TV_SIGNING_CUSTODY_DIR
}
if ([string]::IsNullOrWhiteSpace($SigningCustodyDirectory)) {
    $SigningCustodyDirectory = $defaultCustodyDirectory
}

$storeFile = Join-Path $SigningCustodyDirectory 'room-service-tv-release.p12'
$passwordFile = Join-Path $SigningCustodyDirectory 'room-service-tv-release.password.dpapi'
if (-not (Test-Path -LiteralPath $storeFile -PathType Leaf)) {
    throw "Production keystore was not found at $storeFile. Restore the original key; do not generate a replacement."
}
if (-not (Test-Path -LiteralPath $passwordFile -PathType Leaf)) {
    throw "Encrypted keystore password was not found at $passwordFile. Run this script as the Windows account that owns the DPAPI secret."
}

$keytool = 'C:\Program Files\Java\jdk-17\bin\keytool.exe'
if (-not (Test-Path -LiteralPath $keytool -PathType Leaf)) {
    $keytoolCommand = Get-Command keytool -ErrorAction SilentlyContinue
    if ($null -ne $keytoolCommand) {
        $keytool = $keytoolCommand.Source
    }
}
if (-not (Test-Path -LiteralPath $keytool -PathType Leaf)) {
    throw 'keytool was not found. Install a JDK before packaging a release.'
}

$encryptedPassword = (Get-Content -LiteralPath $passwordFile -Raw).Trim()
try {
    $securePassword = ConvertTo-SecureString -String $encryptedPassword
} catch {
    throw 'Production signing custody could not be unlocked by this Windows account. Use the protected CI signing secret or the approved key-recovery process; do not generate a new key.'
}
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
    $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
}

# keytool reads the password from this process-only variable, so it is not
# placed in a committed file or printed in command output.
$keytoolPasswordVariable = 'EGI_TV_KEYSTORE_PASSWORD'
Set-Item -Path "Env:$keytoolPasswordVariable" -Value $password
try {
    $keytoolOutput = & $keytool -list -v -keystore $storeFile -storetype PKCS12 `
        -storepass:env $keytoolPasswordVariable 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw 'The production keystore could not be opened with the protected DPAPI password.'
    }

    $aliasMatch = [regex]::Match(
        ($keytoolOutput -join [Environment]::NewLine),
        '(?m)^\s*Alias name:\s*(.+?)\s*$'
    )
    if (-not $aliasMatch.Success) {
        throw 'The production keystore alias could not be determined.'
    }

    $env:TV_SIGNING_STORE_FILE = $storeFile
    $env:TV_SIGNING_STORE_PASSWORD = $password
    $env:TV_SIGNING_KEY_ALIAS = $aliasMatch.Groups[1].Value.Trim()
    $env:TV_SIGNING_KEY_PASSWORD = $password
    if ([string]::IsNullOrWhiteSpace($env:ANDROID_SDK_ROOT) -and [string]::IsNullOrWhiteSpace($env:ANDROID_HOME)) {
        $env:ANDROID_SDK_ROOT = 'C:\Users\egi_i\AppData\Local\Android\Sdk'
    }

    & (Join-Path $repositoryRoot 'tools\tv\package-tv.ps1') `
        -ApiBaseUrl $ApiBaseUrl `
        -VersionCode $VersionCode `
        -PreviousVersionCode $PreviousVersionCode `
        -VersionName $VersionName `
        -UpdateApkUrl $UpdateApkUrl `
        -UpdateReleaseId $UpdateReleaseId
    if ($LASTEXITCODE -ne 0) {
        throw 'Release packaging returned a non-zero exit code.'
    }
} finally {
    Remove-Item -LiteralPath "Env:$keytoolPasswordVariable" -ErrorAction SilentlyContinue
    Remove-Item Env:TV_SIGNING_STORE_FILE -ErrorAction SilentlyContinue
    Remove-Item Env:TV_SIGNING_STORE_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:TV_SIGNING_KEY_ALIAS -ErrorAction SilentlyContinue
    Remove-Item Env:TV_SIGNING_KEY_PASSWORD -ErrorAction SilentlyContinue
}
