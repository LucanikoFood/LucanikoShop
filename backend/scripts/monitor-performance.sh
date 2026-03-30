#!/bin/bash

# 🔍 Script di Monitoring Performance Produzione
# Test automatico delle API più critiche

echo "🔍 ==========================================="
echo "   MONITORING PERFORMANCE PRODUZIONE"
echo "==========================================="
echo ""

# URL base (modifica se necessario)
BASE_URL="https://lucanikoshop-production.up.railway.app/api"

# Colori
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Funzione per testare endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local threshold_ms=$3  # Tempo accettabile in ms
    
    echo "📊 Testing: $name"
    echo "   URL: $url"
    
    # Esegui richiesta e misura tempo
    start=$(date +%s%N)
    response=$(curl -s -w "\n%{http_code}" "$url")
    end=$(date +%s%N)
    
    # Calcola tempo in millisecondi
    time_ms=$(( (end - start) / 1000000 ))
    
    # Estrai status code
    http_code=$(echo "$response" | tail -n1)
    
    # Valuta performance
    if [ $http_code -eq 200 ]; then
        if [ $time_ms -lt $threshold_ms ]; then
            echo -e "   ${GREEN}✅ OK${NC} - ${time_ms}ms (target: <${threshold_ms}ms)"
        elif [ $time_ms -lt $((threshold_ms * 2)) ]; then
            echo -e "   ${YELLOW}⚠️  SLOW${NC} - ${time_ms}ms (target: <${threshold_ms}ms)"
        else
            echo -e "   ${RED}❌ VERY SLOW${NC} - ${time_ms}ms (target: <${threshold_ms}ms)"
        fi
    else
        echo -e "   ${RED}❌ ERROR${NC} - HTTP $http_code"
    fi
    echo ""
}

echo "🚀 Iniziando test..."
echo ""

# Test 1: Categorie (dovrebbe essere velocissima con cache)
test_endpoint "Categorie Principali" "$BASE_URL/categories/main" 200

# Test 2: Prodotti Home (cache importante)
test_endpoint "Prodotti Home" "$BASE_URL/products?limit=12" 400

# Test 3: Offerte e Sconti (query più complessa)
test_endpoint "Prodotti in Offerta" "$BASE_URL/discounts/active-products?limit=12" 500

# Test 4: Esperienze
test_endpoint "Esperienze" "$BASE_URL/experiences" 300

# Test 5: Offerte con filtri (più lento, include ordinamento)
test_endpoint "Offerte Ordinate" "$BASE_URL/discounts/active-products?limit=12&sortBy=discount-desc" 600

# Test 6: Ricerca prodotti (regex query)
test_endpoint "Ricerca Prodotti" "$BASE_URL/discounts/active-products?limit=12&search=pasta" 700

echo "==========================================="
echo "✅ Test completati"
echo "==========================================="
echo ""
echo "📝 Interpretazione risultati:"
echo "   ✅ OK: Performance ottimale"
echo "   ⚠️  SLOW: Accettabile ma da monitorare"
echo "   ❌ VERY SLOW o ERROR: Richiede intervento"
echo ""
echo "💡 Suggerimenti:"
echo "   - Se tutti i test sono SLOW: controlla Redis"
echo "   - Se solo alcuni slow: ottimizza query specifiche"
echo "   - Esegui 2-3 volte per verificare cache warming"
echo ""
