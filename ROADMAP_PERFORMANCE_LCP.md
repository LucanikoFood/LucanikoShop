# 🚀 ROADMAP PERFORMANCE LCP - Lucaniko Shop

**Data creazione:** 16 Aprile 2026  
**Basata su:** PageSpeed Insights Report del 16 aprile 2026, 12:50 CEST  
**Obiettivo:** Ridurre LCP mobile da 9.0s a <2.5s (standard Google)

---

## 📊 DATI REALI DA PAGESPEED INSIGHTS

### 📱 MOBILE (Moto G Power emulato, 4G lenta)
- **Performance:** 41/100 ❌
- **LCP:** 9.0s ❌ (target: <2.5s)
- **FCP:** 4.1s ⚠️ (target: <1.8s)
- **CLS:** 0.64 ❌ (target: <0.1)
- **TBT:** 40ms ✅ (target: <200ms)
- **Speed Index:** 5.0s ⚠️

### 💻 DESKTOP (Desktop emulato)
- **Performance:** 59/100 ⚠️
- **LCP:** 2.0s ✅ (appena sotto target)
- **FCP:** 0.6s ✅
- **CLS:** 0.676 ❌ (target: <0.1)
- **TBT:** 120ms ✅
- **Speed Index:** 2.8s ✅

### 🔍 METRICHE LOCALI (Console Browser - Prestazioni)
- **LCP:** 4.05s ❌ (scadente)
- **CLS:** 0.64 ❌ (scadente)
- **INP:** 88ms ✅ (buono)

---

## 🎯 PROBLEMI IDENTIFICATI DA LIGHTHOUSE (IN ORDINE DI PRIORITÀ)

### 🔴 CRITICI (bloccano LCP)

#### 1. **Gli elementi immagine non hanno width e height esplicite**
- **Impatto:** CLS 0.64 (scadentissimo)
- **Causa:** Browser non riserva spazio → layout shift
- **Risparmio stimato:** CLS da 0.64 → <0.1

#### 2. **Richieste di blocco del rendering**
- **Mobile:** 2340ms di blocco
- **Desktop:** 170ms di blocco
- **Causa:** CSS/JS bloccano rendering
- **Risparmio stimato:** -2340ms su mobile

#### 3. **Migliora il caricamento delle immagini**
- **Mobile:** 929 KiB da risparmiare
- **Desktop:** 274 KiB da risparmiare
- **Problema:** Immagini troppo pesanti per connessione 4G
- **Risparmio stimato:** -2-3s su LCP mobile

### ⚠️ IMPORTANTI

#### 4. **Riduci i contenuti CSS inutilizzati**
- **Dimensione:** 48 KiB
- **Risparmio stimato:** -200-400ms FCP

#### 5. **Riduci il codice JavaScript inutilizzato**
- **Dimensione:** 41 KiB
- **Risparmio stimato:** -200-400ms FCP

#### 6. **Evita attività lunghe nel thread principale**
- **3 attività lunghe trovate:**
  1. `lucanikoshop.it` (proprietario) - 164ms → 91ms task
  2. `/assets/index-BmNh8ubZ.js` - 4073ms → 73ms task
  3. Non attribuibile - 834ms → 135ms task
- **Impatto:** Blocca rendering e interattività

### 📌 ALTRI PROBLEMI RILEVATI

#### 7. **Carattere visualizzato**
- **Risparmio stimato:** 20ms
- **Causa:** Font non precaricati

#### 8. **robots.txt non è valido** (SEO)
- **1 errore trovato**
- **Impatto:** Crawling motori di ricerca

#### 9. **rel=canonical non valido** (SEO)
- **Conflitto:** https://lucanikoshop.it/ vs https://lucanikoshop.it/products
- **Impatto:** Confusione per motori di ricerca

#### 10. **Touch target troppo piccoli** (Usabilità mobile)
- Elementi link/bottoni sotto i 48x48px
- **Elementi respinti:** Link navigazione, footer, social

#### 11. **Contrasto colori insufficiente** (Accessibilità)
- Testo "in un click!" con colore rgb(0, 191, 99)
- Badge categorie

---

