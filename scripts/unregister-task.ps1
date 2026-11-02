<#
.SYNOPSIS
  Elimina la tarea programada registrada por register-task.ps1.
#>
param([string]$TaskName = "TratamientoDibujos-AutoUpdate")
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "Tarea '$TaskName' eliminada (si existia)."
