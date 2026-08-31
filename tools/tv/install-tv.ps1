[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $ApkPath,

    [Parameter(Mandatory = $true)]
    [string] $DeviceAddress,

    [int] $Port = 5555,

    [string] $PairingAddress,

    [string] $PairingCode,

    [string] $PackageName = 'com.roomservice.tv.debug',

    [string] $ExpectedSha256
)

$resolvedApkPath = Resolve-Path -LiteralPath $ApkPath -ErrorAction Stop

if (-not [string]::IsNullOrWhiteSpace($ExpectedSha256)) {
    $actualSha256 = (Get-FileHash -LiteralPath $resolvedApkPath.Path -Algorithm SHA256).Hash
    if ($actualSha256 -ne $ExpectedSha256.Trim().ToUpperInvariant()) {
        throw "APK checksum mismatch. Expected $ExpectedSha256 but found $actualSha256."
    }
}

$adbCommand = Get-Command adb -ErrorAction SilentlyContinue

if ($null -eq $adbCommand) {
    $androidSdkRoot = $env:ANDROID_SDK_ROOT
    if ([string]::IsNullOrWhiteSpace($androidSdkRoot)) {
        $androidSdkRoot = $env:ANDROID_HOME
    }
    if ([string]::IsNullOrWhiteSpace($androidSdkRoot)) {
        throw 'adb was not found. Add Android SDK platform-tools to PATH or set ANDROID_SDK_ROOT.'
    }

    $candidateAdbPath = Join-Path $androidSdkRoot 'platform-tools\adb.exe'
    if (-not (Test-Path -LiteralPath $candidateAdbPath -PathType Leaf)) {
        throw "adb was not found at $candidateAdbPath. Install Android SDK platform-tools."
    }
    $adbPath = $candidateAdbPath
} else {
    $adbPath = $adbCommand.Source
}

if (-not [string]::IsNullOrWhiteSpace($PairingCode) -and
    [string]::IsNullOrWhiteSpace($PairingAddress)) {
    throw 'PairingCode requires PairingAddress in the TV Wireless Debugging format ip:port.'
}

if (-not [string]::IsNullOrWhiteSpace($PairingAddress)) {
    if ([string]::IsNullOrWhiteSpace($PairingCode)) {
        $PairingCode = Read-Host 'Enter the one-time Wireless Debugging pairing code shown on the TV'
    }

    if ([string]::IsNullOrWhiteSpace($PairingCode)) {
        throw 'Wireless Debugging pairing code cannot be empty.'
    }

    & $adbPath pair $PairingAddress $PairingCode
    if ($LASTEXITCODE -ne 0) {
        throw "Could not pair with Android TV at $PairingAddress."
    }
}

$deviceTarget = "$($DeviceAddress):$Port"
& $adbPath connect $deviceTarget
if ($LASTEXITCODE -ne 0) {
    throw "Could not connect to Android TV at $deviceTarget."
}

& $adbPath -s $deviceTarget wait-for-device
if ($LASTEXITCODE -ne 0) {
    throw "Android TV at $deviceTarget did not become ready."
}

& $adbPath -s $deviceTarget install -r -d $resolvedApkPath.Path
if ($LASTEXITCODE -ne 0) {
    throw "APK installation failed for $deviceTarget."
}

& $adbPath -s $deviceTarget shell monkey -p $PackageName 1
if ($LASTEXITCODE -ne 0) {
    throw "APK installed, but the package $PackageName could not be launched."
}

Write-Output "Installed and launched $PackageName on $deviceTarget."