## 🎯 FASE 1: FIX IMMEDIATI (OGGI - 1.5-2 ore)
**Rischio:** ✅ BASSO | **Impatto:** 📈 ALTISSIMO | **Risparmio LCP:** -3-4s

### ✅ 1.1 Width/Height espliciti su TUTTE le immagini
**Problema PageSpeed:** "Gli elementi immagine non hanno width e height esplicite"  
**Impatto diretto:** CLS 0.64 → <0.1 (RISOLVE problema critico)  
**Causa:** Browser non sa quanto spazio riservare → layout salta quando carica immagini

**File da modificare (9 componenti):**

#### ProductCard.jsx (CRITICO - è l'LCP element)
```jsx
// Carousel immagini prodotto - AGGIUNGI width/height
{product.images?.length > 1 ? (
  <Carousel>
    {product.images.map((image, idx) => (
      <Carousel.Item key={idx}>
        <img
          width="400"              // ⚡ AGGIUNGI
          height="400"             // ⚡ AGGIUNGI
          src={CloudinaryPresets.productCard(image.url)}
          alt={`${product.name} - ${idx + 1}`}
          loading={idx === 0 ? "eager" : "lazy"}  // Prima immagine: eager!
          style={{ 
            width: '100%',
            height: '280px',
            objectFit: 'cover',
            aspectRatio: '1 / 1'   // ⚡ AGGIUNGI per stabilità
          }}
        />
      </Carousel.Item>
    ))}
  </Carousel>
) : (
  <img
    width="400"                    // ⚡ AGGIUNGI
    height="400"                   // ⚡ AGGIUNGI
    src={CloudinaryPresets.productCard(product.images[0]?.url)}
    alt={product.name}
    loading="eager"                // PRIMA immagine visibile!
    style={{
      width: '100%',
      height: '280px',
      objectFit: 'cover',
      aspectRatio: '1 / 1'        // ⚡ AGGIUNGI
    }}
  />
)}
```

#### ExperienceDetail.jsx
```jsx
// Carousel esperienza
<img
  width="800"                      // ⚡ AGGIUNGI
  height="500"                     // ⚡ AGGIUNGI
  src={CloudinaryPresets.productDetail(image.url)}
  alt={`${experience.title} - ${index + 1}`}
  loading="lazy"
  style={{ 
    maxHeight: '500px',
    width: '100%',
    objectFit: 'contain',
    aspectRatio: '16 / 10'        // ⚡ AGGIUNGI
  }}
/>
```

#### EventDetail.jsx
```jsx
// Carousel evento
<img
  width="800"                      // ⚡ AGGIUNGI
  height="500"                     // ⚡ AGGIUNGI
  src={CloudinaryPresets.productDetail(event.images[0].url)}
  alt={event.title}
  loading="lazy"
  style={{ 
    maxHeight: '500px',
    width: '100%',
    objectFit: 'contain',
    aspectRatio: '16 / 10'        // ⚡ AGGIUNGI
  }}
/>
```

#### CategoriesCarouselArrows.jsx
```jsx
// Card categorie
<Card.Img
  width="300"                      // ⚡ AGGIUNGI
  height="200"                     // ⚡ AGGIUNGI
  variant="top"
  src={card.image}
  alt={card.name}
  onError={() => handleImageError(card.id)}
  loading="lazy"
  style={{ 
    height: '200px',
    objectFit: 'cover',
    aspectRatio: '3 / 2'          // ⚡ AGGIUNGI
  }}
/>
```

#### OtherCategoriesCarousel.jsx
```jsx
// Carousel altre categorie - stesso pattern
<img
  width="300"                      // ⚡ AGGIUNGI
  height="200"                     // ⚡ AGGIUNGI
  src={category.image}
  alt={category.name}
  loading="lazy"
  style={{
    height: '200px',
    objectFit: 'cover',
    aspectRatio: '3 / 2'          // ⚡ AGGIUNGI
  }}
/>
```

#### SuggestedProductsCarousel.jsx
```jsx
// Prodotti suggeriti
<img
  width="400"                      // ⚡ AGGIUNGI
  height="400"                     // ⚡ AGGIUNGI
  src={CloudinaryPresets.productCard(product.images[0]?.url)}
  alt={product.name}
  loading="lazy"
  style={{
    width: '100%',
    height: '250px',
    objectFit: 'cover',
    aspectRatio: '1 / 1'          // ⚡ AGGIUNGI
  }}
/>
```

