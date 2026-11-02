<#
.SYNOPSIS
  Registra la tarea programada de Windows para ejecutar auto-update.ps1
  los lunes a las 09:00 y al iniciar sesion.
#>

param(
    [string]$TaskName = "TratamientoDibujos-AutoUpdate",
    [string]$Time = "09:00"
)

$scriptPath = Join-Path (Split-Path -Parent $PSScriptRoot) "scripts\auto-update.ps1"
if (-not (Test-Path $scriptPath)) {
    throw "No se encontro $scriptPath"
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""

$triggerWeekly = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At $Time
$triggerLogon  = New-ScheduledTaskTrigger -AtLogon -User $env:USERNAME

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew

$task = New-ScheduledTask -Action $action -Trigger $triggerWeekly,$triggerLogon -Principal $principal -Settings $settings

Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force | Out-Null

Write-Host "Tarea '$TaskName' registrada."
Write-Host "  - Semanal: lunes a las $Time"
Write-Host "  - Al iniciar sesion del usuario $env:USERNAME"
Write-Host "  - Script: $scriptPath"
Write-Host "Para probarla ahora: Start-ScheduledTask -TaskName '$TaskName'"
