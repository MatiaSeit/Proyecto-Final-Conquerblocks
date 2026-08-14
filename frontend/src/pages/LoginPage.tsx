import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { extractErrorMessage } from "../api/errors";
import { useAuth } from "../context/AuthContext";
import { AllianceInsignia } from "../components/Icons";

export function LoginPage() {
  const { user, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(extractErrorMessage(err) || "Invalid credentials.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="card login-card">
        <AllianceInsignia
          style={{ width: 48, height: 48, color: "var(--color-accent)", display: "block", margin: "0 auto 1rem" }}
        />
        <h1>ALLIANCE SUPPLY COMMAND</h1>
        <p className="muted">Restricted access &mdash; Alliance personnel only</p>

        {error && <div className="banner banner--error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="username">Callsign / Username</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="password">Access Code</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button className="btn btn--primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Authenticating..." : "Transmit credentials"}
          </button>
        </form>
        <p className="muted" style={{ marginTop: "1.25rem", fontSize: "0.75rem" }}>
          Demo: run <code>manage.py seed_demo</code> then sign in as <code>command</code> /{" "}
          <code>RebelYell123!</code>
        </p>
      </div>
    </div>
  );
}
