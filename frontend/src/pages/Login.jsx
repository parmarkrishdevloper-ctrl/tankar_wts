import { useState } from 'react';
import { FiUser, FiLock, FiAlertCircle, FiZap, FiTrendingUp, FiShield, FiCpu } from 'react-icons/fi';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { adminAPI } from '../services/api';
import Button from '../components/ui/Button';
import Input, { Field } from '../components/ui/Input';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError('Please enter both username and password.');
      return;
    }
    setLoading(true);
    try {
      const response = await adminAPI.login(username, password);
      if (response.data.success) {
        const { data, token } = response.data;
        login(data, token);
        toast.success(`Welcome back, ${data.name || 'admin'}`);
      } else {
        setError(response.data.error || 'Login failed.');
      }
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        (err.response?.status === 404 && 'Admin not found') ||
        (err.response?.status === 401 && 'Invalid password') ||
        'Login failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <aside className="login-aside">
        <div className="login-aside-content">
          <div className="login-aside-brand">
            <div className="login-aside-brand-logo">T</div>
            <span className="login-aside-brand-name">Tankar Suite</span>
          </div>
          <h1>The WhatsApp lead engine for modern businesses.</h1>
          <p className="login-aside-tag">
            Capture, qualify and convert leads on WhatsApp with an AI agent tuned to your business.
            Everything you need, in one calm dashboard.
          </p>
        </div>

        <div className="login-aside-features">
          <div className="login-aside-feature">
            <span className="login-aside-feature-dot"><FiCpu /></span>
            AI agent that speaks your customer's language
          </div>
          <div className="login-aside-feature">
            <span className="login-aside-feature-dot"><FiTrendingUp /></span>
            Pipeline, analytics and live conversations
          </div>
          <div className="login-aside-feature">
            <span className="login-aside-feature-dot"><FiShield /></span>
            Enterprise-grade reliability and security
          </div>
          <div className="login-aside-feature">
            <span className="login-aside-feature-dot"><FiZap /></span>
            Set up in minutes, scale without limits
          </div>
        </div>
      </aside>

      <section className="login-form-side">
        <div className="login-form-container">
          <div className="login-form-header">
            <h2>Sign in to your workspace</h2>
            <p>Use your admin credentials to access the dashboard.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            {error && (
              <div className="login-error" role="alert">
                <FiAlertCircle />
                <span>{error}</span>
              </div>
            )}

            <Field label="Username">
              <Input
                icon={FiUser}
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                disabled={loading}
                autoComplete="username"
                autoFocus
              />
            </Field>

            <Field label="Password">
              <Input
                icon={FiLock}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={loading}
                autoComplete="current-password"
              />
            </Field>

            <Button type="submit" size="lg" block loading={loading}>
              Sign in
            </Button>

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--c-text-subtle)', textAlign: 'center', marginTop: 'var(--space-3)' }}>
              By signing in you agree to Tankar's terms and privacy policy.
            </p>
          </form>
        </div>
      </section>
    </div>
  );
}
