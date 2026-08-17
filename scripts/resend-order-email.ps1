# MOMUTO — find an order's email state and (optionally) resend its
# confirmation email, for "customer says no email arrived" cases.
#
#   .\resend-order-email.ps1
#
# Prompts for the admin token (same ADMIN_TOKEN as leads export), then for
# the order — accepts the LOCAL ref (e.g. d59t8fts70), the PLATFORM order
# number the CMS admin shows (e.g. 2026081633552986), or the customer email.
# Shows the full diagnosis first (was the confirmation sent? when? status?)
# and only sends after an explicit Y.
#
# PS 5.1 notes baked in: -UseBasicParsing (no IE engine), no bare Read-Host
# echo traps, JSON arrays force-enumerated.

$ErrorActionPreference = 'Stop'
$base = 'https://momuto-api.vercel.app/api/admin-orders'

$token = (Read-Host "Admin token").Trim().Trim('"').Trim("'")
$query = (Read-Host "Order (local ref / platform order no / customer email)").Trim()
if (-not $token -or -not $query) { Write-Host "Token and order are required." -ForegroundColor Red; exit 1 }

$headers = @{ 'x-admin-token' = $token; 'Content-Type' = 'application/json' }

# ---- 1. diagnose ----------------------------------------------------------
try {
    $resp = Invoke-WebRequest -UseBasicParsing -Uri ("$base`?action=find&q=" + [uri]::EscapeDataString($query)) -Headers $headers
} catch {
    Write-Host "FIND FAILED: $($_.Exception.Message)" -ForegroundColor Red; exit 1
}
$data = $resp.Content | ConvertFrom-Json
$found = @($data.found | ForEach-Object { $_ })

if ($found.Count -eq 0) {
    Write-Host "`nNo stored order matches '$query'." -ForegroundColor Yellow
    Write-Host $data.hint -ForegroundColor Yellow
    exit 0
}

foreach ($o in $found) {
    Write-Host "`n--- $($o.id) ---" -ForegroundColor Cyan
    Write-Host ("  customer : {0} <{1}>" -f $o.name, $o.email)
    Write-Host ("  platform : {0}   total: {1} {2}   lang: {3}" -f $o.plantOrderNo, $o.currency, $o.total, $o.lang)
    Write-Host ("  status   : {0}   stopLifecycle: {1}   paidAt: {2}" -f $o.status, $o.stopLifecycle, $o.paidAt)
    Write-Host ("  emails   : {0}" -f (($o.emailsSent -join ', ') -replace '^$', 'NONE SENT'))
    if (@($o.manualResends).Count -gt 0) {
        Write-Host ("  resends  : {0}" -f ($o.manualResends -join ', '))
    }
}

if ($found.Count -gt 1) {
    Write-Host "`nMultiple matches - re-run with the exact local ref to resend." -ForegroundColor Yellow
    exit 0
}

# ---- 2. resend on confirmation --------------------------------------------
$o = $found[0]
$already = @($o.emailsSent) -contains 'confirmation'
if ($already) {
    Write-Host "`nConfirmation WAS already sent (per Resend). A resend is harmless;" -ForegroundColor Yellow
    Write-Host "ask the customer to check spam - btopenworld/BT filters are aggressive." -ForegroundColor Yellow
}
$go = Read-Host "`nResend confirmation to $($o.email) now? (Y/n)"
if ($go -ne 'Y' -and $go -ne 'y') { Write-Host "Not sent."; exit 0 }

$payload = @{ action = 'resend-confirmation'; order = $o.id } | ConvertTo-Json
try {
    $resp = Invoke-WebRequest -UseBasicParsing -Method Post -Uri $base -Headers $headers -Body $payload
    $result = $resp.Content | ConvertFrom-Json
    Write-Host "`nSENT to $($result.to)" -ForegroundColor Green
} catch {
    $detail = ''
    try { $detail = (New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd() } catch {}
    Write-Host "`nRESEND FAILED: $($_.Exception.Message)`n$detail" -ForegroundColor Red
    Write-Host "If the error mentions force: the order was withheld on purpose (test/backfill/excluded);" -ForegroundColor Yellow
    Write-Host "re-run and it will still refuse - that case needs a deliberate force:true call." -ForegroundColor Yellow
    exit 1
}
