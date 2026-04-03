import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import API_URL, { getImageUrl } from "./config/api";

function EntrevistaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);

  const formatContent = (content) => {
    if (!content) return "";
    
    // Se o conteúdo já tem tags HTML, retorna como está
    if (/<[^>]*>/.test(content)) {
      return content;
    }
    
    // Se não tem HTML, converte quebras de linha em <br> e parágrafos
    return content
      .split('\n\n')
      .map(para => para.replace(/\n/g, '<br/>'))
      .join('</p><p>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
  };

  const formatDatePT = (dateString) => {
    if (!dateString) return "Data desconhecida";
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "Agora mesmo";
    if (diffMins < 60) return `${diffMins} minuto${diffMins > 1 ? 's' : ''} atrás`;
    if (diffHours < 24) return `${diffHours} hora${diffHours > 1 ? 's' : ''} atrás`;
    if (diffDays < 7) return `${diffDays} dia${diffDays > 1 ? 's' : ''} atrás`;
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} às ${hours}:${mins}`;
  };

  useEffect(() => {
    axios.get(`${API_URL}/api/interviews`)
      .then(res => {
        const selectedInterview = res.data.find(i => i.id === parseInt(id));
        setInterview(selectedInterview);
        setLoading(false);
      })
      .catch(err => {
        console.error("Erro ao carregar entrevista:", err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#666", marginTop: "80px" }}>
        Carregando...
      </div>
    );
  }

  if (!interview) {
    return (
      <div style={{ padding: "40px", textAlign: "center", marginTop: "80px" }}>
        <h2>Entrevista não encontrada</h2>
        <button 
          className="btn btn-primary" 
          onClick={() => navigate("/entrevistas")}
          style={{ marginTop: "20px" }}
        >
          ← Voltar às Entrevistas
        </button>
      </div>
    );
  }

  return (
    <div className="interview-detail-page">
      <section className="interview-detail-section">
        <div className="interview-detail-container">
          {interview.image && (
            <div className="interview-detail-image">
              <img src={getImageUrl(interview.image)} alt={interview.title} />
            </div>
          )}
          
          <div className="interview-detail-content">
            <div className="interview-detail-header">
              <h1>{interview.title}</h1>
              <p className="interview-artist">
                <strong>🎤 {interview.artist}</strong>
              </p>
              <p className="interview-date">
                Publicado em {formatDatePT(interview.created_at)}
                {interview.date && ` • Data da Entrevista: ${interview.date}`}
              </p>
            </div>

            <div className="interview-detail-text">
              {interview.content ? (
                <div dangerouslySetInnerHTML={{ __html: formatContent(interview.content) }} />
              ) : (
                <p>Sem descrição disponível</p>
              )}
            </div>

            <div className="news-detail-share">
              <span>Compartilhe:</span>
              <button className="share-btn whatsapp" onClick={() => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(interview.title + " - " + interview.artist + " | Comunidade do Rock https://comunidadedorock.com.br/og/entrevistas/" + interview.id)}`, '_blank')}>💬 WhatsApp</button>
              <button className="share-btn facebook" onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent("https://comunidadedorock.com.br/og/entrevistas/" + interview.id)}`, '_blank')}>f Facebook</button>
              <button className="share-btn twitter" onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(interview.title + " - " + interview.artist)}&url=${encodeURIComponent("https://comunidadedorock.com.br/og/entrevistas/" + interview.id)}`, '_blank')}>𝕏 Twitter</button>
              <button className="share-btn telegram" onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent("https://comunidadedorock.com.br/og/entrevistas/" + interview.id)}&text=${encodeURIComponent(interview.title)}`, '_blank')}>✈ Telegram</button>
              <button className="share-btn" style={{ background: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)" }} onClick={() => { navigator.clipboard.writeText(interview.title + " | Comunidade do Rock https://comunidadedorock.com.br/og/entrevistas/" + interview.id); alert("Link copiado! Cole no Instagram Direct 📷"); }}>📷 Instagram</button>
            </div>

            <div className="interview-detail-actions">
              <button 
                className="btn btn-primary"
                onClick={() => navigate("/entrevistas")}
              >
                ← Voltar às Entrevistas
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default EntrevistaDetail;
