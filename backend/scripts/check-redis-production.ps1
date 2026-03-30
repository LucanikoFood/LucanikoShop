# Script per verificare lo stato di Redis in PRODUZIONE
# Testa l'endpoint /health e verifica la performance del cache

$ErrorActionPreference = "Continue"
$API_URL = "https://lucanikoshop-production.up.railway.app"

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "   VERIFICA REDIS IN PRODUZIONE" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Endpoint
Write-Host "-----------------------------------------------" -ForegroundColor Blue
Write-Host "Step 1: Controllo Health Endpoint" -ForegroundColor Yellow
Write-Host "-----------------------------------------------" -ForegroundColor Blue
Write-Host ""

try {
    $healthResponse = Invoke-RestMethod -Uri "$API_URL/health" -Method Get -TimeoutSec 10
    
    if ($healthResponse.redis) {
        Write-Host "[OK] Health endpoint risponde" -ForegroundColor Green
        Write-Host "   Redis Available: $($healthResponse.redis.available)" -ForegroundColor Cyan
        Write-Host "   Redis Status: $($healthResponse.redis.status)" -ForegroundColor Cyan
        
        if ($healthResponse.redis.available -eq $true) {
            Write-Host ""
            Write-Host "[SUCCESS] REDIS E' CONNESSO!" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "[ERROR] REDIS NON E' DISPONIBILE" -ForegroundColor Red
            Write-Host "   Controlla Railway Variables: REDIS_URL deve essere configurato" -ForegroundColor Yellow
        }
    } else {
        Write-Host "[WARN] Health endpoint non include info Redis" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[ERROR] Errore nel controllo health:" -ForegroundColor Red
    Write-Host "   $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host ""

# Test 2: Cache Performance Test
Write-Host "-----------------------------------------------" -ForegroundColor Blue
Write-Host "Step 2: Test Performance Cache" -ForegroundColor Yellow
Write-Host "-----------------------------------------------" -ForegroundColor Blue
Write-Host ""

$testEndpoint = "$API_URL/api/products/public?limit=20"

try {
    # Prima chiamata (MISS - deve interrogare DB)
    Write-Host "Prima chiamata (Cache MISS)..." -ForegroundColor Cyan
    $start1 = Get-Date
    $response1 = Invoke-RestMethod -Uri $testEndpoint -Method Get -TimeoutSec 30
    $end1 = Get-Date
    $time1 = ($end1 - $start1).TotalMilliseconds
    Write-Host "   Tempo: $([math]::Round($time1, 0)) ms" -ForegroundColor White
    
    # Pausa per permettere al cache di scrivere
    Start-Sleep -Seconds 1
    
    # Seconda chiamata (HIT - dovrebbe usare cache)
    Write-Host ""
    Write-Host "Seconda chiamata (Cache HIT)..." -ForegroundColor Cyan
    $start2 = Get-Date
    $response2 = Invoke-RestMethod -Uri $testEndpoint -Method Get -TimeoutSec 30
    $end2 = Get-Date
    $time2 = ($end2 - $start2).TotalMilliseconds
    Write-Host "   Tempo: $([math]::Round($time2, 0)) ms" -ForegroundColor White
    
    Write-Host ""
    Write-Host "-----------------------------------------------" -ForegroundColor Blue
    Write-Host "ANALISI RISULTATI" -ForegroundColor Yellow
    Write-Host "-----------------------------------------------" -ForegroundColor Blue
    Write-Host ""
    
    $improvement = (($time1 - $time2) / $time1) * 100
    
    Write-Host "   Prima chiamata:  $([math]::Round($time1, 0)) ms" -ForegroundColor White
    Write-Host "   Seconda chiamata: $([math]::Round($time2, 0)) ms" -ForegroundColor White
    Write-Host "   Miglioramento:    $([math]::Round($improvement, 1))%" -ForegroundColor Cyan
    Write-Host ""
    
    if ($improvement -ge 70) {
        Write-Host "[SUCCESS] CACHE FUNZIONA CORRETTAMENTE!" -ForegroundColor Green
        Write-Host "   Redis sta servendo le risposte dalla cache" -ForegroundColor Green
        Write-Host "   Performance: OTTIMA" -ForegroundColor Green
    } elseif ($improvement -ge 30) {
        Write-Host "[WARN] CACHE FUNZIONA PARZIALMENTE" -ForegroundColor Yellow
        Write-Host "   Redis potrebbe essere lento o sovraccarico" -ForegroundColor Yellow
        Write-Host "   Controlla Upstash dashboard" -ForegroundColor Yellow
    } else {
        Write-Host "[ERROR] CACHE NON FUNZIONA!" -ForegroundColor Red
        Write-Host "   Ogni richiesta interroga MongoDB direttamente" -ForegroundColor Red
        Write-Host "   Questo causa LENTEZZA ESTREMA in produzione" -ForegroundColor Red
        Write-Host ""
        Write-Host "SOLUZIONE:" -ForegroundColor Yellow
        Write-Host "   1. Vai su Railway: Variables" -ForegroundColor White
        Write-Host "   2. Verifica che REDIS_URL sia configurato" -ForegroundColor White
        Write-Host "   3. Se manca, prendilo da Upstash.com" -ForegroundColor White
        Write-Host "   4. Redeploy automatico" -ForegroundColor White
    }
    
} catch {
    Write-Host "[ERROR] Errore nel test performance:" -ForegroundColor Red
    Write-Host "   $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Possibili cause:" -ForegroundColor Yellow
    Write-Host "   - API non risponde (troppo lenta)" -ForegroundColor White
    Write-Host "   - MongoDB M0 sovraccarico" -ForegroundColor White
    Write-Host "   - Redis non configurato (ogni richiesta timeout)" -ForegroundColor White
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Blue
Write-Host ""