#### Negozi.jsx
```jsx
// Logo vendor
<Card.Img
  width="200"                      // ⚡ AGGIUNGI
  height="200"                     // ⚡ AGGIUNGI
  variant="top"
  src={vendor.logo.url}
  alt={vendor.businessName || vendor.name}
  loading="lazy"
  style={{
    height: '200px',
    objectFit: 'contain',
    aspectRatio: '1 / 1'          // ⚡ AGGIUNGI
  }}
/>
```

#### ShopPage.jsx
```jsx
// Logo negozio
<img 
  width="140"                      // ⚡ AGGIUNGI
  height="140"                     // ⚡ AGGIUNGI
  src={vendor.logo.url} 
  alt="Logo" 
  style={{ 
    width: 140, 
    height: 140, 
    borderRadius: 18,
    objectFit: 'contain',
    aspectRatio: '1 / 1'          // ⚡ AGGIUNGI
  }} 
/>
```

#### ProductDetail.jsx
```jsx
// Carousel prodotto dettaglio
<img
  width="800"                      // ⚡ AGGIUNGI
  height="520"                     // ⚡ AGGIUNGI
  className="d-block w-100"
  src={CloudinaryPresets.productDetail(image)}
  alt={`${product.name} - ${index + 1}`}
  loading="lazy"
  style={{ 
    maxHeight: '520px',
    width: '100%',
    objectFit: 'contain',
    aspectRatio: '16 / 10'        // ⚡ AGGIUNGI
  }}
/>
```

**IMPORTANTE:**
- `width` e `height` = dimensioni INTRINSECHE immagine (da Cloudinary)
- `style={{ width, height }}` = dimensioni VISUALIZZATE (CSS)
- `aspectRatio` = mantiene proporzioni anche in layout flessibili
- Prima immagine homepage: `loading="eager"` (non lazy!)

**Benefici misurabili:**
- ✅ **CLS: 0.64 → <0.1** (-84% shift di layout)
- ✅ **LCP: -1.5-2s** (browser alloca spazio subito)
- ⏱️ **Tempo:** 60 minuti
- 🔧 **Rischio:** ZERO (aggiunta attributi HTML standard)

---

### ✅ 1.2 Ottimizzazione formato immagini (Cloudinary)
**Problema PageSpeed:** "Migliora il caricamento delle immagini - Risparmio 929 KiB"  
**Impatto:** LCP 9.0s → ~6-7s (-2-3 secondi!)  
**Causa:** Immagini JPG/PNG pesanti invece di WebP/AVIF

**VERIFICA file `cloudinaryOptimizer.js`:**

Vedo che avete GIÀ implementato:
```js
export const CloudinaryPresets = {
  thumbnail: (url) => optimizeCloudinaryUrl(url, {
    width: 200,
    height: 200,
    crop: 'fill',
    quality: 'auto:good'  // ✅ GIÀ PRESENTE
  }),
  productCard: (url) => optimizeCloudinaryUrl(url, {
    width: 500,
    height: 500,
    crop: 'limit',
    quality: 'auto:good',  // ✅ GIÀ PRESENTE
    format: 'auto'         // ✅ GIÀ PRESENTE (WebP automatico)
  })
}
```

**PROBLEMA:** Verificare che le URL generate includano effettivamente `f_auto,q_auto`

**Test da fare:**
1. Apri homepage
2. Ispeziona prima immagine ProductCard
3. Verifica URL contiene: `/upload/f_auto,q_auto:good,dpr_auto,w_500,h_500,c_limit/`
4. Se NON contiene → correggere `optimizeCloudinaryUrl()`

**Se non funziona, ALTERNATIVA più semplice:**
```jsx
// ProductCard.jsx - usa DIRETTAMENTE trasformazioni Cloudinary
const getOptimizedImageUrl = (url) => {
  if (!url?.includes('cloudinary.com')) return url;
  return url.replace('/upload/', '/upload/f_auto,q_auto:good,w_500,h_500,c_limit,dpr_auto/');
};

// Nel render
<img src={getOptimizedImageUrl(product.images[0]?.url)} />
```

