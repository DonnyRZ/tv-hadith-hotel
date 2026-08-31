[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $DeviceAddress,

    [int] $Port = 5555
)

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

$deviceTarget = "$($DeviceAddress):$Port"
& $adbPath connect $deviceTarget | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Could not connect to Android TV at $deviceTarget."
}

function Get-DeviceProperty([string] $Name) {
    return ((& $adbPath -s $deviceTarget shell getprop $Name) -join '').Trim()
}

$adbState = ((& $adbPath devices) | Select-String -SimpleMatch $deviceTarget | Select-Object -First 1)
if ($null -eq $adbState -or $adbState.Line -notmatch '\sdevice\s*$') {
    throw "Android TV at $deviceTarget is not online in adb."
}

[pscustomobject]@{
    DeviceAddress = $deviceTarget
    Manufacturer = Get-DeviceProperty 'ro.product.manufacturer'
    Model = Get-DeviceProperty 'ro.product.model'
    AndroidApiLevel = Get-DeviceProperty 'ro.build.version.sdk'
    AndroidRelease = Get-DeviceProperty 'ro.build.version.release'
    AndroidBuild = Get-DeviceProperty 'ro.build.display.id'
    AbiList = Get-DeviceProperty 'ro.product.cpu.abilist'
    Resolution = ((& $adbPath -s $deviceTarget shell wm size) -join ' ').Trim()
    HasPlayStore = ((& $adbPath -s $deviceTarget shell pm path com.android.vending 2>$null) -join '').Trim().Length -gt 0
    AdbState = 'device'
} | Format-List
