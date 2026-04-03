import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import API_URL, { getImageUrl } from "./config/api";

function NewsDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

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
    axios.get(`${API_URL}/api/posts`)
      .then(res => {
        const selectedPost = res.data.find(p => p.id === parseInt(id));
        setPost(selectedPost);
        setLoading(false);
        
        // Atualizar meta tags para compartilhamento
        if (selectedPost) {
          updateMetaTags(selectedPost);
        }
      });
  }, [id]);

  const updateMetaTags = (post) => {
    const pageUrl = window.location.href;
    
    // Remover meta tags antigas
    document.querySelectorAll('meta[property^="og:"]').forEach(tag => tag.remove());
    
    // Função auxiliar para adicionar meta tags
    const addMetaTag = (property, content) => {
      const meta = document.createElement('meta');
      meta.setAttribute('property', property);
      meta.setAttribute('content', content);
      document.head.appendChild(meta);
    };
    
    // Adicionar novas meta tags Open Graph
    addMetaTag('og:title', post.title);
    addMetaTag('og:description', post.content.slice(0, 150) + '...');
    addMetaTag('og:image', post.image || 'https://images.unsplash.com/photo-1516450360452-9312f5ff84d4?w=500&h=300&fit=crop');
    addMetaTag('og:url', pageUrl);
    addMetaTag('og:type', 'article');
    addMetaTag('og:site_name', 'Comunidade do Rock');
    
    // Meta tags Twitter
    const addTwitterTag = (name, content) => {
      const meta = document.createElement('meta');
      meta.setAttribute('name', name);
      meta.setAttribute('content', content);
      document.head.appendChild(meta);
    };
    
    addTwitterTag('twitter:card', 'summary_large_image');
    addTwitterTag('twitter:title', post.title);
    addTwitterTag('twitter:description', post.content.slice(0, 150) + '...');
    addTwitterTag('twitter:image', post.image || 'https://images.unsplash.com/photo-1516450360452-9312f5ff84d4?w=500&h=300&fit=crop');
    
    // Atualizar título da página
    document.title = `${post.title} - Comunidade do Rock`;
  };

  const shareOnSocial = (platform) => {
    if (!post) return;
    
    const url = window.location.href;
    const title = post.title;
    const text = `${title} - Confira no Comunidade do Rock`;
    
    const shareUrls = {
      whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(text + ' ' + url)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}&via=ComunidadeRock`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`
    };
    
    if (shareUrls[platform]) {
      window.open(shareUrls[platform], '_blank', 'width=600,height=400');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>
        Carregando...
      </div>
    );
  }

  if (!post) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h2>Notícia não encontrada</h2>
        <button className="btn btn-primary" onClick={() => navigate("/noticias")}>
          Voltar às Notícias
        </button>
      </div>
    );
  }

  return (
    <div className="news-detail-page">
      <section className="news-detail-section">
        <div className="news-detail-container">
          {post.image && (
            <div className="news-detail-image">
              <img src={getImageUrl(post.image)} alt={post.title} />
            </div>
          )}
          
          <div className="news-detail-content">
            <h1>{post.title}</h1>
            
            <div className="news-detail-meta">
              <small>{post.source || "Rolling Stone"}</small>
              <span className="separator">•</span>
              <small>{formatDatePT(post.created_at)}</small>
            </div>
            
            <div className="news-detail-text">
              <div dangerouslySetInnerHTML={{ __html: post.content }} />
            </div>
            
            <div className="news-detail-share">
              <span>Compartilhe:</span>
              <button 
                className="share-btn whatsapp"
                onClick={() => shareOnSocial('whatsapp')}
                title="Compartilhar no WhatsApp"
              >
                <i>💬</i> WhatsApp
              </button>
              <button 
                className="share-btn twitter"
                onClick={() => shareOnSocial('twitter')}
                title="Compartilhar no Twitter"
              >
                <i>𝕏</i> Twitter
              </button>
              <button 
                className="share-btn facebook"
                onClick={() => shareOnSocial('facebook')}
                title="Compartilhar no Facebook"
              >
                <i>f</i> Facebook
              </button>
              <button 
                className="share-btn linkedin"
                onClick={() => shareOnSocial('linkedin')}
                title="Compartilhar no LinkedIn"
              >
                <i>in</i> LinkedIn
              </button>
              <button 
                className="share-btn telegram"
                onClick={() => shareOnSocial('telegram')}
                title="Compartilhar no Telegram"
              >
                <i>✈</i> Telegram
              </button>
            </div>
            
            <div className="news-detail-actions">
              {post.link && (
                <a 
                  href={post.link} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="btn btn-primary"
                >
                  Leia Mais no Site Original →
                </a>
              )}
              <button className="btn btn-outline" onClick={() => navigate("/noticias")}>
                Voltar
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default NewsDetail;
