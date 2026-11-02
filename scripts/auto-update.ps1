<#
.SYNOPSIS
  Actualiza el proyecto tratarmiento-dibujos: git pull + pnpm install + pnpm build.
.DESCRIPTION
  Pensado para ejecutarse los lunes (tras Dependabot) o al arrancar el ordenador.
  Envia una notificacion de Windows con el resultado (OK / error) y guarda un log.
#>

param(
    [string]$ProjectDir = (Split-Path -Parent $PSScriptRoot),
    [switch]$SkipInstall
)

$ErrorActionPreference = "Continue"

$LogDir  = Join-Path $env:LOCALAPPDATA "tratarmiento-dibujos"
$LogFile = Join-Path $LogDir "auto-update.log"
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

function Write-Log {
    param([string]$Message)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$ts  $Message" | Out-File -FilePath $LogFile -Append -Encoding utf8
}

function Show-Notification {
    param(
        [string]$Title,
        [string]$Message,
        [ValidateSet('Info','Warning','Error')][string]$IconType = 'Info'
    )
    try {
        Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
        Add-Type -AssemblyName System.Drawing -ErrorAction Stop
        $notify = New-Object System.Windows.Forms.NotifyIcon
        $notify.Icon = [System.Drawing.SystemIcons]::$IconType
        $notify.BalloonTipIcon = $IconType
        $notify.BalloonTipTitle = $Title
        $notify.BalloonTipText = $Message
        $notify.Visible = $true
        $notify.ShowBalloonTip(8000)
        Start-Sleep -Seconds 9
        $notify.Dispose()
    } catch {
        Write-Log "No se pudo mostrar notificacion: $($_.Exception.Message)"
    }
}

$startTime = Get-Date
Write-Log "=== Inicio auto-update (ProjectDir=$ProjectDir) ==="

$ok = $true
$summary = ""

try {
    if (-not (Test-Path (Join-Path $ProjectDir ".git"))) {
        throw "No se encontro un repositorio git en $ProjectDir"
    }

    Push-Location $ProjectDir
    try {
        if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "git no esta en el PATH" }
        if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { throw "pnpm no esta en el PATH" }

        Write-Log "git fetch origin"
        $fetchOut = git fetch origin 2>&1
        $fetchExit = $LASTEXITCODE
        foreach ($line in $fetchOut) { Write-Log "$line" }
        if ($fetchExit -ne 0) { throw "git fetch fallo (exit $fetchExit)" }

        Write-Log "git pull --ff-only"
        $pullOut = git pull --ff-only 2>&1
        $pullExit = $LASTEXITCODE
        foreach ($line in $pullOut) { Write-Log "$line" }
        if ($pullExit -ne 0) { throw "git pull fallo (exit $pullExit)" }

        if (-not $SkipInstall) {
            Write-Log "pnpm install --frozen-lockfile"
            $installOut = pnpm install --frozen-lockfile 2>&1
            $installExit = $LASTEXITCODE
            foreach ($line in $installOut) { Write-Log "$line" }
            if ($installExit -ne 0) {
                Write-Log "pnpm install --frozen-lockfile fallo; reintentando sin --frozen-lockfile"
                $installOut2 = pnpm install 2>&1
                $installExit2 = $LASTEXITCODE
                foreach ($line in $installOut2) { Write-Log "$line" }
                if ($installExit2 -ne 0) { throw "pnpm install fallo (exit $installExit2)" }
            }
        }

        Write-Log "pnpm run build"
        $buildOut = pnpm run build 2>&1
        $buildExit = $LASTEXITCODE
        foreach ($line in $buildOut) { Write-Log "$line" }
        if ($buildExit -ne 0) { throw "pnpm run build fallo (exit $buildExit)" }

        $summary = "git pull + build OK"
    } finally {
        Pop-Location
    }
} catch {
    $ok = $false
    $summary = "ERROR: $($_.Exception.Message)"
    Write-Log $summary
}

$elapsed = (Get-Date) - $startTime
Write-Log "=== Fin: $summary (duracion $([math]::Round($elapsed.TotalSeconds,1))s) ==="

if ($ok) {
    Show-Notification -Title "tratarmiento-dibujos" -Message "Actualizacion y build correctos (OK)" -IconType Info
} else {
    Show-Notification -Title "tratarmiento-dibujos" -Message "Fallo la actualizacion/build. Revisa el log." -IconType Error
}

exit ([int](-not $ok))
