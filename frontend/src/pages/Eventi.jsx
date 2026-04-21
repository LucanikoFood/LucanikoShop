import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Spinner, Alert, Button, Badge } from 'react-bootstrap';
import { API_URL } from '../services/api';

// Categorie degli eventi
const EVENT_CATEGORIES = [
  'Sagre & Eventi Enogastronomici',
  'Tradizioni popolari & Religiose',
  'Festival, Spettacoli & Concerti',
  'Eventi Sportivi',
  'Fiere & Manifestazioni territoriali'
];

const Eventi = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/events`);
      
      if (!res.ok) {
        throw new Error('Errore nel caricamento degli eventi');
      }

      const data = await res.json();
      setEvents(data || []);
      setError('');
    } catch (err) {
      console.error('Errore caricamento eventi:', err);
      setError(err.message || 'Errore nel caricamento degli eventi');
    } finally {
      setLoading(false);
    }
  };

  const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 
                      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

  // Filtra eventi in base alla ricerca e categoria
  const filteredEvents = events.filter(event => {
    // Filtro categoria
    if (selectedCategory && (!event.categories || !event.categories.includes(selectedCategory))) {
      return false;
    }
    // Filtro ricerca
    if (!searchTerm.trim()) return true;
    const search = searchTerm.toLowerCase();
    // Ricerca anche nelle categorie multiple
    const categoriesText = event.categories ? event.categories.join(' ').toLowerCase() : '';
    return (
      event.title?.toLowerCase().includes(search) ||
      event.description?.toLowerCase().includes(search) ||
      event.company?.toLowerCase().includes(search) ||
      event.city?.toLowerCase().includes(search) ||
      categoriesText.includes(search)
    );
  });

  // Filtra eventi per mese selezionato (se un mese è selezionato)
  const monthFilteredEvents = selectedMonth !== null 
    ? filteredEvents.filter(event => {
        if (!event.eventDates || !Array.isArray(event.eventDates)) return false;
        return event.eventDates.some(eventDate => {
          const date = new Date(eventDate);
          return date.getMonth() === selectedMonth;
        });
      })
    : filteredEvents; // Mostra tutti gli eventi se nessun mese è selezionato

  // Ordina eventi per data (prima data disponibile)
  const sortedEvents = monthFilteredEvents.sort((a, b) => {
    const dateA = a.eventDates && a.eventDates.length > 0 ? new Date(a.eventDates[0]) : new Date();
    const dateB = b.eventDates && b.eventDates.length > 0 ? new Date(b.eventDates[0]) : new Date();
    return dateA - dateB;
  });

  if (loading) {
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Caricamento...</span>
        </Spinner>
        <p className="mt-3">Caricamento eventi...</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-5">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container className="py-5">
      <div className="mb-5 d-flex flex-wrap align-items-center justify-content-between" style={{ textAlign: 'left', gap: 16 }}>
        <div>
          <h1 style={{ color: '#004b75', fontWeight: 700, textAlign: 'left' }}>Eventi</h1>
          <p className="text-muted" style={{ fontSize: '1.1rem', textAlign: 'left', marginBottom: 0 }}>
            Resta aggiornato sugli eventi promossi dalle realtà locali: manifestazioni, appuntamenti enogastronomici, sportivi, musicali e iniziative dedicate alle eccellenze e alle tradizioni del territorio lucano. 
          </p>
        </div>
        <div style={{ minWidth: 200, maxWidth: 300, width: '100%' }}>
          <div className="input-group shadow" style={{ borderRadius: 10, border: '2px solid #004b75', overflow: 'hidden' }}>
            <span className="input-group-text" style={{ background: '#004b75', color: '#fff', border: 'none' }}>
              <i className="bi bi-search"></i>
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="Cerca per parola chiave o città..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ fontSize: 16, padding: '0.5rem 0.75rem', border: 'none', boxShadow: 'none' }}
            />
          </div>
        </div>
      </div>

      {/* Filtro Categorie */}
      <div className="mb-4">
        <h5 className="mb-3" style={{ color: '#004b75', fontWeight: 600, textAlign: 'left' }}>Filtra per categoria:</h5>
        <div className="d-flex gap-1 justify-content-start" style={{overflowX: 'auto', overflowY: 'hidden', maxWidth: '100%', paddingBottom: '4px'}}>
          <button
            className="btn"
            style={{
              backgroundColor: !selectedCategory ? '#004b75' : '#fff',
              color: !selectedCategory ? '#fff' : '#004b75',
              border: '2px solid #004b75',
              borderRadius: '16px',
              padding: '4px 10px',
              fontWeight: 600,
              fontSize: '0.85rem',
              transition: 'all 0.3s ease',
              minHeight: 0,
              whiteSpace: 'nowrap'
            }}
            onClick={() => setSelectedCategory('')}
          >
            Tutte
          </button>
          {EVENT_CATEGORIES.map(category => (
            <button
              key={category}
              className="btn"
              style={{
                backgroundColor: selectedCategory === category ? '#004b75' : '#fff',
                color: selectedCategory === category ? '#fff' : '#004b75',
                border: '2px solid #004b75',
                borderRadius: '16px',
                padding: '4px 10px',
                fontWeight: 600,
                fontSize: '0.85rem',
                transition: 'all 0.3s ease',
                minHeight: 0,
                whiteSpace: 'nowrap'
              }}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Selezione Mese */}
      <div className="mb-4">
        <h5 className="mb-3" style={{ color: '#00bf63', fontWeight: 600, textAlign: 'left' }}>Seleziona un mese:</h5>
        <div className="d-flex gap-1 justify-content-start" style={{overflowX: 'auto', overflowY: 'hidden', maxWidth: '100%', paddingBottom: '4px'}}>
          {monthNames.map((month, index) => (
            <button
              key={month}
              className="btn"
              style={{
                backgroundColor: selectedMonth === index ? '#00bf63' : '#fff',
                color: selectedMonth === index ? '#fff' : '#00bf63',
                border: '2px solid #00bf63',
                borderRadius: '16px',
                padding: '4px 10px',
                fontWeight: 600,
                fontSize: '0.85rem',
                transition: 'all 0.3s ease',
                minHeight: 0,
                whiteSpace: 'nowrap'
              }}
              onClick={() => setSelectedMonth(index)}
            >
              {month}
            </button>
          ))}
        </div>
      </div>

      {/* Visualizza selezione corrente */}
      {(selectedMonth !== null || selectedCategory) && (
        <div className="mt-4 mb-3 text-center">
          <h2 className="d-none d-md-block" style={{ 
            color: '#004b75', 
            fontWeight: 700, 
            fontSize: '1.8rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            flexWrap: 'wrap'
          }}>
            {selectedMonth !== null && (
              <span style={{ color: '#00bf63' }}>
                {monthNames[selectedMonth]}
              </span>
            )}
            {selectedMonth !== null && selectedCategory && (
              <span style={{ color: '#004b75' }}>-</span>
            )}
            {selectedCategory && (
              <span style={{ color: '#004b75' }}>
                {selectedCategory}
              </span>
            )}
          </h2>
          <h5 className="d-block d-md-none" style={{ 
            color: '#004b75', 
            fontWeight: 600, 
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            flexWrap: 'wrap'
          }}>
            {selectedMonth !== null && (
              <span style={{ color: '#00bf63' }}>
                {monthNames[selectedMonth]}
              </span>
            )}
            {selectedMonth !== null && selectedCategory && (
              <span style={{ color: '#004b75' }}>-</span>
            )}
            {selectedCategory && (
              <span style={{ color: '#004b75' }}>
                {selectedCategory}
              </span>
            )}
          </h5>
        </div>
      )}

      {/* Lista Eventi */}
      {sortedEvents.length === 0 ? (
        <div className="text-center text-muted py-5">
          <i className="bi bi-calendar-x" style={{ fontSize: '4rem', opacity: 0.3 }}></i>
          <p className="mt-3" style={{ fontSize: '1.1rem' }}>
            {selectedMonth !== null 
              ? `Nessun evento in programma per ${monthNames[selectedMonth]}` 
              : 'Nessun evento disponibile'
            }
            {(searchTerm || selectedCategory) && ' con i filtri selezionati'}
          </p>
        </div>
      ) : (
        <>
          <h4 className="mb-4" style={{ color: '#004b75', fontWeight: 600 }}>
            {selectedMonth !== null 
              ? `Eventi di ${monthNames[selectedMonth]} (${sortedEvents.length})`
              : `Tutti gli Eventi (${sortedEvents.length})`
            }
          </h4>
          <Row xs={1} md={2} lg={3} className="g-4">
            {sortedEvents.map(event => (
              <Col key={event._id}>
                <Card 
                  className="h-100"
                  style={{
                    cursor: 'pointer',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease',
                    maxWidth: '400px',
                    margin: '0 auto',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.18), 0 1.5px 6px rgba(0,0,0,0.12)',
                    border: '2px solid transparent'
                  }}
                  onClick={() => navigate(`/eventi/${event._id}`)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-8px)';
                    e.currentTarget.style.boxShadow = '0 16px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.16)';
                    e.currentTarget.style.borderColor = '#004b75';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.18), 0 1.5px 6px rgba(0,0,0,0.12)';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  <Card.Body>
                    <div className="mb-2 d-flex flex-wrap gap-1">
                      {event.categories && event.categories.length > 0 ? (
                        event.categories.map((cat, idx) => (
                          <Badge key={idx} style={{ fontSize: '0.7rem', backgroundColor: '#004b75', color: '#fff' }}>
                            {cat}
                          </Badge>
                        ))
                      ) : (
                        <Badge style={{ fontSize: '0.7rem', backgroundColor: '#6c757d', color: '#fff' }}>
                          Nessuna categoria
                        </Badge>
                      )}
                    </div>
                    <h5 style={{ color: '#004b75', fontWeight: 600, marginBottom: '12px' }}>
                      {event.title}
                    </h5>
                    <div className="mb-2">
                      <small className="text-muted d-flex align-items-center gap-1 mb-1">
                        <i className="bi bi-building-fill" style={{ color: '#004b75' }}></i>
                        {event.company}
                      </small>
                      <small className="text-muted d-flex align-items-center gap-1 mb-2">
                        <i className="bi bi-geo-alt-fill" style={{ color: '#00bf63' }}></i>
                        {event.city}
                      </small>
                      <div className="d-flex flex-wrap gap-1">
                        {event.eventDates && event.eventDates.slice(0, 3).map((date, idx) => (
                          <Badge 
                            key={idx} 
                            bg="success" 
                            style={{ fontSize: '0.7rem', backgroundColor: '#00bf63' }}
                          >
                            {new Date(date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                          </Badge>
                        ))}
                        {event.eventDates && event.eventDates.length > 3 && (
                          <Badge bg="secondary" style={{ fontSize: '0.7rem' }}>
                            +{event.eventDates.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-100 mt-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/eventi/${event._id}`);
                      }}
                      style={{
                        backgroundColor: '#004b75',
                        border: 'none',
                        fontWeight: 600
                      }}
                    >
                      <i className="bi bi-eye me-2"></i>
                      Dettagli
                    </Button>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </>
      )}
    </Container>
  );
};

export default Eventi;
