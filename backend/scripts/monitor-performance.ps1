# 🔍 Script di Monitoring Performance Produzione (Windows PowerShell)
# Test automatico delle API più critiche

Write-Host "🔍 ==========================================="
Write-Host "   MONITORING PERFORMANCE PRODUZIONE"
Write-Host "==========================================="
Write-Host ""

# URL base
$BASE_URL = "https://lucanikoshop-production.up.railway.app/api"

# Funzione per testare endpoint
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [int]$ThresholdMs
    )
    
    Write-Host "📊 Testing: $Name"
    Write-Host "   URL: $Url"
    
    # Misura tempo
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 30 -UseBasicParsing
        $stopwatch.Stop()
        $timeMs = $stopwatch.ElapsedMilliseconds
        $statusCode = $response.StatusCode
        
        # Valuta performance
        if ($statusCode -eq 200) {
            if ($timeMs -lt $ThresholdMs) {
                Write-Host "   ✅ OK - ${timeMs}ms (target: <${ThresholdMs}ms)" -ForegroundColor Green
            }
            elseif ($timeMs -lt ($ThresholdMs * 2)) {
                Write-Host "   ⚠️  SLOW - ${timeMs}ms (target: <${ThresholdMs}ms)" -ForegroundColor Yellow
            }
            else {
                Write-Host "   ❌ VERY SLOW - ${timeMs}ms (target: <${ThresholdMs}ms)" -ForegroundColor Red
            }
        }
        else {
            Write-Host "   ❌ ERROR - HTTP $statusCode" -ForegroundColor Red
        }
    }
    catch {
        $stopwatch.Stop()
        Write-Host "   ❌ ERROR - $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
}

Write-Host "🚀 Iniziando test..." -ForegroundColor Cyan
Write-Host ""

# Test 1: Categorie (dovrebbe essere velocissima con cache)
Test-Endpoint -Name "Categorie Principali" -Url "$BASE_URL/categories/main" -ThresholdMs 200

# Test 2: Prodotti Home (cache importante)
Test-Endpoint -Name "Prodotti Home" -Url "$BASE_URL/products?limit=12" -ThresholdMs 400

# Test 3: Offerte e Sconti (query più complessa)
Test-Endpoint -Name "Prodotti in Offerta" -Url "$BASE_URL/discounts/active-products?limit=12" -ThresholdMs 500

# Test 4: Esperienze
Test-Endpoint -Name "Esperienze" -Url "$BASE_URL/experiences" -ThresholdMs 300

# Test 5: Offerte con filtri (più lento, include ordinamento)
Test-Endpoint -Name "Offerte Ordinate" -Url "$BASE_URL/discounts/active-products?limit=12&sortBy=discount-desc" -ThresholdMs 600

# Test 6: Ricerca prodotti (regex query)
Test-Endpoint -Name "Ricerca Prodotti" -Url "$BASE_URL/discounts/active-products?limit=12&search=pasta" -ThresholdMs 700

# Test 7: Secondo test categorie (per verificare cache hit)
Write-Host "🔄 Secondo test per verificare cache..."
Test-Endpoint -Name "Categorie (2° test - dovrebbe essere cache hit)" -Url "$BASE_URL/categories/main" -ThresholdMs 100

Write-Host "==========================================="
Write-Host "✅ Test completati" -ForegroundColor Green
Write-Host "==========================================="
Write-Host ""
Write-Host "📝 Interpretazione risultati:"
Write-Host "   ✅ OK: Performance ottimale"
Write-Host "   ⚠️  SLOW: Accettabile ma da monitorare"
Write-Host "   ❌ VERY SLOW o ERROR: Richiede intervento"
Write-Host ""
Write-Host "💡 Suggerimenti:"
Write-Host "   - Se tutti i test sono SLOW: controlla Redis su Railway" -ForegroundColor Yellow
Write-Host "   - Se solo alcuni slow: ottimizza query specifiche"
Write-Host "   - Esegui 2-3 volte per verificare cache warming"
Write-Host "   - Secondo test categorie dovrebbe essere <100ms se cache funziona"
Write-Host ""
Write-Host "📊 Per diagnostica approfondita esegui:"
Write-Host "   node scripts/production-diagnostics.js" -ForegroundColor Cyan
Write-Host ""
