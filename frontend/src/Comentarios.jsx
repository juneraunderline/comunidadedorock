import { useState, useEffect } from "react";
import axios from "axios";
import API_URL from "./config/api";

function Comentarios({ pageType, pageId }) {
  const [comments, setComments] = useState([]);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [user] = useState(() => {
    try {
      const saved = localStorage.getItem("user");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const fetchComments = () => {
    if (!pageId) return;
    axios.get(`${API_URL}/api/comments/${pageType}/${pageId}`)
      .then(res => setComments(res.data))
      .catch(() => setComments([]));
  };

  useEffect(() => {
    fetchComments();
  }, [pageType, pageId]);

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "Agora mesmo";
    if (diffMins < 60) return `${diffMins}min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;
    return date.toLocaleDateString("pt-BR");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSending(true);
    try {
      await axios.post(`${API_URL}/api/comments`, {
        page_type: pageType,
        page_id: pageId,
        user_id: user?.id || null,
        user_name: user?.display_name || user?.username || "Anônimo",
        user_avatar: user?.avatar || null,
        content: content.trim()
      });
      setContent("");
      fetchComments();
    } catch (err) {
      alert(err.response?.data?.error || "Erro ao enviar comentário");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Deletar este comentário?")) return;
    try {
      await axios.delete(`${API_URL}/api/comments/${id}`);
      fetchComments();
    } catch {
      alert("Erro ao deletar comentário");
    }
  };

  const boxStyle = {
    marginTop: "40px",
    padding: "24px",
    background: "#16161b",
    borderRadius: "8px",
    border: "1px solid #2a2a33"
  };

  const inputStyle = {
    width: "100%",
    padding: "12px 14px",
    background: "#10101a",
    border: "1px solid #2a2a33",
    borderRadius: "8px",
    color: "#fff",
    fontSize: "14px",
    fontFamily: "inherit",
    resize: "vertical"
  };

  return (
    <div style={boxStyle}>
      <h3 style={{ color: "#e9b61e", margin: "0 0 20px", fontSize: "18px", textTransform: "uppercase", letterSpacing: "1px" }}>
        💬 Comentários {comments.length > 0 && `(${comments.length})`}
      </h3>

      {/* Formulário */}
      {user ? (
        <form onSubmit={handleSubmit} style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0,
              background: user.avatar ? `url(${user.avatar}) center/cover` : "#e9b61e",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "14px", color: "#fff", border: "2px solid #e9b61e"
            }}>
              {!user.avatar && (user.display_name || user.username || "U").charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Deixe seu comentário..."
                rows="3"
                maxLength={1000}
                style={inputStyle}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                <small style={{ color: "#666" }}>{content.length}/1000</small>
                <button
                  type="submit"
                  disabled={sending || !content.trim()}
                  className="btn btn-primary"
                  style={{ padding: "8px 20px", fontSize: "13px", opacity: (sending || !content.trim()) ? 0.5 : 1 }}
                >
                  {sending ? "Enviando..." : "Comentar"}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div style={{ textAlign: "center", padding: "16px", background: "#10101a", borderRadius: "8px", marginBottom: "24px" }}>
          <p style={{ color: "#888", margin: "0 0 8px" }}>Faça login para comentar</p>
          <a href="/login" className="btn btn-primary" style={{ padding: "8px 20px", fontSize: "13px", textDecoration: "none" }}>Entrar</a>
        </div>
      )}

      {/* Lista de comentários */}
      {comments.length === 0 ? (
        <p style={{ color: "#666", textAlign: "center", padding: "16px 0" }}>Nenhum comentário ainda. Seja o primeiro!</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {comments.map(c => (
            <div key={c.id} style={{ display: "flex", gap: "12px", padding: "12px", background: "#10101a", borderRadius: "8px" }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0,
                background: c.user_avatar ? `url(${c.user_avatar}) center/cover` : "#333",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "13px", color: "#fff"
              }}>
                {!c.user_avatar && (c.user_name || "A").charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <strong style={{ color: "#e9b61e", fontSize: "13px" }}>{c.user_name}</strong>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <small style={{ color: "#666", fontSize: "11px" }}>{formatDate(c.created_at)}</small>
                    {user && (user.role === "admin" || user.id === c.user_id) && (
                      <button
                        onClick={() => handleDelete(c.id)}
                        style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: "12px", padding: "2px" }}
                        title="Deletar"
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </div>
                <p style={{ color: "#ccc", margin: 0, fontSize: "14px", lineHeight: "1.5", wordBreak: "break-word" }}>{c.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Comentarios;