**Benefici misurabili:**
- ✅ **929 KiB risparmiati** (confermato da PageSpeed)
- ✅ **LCP: -2-3s** su mobile 4G
- ⏱️ **Tempo:** 15-30 minuti (verifica + eventuale fix)
- 🔧 **Rischio:** BASSO (già usate CloudinaryPresets)

---

### ✅ 1.3 Fetchpriority="high" sulla prima immagine LCP
**Problema PageSpeed:** "Rilevamento della richiesta LCP"  
**Impatto:** LCP -300-500ms  
**Causa:** Browser non sa quale immagine è la più importante

**Implementazione in `ProductCard.jsx`:**
```jsx
// Aggiungi prop per identificare se è la prima card
const ProductCard = ({ product, fromShop, isFirstCard = false }) => {
  // ...
  
  return (
    <Card>
      {/* Prima immagine della prima card */}
      <img
        src={CloudinaryPresets.productCard(product.images[0]?.url)}
        alt={product.name}
        width="400"
        height="400"
        loading={isFirstCard ? "eager" : "lazy"}      // ⚡ eager se prima
        fetchpriority={isFirstCard ? "high" : "low"}  // ⚡ high se prima
        style={{ aspectRatio: '1/1', objectFit: 'cover' }}
      />
    </Card>
  );
};
```

**Modificare `Products.jsx` per passare prop:**
```jsx
{products.map((product, index) => (
  <Col key={product._id} xs={6} md={4} lg={3} className="mb-4">
    <ProductCard 
      product={product} 
      isFirstCard={index === 0}  // ⚡ AGGIUNGI
    />
  </Col>
))}
```

**Benefici:**
- ✅ **LCP: -300-500ms** (priorità alta al caricamento)
- ⏱️ **Tempo:** 10 minuti
- 🔧 **Rischio:** ZERO

---

### ✅ 1.4 Preload font (se usate)
**Problema PageSpeed:** "Carattere visualizzato - Risparmio 20ms"  
**Impatto:** Minimo ma gratuito  

**Verifica in `index.html` se usate Google Fonts:**
```html
<!-- Se avete questo: -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<!-- AGGIUNGI preload del font specifico: -->
<link rel="preload" 
      href="https://fonts.gstatic.com/s/[FONT_NAME]/[VERSION].woff2" 
      as="font" 
      type="font/woff2" 
      crossorigin>
```

**Se NON usate font custom:** SKIP questo punto.

**Benefici:**
- ✅ **FCP: -20ms** (confermato PageSpeed)
- ⏱️ **Tempo:** 5 minuti
- 🔧 **Rischio:** ZERO

---

## ⚙️ RISULTATO ATTESO FASE 1

| Metrica | Prima | Dopo Fase 1 | Miglioramento |
|---------|-------|-------------|---------------|
| **LCP (mobile)** | 9.0s | **4.5-5.5s** | **-40-50%** ✅ |
| **CLS** | 0.64 | **<0.1** | **-84%** ✅ |
| **Performance** | 41/100 | **65-72/100** | +24-31 punti |
| **Immagini** | +929 KiB | **Ottimizzate** | -929 KiB |

**⏱️ Tempo totale Fase 1:** 1.5-2 ore  
**🔧 Rischio:** MINIMO (solo aggiunta attributi)  
**📅 Deploy:** OGGI, appena finito

---

## 🛠️ FASE 2: RENDER BLOCKING (PROSSIMA SETTIMANA - 3-4 ore)
**Problema PageSpeed:** "Richieste di blocco del rendering - Risparmio 2340ms"  
**Rischio:** ⚠️ MODERATO | **Impatto:** 📈 ALTO

### ⚠️ 2.1 Rimuovi CSS inutilizzato (48 KiB)
**Problema PageSpeed:** "Riduci i contenuti CSS inutilizzati - 48 KiB"  
**Causa:** Bootstrap CSS completo anche se usate solo alcuni componenti

**SOLUZIONE 1 - PurgeCSS (consigliato):**
```bash
npm install --save-dev @fullhuman/postcss-purgecss
```

