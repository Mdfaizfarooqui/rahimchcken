import React, { useState } from 'react';

export default function UserAuth({ onUserAuth, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode); // 'login' or 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Username and password are required.');
      return;
    }

    setLoading(true);
    setError('');

    const endpoint = mode === 'login' ? '/api/auth/login-user' : '/api/auth/register';
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });

      const data = await res.json();
      
      if (res.ok) {
        onUserAuth(data); // Pass token and user details to parent
      } else {
        setError(data.error || 'Authentication failed. Please try again.');
      }
    } catch (err) {
      setError('Network error. Unable to connect to server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="view auth-container">
      <div className="auth-card">
        <h2>{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
        <p className="auth-subtitle">
          {mode === 'login' 
            ? 'Sign in to place orders and track your fresh cuts.'
            : 'Join Rahim\'s Chicken to order premium raw cuts.'}
        </p>

        <form onSubmit={handleSubmit}>
          <input
            className="auth-input"
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />

          {error && <div style={{ color: 'var(--red)', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</div>}

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? 'Please wait...' : (mode === 'login' ? 'Sign In' : 'Register')}
          </button>
        </form>

        <div className="auth-toggle">
          {mode === 'login' ? 'New to Rahim\'s Chicken?' : 'Already have an account?'}
          <button onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError('');
            setPassword('');
          }}>
            {mode === 'login' ? 'Create an Account' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}
