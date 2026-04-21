import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Table, Button, Badge, Spinner, Alert, Tabs, Tab, Form, Modal } from 'react-bootstrap';
import { adminAPI, uploadVendorDocument, API_URL, sponsorAPI, experienceAPI, eventAPI, uploadAPI } from '../services/api';
// Espone la funzione uploadVendorDocument su window per uso inline
window.uploadVendorDocument = uploadVendorDocument;
import { useAuth } from '../context/authContext';
import RegisterCompanyForm from '../components/RegisterCompanyForm';
import AlertModal from '../components/AlertModal';
import { CloudinaryPresets } from '../utils/cloudinaryOptimizer';

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [pendingSellers, setPendingSellers] = useState([]);
  const [allSellers, setAllSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');
  // Stato per i documenti allegati
  const [vendorDocs, setVendorDocs] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [sellersPage, setSellersPage] = useState(1);
  const [eventSearchTerm, setEventSearchTerm] = useState("");
  const [experienceSearchTerm, setExperienceSearchTerm] = useState("");
  
  // Stato per le News
  const [adminNews, setAdminNews] = useState([]);
  // Rimosso newsTitle
  const [newsContent, setNewsContent] = useState('');
  const [savingNews, setSavingNews] = useState(false);
  const [editingNewsId, setEditingNewsId] = useState(null);

  // Stato per gli Sponsor
  const [sponsors, setSponsors] = useState([]);
  const [showSponsorModal, setShowSponsorModal] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState(null);
  const [sponsorFormData, setSponsorFormData] = useState({
    name: '',
    description: '',
    city: '',
    phone: '',
    website: '',
    logo: '',
    tier: 'Support',
    status: 'active'
  });
  const [savingSponsor, setSavingSponsor] = useState(false);
  const [sponsorLogoFile, setSponsorLogoFile] = useState(null);
  const [sponsorLogoPreview, setSponsorLogoPreview] = useState('');
  const [showSponsorSuccessModal, setShowSponsorSuccessModal] = useState(false);
  const [sponsorSuccessMessage, setSponsorSuccessMessage] = useState('');

  // Stato per le Esperienze
  const [experiences, setExperiences] = useState([]);
  const [showExperienceModal, setShowExperienceModal] = useState(false);
  const [editingExperience, setEditingExperience] = useState(null);
  const [experienceFormData, setExperienceFormData] = useState({
    title: '',
    description: '',
    company: '',
    city: '',
    address: '',
    phone: '',
    website: '',
    categories: [],
    status: 'active'
  });
  const [savingExperience, setSavingExperience] = useState(false);
  const [experienceImageItems, setExperienceImageItems] = useState([]);
  const [showExperienceSuccessModal, setShowExperienceSuccessModal] = useState(false);
  const [experienceSuccessMessage, setExperienceSuccessMessage] = useState('');

  // Stato per gli Eventi
  const [events, setEvents] = useState([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventFormData, setEventFormData] = useState({
    title: '',
    description: '',
    company: '',
    city: '',
    address: '',
    phone: '',
    website: '',
    categories: [],
    eventDates: [],
    eventTime: '',
    status: 'active'
  });
  const [savingEvent, setSavingEvent] = useState(false);
  const [eventImageItems, setEventImageItems] = useState([]);
  const [showEventSuccessModal, setShowEventSuccessModal] = useState(false);
  const [eventSuccessMessage, setEventSuccessMessage] = useState('');
  const [eventCalendarMonth, setEventCalendarMonth] = useState(new Date());

  // Stato per AlertModal
  const [alertModal, setAlertModal] = useState({ show: false, message: '', type: 'info' });
  
  // ⚡ LAZY LOADING: Traccia quali tab sono stati caricati
  const [loadedTabs, setLoadedTabs] = useState(new Set(['pending-sellers'])); // Tab default
  const [activeTab, setActiveTab] = useState('pending-sellers');
  
  // Funzione helper per mostrare alert modal
  const showAlert = (message, type = 'info') => {
    setAlertModal({ show: true, message, type });
  };

  useEffect(() => {
    // ⚡ LAZY LOADING: Carica solo i dati essenziali all'apertura
    // News/Sponsors/Experiences/Events saranno caricati quando l'utente apre il tab
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // ⚡ PERFORMANCE: Una sola chiamata invece di 3+ (stats + sellers + docs)
      const data = await adminAPI.getDashboardData(user.token);

      setStats(data.stats);
      setPendingSellers(data.pendingSellers.sellers);
      setAllSellers(data.allSellers.sellers);
      setVendorDocs(data.vendorDocs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ⚡ LAZY LOADING: Handler per cambio tab - carica dati solo quando necessario
  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    
    // Carica dati solo se non ancora caricati
    if (!loadedTabs.has(tabKey)) {
      if (tabKey === 'news' && adminNews.length === 0) {
        loadNews();
        setLoadedTabs(prev => new Set([...prev, 'news']));
      } else if (tabKey === 'sponsors' && sponsors.length === 0) {
        loadSponsors();
        setLoadedTabs(prev => new Set([...prev, 'sponsors']));
      } else if (tabKey === 'experiences' && experiences.length === 0) {
        loadExperiences();
        setLoadedTabs(prev => new Set([...prev, 'experiences']));
      } else if (tabKey === 'events' && events.length === 0) {
        loadEvents();
        setLoadedTabs(prev => new Set([...prev, 'events']));
      }
    }
  };

  const handleApprove = async (sellerId) => {
    if (!confirm('Sei sicuro di voler approvare questo venditore?')) return;

    try {
      setActionLoading(sellerId);
      await adminAPI.approveSeller(sellerId, user.token);
      showAlert('Venditore approvato con successo!', 'success');
      await loadData();
    } catch (err) {
      showAlert('Errore: ' + err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (sellerId) => {
    if (!confirm('Sei sicuro di voler RIFIUTARE ed ELIMINARE questo venditore? Questa azione è irreversibile!')) return;

    try {
      setActionLoading(sellerId);
      await adminAPI.rejectSeller(sellerId, user.token);
      showAlert('Venditore rifiutato ed eliminato', 'success');
      await loadData();
    } catch (err) {
      showAlert('Errore: ' + err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleRenewal = async (sellerId, currentStatus) => {
    try {
      const res = await fetch(`${API_URL}/admin/sellers/${sellerId}/subscription`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Errore toggle rinnovo');
      }

      // Aggiorna localmente lo stato
      setAllSellers(prev => prev.map(seller => 
        seller._id === sellerId 
          ? { ...seller, subscriptionSuspended: !currentStatus }
          : seller
      ));
    } catch (err) {
      showAlert('Errore: ' + err.message, 'error');
    }
  };

  const handleDeleteDocument = async (sellerId, filename) => {
    if (!confirm(`Sei sicuro di voler eliminare il documento "${filename}"?`)) return;

    try {
      await adminAPI.deleteVendorDocument(sellerId, filename, user.token);
      showAlert('Documento eliminato con successo!', 'success');
      
      // Aggiorna la lista documenti
      const res = await adminAPI.getVendorDocuments(sellerId, user.token);
      setVendorDocs((prev) => ({ ...prev, [sellerId]: res.files || [] }));
    } catch (err) {
      showAlert('Errore eliminazione documento: ' + err.message, 'error');
    }
  };

  const handleDeleteSeller = async (sellerId, sellerName) => {
    if (!confirm(`ATTENZIONE: Sei sicuro di voler ELIMINARE DEFINITIVAMENTE il venditore "${sellerName}"?\n\nQuesta azione eliminerà:\n- L'account venditore\n- Tutti i suoi prodotti\n- Tutti i dati associati\n\nQuesta azione è IRREVERSIBILE!`)) return;

    try {
      setActionLoading(sellerId);
      await adminAPI.deleteSeller(sellerId, user.token);
      showAlert('Venditore eliminato definitivamente', 'success');
      await loadData();
    } catch (err) {
      showAlert('Errore eliminazione venditore: ' + err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Funzioni per gestione News
  const loadNews = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/news/all`, {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setAdminNews(data);
      }
    } catch (err) {
      console.error('Errore caricamento news:', err);
    }
  };

  const handleSaveNews = async (e) => {
    e.preventDefault();
    try {
      setSavingNews(true);
      const method = editingNewsId ? 'PUT' : 'POST';
      const url = editingNewsId 
        ? `${API_URL}/admin/news/${editingNewsId}`
        : `${API_URL}/admin/news`;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ content: newsContent })
      });

      if (response.ok) {
        showAlert(editingNewsId ? 'News aggiornata!' : 'News creata!', 'success');
        setNewsContent('');
        setEditingNewsId(null);
        await loadNews();
      } else {
        const data = await response.json();
        showAlert('Errore: ' + data.message, 'error');
      }
    } catch (err) {
      showAlert('Errore: ' + err.message, 'error');
    } finally {
      setSavingNews(false);
    }
  };

  const handleEditNews = (news) => {
    setNewsContent(news.content);
    setEditingNewsId(news._id);
  };

  const handleDeleteNews = async (newsId) => {
    if (!confirm('Sei sicuro di voler eliminare questa news?')) return;

    try {
      const response = await fetch(`${API_URL}/admin/news/${newsId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });

      if (response.ok) {
        showAlert('News eliminata!', 'success');
        await loadNews();
      } else {
        const data = await response.json();
        showAlert('Errore: ' + data.message, 'error');
      }
    } catch (err) {
      showAlert('Errore: ' + err.message, 'error');
    }
  };

  const handleToggleNewsActive = async (newsId, currentStatus) => {
    try {
      const response = await fetch(`${API_URL}/admin/news/${newsId}/toggle`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        }
      });

      if (response.ok) {
        await loadNews();
      } else {
        const data = await response.json();
        showAlert('Errore: ' + data.message, 'error');
      }
    } catch (err) {
      showAlert('Errore: ' + err.message, 'error');
    }
  };

  // === GESTIONE SPONSOR ===
  const loadSponsors = async () => {
    try {
      const data = await sponsorAPI.getAllSponsors(user.token);
      setSponsors(data);
    } catch (err) {
      console.error('Errore caricamento sponsor:', err);
    }
  };

  const handleOpenSponsorModal = (sponsor = null) => {
    if (sponsor) {
      setEditingSponsor(sponsor);
      setSponsorFormData({
        name: sponsor.name || '',
        description: sponsor.description || '',
        city: sponsor.city || '',
        phone: sponsor.phone || '',
        website: sponsor.website || '',
        logo: sponsor.logo || '',
        tier: sponsor.tier || 'Support',
        status: sponsor.status || 'active'
      });
    } else {
      setEditingSponsor(null);
      setSponsorFormData({
        name: '',
        description: '',
        city: '',
        phone: '',
        website: '',
        logo: '',
        tier: 'Support',
        status: 'active'
      });
      setSponsorLogoFile(null);
      setSponsorLogoPreview('');
    }
    setShowSponsorModal(true);
  };

  const handleCloseSponsorModal = () => {
    setShowSponsorModal(false);
    setEditingSponsor(null);
    setSponsorFormData({
      name: '',
      description: '',
      city: '',
      phone: '',
      website: '',
      logo: '',
      tier: 'Support',
      status: 'active'
    });
    setSponsorLogoFile(null);
    setSponsorLogoPreview('');
  };

  const handleSaveSponsor = async (e) => {
    e.preventDefault();
    
    if (!sponsorFormData.name || !sponsorFormData.description || !sponsorFormData.city || 
        !sponsorFormData.phone || !sponsorFormData.website) {
      showAlert('Compila tutti i campi obbligatori', 'warning');
      return;
    }

    try {
      setSavingSponsor(true);
      
      let logoUrl = sponsorFormData.logo;
      
      // Se c'è un nuovo file da caricare
      if (sponsorLogoFile) {
        const uploadResult = await uploadAPI.uploadProductImage(sponsorLogoFile, user.token);
        logoUrl = uploadResult.url;
      }
      
      const dataToSave = {
        ...sponsorFormData,
        logo: logoUrl
      };
      
      if (editingSponsor) {
        await sponsorAPI.updateSponsor(editingSponsor._id, dataToSave, user.token);
        setSponsorSuccessMessage('Sponsor aggiornato con successo!');
      } else {
        await sponsorAPI.createSponsor(dataToSave, user.token);
        setSponsorSuccessMessage('Sponsor creato con successo!');
      }
      
      await loadSponsors();
      handleCloseSponsorModal();
      setShowSponsorSuccessModal(true);
    } catch (err) {
      showAlert('Errore: ' + err.message, 'error');
    } finally {
      setSavingSponsor(false);
    }
  };

  const handleDeleteSponsor = async (sponsorId) => {
    if (!confirm('Sei sicuro di voler eliminare questo sponsor?')) return;

    try {
      await sponsorAPI.deleteSponsor(sponsorId, user.token);
      showAlert('Sponsor eliminato!', 'success');
      await loadSponsors();
    } catch (err) {
      showAlert('Errore: ' + err.message, 'error');
    }
  };

  const handleToggleSponsorStatus = async (sponsorId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await sponsorAPI.updateSponsor(sponsorId, { status: newStatus }, user.token);
      await loadSponsors();
    } catch (err) {
      showAlert('Errore: ' + err.message, 'error');
    }
  };

  // === GESTIONE ESPERIENZE ===
  const loadExperiences = async () => {
    try {
      const data = await experienceAPI.getAllExperiences(user.token);
      setExperiences(data);
    } catch (err) {
      console.error('Errore caricamento esperienze:', err);
    }
  };

  const handleOpenExperienceModal = (experience = null) => {
    if (experience) {
      setEditingExperience(experience);
      // Gestisce sia il nuovo formato (categories array) che il vecchio (category string) per retrocompatibilità
      const categoriesArray = experience.categories 
        ? experience.categories 
        : (experience.category ? [experience.category] : []);
      
      setExperienceFormData({
        title: experience.title || '',
        description: experience.description || '',
        company: experience.company || '',
        city: experience.city || '',
        address: experience.address || '',
        phone: experience.phone || '',
        website: experience.website || '',
        categories: categoriesArray,
        status: experience.status || 'active'
      });
      // Carica immagini esistenti
      if (experience.images && experience.images.length > 0) {
        setExperienceImageItems(experience.images.map((img, idx) => ({
          file: null,
          url: img.url,
          public_id: img.public_id,
          isMain: idx === 0
        })));
      } else {
        setExperienceImageItems([]);
      }
    } else {
      setEditingExperience(null);
      setExperienceFormData({
        title: '',
        description: '',
        company: '',
        city: '',
        address: '',
        phone: '',
        categories: [],
        website: '',
        status: 'active'
      });
      setExperienceImageItems([]);
    }
    setShowExperienceModal(true);
  };

  const handleCloseExperienceModal = () => {
    setShowExperienceModal(false);
    setEditingExperience(null);
    setExperienceFormData({
      title: '',
      description: '',
      company: '',
      city: '',
      phone: '',
      categories: [],
      website: '',
      status: 'active'
    });
    setExperienceImageItems([]);
  };

  // Handler per multiple immagini esperienze
  const handleExperienceImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setExperienceImageItems(prev => {
      const newItems = files.map(file => ({
        file: file,
        url: URL.createObjectURL(file),
        isMain: false
      }));
      
      const combined = [...prev, ...newItems];
      // Se non c'è nessuna immagine principale, imposta la prima come principale
      if (!combined.some(item => item.isMain) && combined.length > 0) {
        combined[0].isMain = true;
      }
      return combined;
    });
    
    // Reset input per permettere di caricare lo stesso file
    e.target.value = '';
  };

  const handleExperienceSetAsMain = (idx) => {
    setExperienceImageItems(prev => 
      prev.map((item, i) => ({ ...item, isMain: i === idx }))
    );
  };

  const handleExperienceRemoveImage = (idx) => {
    setExperienceImageItems(prev => {
      const newItems = prev.filter((_, i) => i !== idx);
      // Se rimuovi la principale e ci sono altre immagini, imposta la prima come principale
      if (newItems.length > 0 && !newItems.some(item => item.isMain)) {
        newItems[0].isMain = true;
      }
      return newItems;
    });
  };

  const handleSaveExperience = async (e) => {
    e.preventDefault();
    
    if (!experienceFormData.title || !experienceFormData.description || !experienceFormData.company ||
        !experienceFormData.city || !experienceFormData.phone || 
        !experienceFormData.categories || experienceFormData.categories.length === 0) {
      showAlert('Compila tutti i campi obbligatori e seleziona almeno una categoria', 'warning');
      return;
    }

    try {
      setSavingExperience(true);
      
      let updatedImages = [];
      
      // Trova l'indice dell'immagine principale
      const mainIndex = experienceImageItems.findIndex(item => item.isMain);
      
      if (editingExperience) {
        // MODIFICA ESPERIENZA ESISTENTE
        const newImages = experienceImageItems.filter(item => item.file !== null);
        
        if (newImages.length > 0) {
          // Ci sono nuove immagini: elimina le vecchie e carica le nuove
          // Elimina vecchie immagini da Cloudinary
          if (editingExperience.images && editingExperience.images.length > 0) {
            for (const img of editingExperience.images) {
              if (img.public_id) {
                try {
                  const encodedPublicId = encodeURIComponent(img.public_id);
                  await fetch(`${API_URL}/upload/${encodedPublicId}`, {
                    method: 'DELETE',
                    headers: {
                      'Authorization': `Bearer ${user.token}`,
                    },
                  });
                } catch (err) {
                  console.error('Errore eliminazione immagine:', err);
                }
              }
            }
          }
          // Carica tutte le nuove immagini mantenendo traccia dell'indice
          const uploadedWithIndex = [];
          for (let i = 0; i < experienceImageItems.length; i++) {
            const item = experienceImageItems[i];
            if (item.file) {
              try {
                const uploadResponse = await uploadAPI.uploadProductImage(item.file, user.token);
                if (uploadResponse && uploadResponse.url) {
                  uploadedWithIndex.push({
                    url: uploadResponse.url,
                    public_id: uploadResponse.public_id,
                    originalIndex: i
                  });
                }
              } catch (uploadErr) {
                console.error('Errore upload immagine:', uploadErr);
              }
            }
          }
          // Ordina: l'immagine principale per prima
          updatedImages = uploadedWithIndex.sort((a, b) => {
            if (a.originalIndex === mainIndex) return -1;
            if (b.originalIndex === mainIndex) return 1;
            return a.originalIndex - b.originalIndex;
          }).map(({ url, public_id }) => ({ url, public_id }));
        } else {
          // Nessuna nuova immagine: mantieni quelle esistenti e riordina in base a isMain
          updatedImages = experienceImageItems
            .filter(item => item.file === null)
            .map((item, idx) => {
              const found = editingExperience.images.find(img => img.url === item.url);
              return found ? { url: found.url, public_id: found.public_id, originalIndex: idx } : null;
            })
            .filter(Boolean);
          
          // Ordina: l'immagine principale per prima
          updatedImages = updatedImages.sort((a, b) => {
            if (a.originalIndex === mainIndex) return -1;
            if (b.originalIndex === mainIndex) return 1;
            return a.originalIndex - b.originalIndex;
          }).map(({ url, public_id }) => ({ url, public_id }));
        }
      } else {
        // CREAZIONE NUOVA ESPERIENZA
        const uploadedWithIndex = [];
        for (let i = 0; i < experienceImageItems.length; i++) {
          const item = experienceImageItems[i];
          if (item.file) {
            try {
              const uploadResponse = await uploadAPI.uploadProductImage(item.file, user.token);
              if (uploadResponse && uploadResponse.url) {
                uploadedWithIndex.push({
                  url: uploadResponse.url,
                  public_id: uploadResponse.public_id,
                  originalIndex: i
                });
              }
            } catch (uploadErr) {
              console.error('Errore upload immagine:', uploadErr);
            }
          }
        }
        
        // Ordina: l'immagine principale per prima
        updatedImages = uploadedWithIndex.sort((a, b) => {
          if (a.originalIndex === mainIndex) return -1;
          if (b.originalIndex === mainIndex) return 1;
          return a.originalIndex - b.originalIndex;
        }).map(({ url, public_id }) => ({ url, public_id }));
      }
        
      const dataToSave = {
        ...experienceFormData,
        images: updatedImages
      };
      
      if (editingExperience) {
        await experienceAPI.updateExperience(editingExperience._id, dataToSave, user.token);
        setExperienceSuccessMessage('Esperienza aggiornata con successo!');
      } else {
        await experienceAPI.createExperience(dataToSave, user.token);
        setExperienceSuccessMessage('Esperienza creata con successo!');
      }
      
      await loadExperiences();
      handleCloseExperienceModal();
      setShowExperienceSuccessModal(true);
    } catch (err) {
      showAlert('Errore: ' + err.message, 'error');
    } finally {
      setSavingExperience(false);
    }
  };

  const handleDeleteExperience = async (experienceId) => {
    if (!confirm('Sei sicuro di voler eliminare questa esperienza?')) return;

    try {
      await experienceAPI.deleteExperience(experienceId, user.token);
      showAlert('Esperienza eliminata!', 'success');
      await loadExperiences();
    } catch (err) {
      showAlert('Errore: ' + err.message, 'error');
    }
  };

  const handleToggleExperienceStatus = async (experienceId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await experienceAPI.updateExperience(experienceId, { status: newStatus }, user.token);
      await loadExperiences();
    } catch (err) {
      showAlert('Errore: ' + err.message, 'error');
    }
  };

  // === GESTIONE EVENTI ===
  const loadEvents = async () => {
    try {
      const data = await eventAPI.getAllEvents(user.token);
      setEvents(data);
    } catch (err) {
      console.error('Errore caricamento eventi:', err);
    }
  };

  const handleOpenEventModal = (event = null) => {
    if (event) {
      setEditingEvent(event);
      setEventFormData({
        title: event.title || '',
        description: event.description || '',
        company: event.company || '',
        city: event.city || '',
        address: event.address || '',
        phone: event.phone || '',
        website: event.website || '',
        categories: event.categories || [],
        eventDates: event.eventDates ? event.eventDates.map(d => new Date(d).toISOString().split('T')[0]) : [],
        eventTime: event.eventTime || '',
        status: event.status || 'active'
      });
      // Carica immagini esistenti
      if (event.images && event.images.length > 0) {
        setEventImageItems(event.images.map((img, idx) => ({
          file: null,
          url: img.url,
          public_id: img.public_id,
          isMain: idx === 0
        })));
      } else {
        setEventImageItems([]);
      }
      // Imposta il calendario sul mese della prima data selezionata
      if (event.eventDates && event.eventDates.length > 0) {
        setEventCalendarMonth(new Date(event.eventDates[0]));
      } else {
        setEventCalendarMonth(new Date());
      }
    } else {
      setEditingEvent(null);
      setEventFormData({
        title: '',
        description: '',
        company: '',
        city: '',
        address: '',
        phone: '',
        categories: [],
        website: '',
        eventDates: [],
        eventTime: '',
        status: 'active'
      });
      setEventImageItems([]);
    }
    setEventCalendarMonth(new Date());
    setShowEventModal(true);
  };

  const handleCloseEventModal = () => {
    setShowEventModal(false);
    setEditingEvent(null);
    setEventFormData({
      title: '',
      description: '',
      company: '',
      city: '',
      phone: '',
      categories: [],
      website: '',
      eventDates: [],
      eventTime: '',
      status: 'active'
    });
    setEventImageItems([]);
    setEventCalendarMonth(new Date());
  };

  // Handler per gestione date multiple con calendario
  const handleToggleEventDate = (date) => {
    if (!date) return;
    // Fix timezone: usa metodi locali invece di toISOString()
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    if (eventFormData.eventDates.includes(dateStr)) {
      // Rimuovi data
      setEventFormData({ 
        ...eventFormData, 
        eventDates: eventFormData.eventDates.filter(d => d !== dateStr)
      });
    } else {
      // Aggiungi data
      setEventFormData({ 
        ...eventFormData, 
        eventDates: [...eventFormData.eventDates, dateStr].sort()
      });
    }
  };

  const handleRemoveEventDate = (dateString) => {
    setEventFormData({ 
      ...eventFormData, 
      eventDates: eventFormData.eventDates.filter(d => d !== dateString) 
    });
  };

  // Funzioni helper per calendario evento
  const getEventCalendarDays = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    return days;
  };

  const isEventDateSelected = (date) => {
    if (!date) return false;
    // Fix timezone: usa metodi locali invece di toISOString()
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return eventFormData.eventDates.includes(dateStr);
  };

  const changeEventCalendarMonth = (direction) => {
    setEventCalendarMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  // Handler per multiple immagini eventi
  const handleEventImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setEventImageItems(prev => {
      const newItems = files.map(file => ({
        file: file,
        url: URL.createObjectURL(file),
        isMain: false
      }));
      
      const combined = [...prev, ...newItems];
      if (!combined.some(item => item.isMain) && combined.length > 0) {
        combined[0].isMain = true;
      }
      return combined;
    });
    
    e.target.value = '';
  };

  const handleEventSetAsMain = (idx) => {
    setEventImageItems(prev => 
      prev.map((item, i) => ({ ...item, isMain: i === idx }))
    );
  };

  const handleEventRemoveImage = (idx) => {
    setEventImageItems(prev => {
      const newItems = prev.filter((_, i) => i !== idx);
      if (newItems.length > 0 && !newItems.some(item => item.isMain)) {
        newItems[0].isMain = true;
      }
      return newItems;
    });
  };

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    
    if (!eventFormData.title || !eventFormData.description || !eventFormData.company ||
        !eventFormData.city || 
        !eventFormData.categories || eventFormData.categories.length === 0 ||
        !eventFormData.eventDates || eventFormData.eventDates.length === 0) {
      showAlert('Compila tutti i campi obbligatori, inclusa almeno una categoria e almeno una data', 'warning');
      return;
    }

    try {
      setSavingEvent(true);
      
      let updatedImages = [];
      
      // Trova l'indice dell'immagine principale
      const mainIndex = eventImageItems.findIndex(item => item.isMain);
      
      if (editingEvent) {
        // MODIFICA EVENTO ESISTENTE
        const newImages = eventImageItems.filter(item => item.file !== null);
        
        if (newImages.length > 0) {
          // Elimina vecchie immagini da Cloudinary
          if (editingEvent.images && editingEvent.images.length > 0) {
            for (const img of editingEvent.images) {
              if (img.public_id) {
                try {
                  const encodedPublicId = encodeURIComponent(img.public_id);
                  await fetch(`${API_URL}/upload/${encodedPublicId}`, {
                    method: 'DELETE',
                    headers: {
                      'Authorization': `Bearer ${user.token}`,
                    },
                  });
                } catch (err) {
                  console.error('Errore eliminazione immagine:', err);
                }
              }
            }
          }
          // Carica nuove immagini mantenendo traccia dell'indice
          const uploadedWithIndex = [];
          for (let i = 0; i < eventImageItems.length; i++) {
            const item = eventImageItems[i];
            if (item.file) {
              try {
                const uploadResponse = await uploadAPI.uploadProductImage(item.file, user.token);
                if (uploadResponse && uploadResponse.url) {
                  uploadedWithIndex.push({
                    url: uploadResponse.url,
                    public_id: uploadResponse.public_id,
                    originalIndex: i
                  });
                }
              } catch (uploadErr) {
                console.error('Errore upload immagine:', uploadErr);
              }
            }
          }
          // Ordina: l'immagine principale per prima
          updatedImages = uploadedWithIndex.sort((a, b) => {
            if (a.originalIndex === mainIndex) return -1;
            if (b.originalIndex === mainIndex) return 1;
            return a.originalIndex - b.originalIndex;
          }).map(({ url, public_id }) => ({ url, public_id }));
        } else {
          // Mantieni immagini esistenti e riordina
          updatedImages = eventImageItems
            .filter(item => item.file === null)
            .map((item, idx) => {
              const found = editingEvent.images.find(img => img.url === item.url);
              return found ? { url: found.url, public_id: found.public_id, originalIndex: idx } : null;
            })
            .filter(Boolean);
          
          // Ordina: l'immagine principale per prima
          updatedImages = updatedImages.sort((a, b) => {
            if (a.originalIndex === mainIndex) return -1;
            if (b.originalIndex === mainIndex) return 1;
            return a.originalIndex - b.originalIndex;
          }).map(({ url, public_id }) => ({ url, public_id }));
        }
      } else {
        // CREAZIONE NUOVO EVENTO
        const uploadedWithIndex = [];
        for (let i = 0; i < eventImageItems.length; i++) {
          const item = eventImageItems[i];
          if (item.file) {
            try {
              const uploadResponse = await uploadAPI.uploadProductImage(item.file, user.token);
              if (uploadResponse && uploadResponse.url) {
                uploadedWithIndex.push({
                  url: uploadResponse.url,
                  public_id: uploadResponse.public_id,
                  originalIndex: i
                });
              }
            } catch (uploadErr) {
              console.error('Errore upload immagine:', uploadErr);
            }
          }
        }
        
        // Ordina: l'immagine principale per prima
        updatedImages = uploadedWithIndex.sort((a, b) => {
          if (a.originalIndex === mainIndex) return -1;
          if (b.originalIndex === mainIndex) return 1;
          return a.originalIndex - b.originalIndex;
        }).map(({ url, public_id }) => ({ url, public_id }));
      }
        
      const dataToSave = {
        ...eventFormData,
        images: updatedImages
      };
      
      if (editingEvent) {
        await eventAPI.updateEvent(editingEvent._id, dataToSave, user.token);
        setEventSuccessMessage('Evento aggiornato con successo!');
      } else {
        await eventAPI.createEvent(dataToSave, user.token);
        setEventSuccessMessage('Evento creato con successo!');
      }
      
      await loadEvents();
      handleCloseEventModal();
      setShowEventSuccessModal(true);
    } catch (err) {
      showAlert('Errore: ' + err.message, 'error');
    } finally {
      setSavingEvent(false);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!confirm('Sei sicuro di voler eliminare questo evento?')) return;

    try {
      await eventAPI.deleteEvent(eventId, user.token);
      showAlert('Evento eliminato!', 'success');
      await loadEvents();
    } catch (err) {
      showAlert('Errore: ' + err.message, 'error');
    }
  };

  const handleToggleEventStatus = async (eventId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await eventAPI.updateEvent(eventId, { status: newStatus }, user.token);
      await loadEvents();
    } catch (err) {
      showAlert('Errore: ' + err.message, 'error');
    }
  };

  // Filtro venditori per nome o nome azienda
  const filteredSellers = allSellers.filter(seller => {
    const name = seller.name?.toLowerCase() || "";
    const business = seller.businessName?.toLowerCase() || "";
    return (
      name.includes(searchTerm.toLowerCase()) ||
      business.includes(searchTerm.toLowerCase())
    );
  });

  // Filtro esperienze per titolo o azienda
  const filteredExperiences = experiences.filter(experience => {
    const title = experience.title?.toLowerCase() || "";
    const company = experience.company?.toLowerCase() || "";
    return (
      title.includes(experienceSearchTerm.toLowerCase()) ||
      company.includes(experienceSearchTerm.toLowerCase())
    );
  });

  // Filtro eventi per titolo o azienda
  const filteredEvents = events.filter(event => {
    const title = event.title?.toLowerCase() || "";
    const company = event.company?.toLowerCase() || "";
    return (
      title.includes(eventSearchTerm.toLowerCase()) ||
      company.includes(eventSearchTerm.toLowerCase())
    );
  });

  // Paginazione venditori - 10 per pagina
  const sellersPerPage = 10;
  const totalSellersPages = Math.ceil(filteredSellers.length / sellersPerPage);
  const startIndex = (sellersPage - 1) * sellersPerPage;
  const endIndex = startIndex + sellersPerPage;
  const paginatedSellers = filteredSellers.slice(startIndex, endIndex);

  // Reset pagina quando cambia la ricerca
  useEffect(() => {
    setSellersPage(1);
  }, [searchTerm]);

  if (loading) {
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" />
        <p className="mt-3">Caricamento dashboard...</p>
      </Container>
    );
  }

  return (
    <Container className="py-5">
      <h2 className="mb-4">
        <span><i className="bi bi-shield-shaded text-primary"></i> Dashboard Admin</span>
      </h2>



      {error && <Alert variant="danger">{error}</Alert>}

      {/* Statistiche */}
      {stats && (
        <Row className="mb-4">
          <Col md={3} className="mb-3">
            <Card className="text-center">
              <Card.Body>
                <h3 className="text-primary">{stats.totalUsers}</h3>
                <p className="text-muted mb-0">Utenti Totali</p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3} className="mb-3">
            <Card className="text-center">
              <Card.Body>
                <h3 className="text-warning">{stats.pendingSellers}</h3>
                <p className="text-muted mb-0">Venditori in Attesa</p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3} className="mb-3">
            <Card className="text-center">
              <Card.Body>
                <h3 className="text-success">{stats.approvedSellers}</h3>
                <p className="text-muted mb-0">Venditori Approvati</p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3} className="mb-3">
            <Card className="text-center">
              <Card.Body>
                <h3 className="text-info">{stats.buyers || 0}</h3>
                <p className="text-muted mb-0">Buyer Registrati</p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Tabs per Venditori */}
      <Tabs 
        activeKey={activeTab}
        onSelect={handleTabChange}
        defaultActiveKey="pending-sellers" 
        className="mb-3"
      >
        {/* Tab Registra Azienda */}
        <Tab 
          eventKey="register-company" 
          title={<span><i className="bi bi-building-add text-primary"></i> Registra Azienda</span>}
        >
          <Card>
            <Card.Body>
              <RegisterCompanyForm />
            </Card.Body>
          </Card>
        </Tab>
        {/* Tab Venditori in Attesa */}
        <Tab 
          eventKey="pending-sellers" 
          title={
            <span>
              <span><i className="bi bi-hourglass-split text-warning"></i> Venditori in Attesa</span> 
              {pendingSellers.length > 0 && (
                <Badge bg="warning" className="ms-2">{pendingSellers.length}</Badge>
              )}
            </span>
          }
        >
          <Card>
            <Card.Body>
              {pendingSellers.length === 0 ? (
                <Alert variant="info">Nessun venditore in attesa di approvazione</Alert>
              ) : (
                <Table responsive hover>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Email</th>
                      <th>Azienda</th>
                      <th>P.IVA</th>
                      <th>Data Registrazione</th>
                      <th>Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingSellers.map((seller) => (
                      <tr key={seller._id}>
                        <td>{seller.name}</td>
                        <td>{seller.email}</td>
                        <td>
                          {seller.businessName ? (
                            <span 
                              style={{ 
                                color: '#0d6efd', 
                                cursor: 'pointer',
                                textDecoration: 'underline'
                              }}
                              onClick={() => navigate(`/shop/${seller.slug || seller._id}`)}
                            >
                              {seller.businessName}
                            </span>
                          ) : '-'}
                        </td>
                        <td>{seller.vatNumber || '-'}</td>
                        <td>{new Date(seller.createdAt).toLocaleDateString('it-IT')}</td>
                        <td>
                          <Button
                            variant="success"
                            size="sm"
                            className="me-2"
                            onClick={() => handleApprove(seller._id)}
                            disabled={actionLoading === seller._id}
                          >
                            {actionLoading === seller._id ? <Spinner animation="border" size="sm" /> : '✓ Approva'}
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleReject(seller._id)}
                            disabled={actionLoading === seller._id}
                          >
                            {actionLoading === seller._id ? <Spinner animation="border" size="sm" /> : '✗ Rifiuta'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Tab>

        {/* Tab Tutti i Venditori */}
        <Tab eventKey="all" title={<span><i className="bi bi-person-lines-fill text-success"></i> Tutti i Venditori</span>}>
          <Card>
            <Card.Body>
              <div className="mb-3 d-flex align-items-center justify-content-between flex-wrap">
                <div className="mb-2 mb-md-0">
                  <strong>Ricerca per nome o azienda:</strong>
                  <input
                    type="text"
                    className="form-control d-inline-block ms-2"
                    style={{ width: 260, maxWidth: '100%' }}
                    placeholder="Cerca venditore..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              {filteredSellers.length === 0 ? (
                <Alert variant="info">Nessun venditore trovato</Alert>
              ) : (
                <Table responsive hover>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Email</th>
                      <th>Azienda</th>
                      <th>P.IVA</th>
                      <th>Stato</th>
                      <th>Stato Abbonamento</th>
                      <th>Rinnovo Automatico</th>
                      <th>Documenti Allegati</th>
                      <th>Data Registrazione</th>
                      <th>Data Scadenza Abbonamento</th>
                      <th>Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedSellers.map((seller) => (
                      <tr key={seller._id}>
                        <td>{seller.name}</td>
                        <td>{seller.email}</td>
                        <td>
                          {seller.businessName ? (
                            <span 
                              style={{ 
                                color: '#0d6efd', 
                                cursor: 'pointer',
                                textDecoration: 'underline'
                              }}
                              onClick={() => navigate(`/vendor/profile?sellerId=${seller._id}`)}
                            >
                              {seller.businessName}
                            </span>
                          ) : '-'}
                        </td>
                        <td>{seller.vatNumber || '-'}</td>
                        <td>
                          {seller.isApproved ? (
                            <Badge bg="success">✓ Approvato</Badge>
                          ) : (
                            <Badge bg="warning">⏳ In Attesa</Badge>
                          )}
                        </td>
                        <td>
                          {/* Stato Abbonamento: pallino verde se subscriptionPaid true, rosso altrimenti */}
                          {seller.subscriptionPaid ? (
                            <span title="Abbonamento attivo" style={{ color: 'green', fontSize: '1.5em' }}>●</span>
                          ) : (
                            <span title="Abbonamento non attivo" style={{ color: 'red', fontSize: '1.5em' }}>●</span>
                          )}
                        </td>
                        <td>
                          {/* Switch Rinnovo Automatico */}
                          <div className="form-check form-switch" style={{ fontSize: '1.2em' }}>
                            <input
                              className="form-check-input"
                              type="checkbox"
                              role="switch"
                              checked={!seller.subscriptionSuspended}
                              onChange={() => handleToggleRenewal(seller._id, seller.subscriptionSuspended)}
                              style={{ cursor: 'pointer' }}
                              title={seller.subscriptionSuspended ? 'Rinnovo sospeso - Clicca per attivare' : 'Rinnovo attivo - Clicca per sospendere'}
                            />
                            <label className="form-check-label" style={{ fontSize: '0.85em', marginLeft: '0.3em' }}>
                              {seller.subscriptionSuspended ? 'OFF' : 'ON'}
                            </label>
                          </div>
                        </td>
                        <td>
                          {/* Documenti Allegati: upload PDF + lista file */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5em' }}>
                            <form
                              onSubmit={async (e) => {
                                e.preventDefault();
                                const files = e.target.elements[`pdf_${seller._id}`].files;
                                if (!files.length) {
                                  showAlert('Seleziona almeno un file PDF', 'warning');
                                  return;
                                }
                                try {
                                  for (let i = 0; i < files.length; i++) {
                                    await window.uploadVendorDocument(seller._id, files[i]);
                                  }
                                  showAlert('Documenti caricati!', 'success');
                                  // Aggiorna la lista documenti dopo upload
                                  try {
                                    const res = await adminAPI.getVendorDocuments(seller._id, user.token);
                                    setVendorDocs((prev) => ({ ...prev, [seller._id]: res.files || [] }));
                                  } catch {}
                                } catch (err) {
                                  showAlert('Errore upload: ' + err.message, 'error');
                                }
                              }}
                              style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}
                            >
                              <input
                                type="file"
                                accept="application/pdf"
                                name={`pdf_${seller._id}`}
                                style={{ width: '180px' }}
                                multiple
                              />
                              <Button type="submit" size="sm" variant="secondary">Carica</Button>
                            </form>
                            {/* Lista file PDF allegati */}
                            {vendorDocs[seller._id] && vendorDocs[seller._id].length > 0 ? (
                              <ul style={{ margin: 0, paddingLeft: '1em', fontSize: '0.95em' }}>
                                {vendorDocs[seller._id].map((file, idx) => (
                                  <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5em', marginBottom: '0.3em' }}>
                                    <a href={file.url} target="_blank" rel="noopener noreferrer">
                                      {file.name || file.url.split('/').pop()}
                                    </a>
                                    <Button 
                                      size="sm" 
                                      variant="outline-danger" 
                                      style={{ padding: '0.1rem 0.4rem', fontSize: '0.75rem' }}
                                      onClick={() => handleDeleteDocument(seller._id, file.filename)}
                                      title="Elimina documento"
                                    >
                                      <i className="bi bi-trash"></i>
                                    </Button>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span style={{ color: '#888', fontSize: '0.95em' }}>Nessun documento</span>
                            )}
                          </div>
                        </td>
                        <td>{new Date(seller.createdAt).toLocaleDateString('it-IT')}</td>
                        <td>{seller.subscriptionEndDate ? new Date(seller.subscriptionEndDate).toLocaleDateString('it-IT') : '-'}</td>
                        <td>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteSeller(seller._id, seller.name || seller.email)}
                            disabled={actionLoading === seller._id}
                            title="Elimina venditore definitivamente"
                          >
                            {actionLoading === seller._id ? (
                              <Spinner animation="border" size="sm" />
                            ) : (
                              <>
                                <i className="bi bi-trash"></i> Elimina
                              </>
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
              
              {/* Paginazione venditori */}
              {totalSellersPages > 1 && (
                <Row className="mt-4">
                  <Col className="d-flex justify-content-center align-items-center gap-3">
                    <Button
                      variant="outline-primary"
                      disabled={sellersPage === 1}
                      onClick={() => { window.scrollTo(0, 0); setSellersPage(sellersPage - 1); }}
                      className="pagination-btn"
                    >
                      ← Precedente
                    </Button>
                    <span className="text-muted">
                      Pagina <strong>{sellersPage}</strong> di <strong>{totalSellersPages}</strong> ({filteredSellers.length} venditori totali)
                    </span>
                    <Button
                      variant="outline-primary"
                      disabled={sellersPage >= totalSellersPages}
                      onClick={() => { window.scrollTo(0, 0); setSellersPage(sellersPage + 1); }}
                      className="pagination-btn"
                    >
                      Successiva →
                    </Button>
                  </Col>
                </Row>
              )}
            </Card.Body>
          </Card>
        </Tab>

        {/* Tab News */}
        <Tab eventKey="news" title={<span><i className="bi bi-megaphone text-info"></i> News</span>}>
          <Card>
            <Card.Header>
              <h5><i className="bi bi-megaphone me-2"></i>Gestione News</h5>
              <small className="text-muted">Le news attive verranno mostrate nella pagina Catalogo</small>
            </Card.Header>
            <Card.Body>
              {/* Form creazione/modifica news */}
              <Form onSubmit={handleSaveNews} className="mb-4 p-3 border rounded">
                <h6>{editingNewsId ? 'Modifica News' : 'Crea Nuova News'}</h6>
                <Form.Group className="mb-3">
                  <Form.Label>Contenuto</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={newsContent}
                    onChange={(e) => setNewsContent(e.target.value)}
                    placeholder="Contenuto della news (max 500 caratteri)"
                    maxLength={500}
                  />
                  <Form.Text className="text-muted">
                    {newsContent.length}/500 caratteri
                  </Form.Text>
                </Form.Group>
                <div className="d-flex gap-2">
                  <Button type="submit" variant="primary" disabled={savingNews}>
                    {savingNews ? <Spinner size="sm" /> : (editingNewsId ? 'Aggiorna' : 'Crea')}
                  </Button>
                  {editingNewsId && (
                    <Button 
                      variant="secondary" 
                      onClick={() => {
                        setEditingNewsId(null);
                        setNewsContent('');
                      }}
                    >
                      Annulla
                    </Button>
                  )}
                </div>
              </Form>

              {/* Lista news esistenti */}
              <h6 className="mb-3">News Esistenti ({adminNews.length})</h6>
              {adminNews.length === 0 ? (
                <Alert variant="info">Nessuna news presente. Creane una!</Alert>
              ) : (
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>Contenuto</th>
                      <th>Stato</th>
                      <th>Creata il</th>
                      <th>Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminNews.map(news => (
                      <tr key={news._id}>
                        <td>{news.content}</td>
                        <td>
                          <Badge bg={news.isActive ? 'success' : 'secondary'}>
                            {news.isActive ? 'Attiva' : 'Inattiva'}
                          </Badge>
                        </td>
                        <td>{new Date(news.createdAt).toLocaleDateString('it-IT')}</td>
                        <td>
                          <div className="d-flex gap-1">
                            <Button
                              size="sm"
                              variant={news.isActive ? 'warning' : 'success'}
                              onClick={() => handleToggleNewsActive(news._id, news.isActive)}
                              title={news.isActive ? 'Disattiva' : 'Attiva'}
                            >
                              <i className={`bi bi-${news.isActive ? 'eye-slash' : 'eye'}`}></i>
                            </Button>
                            <Button
                              size="sm"
                              variant="info"
                              onClick={() => handleEditNews(news)}
                              title="Modifica"
                            >
                              <i className="bi bi-pencil"></i>
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleDeleteNews(news._id)}
                              title="Elimina"
                            >
                              <i className="bi bi-trash"></i>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Tab>

        {/* Tab Sponsor */}
        <Tab eventKey="sponsors" title={<span><i className="bi bi-award text-warning"></i> Sponsor</span>}>
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <div>
                <h5><i className="bi bi-award me-2"></i>Gestione Sponsor</h5>
                <small className="text-muted">Gestisci gli sponsor della piattaforma</small>
              </div>
              <Button variant="primary" onClick={() => handleOpenSponsorModal()}>
                <i className="bi bi-plus-circle me-2"></i>Aggiungi Sponsor
              </Button>
            </Card.Header>
            <Card.Body>
              {sponsors.length === 0 ? (
                <Alert variant="info">Nessuno sponsor presente</Alert>
              ) : (
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>Logo</th>
                      <th>Nome</th>
                      <th>Città</th>
                      <th>Telefono</th>
                      <th>Tier</th>
                      <th>Status</th>
                      <th>Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sponsors.map((sponsor) => (
                      <tr key={sponsor._id}>
                        <td>
                          {sponsor.logo ? (
                            <img 
                              src={sponsor.logo} 
                              alt={sponsor.name}
                              style={{ width: '50px', height: '50px', objectFit: 'contain' }}
                            />
                          ) : (
                            <div style={{ width: '50px', height: '50px', backgroundColor: '#f0f0f0', borderRadius: '4px' }} />
                          )}
                        </td>
                        <td><strong>{sponsor.name}</strong></td>
                        <td>{sponsor.city}</td>
                        <td>{sponsor.phone}</td>
                        <td>
                          <Badge bg={
                            sponsor.tier === 'Main' ? 'danger' :
                            sponsor.tier === 'Premium' ? 'warning' :
                            sponsor.tier === 'Official' ? 'info' :
                            'secondary'
                          }>
                            {sponsor.tier}
                          </Badge>
                        </td>
                        <td>
                          <Badge bg={sponsor.status === 'active' ? 'success' : 'secondary'}>
                            {sponsor.status === 'active' ? 'Attivo' : 'Inattivo'}
                          </Badge>
                        </td>
                        <td>
                          <div className="d-flex gap-2">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => handleOpenSponsorModal(sponsor)}
                            >
                              <i className="bi bi-pencil"></i>
                            </Button>
                            <Button
                              variant={sponsor.status === 'active' ? 'outline-warning' : 'outline-success'}
                              size="sm"
                              onClick={() => handleToggleSponsorStatus(sponsor._id, sponsor.status)}
                            >
                              <i className={`bi bi-${sponsor.status === 'active' ? 'pause' : 'play'}`}></i>
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleDeleteSponsor(sponsor._id)}
                            >
                              <i className="bi bi-trash"></i>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Tab>

        {/* Tab Esperienze */}
        <Tab eventKey="experiences" title={<span><i className="bi bi-calendar-event text-success"></i> Esperienze</span>}>
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <div>
                <h5><i className="bi bi-calendar-event me-2"></i>Gestione Esperienze</h5>
                <small className="text-muted">Gestisci i pacchetti esperienze della piattaforma</small>
              </div>
              <Button variant="primary" onClick={() => handleOpenExperienceModal()}>
                <i className="bi bi-plus-circle me-2"></i>Aggiungi Esperienza
              </Button>
            </Card.Header>
            <Card.Body>
              <div className="mb-3 d-flex align-items-center">
                <strong>Ricerca per nome o azienda:</strong>
                <input
                  type="text"
                  className="form-control d-inline-block ms-2"
                  style={{ width: 260, maxWidth: '100%' }}
                  placeholder="Cerca esperienza..."
                  value={experienceSearchTerm}
                  onChange={e => setExperienceSearchTerm(e.target.value)}
                />
              </div>
              {filteredExperiences.length === 0 ? (
                <Alert variant="info">Nessuna esperienza trovata</Alert>
              ) : (
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>Immagine</th>
                      <th>Titolo</th>
                      <th>Azienda</th>
                      <th>Città</th>
                      <th>Categoria</th>
                      <th>Status</th>
                      <th>Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExperiences.map((experience) => (
                      <tr key={experience._id}>
                        <td>
                          {experience.images && experience.images.length > 0 ? (
                            <img 
                              src={CloudinaryPresets.thumbnail(experience.images[0].url)}
                              alt={experience.title}
                              style={{ width: '80px', height: '50px', objectFit: 'cover', borderRadius: '4px' }}
                              loading="lazy"
                            />
                          ) : (
                            <div style={{ width: '80px', height: '50px', backgroundColor: '#f0f0f0', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <i className="bi bi-calendar-event" style={{ fontSize: '1.5rem', color: '#6c757d' }}></i>
                            </div>
                          )}
                        </td>
                        <td><strong>{experience.title}</strong></td>
                        <td>{experience.company}</td>
                        <td>{experience.city}</td>
                        <td>
                          {experience.categories && experience.categories.length > 0 ? (
                            experience.categories.map((cat) => (
                              <Badge key={cat} bg="info" className="me-1 mb-1" style={{ fontSize: '0.7rem' }}>
                                {cat}
                              </Badge>
                            ))
                          ) : experience.category ? (
                            <Badge bg="info" style={{ fontSize: '0.75rem' }}>
                              {experience.category}
                            </Badge>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td>
                          <Badge bg={experience.status === 'active' ? 'success' : 'secondary'}>
                            {experience.status === 'active' ? 'Attivo' : 'Inattivo'}
                          </Badge>
                        </td>
                        <td>
                          <div className="d-flex gap-2">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => handleOpenExperienceModal(experience)}
                            >
                              <i className="bi bi-pencil"></i>
                            </Button>
                            <Button
                              variant={experience.status === 'active' ? 'outline-warning' : 'outline-success'}
                              size="sm"
                              onClick={() => handleToggleExperienceStatus(experience._id, experience.status)}
                            >
                              <i className={`bi bi-${experience.status === 'active' ? 'pause' : 'play'}`}></i>
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleDeleteExperience(experience._id)}
                            >
                              <i className="bi bi-trash"></i>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Tab>

        {/* TAB GESTIONE EVENTI */}
        <Tab eventKey="events" title={<span><i className="bi bi-calendar3 text-primary"></i> Eventi</span>}>
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <div>
                <h5><i className="bi bi-calendar3 me-2"></i>Gestione Eventi</h5>
                <small className="text-muted">Gestisci gli eventi della piattaforma</small>
              </div>
              <Button variant="primary" onClick={() => handleOpenEventModal()}>
                <i className="bi bi-plus-circle me-2"></i>Aggiungi Evento
              </Button>
            </Card.Header>
            <Card.Body>
              <div className="mb-3 d-flex align-items-center">
                <strong>Ricerca per nome o azienda:</strong>
                <input
                  type="text"
                  className="form-control d-inline-block ms-2"
                  style={{ width: 260, maxWidth: '100%' }}
                  placeholder="Cerca evento..."
                  value={eventSearchTerm}
                  onChange={e => setEventSearchTerm(e.target.value)}
                />
              </div>
              {filteredEvents.length === 0 ? (
                <Alert variant="info">Nessun evento trovato</Alert>
              ) : (
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>Immagine</th>
                      <th>Titolo</th>
                      <th>Azienda</th>
                      <th>Città</th>
                      <th>Data</th>
                      <th>Ora</th>
                      <th>Categoria</th>
                      <th>Status</th>
                      <th>Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.map((event) => (
                      <tr key={event._id}>
                        <td>
                          {event.images && event.images.length > 0 ? (
                            <img 
                              src={CloudinaryPresets.thumbnail(event.images[0].url)}
                              alt={event.title}
                              style={{ width: '80px', height: '50px', objectFit: 'cover', borderRadius: '4px' }}
                              loading="lazy"
                            />
                          ) : (
                            <div style={{ width: '80px', height: '50px', backgroundColor: '#f0f0f0', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <i className="bi bi-calendar3" style={{ fontSize: '1.5rem', color: '#6c757d' }}></i>
                            </div>
                          )}
                        </td>
                        <td><strong>{event.title}</strong></td>
                        <td>{event.company}</td>
                        <td>{event.city}</td>
                        <td>
                          {event.eventDates && event.eventDates.length > 0 ? (
                            <div className="d-flex align-items-center gap-1">
                              <span>{new Date(event.eventDates[0]).toLocaleDateString('it-IT')}</span>
                              {event.eventDates.length > 1 && (
                                <Badge bg="secondary" style={{ fontSize: '0.7rem' }}>
                                  +{event.eventDates.length - 1}
                                </Badge>
                              )}
                            </div>
                          ) : '-'}
                        </td>
                        <td>{event.eventTime || '-'}</td>
                        <td>
                          <div className="d-flex flex-wrap gap-1">
                            {event.categories && event.categories.length > 0 ? (
                              event.categories.map((cat, idx) => (
                                <Badge key={idx} bg="info" style={{ fontSize: '0.7rem' }}>
                                  {cat}
                                </Badge>
                              ))
                            ) : (
                              <Badge bg="secondary" style={{ fontSize: '0.7rem' }}>
                                Nessuna
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td>
                          <Badge bg={event.status === 'active' ? 'success' : 'secondary'}>
                            {event.status === 'active' ? 'Attivo' : 'Inattivo'}
                          </Badge>
                        </td>
                        <td>
                          <div className="d-flex gap-2">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => handleOpenEventModal(event)}
                            >
                              <i className="bi bi-pencil"></i>
                            </Button>
                            <Button
                              variant={event.status === 'active' ? 'outline-warning' : 'outline-success'}
                              size="sm"
                              onClick={() => handleToggleEventStatus(event._id, event.status)}
                            >
                              <i className={`bi bi-${event.status === 'active' ? 'pause' : 'play'}`}></i>
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleDeleteEvent(event._id)}
                            >
                              <i className="bi bi-trash"></i>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Tab>

        {/* TAB PANNELLO PAGAMENTI */}
        <Tab eventKey="payments" title={<><i className="bi bi-cash-stack me-2"></i>Pagamenti Venditori</>}>
          <Card>
            <Card.Header>
              <div>
                <h5><i className="bi bi-cash-stack me-2"></i>Pannello Controllo Pagamenti</h5>
                <small className="text-muted">Monitora i pagamenti ai venditori, statistiche e transfer</small>
              </div>
            </Card.Header>
            <Card.Body>
              <p className="mb-4">
                Accedi al pannello completo per gestire tutti i pagamenti ai venditori, visualizzare statistiche dettagliate
                e monitorare i transfer Stripe.
              </p>
              
              <div className="d-grid gap-2">
                <Button 
                  variant="primary" 
                  size="lg"
                  onClick={() => window.location.href = '/admin/payment-control'}
                  className="d-flex align-items-center justify-content-center"
                >
                  <i className="bi bi-box-arrow-up-right me-2"></i>
                  Apri Pannello Controllo Pagamenti
                </Button>
              </div>

              <hr className="my-4" />

              <Row className="text-center">
                <Col md={4}>
                  <div className="p-3">
                    <i className="bi bi-clock-history fs-1 text-warning mb-2"></i>
                    <h6 className="text-muted">Payouts Pending</h6>
                    <p className="small">Visualizza tutti i pagamenti in attesa (&gt;14 giorni)</p>
                  </div>
                </Col>
                <Col md={4}>
                  <div className="p-3">
                    <i className="bi bi-graph-up fs-1 text-success mb-2"></i>
                    <h6 className="text-muted">Statistiche</h6>
                    <p className="small">Totali pagati, da pagare, transfer falliti, fee</p>
                  </div>
                </Col>
                <Col md={4}>
                  <div className="p-3">
                    <i className="bi bi-funnel fs-1 text-info mb-2"></i>
                    <h6 className="text-muted">Filtri Avanzati</h6>
                    <p className="small">Filtra per venditore, data, status e altro</p>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Tab>

        {/* TAB REGISTRO CONSENSI COOKIE */}
        <Tab eventKey="cookie-consent" title={<><i className="bi bi-shield-lock me-2"></i>Registro Cookie</>}>
          <Card>
            <Card.Header className="bg-dark text-white">
              <div>
                <h5><i className="bi bi-shield-lock-fill me-2"></i>Registro Consensi Cookie (INTERNO)</h5>
                <small>Registro interno per accountability e conformità GDPR</small>
              </div>
            </Card.Header>
            <Card.Body>
              <Alert variant="info">
                <i className="bi bi-info-circle-fill me-2"></i>
                <strong>Registro Interno:</strong> Questa sezione contiene il log completo di tutti i consensi 
                cookie raccolti dagli utenti. Accessibile solo agli amministratori per scopi di conformità GDPR 
                e dimostrare la validità dei consensi in caso di controlli o contestazioni.
              </Alert>

              <p className="mb-4">
                Visualizza tutti i consensi registrati con dettagli su:
              </p>

              <Row className="mb-4">
                <Col md={6}>
                  <ul>
                    <li><strong>Data e ora</strong> del consenso</li>
                    <li><strong>Utente</strong> (autenticato o anonimo)</li>
                    <li><strong>Azione</strong> (accetta/rifiuta/personalizza)</li>
                    <li><strong>Preferenze dettagliate</strong> per categoria</li>
                  </ul>
                </Col>
                <Col md={6}>
                  <ul>
                    <li><strong>IP hashato</strong> (privacy protected)</li>
                    <li><strong>Metodo</strong> (banner/centro preferenze)</li>
                    <li><strong>Versione policy</strong> accettata</li>
                    <li><strong>Statistiche aggregate</strong></li>
                  </ul>
                </Col>
              </Row>
              
              <div className="d-grid gap-2">
                <Button 
                  variant="dark" 
                  size="lg"
                  onClick={() => window.location.href = '/admin/cookie-consent'}
                  className="d-flex align-items-center justify-content-center"
                >
                  <i className="bi bi-box-arrow-up-right me-2"></i>
                  Apri Registro Consensi Cookie
                </Button>
              </div>

              <hr className="my-4" />

              <Row className="text-center">
                <Col md={4}>
                  <div className="p-3">
                    <i className="bi bi-people-fill fs-1 text-primary mb-2"></i>
                    <h6 className="text-muted">Tutti i Consensi</h6>
                    <p className="small">Visualizza registro completo con filtri avanzati</p>
                  </div>
                </Col>
                <Col md={4}>
                  <div className="p-3">
                    <i className="bi bi-graph-up-arrow fs-1 text-success mb-2"></i>
                    <h6 className="text-muted">Statistiche</h6>
                    <p className="small">Analytics accettati, marketing, totali ultimi 30gg</p>
                  </div>
                </Col>
                <Col md={4}>
                  <div className="p-3">
                    <i className="bi bi-shield-check fs-1 text-info mb-2"></i>
                    <h6 className="text-muted">Conformità GDPR</h6>
                    <p className="small">Dati conservati per audit e accountability</p>
                  </div>
                </Col>
              </Row>

              <Alert variant="warning" className="mt-3 mb-0">
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                <small>
                  <strong>Nota:</strong> I dati del registro devono essere conservati per almeno 12-24 mesi 
                  per dimostrare la conformità GDPR. L'accesso è limitato agli amministratori.
                </small>
              </Alert>
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>

      {/* Modal Sponsor */}
      <Modal show={showSponsorModal} onHide={handleCloseSponsorModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editingSponsor ? 'Modifica Sponsor' : 'Nuovo Sponsor'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSaveSponsor}>
          <Modal.Body>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Nome *</Form.Label>
                  <Form.Control
                    type="text"
                    value={sponsorFormData.name}
                    onChange={(e) => setSponsorFormData({ ...sponsorFormData, name: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Città *</Form.Label>
                  <Form.Control
                    type="text"
                    value={sponsorFormData.city}
                    onChange={(e) => setSponsorFormData({ ...sponsorFormData, city: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            
            <Form.Group className="mb-3">
              <Form.Label>Descrizione *</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                maxLength={500}
                value={sponsorFormData.description}
                onChange={(e) => setSponsorFormData({ ...sponsorFormData, description: e.target.value })}
                required
              />
              <Form.Text className="text-muted">
                {sponsorFormData.description.length}/500 caratteri
              </Form.Text>
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Telefono *</Form.Label>
                  <Form.Control
                    type="text"
                    value={sponsorFormData.phone}
                    onChange={(e) => setSponsorFormData({ ...sponsorFormData, phone: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Sito Web *</Form.Label>
                  <Form.Control
                    type="url"
                    value={sponsorFormData.website}
                    onChange={(e) => setSponsorFormData({ ...sponsorFormData, website: e.target.value })}
                    placeholder="https://esempio.it"
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Logo</Form.Label>
              <Form.Control
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    setSponsorLogoFile(file);
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setSponsorLogoPreview(reader.result);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              {(sponsorLogoPreview || sponsorFormData.logo) && (
                <div className="mt-2 position-relative d-inline-block">
                  <img 
                    src={sponsorLogoPreview || sponsorFormData.logo} 
                    alt="Preview" 
                    style={{ maxWidth: '200px', maxHeight: '100px', objectFit: 'contain', border: '1px solid #ddd', borderRadius: 8 }}
                    onError={(e) => e.target.style.display = 'none'}
                  />
                  <button
                    type="button"
                    aria-label="Rimuovi immagine"
                    onClick={() => {
                      setSponsorLogoFile(null);
                      setSponsorLogoPreview('');
                      setSponsorFormData({ ...sponsorFormData, logo: '' });
                    }}
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      background: 'rgba(255,255,255,0.85)',
                      border: 'none',
                      borderRadius: '50%',
                      width: 28,
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.12)'
                    }}
                  >
                    <span style={{ color: '#d32f2f', fontSize: 20, fontWeight: 700, lineHeight: 1 }}>&times;</span>
                  </button>
                </div>
              )}
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Livello *</Form.Label>
                  <Form.Select
                    value={sponsorFormData.tier}
                    onChange={(e) => setSponsorFormData({ ...sponsorFormData, tier: e.target.value })}
                    required
                  >
                    <option value="Main">Main</option>
                    <option value="Premium">Premium</option>
                    <option value="Official">Official</option>
                    <option value="Support">Support</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Stato *</Form.Label>
                  <Form.Select
                    value={sponsorFormData.status}
                    onChange={(e) => setSponsorFormData({ ...sponsorFormData, status: e.target.value })}
                    required
                  >
                    <option value="active">Attivo</option>
                    <option value="inactive">Inattivo</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseSponsorModal}>
              Annulla
            </Button>
            <Button variant="primary" type="submit" disabled={savingSponsor}>
              {savingSponsor ? 'Salvataggio...' : 'Salva'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal Successo Sponsor */}
      <Modal show={showSponsorSuccessModal} onHide={() => setShowSponsorSuccessModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-check-circle-fill text-success me-2"></i>
            Operazione completata
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-0">{sponsorSuccessMessage}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={() => setShowSponsorSuccessModal(false)}>
            OK
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Esperienza */}
      <Modal show={showExperienceModal} onHide={handleCloseExperienceModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editingExperience ? 'Modifica Esperienza' : 'Nuova Esperienza'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSaveExperience}>
          <Modal.Body>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Titolo *</Form.Label>
                  <Form.Control
                    type="text"
                    value={experienceFormData.title}
                    onChange={(e) => setExperienceFormData({ ...experienceFormData, title: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Città *</Form.Label>
                  <Form.Control
                    type="text"
                    value={experienceFormData.city}
                    onChange={(e) => setExperienceFormData({ ...experienceFormData, city: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            
            <Form.Group className="mb-3">
              <Form.Label>Indirizzo (opzionale)</Form.Label>
              <Form.Control
                type="text"
                value={experienceFormData.address}
                onChange={(e) => setExperienceFormData({ ...experienceFormData, address: e.target.value })}
                placeholder="Via, numero civico"
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Descrizione *</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                maxLength={1000}
                value={experienceFormData.description}
                onChange={(e) => setExperienceFormData({ ...experienceFormData, description: e.target.value })}
                required
              />
              <Form.Text className="text-muted">
                {experienceFormData.description.length}/1000 caratteri
              </Form.Text>
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Azienda *</Form.Label>
                  <Form.Control
                    type="text"
                    value={experienceFormData.company}
                    onChange={(e) => setExperienceFormData({ ...experienceFormData, company: e.target.value })}
                    placeholder="Nome azienda"
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Contatti *</Form.Label>
                  <Form.Control
                    type="text"
                    value={experienceFormData.phone}
                    onChange={(e) => setExperienceFormData({ ...experienceFormData, phone: e.target.value })}
                    placeholder="Numero di telefono"
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Categorie * (selezionane almeno una)</Form.Label>
              <div className="border rounded p-3" style={{ backgroundColor: '#f8f9fa' }}>
                {['Enogastronomiche', 'Outdoor & Natura', 'Cultura & Tradizioni', 'Sport & Benessere', 'Family & Educational', 'Tour & Attività speciali', 'Ospitalità'].map((category) => (
                  <Form.Check
                    key={category}
                    type="checkbox"
                    id={`experience-category-${category.replace(/\s+/g, '-')}`}
                    label={category}
                    checked={experienceFormData.categories.includes(category)}
                    onChange={(e) => {
                      const newCategories = e.target.checked
                        ? [...experienceFormData.categories, category]
                        : experienceFormData.categories.filter(c => c !== category);
                      setExperienceFormData({ ...experienceFormData, categories: newCategories });
                    }}
                    className="mb-2"
                  />
                ))}
              </div>
              {experienceFormData.categories.length > 0 && (
                <div className="mt-2">
                  <small className="text-muted">Categorie selezionate:</small>
                  <div className="mt-1">
                    {experienceFormData.categories.map((cat) => (
                      <Badge 
                        key={cat} 
                        bg="primary" 
                        className="me-1 mb-1"
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          const newCategories = experienceFormData.categories.filter(c => c !== cat);
                          setExperienceFormData({ ...experienceFormData, categories: newCategories });
                        }}
                      >
                        {cat} ×
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Sito Web</Form.Label>
              <Form.Control
                type="url"
                value={experienceFormData.website}
                onChange={(e) => setExperienceFormData({ ...experienceFormData, website: e.target.value })}
                placeholder="https://esempio.it"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Immagini</Form.Label>
              <Form.Control
                type="file"
                accept="image/*"
                multiple
                onChange={handleExperienceImageChange}
              />
              <Form.Text className="text-muted">
                Carica una o più immagini. La prima immagine con la stella sarà quella principale mostrata nelle card.
              </Form.Text>
              
              {/* Preview immagini */}
              {experienceImageItems.length > 0 && (
                <div className="mt-3" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {experienceImageItems.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: 'relative',
                        width: '120px',
                        height: '120px',
                        border: item.isMain ? '3px solid #ffc107' : '1px solid #ddd',
                        borderRadius: '8px',
                        overflow: 'hidden'
                      }}
                    >
                      <img
                        src={item.url}
                        alt={`Preview ${idx + 1}`}
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'cover'
                        }}
                      />
                      {item.isMain && (
                        <span
                          style={{
                            position: 'absolute',
                            bottom: 4,
                            left: 4,
                            background: '#ffc107',
                            color: '#000',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 'bold'
                          }}
                        >
                          PRINCIPALE
                        </span>
                      )}
                      {/* Pulsante stella per impostare come principale */}
                      <button
                        type="button"
                        onClick={() => handleExperienceSetAsMain(idx)}
                        style={{
                          position: 'absolute',
                          top: 4,
                          left: 4,
                          background: item.isMain ? '#ffc107' : 'rgba(255,255,255,0.9)',
                          border: 'none',
                          borderRadius: '50%',
                          width: 26,
                          height: 26,
                          cursor: 'pointer',
                          fontSize: '14px',
                          lineHeight: '26px',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                        }}
                        title="Imposta come principale"
                      >★</button>
                      {/* Pulsante elimina */}
                      <button
                        type="button"
                        onClick={() => handleExperienceRemoveImage(idx)}
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          background: 'rgba(255,255,255,0.9)',
                          border: 'none',
                          borderRadius: '50%',
                          width: 26,
                          height: 26,
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          color: '#d00',
                          lineHeight: '26px',
                          padding: 0,
                          fontSize: '18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                        }}
                        title="Rimuovi immagine"
                      >&times;</button>
                    </div>
                  ))}
                </div>
              )}
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Stato *</Form.Label>
              <Form.Select
                value={experienceFormData.status}
                onChange={(e) => setExperienceFormData({ ...experienceFormData, status: e.target.value })}
                required
              >
                <option value="active">Attivo</option>
                <option value="inactive">Inattivo</option>
              </Form.Select>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseExperienceModal}>
              Annulla
            </Button>
            <Button variant="primary" type="submit" disabled={savingExperience}>
              {savingExperience ? 'Salvataggio...' : 'Salva'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal Successo Esperienza */}
      <Modal show={showExperienceSuccessModal} onHide={() => setShowExperienceSuccessModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-check-circle-fill text-success me-2"></i>
            Operazione completata
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-0">{experienceSuccessMessage}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={() => setShowExperienceSuccessModal(false)}>
            OK
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Gestione Eventi */}
      <Modal show={showEventModal} onHide={handleCloseEventModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editingEvent ? 'Modifica Evento' : 'Nuovo Evento'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSaveEvent}>
          <Modal.Body>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Titolo *</Form.Label>
                  <Form.Control
                    type="text"
                    value={eventFormData.title}
                    onChange={(e) => setEventFormData({ ...eventFormData, title: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Città *</Form.Label>
                  <Form.Control
                    type="text"
                    value={eventFormData.city}
                    onChange={(e) => setEventFormData({ ...eventFormData, city: e.target.value })}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            
            <Form.Group className="mb-3">
              <Form.Label>Indirizzo (opzionale)</Form.Label>
              <Form.Control
                type="text"
                value={eventFormData.address}
                onChange={(e) => setEventFormData({ ...eventFormData, address: e.target.value })}
                placeholder="Via, numero civico"
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Descrizione *</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                maxLength={1000}
                value={eventFormData.description}
                onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })}
                required
              />
              <Form.Text className="text-muted">
                {eventFormData.description.length}/1000 caratteri
              </Form.Text>
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Azienda Organizzatrice *</Form.Label>
                  <Form.Control
                    type="text"
                    value={eventFormData.company}
                    onChange={(e) => setEventFormData({ ...eventFormData, company: e.target.value })}
                    placeholder="Nome azienda"
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Contatti (opzionale)</Form.Label>
                  <Form.Control
                    type="text"
                    value={eventFormData.phone}
                    onChange={(e) => setEventFormData({ ...eventFormData, phone: e.target.value })}
                    placeholder="Numero di telefono"
                  />
                </Form.Group>
              </Col>
            </Row>

            {/* CALENDARIO SELEZIONE DATE */}
            <Form.Group className="mb-3">
              <Form.Label>Date Evento * (clicca per selezionare/deselezionare)</Form.Label>
              <Card className="shadow-sm">
                <Card.Header style={{ backgroundColor: '#004b75', color: 'white', padding: '0.75rem' }}>
                  <div className="d-flex justify-content-between align-items-center">
                    <Button 
                      variant="link" 
                      className="text-white p-0"
                      onClick={() => changeEventCalendarMonth(-1)}
                      type="button"
                    >
                      <i className="bi bi-chevron-left" style={{ fontSize: '1.3rem' }}></i>
                    </Button>
                    <h6 className="mb-0">
                      {['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 
                        'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'][eventCalendarMonth.getMonth()]} {eventCalendarMonth.getFullYear()}
                    </h6>
                    <Button 
                      variant="link" 
                      className="text-white p-0"
                      onClick={() => changeEventCalendarMonth(1)}
                      type="button"
                    >
                      <i className="bi bi-chevron-right" style={{ fontSize: '1.3rem' }}></i>
                    </Button>
                  </div>
                </Card.Header>
                <Card.Body style={{ padding: '0.75rem' }}>
                  {/* Nomi giorni */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
                    {['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'].map(day => (
                      <div 
                        key={day} 
                        style={{ 
                          textAlign: 'center', 
                          fontWeight: 600, 
                          fontSize: '0.75rem',
                          color: '#6c757d',
                          padding: '4px 0'
                        }}
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                  
                  {/* Griglia giorni */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                    {getEventCalendarDays(eventCalendarMonth).map((day, index) => {
                      const isSelected = day && isEventDateSelected(day);
                      const isPast = day && day < new Date().setHours(0, 0, 0, 0);
                      
                      return (
                        <button
                          key={index}
                          type="button"
                          disabled={!day || isPast}
                          onClick={() => day && !isPast && handleToggleEventDate(day)}
                          style={{
                            padding: '8px',
                            border: isSelected ? '2px solid #0d6efd' : '1px solid #dee2e6',
                            borderRadius: '6px',
                            backgroundColor: isSelected ? '#0d6efd' : (day ? 'white' : 'transparent'),
                            color: isSelected ? 'white' : (isPast ? '#ccc' : '#212529'),
                            cursor: (day && !isPast) ? 'pointer' : 'default',
                            fontWeight: isSelected ? 600 : 400,
                            fontSize: '0.85rem',
                            textAlign: 'center',
                            transition: 'all 0.2s',
                            opacity: (day && !isPast) ? 1 : 0.3
                          }}
                          onMouseEnter={(e) => {
                            if (day && !isPast && !isSelected) {
                              e.currentTarget.style.backgroundColor = '#e7f1ff';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (day && !isPast && !isSelected) {
                              e.currentTarget.style.backgroundColor = 'white';
                            }
                          }}
                        >
                          {day ? day.getDate() : ''}
                        </button>
                      );
                    })}
                  </div>
                </Card.Body>
              </Card>
              
              {/* Date selezionate */}
              {eventFormData.eventDates.length > 0 && (
                <div className="mt-2">
                  <small className="text-muted d-block mb-2">
                    <strong>{eventFormData.eventDates.length}</strong> {eventFormData.eventDates.length === 1 ? 'data selezionata' : 'date selezionate'}:
                  </small>
                  <div className="d-flex flex-wrap gap-2">
                    {eventFormData.eventDates.map((date, idx) => (
                      <Badge 
                        key={idx} 
                        bg="primary" 
                        className="d-flex align-items-center gap-2"
                        style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem' }}
                      >
                        <span>{new Date(date + 'T00:00:00').toLocaleDateString('it-IT')}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveEventDate(date)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '1.1rem',
                            lineHeight: 1,
                            padding: 0
                          }}
                        >
                          &times;
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Form.Group>

            <Row>
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label>Orario (opzionale)</Form.Label>
                  <Form.Control
                    type="text"
                    value={eventFormData.eventTime}
                    onChange={(e) => setEventFormData({ ...eventFormData, eventTime: e.target.value })}
                    placeholder="es. 20:30"
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Categorie * (selezionane almeno una)</Form.Label>
              <div className="border rounded p-3" style={{ backgroundColor: '#f8f9fa' }}>
                {['Sagre & Eventi Enogastronomici', 'Tradizioni popolari & Religiose', 'Festival, Spettacoli & Concerti', 'Eventi Sportivi', 'Fiere & Manifestazioni territoriali'].map((category) => (
                  <Form.Check
                    key={category}
                    type="checkbox"
                    id={`event-category-${category.replace(/\s+/g, '-')}`}
                    label={category}
                    checked={eventFormData.categories.includes(category)}
                    onChange={(e) => {
                      const newCategories = e.target.checked
                        ? [...eventFormData.categories, category]
                        : eventFormData.categories.filter(c => c !== category);
                      setEventFormData({ ...eventFormData, categories: newCategories });
                    }}
                    className="mb-2"
                  />
                ))}
              </div>
              {eventFormData.categories.length > 0 && (
                <div className="mt-2">
                  <small className="text-muted d-block mb-2">
                    <strong>{eventFormData.categories.length}</strong> {eventFormData.categories.length === 1 ? 'categoria selezionata' : 'categorie selezionate'}:
                  </small>
                  <div className="d-flex flex-wrap gap-2">
                    {eventFormData.categories.map((cat) => (
                      <Badge 
                        key={cat} 
                        bg="primary" 
                        className="d-flex align-items-center gap-2"
                        style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem', cursor: 'pointer' }}
                        onClick={() => {
                          const newCategories = eventFormData.categories.filter(c => c !== cat);
                          setEventFormData({ ...eventFormData, categories: newCategories });
                        }}
                      >
                        <span>{cat}</span>
                        <span>&times;</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Sito Web</Form.Label>
              <Form.Control
                type="url"
                value={eventFormData.website}
                onChange={(e) => setEventFormData({ ...eventFormData, website: e.target.value })}
                placeholder="https://esempio.it"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Immagini</Form.Label>
              <Form.Control
                type="file"
                accept="image/*"
                multiple
                onChange={handleEventImageChange}
              />
              <Form.Text className="text-muted">
                Carica una o più immagini. La prima immagine con la stella sarà quella principale mostrata nelle card.
              </Form.Text>
              
              {/* Preview immagini */}
              {eventImageItems.length > 0 && (
                <div className="mt-3" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {eventImageItems.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: 'relative',
                        width: '120px',
                        height: '120px',
                        border: item.isMain ? '3px solid #ffc107' : '1px solid #ddd',
                        borderRadius: '8px',
                        overflow: 'hidden'
                      }}
                    >
                      <img
                        src={item.url}
                        alt={`Preview ${idx + 1}`}
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'cover'
                        }}
                      />
                      {item.isMain && (
                        <span
                          style={{
                            position: 'absolute',
                            bottom: 4,
                            left: 4,
                            background: '#ffc107',
                            color: '#000',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 'bold'
                          }}
                        >
                          PRINCIPALE
                        </span>
                      )}
                      {/* Pulsante stella per impostare come principale */}
                      <button
                        type="button"
                        onClick={() => handleEventSetAsMain(idx)}
                        style={{
                          position: 'absolute',
                          top: 4,
                          left: 4,
                          background: item.isMain ? '#ffc107' : 'rgba(255,255,255,0.9)',
                          border: 'none',
                          borderRadius: '50%',
                          width: 26,
                          height: 26,
                          cursor: 'pointer',
                          fontSize: '14px',
                          lineHeight: '26px',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                        }}
                        title="Imposta come principale"
                      >★</button>
                      {/* Pulsante elimina */}
                      <button
                        type="button"
                        onClick={() => handleEventRemoveImage(idx)}
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          background: 'rgba(255,255,255,0.9)',
                          border: 'none',
                          borderRadius: '50%',
                          width: 26,
                          height: 26,
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          color: '#d00',
                          lineHeight: '26px',
                          padding: 0,
                          fontSize: '18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                        }}
                        title="Rimuovi immagine"
                      >&times;</button>
                    </div>
                  ))}
                </div>
              )}
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Stato *</Form.Label>
              <Form.Select
                value={eventFormData.status}
                onChange={(e) => setEventFormData({ ...eventFormData, status: e.target.value })}
                required
              >
                <option value="active">Attivo</option>
                <option value="inactive">Inattivo</option>
              </Form.Select>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseEventModal}>
              Annulla
            </Button>
            <Button variant="primary" type="submit" disabled={savingEvent}>
              {savingEvent ? 'Salvataggio...' : 'Salva'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal Successo Evento */}
      <Modal show={showEventSuccessModal} onHide={() => setShowEventSuccessModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-check-circle-fill text-success me-2"></i>
            Operazione completata
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-0">{eventSuccessMessage}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={() => setShowEventSuccessModal(false)}>
            OK
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Alert Modal per tutti i messaggi */}
      <AlertModal
        show={alertModal.show}
        onHide={() => setAlertModal({ show: false, message: '', type: 'info' })}
        message={alertModal.message}
        type={alertModal.type}
      />
    </Container>
  );
};

export default AdminDashboard;