```js
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import purgecss from '@fullhuman/postcss-purgecss'

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        purgecss({
          content: ['./src/**/*.{js,jsx,html}'],
          safelist: ['carousel', 'modal', 'dropdown'], // Classi dinamiche Bootstrap
          defaultExtractor: content => content.match(/[\w-/:]+(?<!:)/g) || []
        })
      ]
    }
  }
})
```

**SOLUZIONE 2 - Import selettivo Bootstrap (alternativa):**
```jsx
// main.jsx - invece di importare tutto Bootstrap
// import 'bootstrap/dist/css/bootstrap.min.css'; // ❌ RIMUOVI

// ✅ IMPORTA solo quello che serve
import 'bootstrap/dist/css/bootstrap-grid.css';
import 'bootstrap/dist/css/bootstrap-utilities.css';
import './custom-bootstrap-components.css'; // Solo componenti usati
```

**Benefici:**
- ✅ **-48 KiB CSS** (confermato PageSpeed)
- ✅ **Render blocking: -200-400ms**
- ✅ **FCP: -200-400ms**
- ⏱️ **Tempo:** 1-1.5 ore
- 🔧 **Rischio:** MODERATO (testare styling su tutte le pagine)

---

### ⚠️ 2.2 Rimuovi JavaScript inutilizzato (41 KiB)
**Problema PageSpeed:** "Riduci il codice JavaScript inutilizzato - 41 KiB"  
**Causa:** Librerie importate completamente anche se serve solo una parte

**SOLUZIONE - Tree shaking + import selettivo:**

**1. Verifica React Bootstrap imports:**
```jsx
// ❌ SBAGLIATO - importa tutto
import { Button, Card, Container, Row, Col, ... } from 'react-bootstrap';

// ✅ CORRETTO - tree shaking automatico (già OK in Vite)
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
// Oppure (equivalente):
import { Button, Card } from 'react-bootstrap'; // Vite fa tree-shaking
```

**2. Verifica bootstrap-icons non importi tutto:**
```jsx
// Se usate bootstrap-icons, verificare che NON ci sia:
// import 'bootstrap-icons/font/bootstrap-icons.css'; // ❌ Importa TUTTE le icone

// Usate invece le classi direttamente (già OK se usate solo <i className="bi bi-*">)
```

**3. Dynamic import per route lazy:**
Vedo che avete già lazy loading routes, VERIFICARE sia applicato correttamente:
```jsx
// App.jsx - VERIFICARE tutte le route usino lazy()
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const ProductForm = lazy(() => import('./pages/ProductForm'));
const VendorDashboard = lazy(() => import('./pages/VendorDashboard'));
// ... tutte le route non critiche
```

**Benefici:**
- ✅ **-41 KiB JS** (confermato PageSpeed)
- ✅ **Render blocking: -200-300ms**
- ✅ **Attività lunghe: ridotte**
- ⏱️ **Tempo:** 1 ora
- 🔧 **Rischio:** BASSO (solo riorganizzazione import)

---

### ⚠️ 2.3 Defer JavaScript non critico
**Problema PageSpeed:** "Richieste di blocco del rendering - 2340ms"  
**Causa:** JS scaricato e eseguito prima del rendering

**SOLUZIONE - Modificare Vite build:**
```js
// vite.config.js
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Separa vendor chunks
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'bootstrap-vendor': ['react-bootstrap'],
          'stripe-vendor': ['@stripe/react-stripe-js', '@stripe/stripe-js']
        },
        // ⚡ AGGIUNGI: genera moduli ES per browser moderni
        format: 'es',
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // ⚡ AGGIUNGI module preload per chunk critici
    modulePreload: {
      polyfill: false // Rimuovi polyfill se non serve IE11
    }
  }
})
```

**Benefici:**
- ✅ **Render blocking: -800-1200ms** (caricamento parallelo)
- ✅ **LCP: -500-800ms**
- ⏱️ **Tempo:** 30 minuti
- 🔧 **Rischio:** BASSO

---

## ⚙️ RISULTATO ATTESO FASE 2 (dopo Fase 1)

| Metrica | Dopo Fase 1 | Dopo Fase 2 | Miglioramento Totale |
|---------|-------------|-------------|---------------------|
| **LCP (mobile)** | 4.5-5.5s | **2.5-3.5s** | **-60-72%** da 9.0s ✅ |
| **CLS** | <0.1 | **<0.1** | Mantiene ✅ |
| **Performance** | 65-72/100 | **78-88/100** | +37-47 punti |
| **FCP** | 3.5-3.8s | **2.0-2.5s** | -50% |
| **Render Blocking** | 2340ms | **<500ms** | -78% |

