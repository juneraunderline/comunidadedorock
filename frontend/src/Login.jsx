import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import API_URL from "./config/api";

function Login({ onLogin }) {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        if (!username || !password) return setError("Preencha todos os campos");
        if (password.length < 4) return setError("Senha deve ter pelo menos 4 caracteres");
        if (password !== confirmPassword) return setError("As senhas não conferem");
        const res = await axios.post(`${API_URL}/api/register`, {
          username,
          password,
          display_name: displayName || username
        });
        if (res.data.success) {
          onLogin(res.data.user);
          navigate("/");
        }
      } else {
        if (!username || !password) return setError("Preencha todos os campos");
        const res = await axios.post(`${API_URL}/api/login`, {
          user: username,
          pass: password
        });
        if (res.data.success) {
          onLogin(res.data.user);
          navigate("/");
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao conectar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#08080f", padding: "20px" }}>
      <div style={{
        width: "100%", maxWidth: "420px", background: "rgba(20, 20, 26, 0.95)",
        border: "1px solid #34343d", borderRadius: "14px", padding: "32px",
        boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)", textAlign: "center"
      }}>
        <h1 style={{ margin: 0, fontSize: "28px", color: "#fff", letterSpacing: "1px" }}>
          🎸 {isRegister ? "CRIAR CONTA" : "ENTRAR"}
        </h1>
        <p style={{ margin: "10px 0 24px", color: "#b2b2c2", fontSize: "14px" }}>
          {isRegister ? "Junte-se à Comunidade do Rock" : "Acesse sua conta"}
        </p>

        {error && (
          <div style={{ background: "rgba(244,67,54,0.15)", border: "1px solid #f44336", color: "#f44336", padding: "10px", borderRadius: "8px", marginBottom: "16px", fontSize: "13px" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "14px", textAlign: "left" }}>
            <label style={{ display: "block", marginBottom: "6px", color: "#ddd", fontSize: "13px" }}>Usuário</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="seu_usuario"
              style={{ width: "100%", padding: "12px 14px", background: "#10101a", border: "1px solid #2a2a33", borderRadius: "8px", color: "#fff", fontSize: "14px" }}
            />
          </div>

          {isRegister && (
            <div style={{ marginBottom: "14px", textAlign: "left" }}>
              <label style={{ display: "block", marginBottom: "6px", color: "#ddd", fontSize: "13px" }}>Nome de exibição</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Como quer ser chamado"
                style={{ width: "100%", padding: "12px 14px", background: "#10101a", border: "1px solid #2a2a33", borderRadius: "8px", color: "#fff", fontSize: "14px" }}
              />
            </div>
          )}

          <div style={{ marginBottom: "14px", textAlign: "left" }}>
            <label style={{ display: "block", marginBottom: "6px", color: "#ddd", fontSize: "13px" }}>Senha</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••"
              style={{ width: "100%", padding: "12px 14px", background: "#10101a", border: "1px solid #2a2a33", borderRadius: "8px", color: "#fff", fontSize: "14px" }}
            />
          </div>

          {isRegister && (
            <div style={{ marginBottom: "14px", textAlign: "left" }}>
              <label style={{ display: "block", marginBottom: "6px", color: "#ddd", fontSize: "13px" }}>Confirmar senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••"
                style={{ width: "100%", padding: "12px 14px", background: "#10101a", border: "1px solid #2a2a33", borderRadius: "8px", color: "#fff", fontSize: "14px" }}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "14px", background: "#e91e63", color: "#fff",
              border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "700",
              cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1,
              textTransform: "uppercase", letterSpacing: "1px", marginTop: "8px"
            }}
          >
            {loading ? "Aguarde..." : isRegister ? "Criar Conta" : "Entrar"}
          </button>
        </form>

        <p style={{ marginTop: "20px", color: "#888", fontSize: "13px" }}>
          {isRegister ? "Já tem conta?" : "Não tem conta?"}{" "}
          <button
            onClick={() => { setIsRegister(!isRegister); setError(""); }}
            style={{ background: "none", border: "none", color: "#e91e63", cursor: "pointer", fontSize: "13px", fontWeight: "700" }}
          >
            {isRegister ? "Fazer login" : "Criar conta"}
          </button>
        </p>

        <button
          onClick={() => navigate("/")}
          style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: "12px", marginTop: "10px" }}
        >
          ← Voltar ao site
        </button>
      </div>
    </div>
  );
}

export default Login;