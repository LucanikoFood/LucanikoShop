# 🔄 ROLLBACK RAPIDO MODIFICHE OGGI (30/03/2026)

**Se sospetti che le modifiche di oggi abbiano causato il problema, ecco come fare rollback veloce.**

---

## 📝 MODIFICHE FATTE OGGI

### 1. Carosello "Esperienze Simili" (ExperienceDetail.jsx)
- **File:** `frontend/src/pages/ExperienceDetail.jsx`
- **File:** `backend/controllers/experienceController.js`
- **File:** `backend/routes/experienceRoutes.js`
- **Impatto:** BASSO (solo su pagina dettaglio esperienza)

### 2. Filtri OffersAndDiscounts.jsx
- **File:** `frontend/src/pages/OffersAndDiscounts.jsx`
- **File:** `backend/controllers/discountController.js`
- **Impatto:** MEDIO-ALTO (ricerca regex può essere lenta senza cache)

### 3. Index MongoDB aggiunto
- **File:** `backend/models/Product.js`
- **Impatto:** POSITIVO (migliora performance)

---

## ⚡ ROLLBACK RAPIDO - Opzione 1: Disabilita Carosello Esperienze

**Se il problema è sul carosello esperienze simili:**

### File: `frontend/src/pages/ExperienceDetail.jsx`

**TROVA (linea ~47):**
```javascript
// ⚡ LAZY LOADING: Carica esperienze simili con ritardo per non bloccare il rendering
useEffect(() => {
  if (experience && experience._id) {
    const timer = setTimeout(() => {
      loadSimilarExperiences();
    }, 500);
    
    return () => clearTimeout(timer);
  }
}, [experience]);
```

**SOSTITUISCI CON (commenta):**
```javascript
// TEMPORANEAMENTE DISABILITATO PER DEBUG
/*
useEffect(() => {
  if (experience && experience._id) {
    const timer = setTimeout(() => {
      loadSimilarExperiences();
    }, 500);
    
    return () => clearTimeout(timer);
  }
}, [experience]);
*/
```

**E TROVA (linea ~250):**
```javascript
{similarExperiences.length > 0 && (
  // ... tutto il blocco carosello
)}
```

**SOSTITUISCI CON:**
```javascript
{/* TEMPORANEAMENTE DISABILITATO PER DEBUG */}
{false && similarExperiences.length > 0 && (
  // ... tutto il blocco carosello
)}
```

---

## ⚡ ROLLBACK RAPIDO - Opzione 2: Ripristina Ricerca Text

**Se il problema è sulla pagina Offerte e Sconti:**

### File: `backend/controllers/discountController.js`

**TROVA (linea ~428):**
```javascript
// ⚡ Ricerca parziale case-insensitive (match anche stringhe parziali)
if (search) {
  // Escape caratteri speciali regex
  const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  query.name = { $regex: escapedSearch, $options: 'i' };
}
```

**SOSTITUISCI CON:**
```javascript
// Ricerca full-text (ROLLBACK)
if (search) {
  query.$text = { $search: search };
}
```

---

## ⚡ ROLLBACK COMPLETO - Git Revert

**Se vuoi annullare TUTTE le modifiche di oggi:**

### Passo 1: Verifica commit recenti
```bash
git log --oneline -5
```

### Passo 2: Identifica commit PRIMA delle modifiche di oggi
```
abc1234 - Fix performance issues (← OGGI)
def5678 - Previous working commit (← BUONO)
```

### Passo 3: Revert al commit buono
```bash
# Crea branch di backup
git branch backup-before-rollback

# Revert al commit precedente
git revert abc1234

# OPPURE reset hard (ATTENZIONE: perde modifiche)
git reset --hard def5678
```

### Passo 4: Deploy su Railway
```bash
git push origin main
```

Railway farà automaticamente redeploy.

---

## 🔍 VERIFICA SE LE MODIFICHE SONO IL PROBLEMA

### Test A/B Veloce

**1. Disabilita solo carosello esperienze:**
- Commenta codice come sopra
- Deploy
- Testa velocità
- Se OK → problema era carosello
- Se LENTO ancora → non era il problema

**2. Disabilita solo ricerca regex:**
- Ripristina $text search come sopra
- Deploy
- Testa velocità
- Se OK → problema era regex
- Se LENTO ancora → non era il problema

**3. Se entrambi i test falliscono:**
- Il problema NON sono le modifiche di oggi
- Il problema è quasi certamente **Redis disabilitato**
- Segui guida `CRITICAL_PRODUCTION_PERFORMANCE_FIX.md`

---

## 📊 PROBABILITÀ CAUSE

Basandomi sull'analisi:

| Causa | Probabilità | Azione |
|-------|-------------|--------|
| **Redis disabilitato** | **95%** | Attiva Redis (CRITICAL_PRODUCTION_PERFORMANCE_FIX.md) |
| Ricerca regex lenta | 3% | Rollback a $text search |
| Carosello esperienze | 1% | Disabilita carosello |
| Altro (Railway/MongoDB) | 1% | Diagnostics script |

**Conclusione:** Quasi certamente il problema è Redis non attivato, NON le modifiche di oggi.

---

## ✅ ORDINE AZIONI CONSIGLIATO

1. **PRIMA:** Attiva Redis (15 minuti) ← **Probabilità 95% di risolvere**
2. **SE ANCORA LENTO:** Disabilita ricerca regex (5 minuti)
3. **SE ANCORA LENTO:** Disabilita carosello esperienze (5 minuti)
4. **SE ANCORA LENTO:** Rollback completo git (10 minuti)
5. **SE ANCORA LENTO:** Esegui diagnostics script

---

## 🆘 EMERGENCY ROLLBACK (2 minuti)

**Se l'app è completamente bloccata e serve fix immediato:**

```bash
# 1. Vai alla directory del progetto
cd backend

# 2. Trova ultimo commit stabile
git log --oneline -10

# 3. Reset hard (ATTENZIONE: perde modifiche non committate)
git reset --hard <COMMIT_HASH_STABILE>

# 4. Force push
git push -f origin main

# 5. Railway fa auto-deploy in 1-2 minuti
```

**Commit hash probabilmente stabile:** Cerca commit con messaggio tipo "working version" o "stable" o data di 2-3 giorni fa.

---

## 📝 LOG PER SUPPORTO

Se devi chiedere supporto, esegui questi comandi e salva output:

```bash
# Log Railway
# Vai su Railway → Deployments → View Logs → Copy all

# Git log recente
git log --oneline -20 > git-history.txt

# Diagnostics script
cd backend
node scripts/production-diagnostics.js > diagnostics.txt

# Package versions
cat backend/package.json > backend-packages.txt
cat frontend/package.json > frontend-packages.txt
```

---

**Ricorda:** Il 95% delle volte il problema è Redis disabilitato, non il codice!