**⏱️ Tempo totale Fase 2:** 3-4 ore  
**🔧 Rischio:** MODERATO (testing completo necessario)  
**📅 Deploy:** Dopo test su staging, settimana prossima

---

## 🐛 FASE 3: FIX SEO & ACCESSIBILITÀ (30 minuti)
**Problema PageSpeed:** Vari errori SEO e accessibilità  
**Rischio:** ✅ MINIMO | **Impatto:** 📊 SEO Score

### ✅ 3.1 Fix robots.txt
**Problema PageSpeed:** "robots.txt non è valido - 1 errore trovato"

**Creare/correggere `frontend/public/robots.txt`:**
```txt
User-agent: *
Allow: /

# Sitemap
Sitemap: https://lucanikoshop.it/sitemap.xml

# Disallow admin/vendor area
Disallow: /admin
Disallow: /vendor
Disallow: /login
Disallow: /register
```

**Benefici:**
- ✅ **SEO: +5-10 punti**
- ⏱️ **Tempo:** 5 minuti
- 🔧 **Rischio:** ZERO

---

### ✅ 3.2 Fix canonical URL
**Problema PageSpeed:** "rel=canonical non valido - Conflitto tra / e /products"

**Correggere in `Products.jsx`:**
```jsx
// Products.jsx
<SEOHelmet
  title="Lucaniko Shop - Il primo centro commerciale della Basilicata"
  description="..."
  url="https://lucanikoshop.it/"  // ⚡ Forza canonical su homepage
  // ... altri props
/>
```

**E in `index.html` aggiungere canonical fisso:**
```html
<head>
  <!-- ... altri tag ... -->
  <link rel="canonical" href="https://lucanikoshop.it/" />
</head>
```

**Benefici:**
- ✅ **SEO: +5 punti**
- ⏱️ **Tempo:** 5 minuti
- 🔧 **Rischio:** ZERO

---

### ✅ 3.3 Fix accessibilità link social
**Problema PageSpeed:** "Il nome dei link non è distinguibile"

**Correggere Footer/Navbar link social:**
```jsx
// Footer.jsx - AGGIUNGI aria-label
<a 
  href="https://www.instagram.com/lucanikoshop/" 
  target="_blank" 
  rel="noopener noreferrer" 
  className="footer-social-icon"
  aria-label="Seguici su Instagram"  // ⚡ AGGIUNGI
>
  <i className="bi bi-instagram"></i>
</a>

<a 
  href="https://www.facebook.com/lucanikoshop" 
  target="_blank" 
  rel="noopener noreferrer" 
  className="footer-social-icon"
  aria-label="Seguici su Facebook"  // ⚡ AGGIUNGI
>
  <i className="bi bi-facebook"></i>
</a>

<a 
  href="https://www.tiktok.com/@lucaniko.it" 
  target="_blank" 
  rel="noopener noreferrer" 
  className="footer-social-icon"
  aria-label="Seguici su TikTok"  // ⚡ AGGIUNGI
>
  <i className="bi bi-tiktok"></i>
</a>
```

**Benefici:**
- ✅ **Accessibilità: +8-12 punti**
- ⏱️ **Tempo:** 10 minuti
- 🔧 **Rischio:** ZERO

---

### ✅ 3.4 Fix touch target size
**Problema PageSpeed:** "I touch target non hanno dimensioni o spaziatura sufficienti"  
**Elementi respinti:** Link navigazione, footer, social (< 48x48px)

**Correggere CSS:**
```css
/* Footer.css o global CSS */
.footer-social-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 48px;      /* ⚡ AGGIUNGI */
  min-height: 48px;     /* ⚡ AGGIUNGI */
  font-size: 24px;
  padding: 12px;        /* ⚡ AGGIUNGI */
}

/* Link navigazione footer */
.footer-link {
  display: inline-block;
  min-height: 48px;     /* ⚡ AGGIUNGI */
  padding: 12px 8px;    /* ⚡ AGGIUNGI */
}
```

