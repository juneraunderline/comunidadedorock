import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import API_URL from "./config/api";

function Perfil({ user, setUser }) {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }
    setDisplayName(user.display_name || "");
    setUsername(user.username || "");
    setAvatar(user.avatar || "");
    // Buscar dados atualizados do servidor (inclui created_at)
    if (user.id) {
      axios.get(`${API_URL}/api/user/${user.id}`).then(res => {
        const updated = { ...user, ...res.data };
        setUser(updated);
        localStorage.setItem("user", JSON.stringify(updated));
      }).catch(() => {});
    }
  }, [user?.id, navigate]);

  const saveProfile = async () => {
    setMsg("");
    setError("");
    try {
      const res = await axios.put(`${API_URL}/api/user/${user.id}`, {
        display_name: displayName,
        username: username,
        avatar: avatar
      });
      if (res.data.success) {
        const updated = res.data.user;
        setUser(updated);
        localStorage.setItem("user", JSON.stringify(updated));
        setMsg("Perfil atualizado com sucesso!");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao atualizar perfil");
    }
  };

  const changePassword = async () => {
    setMsg("");
    setError("");
    if (!currentPassword) return setError("Digite sua senha atual");
    if (!newPassword) return setError("Digite a nova senha");
    if (newPassword.length < 4) return setError("Nova senha deve ter pelo menos 4 caracteres");
    if (newPassword !== confirmPassword) return setError("As senhas não conferem");
    try {
      const res = await axios.put(`${API_URL}/api/user/${user.id}`, {
        current_password: currentPassword,
        new_password: newPassword
      });
      if (res.data.success) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setMsg("Senha alterada com sucesso!");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao alterar senha");
    }
  };

  if (!user) return null;

  return (
    <div style={{ minHeight: "80vh", padding: "40px 20px", background: "#0a0a0e", marginTop: "80px" }}>
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "32px", marginBottom: "30px", color: "#fff" }}>
          MEU <span style={{ color: "#e9b61e" }}>PERFIL</span>
        </h1>

        {msg && <div style={{ background: "rgba(76,175,80,0.15)", border: "1px solid #4caf50", color: "#4caf50", padding: "12px", borderRadius: "8px", marginBottom: "16px" }}>{msg}</div>}
        {error && <div style={{ background: "rgba(244,67,54,0.15)", border: "1px solid #f44336", color: "#f44336", padding: "12px", borderRadius: "8px", marginBottom: "16px" }}>{error}</div>}

        {/* Avatar */}
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <div style={{
            width: "100px", height: "100px", borderRadius: "50%", margin: "0 auto 16px",
            background: avatar ? `url(${avatar}) center/cover` : "#e9b61e",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "40px", color: "#fff", border: "3px solid #e9b61e"
          }}>
            {!avatar && (user.display_name || user.username || "U").charAt(0).toUpperCase()}
          </div>
          <p style={{ color: "#999", fontSize: "13px" }}>@{user.username}</p>
          <p style={{ color: "#666", fontSize: "12px" }}>Membro desde {new Date(user.created_at).toLocaleDateString("pt-BR")}</p>
          {(user.role === "admin" || user.role === "editor") && (
            <a
              href="/admin"
              style={{
                display: "inline-block", marginTop: "12px",
                background: user.role === "admin" ? "#e9b61e" : "#333",
                color: "#fff", textDecoration: "none",
                padding: "8px 20px", borderRadius: "6px",
                fontSize: "13px", fontWeight: "700",
                textTransform: "uppercase", letterSpacing: "0.5px"
              }}
            >
              {user.role === "admin" ? "⚙️ Painel Admin Completo" : "📝 Painel de Notícias"}
            </a>
          )}
        </div>

        {/* Dados do perfil */}
        <div style={{ background: "#111118", border: "1px solid #252532", borderRadius: "12px", padding: "24px", marginBottom: "20px" }}>
          <h3 style={{ color: "#e9b61e", marginTop: 0, marginBottom: "16px" }}>Dados do Perfil</h3>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", color: "#b0b0c6", fontSize: "14px" }}>Usuário</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              style={{ width: "100%", background: "#0a0a11", border: "1px solid #2c2c38", color: "#fff", padding: "10px 12px", borderRadius: "6px", fontSize: "14px" }}
            />
            <p style={{ margin: "4px 0 0", color: "#555", fontSize: "11px" }}>Apenas letras minúsculas, números e _</p>
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", color: "#b0b0c6", fontSize: "14px" }}>Nome de exibição</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              style={{ width: "100%", background: "#0a0a11", border: "1px solid #2c2c38", color: "#fff", padding: "10px 12px", borderRadius: "6px", fontSize: "14px" }}
            />
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", color: "#b0b0c6", fontSize: "14px" }}>URL do Avatar (imagem)</label>
            <input
              type="text"
              value={avatar}
              onChange={e => setAvatar(e.target.value)}
              placeholder="https://exemplo.com/foto.jpg"
              style={{ width: "100%", background: "#0a0a11", border: "1px solid #2c2c38", color: "#fff", padding: "10px 12px", borderRadius: "6px", fontSize: "14px" }}
            />
          </div>

          <button onClick={saveProfile} style={{ background: "#e9b61e", color: "#fff", border: "none", padding: "10px 24px", borderRadius: "6px", cursor: "pointer", fontWeight: "700", fontSize: "14px" }}>
            Salvar Perfil
          </button>
        </div>

        {/* Alterar senha */}
        <div style={{ background: "#111118", border: "1px solid #252532", borderRadius: "12px", padding: "24px", marginBottom: "20px" }}>
          <h3 style={{ color: "#e9b61e", marginTop: 0, marginBottom: "16px" }}>Alterar Senha</h3>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", color: "#b0b0c6", fontSize: "14px" }}>Senha atual</label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              style={{ width: "100%", background: "#0a0a11", border: "1px solid #2c2c38", color: "#fff", padding: "10px 12px", borderRadius: "6px", fontSize: "14px" }}
            />
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", color: "#b0b0c6", fontSize: "14px" }}>Nova senha</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              style={{ width: "100%", background: "#0a0a11", border: "1px solid #2c2c38", color: "#fff", padding: "10px 12px", borderRadius: "6px", fontSize: "14px" }}
            />
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "4px", color: "#b0b0c6", fontSize: "14px" }}>Confirmar nova senha</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              style={{ width: "100%", background: "#0a0a11", border: "1px solid #2c2c38", color: "#fff", padding: "10px 12px", borderRadius: "6px", fontSize: "14px" }}
            />
          </div>

          <button onClick={changePassword} style={{ background: "#333", color: "#fff", border: "1px solid #555", padding: "10px 24px", borderRadius: "6px", cursor: "pointer", fontWeight: "700", fontSize: "14px" }}>
            Alterar Senha
          </button>
        </div>

        <button onClick={() => navigate("/")} style={{ background: "none", border: "1px solid #444", color: "#999", padding: "10px 24px", borderRadius: "6px", cursor: "pointer", fontSize: "14px" }}>
          ← Voltar
        </button>
      </div>
    </div>
  );
}

export default Perfil;