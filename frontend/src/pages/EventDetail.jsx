import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Row,
  Col,
  Card,
  Badge,
  Button,
  Spinner,
  Alert,
  Carousel,
  ListGroup,
} from 'react-bootstrap';
import { API_URL } from '../services/api';
import SEOHelmet from '../components/SEOHelmet';
import { CloudinaryPresets } from '../utils/cloudinaryOptimizer';

const EventDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Carica evento
  const loadEvent = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/events/${id}`);
      
      if (!res.ok) {
        throw new Error('Evento non trovato');
      }

      const data = await res.json();
      setEvent(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Errore caricamento evento');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvent();
  }, [id]);

  const formatEventDate = (dateStr) => {
    const date = new Date(dateStr);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('it-IT', options);
  };

  if (loading) {
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Caricamento...</span>
        </Spinner>
        <p className="mt-3">Caricamento evento...</p>
      </Container>
    );
  }

  if (error || !event) {
    return (
      <Container className="py-5">
        <Alert variant="danger">{error || 'Evento non trovato'}</Alert>
        <Button variant="primary" onClick={() => navigate('/eventi')}>
          Torna agli Eventi
        </Button>
      </Container>
    );
  }

  return (
    <>
      <SEOHelmet
        title={`${event.title} - Eventi`}
        description={event.description}
        keywords={`evento, ${event.categories ? event.categories.join(', ') : ''}, ${event.city}, ${event.company}`}
        type="article"
      />

      <Container className="py-5">
        <Button 
          variant="link" 
          className="mb-3 p-0" 
          onClick={() => navigate('/eventi')}
          style={{ color: '#004b75', textDecoration: 'none', fontWeight: 600 }}
        >
          <i className="bi bi-arrow-left"></i> Torna al Calendario Eventi
        </Button>

        <Row>
          {/* COLONNA IMMAGINI */}
          <Col lg={6} className="mb-4">
            {event.images && event.images.length > 0 ? (
              event.images.length === 1 ? (
                <img
                  className="d-block w-100"
                  src={CloudinaryPresets.productDetail(event.images[0].url)}
                  alt={event.title}
                  loading="lazy"
                  style={{ 
                    maxHeight: '500px', 
                    width: '100%',
                    objectFit: 'contain', 
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)' 
                  }}
                />
              ) : (
                <Carousel indicators={false} interval={null}>
                  {event.images.map((image, index) => (
                    <Carousel.Item key={index}>
                      <img
                        className="d-block w-100"
                        src={CloudinaryPresets.productDetail(image.url)}
                        loading="lazy"
                        alt={`${event.title} - ${index + 1}`}
                        style={{ 
                          maxHeight: '500px',
                          width: '100%', 
                          objectFit: 'contain', 
                          borderRadius: '8px' 
                        }}
                      />
                    </Carousel.Item>
                  ))}
                </Carousel>
              )
            ) : (
              <div
                style={{
                  height: '400px',
                  backgroundColor: '#f8f9fa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px',
                }}
              >
                <i className="bi bi-calendar-event" style={{ fontSize: '5rem', color: '#6c757d' }}></i>
              </div>
            )}
          </Col>

          {/* COLONNA DETTAGLI */}
          <Col lg={6}>
            <div className="mb-3">
              <div className="mb-2 d-flex flex-wrap gap-2">
                {event.categories && event.categories.length > 0 ? (
                  event.categories.map((cat, idx) => (
                    <Badge 
                      key={idx}
                      style={{ fontSize: '0.85rem', padding: '8px 14px', backgroundColor: '#004b75', color: '#fff' }}
                    >
                      {cat}
                    </Badge>
                  ))
                ) : (
                  <Badge style={{ fontSize: '0.85rem', padding: '8px 14px', backgroundColor: '#6c757d', color: '#fff' }}>
                    Nessuna categoria
                  </Badge>
                )}
              </div>
              <h1 style={{ color: '#004b75', fontWeight: 700, fontSize: '2.2rem' }}>
                {event.title}
              </h1>
            </div>

            {/* DATA E ORA */}
            <Card className="mb-3 shadow-sm" style={{ backgroundColor: 'rgb(255, 255, 255)', border: '2px solid rgb(224, 222, 213)' }}>
              <Card.Body>
                <div className="d-flex align-items-start gap-3">
                  <i className="bi bi-calendar-check-fill" style={{ fontSize: '2.5rem', color: '#004b75' }}></i>
                  <div className="w-100">
                    <h5 className="mb-2" style={{ color: '#004b75', fontWeight: 700 }}>
                      {event.eventDates && event.eventDates.length > 1 ? 'Date dell\'evento:' : 'Data evento:'}
                    </h5>
                    {event.eventDates && event.eventDates.length > 0 ? (
                      event.eventDates.map((date, idx) => (
                        <div key={idx} className="mb-1">
                          <Badge style={{ fontSize: '0.95rem', padding: '6px 10px', backgroundColor: '#004b75', color: '#fff' }}>
                            {formatEventDate(date)}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <p className="mb-0 text-muted">Data non specificata</p>
                    )}
                    {event.eventTime && (
                      <p className="mb-0 text-muted mt-2" style={{ fontSize: '1.1rem' }}>
                        <i className="bi bi-clock-fill me-2"></i>
                        Ore {event.eventTime}
                      </p>
                    )}
                  </div>
                </div>
              </Card.Body>
            </Card>

            {/* INFO ORGANIZZATORE */}
            <Card className="mb-3 shadow-sm">
              <Card.Body>
                <h5 style={{ color: '#00bf63', fontWeight: 700, marginBottom: '1rem' }}>
                  <i className="bi bi-building-fill me-2"></i>
                  Organizzatore
                </h5>
                <ListGroup variant="flush">
                  <ListGroup.Item>
                    <div className="d-flex align-items-start gap-2">
                      <i className="bi bi-building-fill mt-1" style={{ color: '#004b75', fontSize: '1.2rem' }}></i>
                      <div>
                        <small className="text-muted d-block">Organizzatore</small>
                        <strong style={{ fontSize: '1.1rem' }}>{event.company}</strong>
                      </div>
                    </div>
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <div className="d-flex align-items-start gap-2">
                      <i className="bi bi-geo-alt-fill mt-1" style={{ color: '#00bf63', fontSize: '1.2rem' }}></i>
                      <div>
                        <small className="text-muted d-block">Località</small>
                        <strong style={{ fontSize: '1.1rem' }}>{event.city}</strong>
                      </div>
                    </div>
                  </ListGroup.Item>
                  {event.address && (
                    <ListGroup.Item>
                      <div className="d-flex align-items-start gap-2">
                        <i className="bi bi-signpost-fill mt-1" style={{ color: '#00bf63', fontSize: '1.2rem' }}></i>
                        <div>
                          <small className="text-muted d-block">Indirizzo</small>
                          <strong style={{ fontSize: '1.1rem' }}>{event.address}</strong>
                        </div>
                      </div>
                    </ListGroup.Item>
                  )}
                  {event.phone && (
                    <ListGroup.Item>
                      <div className="d-flex align-items-start gap-2">
                        <i className="bi bi-telephone-fill mt-1" style={{ color: '#00bf63', fontSize: '1.2rem' }}></i>
                        <div>
                          <small className="text-muted d-block">Contatti</small>
                          <strong style={{ fontSize: '1.1rem' }}>{event.phone}</strong>
                        </div>
                      </div>
                    </ListGroup.Item>
                  )}
                </ListGroup>
              </Card.Body>
            </Card>

            {/* DESCRIZIONE */}
            <Card className="mb-3 shadow-sm">
              <Card.Body>
                <h5 style={{ color: '#004b75', fontWeight: 700, marginBottom: '1rem' }}>
                  <i className="bi bi-info-circle-fill me-2"></i>
                  Descrizione
                </h5>
                <p style={{ fontSize: '1.05rem', lineHeight: '1.7', color: '#333', whiteSpace: 'pre-wrap' }}>
                  {event.description}
                </p>
              </Card.Body>
            </Card>

            {/* PULSANTE SITO WEB */}
            {event.website && (
              <div className="d-grid gap-2">
                <Button
                  href={event.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="primary"
                  size="lg"
                  style={{
                    backgroundColor: '#004b75',
                    borderColor: '#004b75',
                    fontWeight: 600,
                    padding: '14px 24px',
                    fontSize: '1.1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px'
                  }}
                >
                  <i className="bi bi-box-arrow-up-right"></i>
                  Maggiori Informazioni
                </Button>
              </div>
            )}
          </Col>
        </Row>
      </Container>
    </>
  );
};

export default EventDetail;