**Benefici:**
- ✅ **Best Practices: +5-8 punti**
- ✅ **Usabilità mobile:** migliorata
- ⏱️ **Tempo:** 10 minuti
- 🔧 **Rischio:** MINIMO (solo padding)

---

## 📅 TIMELINE & PRIORITÀ

| Fase | Durata | Quando | Rischio | LCP Target | Score Target |
|------|--------|--------|---------|------------|--------------|
| **🎯 FASE 1** | 1.5-2h | **OGGI** | ✅ Minimo | 4.5-5.5s | 65-72/100 |
| **⚙️ FASE 2** | 3-4h | Prossima settimana | ⚠️ Moderato | 2.5-3.5s | 78-88/100 |
| **🐛 FASE 3** | 30min | Quando serve | ✅ Minimo | - | +5-10 SEO |

---

## ✅ CHECKLIST IMPLEMENTAZIONE

### 🎯 FASE 1 - Quick Wins (PRIORITÀ MASSIMA)

**1.1 Width/Height immagini (60 min):**
- [ ] ProductCard.jsx - carousel + singola immagine
- [ ] ExperienceDetail.jsx - carousel
- [ ] EventDetail.jsx - carousel
- [ ] CategoriesCarouselArrows.jsx - card categorie
- [ ] OtherCategoriesCarousel.jsx - carousel
- [ ] SuggestedProductsCarousel.jsx - prodotti
- [ ] Negozi.jsx - logo vendor
- [ ] ShopPage.jsx - logo vendor  
- [ ] ProductDetail.jsx - carousel prodotto
- [ ] Aggiungere `aspectRatio: '1/1'` in tutti gli style

**1.2 Ottimizzazione Cloudinary (30 min):**
- [ ] Testare URL prima immagine homepage
- [ ] Verificare presenza `/f_auto,q_auto:good,w_500,h_500/`
- [ ] Se mancante: correggere `optimizeCloudinaryUrl()`
- [ ] Testare su 3-4 immagini diverse

**1.3 Fetchpriority prima immagine (10 min):**
- [ ] Aggiungere prop `isFirstCard` a ProductCard
- [ ] Passare `isFirstCard={index === 0}` da Products.jsx
- [ ] Aggiungere `fetchpriority="high"` se isFirstCard
- [ ] Aggiungere `loading="eager"` se isFirstCard
- [ ] Aggiungere `fetchpriority="low"` agli altri

**1.4 Preload font (5 min):**
- [ ] Verificare se usate Google Fonts
- [ ] Se sì: aggiungere preload in index.html
- [ ] Se no: SKIP

**TEST FASE 1:**
- [ ] Build produzione: `npm run build`
- [ ] Deploy su staging o preview
- [ ] Test PageSpeed Insights mobile
- [ ] **VERIFICARE: CLS < 0.1** ✅
- [ ] **VERIFICARE: LCP < 5.5s** ⚠️
- [ ] **VERIFICARE: Performance > 65** ⚠️
- [ ] Se tutto OK → Deploy produzione

---

### ⚙️ FASE 2 - Render Blocking (DOPO VALIDAZIONE FASE 1)

**2.1 Rimuovi CSS inutilizzato (1-1.5h):**
- [ ] Installare PurgeCSS: `npm install -D @fullhuman/postcss-purgecss`
- [ ] Configurare in vite.config.js
- [ ] Aggiungere safelist Bootstrap dinamici
- [ ] Build test
- [ ] Testare TUTTE le pagine visivamente
- [ ] Verificare modal, dropdown, carousel funzionino
- [ ] Fix eventuali classi mancanti

**2.2 Rimuovi JS inutilizzato (1h):**
- [ ] Verificare imports React Bootstrap
- [ ] Verificare lazy loading tutte le route
- [ ] Eventuale tree-shaking manuale
- [ ] Build e verificare dimensioni bundle

**2.3 Defer JS non critico (30 min):**
- [ ] Configurare modulePreload in vite.config.js
- [ ] Configurare format: 'es'
- [ ] Build e test

