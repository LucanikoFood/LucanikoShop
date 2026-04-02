import { useState } from 'react';
import { Container, Form, Button, Card, Alert, InputGroup } from 'react-bootstrap';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { API_URL } from '../services/api';

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Validazione password robusta (stessa della registrazione)
  const isPasswordStrong = (password) => {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/.test(password);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validazione lato client
    if (!isPasswordStrong(password)) {
      setError('La password deve essere di almeno 8 caratteri e contenere almeno una maiuscola, una minuscola, un numero e un simbolo');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Le password non corrispondono');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/reset-password/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        // Redirect al login dopo 3 secondi
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        setError(data.message || 'Errore durante il reset della password');
      }
    } catch (err) {
      setError('Errore di connessione. Riprova più tardi.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <Card style={{ width: '400px' }}>
          <Card.Body className="text-center">
            <i className="bi bi-check-circle-fill text-success mb-3" style={{ fontSize: '64px' }}></i>
            <h2 className="mb-3">Password reimpostata!</h2>
            <p className="text-muted">
              La tua password è stata modificata con successo. 
              Verrai reindirizzato alla pagina di login...
            </p>
            <Link to="/login" className="btn btn-primary mt-3">
              Vai al Login
            </Link>
          </Card.Body>
        </Card>
      </Container>
    );
  }

  return (
    <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
      <Card style={{ width: '400px' }}>
        <Card.Body>
          <h2 className="text-center mb-4">Reimposta Password</h2>
          
          {error && <Alert variant="danger">{error}</Alert>}
          
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="password">
              <Form.Label>Nuova Password</Form.Label>
              <InputGroup>
                <Form.Control
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Inserisci nuova password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <Button 
                  variant="outline-secondary" 
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <i className={showPassword ? "bi bi-eye-slash" : "bi bi-eye"}></i>
                </Button>
              </InputGroup>
              <Form.Text className="text-muted">
                Minimo 8 caratteri con maiuscola, minuscola, numero e simbolo
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3" controlId="confirmPassword">
              <Form.Label>Conferma Password</Form.Label>
              <InputGroup>
                <Form.Control
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Conferma nuova password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <Button 
                  variant="outline-secondary" 
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <i className={showConfirmPassword ? "bi bi-eye-slash" : "bi bi-eye"}></i>
                </Button>
              </InputGroup>
            </Form.Group>

            <Button 
              variant="primary" 
              type="submit" 
              className="w-100"
              disabled={loading}
            >
              {loading ? 'Reimpostazione...' : 'Reimposta Password'}
            </Button>
          </Form>

          <div className="text-center mt-3">
            <Link to="/login">Torna al Login</Link>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default ResetPassword;