**TEST FASE 2:**
- [ ] Build produzione
- [ ] Deploy su staging
- [ ] Test PageSpeed Insights mobile
- [ ] **VERIFICARE: LCP < 3.5s** ✅
- [ ] **VERIFICARE: Performance > 78** ✅
- [ ] **VERIFICARE: Render blocking < 500ms** ✅
- [ ] Test funzionale completo (registrazione, checkout, ecc.)
- [ ] Se tutto OK → Deploy produzione

---

### 🐛 FASE 3 - SEO & Accessibilità (30 min)

**Fix SEO (15 min):**
- [ ] Creare/correggere `frontend/public/robots.txt`
- [ ] Aggiungere canonical fisso in index.html
- [ ] Correggere canonical in Products.jsx

**Fix Accessibilità (15 min):**
- [ ] Aggiungere aria-label a link social (3 link)
- [ ] Aumentare min-height touch target (footer CSS)
- [ ] Test con screen reader (opzionale)

**TEST FASE 3:**
- [ ] Deploy
- [ ] Test PageSpeed SEO score
- [ ] Test PageSpeed Accessibility score
- [ ] **VERIFICARE: SEO > 90** ✅
- [ ] **VERIFICARE: Accessibility > 90** ✅

---

## 🎯 OBIETTIVO FINALE

**Target realistico dopo Fase 1+2:**

| Metrica | Valore iniziale | Target post-fix | Google Rating |
|---------|-----------------|-----------------|---------------|
| **LCP mobile** | 9.0s ❌ | **2.5-3.5s** | ✅ Buono/Migliorabile |
| **CLS** | 0.64 ❌ | **<0.1** | ✅ Buono |
| **FCP** | 4.1s ⚠️ | **2.0-2.5s** | ✅ Migliorabile |
| **Performance** | 41/100 ❌ | **78-88/100** | ✅ Buono |
| **SEO** | 85/100 ⚠️ | **90-95/100** | ✅ Buono |
| **Accessibility** | 84/100 ⚠️ | **90-95/100** | ✅ Buono |

---

## 📱 COME TESTARE

**Dopo OGNI fase:**

1. **Build produzione:**
   ```bash
   cd frontend
   npm run build
   ```

2. **Deploy su staging/preview** (Vercel automatico su push)

3. **Test PageSpeed Insights:**
   - URL: https://pagespeed.web.dev/
   - Inserire URL staging
   - Testare MOBILE e DESKTOP
   - Salvare screenshot dei risultati

4. **Verifica metriche Core Web Vitals:**
   - ✅ LCP < 2.5s = VERDE
   - ⚠️ LCP 2.5-4s = ARANCIONE  
   - ❌ LCP > 4s = ROSSO
   - ✅ CLS < 0.1 = VERDE
   - ⚠️ CLS 0.1-0.25 = ARANCIONE
   - ❌ CLS > 0.25 = ROSSO

5. **Test manuale:**
   - Simulare 4G lenta (Chrome DevTools → Network → Slow 4G)
   - Verificare layout non "salti" durante caricamento
   - Testare tutte le pagine principali

6. **Se tutto OK → Deploy produzione**

---

## 💡 NOTE IMPORTANTI

1. **NON compromettere funzionalità:** testare SEMPRE prima di deployare
2. **Fase 1 è CRITICA:** 70-80% del miglioramento, rischio minimo
3. **Fase 2 richiede testing:** PurgeCSS può rompere stili se mal configurato
4. **Fase 3 è bonus:** migliora score ma non performance
5. **Vercel Pro + Railway Pro sono OK:** problema è frontend, non infrastruttura
6. **Ogni fase va validata:** PageSpeed test + test manuale

---

## 🚨 SE QUALCOSA VA STORTO

**Fase 1 - Width/Height causa layout rotti:**
- Rimuovere `aspectRatio` e tenere solo width/height
- Adjustare valori width/height se necessario

**Fase 2 - PurgeCSS rimuove CSS necessari:**
- Aggiungere classi a `safelist`
- Esempio: `safelist: ['carousel-*', 'modal-*', 'dropdown-*']`

**Fase 2 - Tree shaking rompe funzionalità:**
- Revertare a import standard
- Verificare build warnings

**Deploy fallito:**
- Check build logs Vercel
- Verificare environment variables
- Test locale con `npm run preview`

---

**Pronto per iniziare con FASE 1? Tutto chiaro?** 🚀
