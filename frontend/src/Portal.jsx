import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import "./portal.css";

function Portal() {
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);

  // Função para extrair o domínio principal do URL
  const getMainSiteUrl = (feedUrl) => {
    try {
      const url = new URL(feedUrl);
      return url.origin; // Retorna apenas o protocolo + domínio
    } catch (err) {
      return feedUrl;
    }
  };

  // Função para obter favicon do site
  const getFaviconUrl = (feedUrl) => {
    try {
      const url = new URL(feedUrl);
      const domain = url.origin;
      // Tenta favicon.ico primeiro, depois a API do Google
      return `${domain}/favicon.ico`;
    } catch (err) {
      return null;
    }
  };

  useEffect(() => {
    // Forçar refetch dos feeds a cada 5 segundos
    const interval = setInterval(() => {
      axios.get("http://https://comunidadedorock.onrender.com/api/rss-feeds")
        .then(res => {
          setFeeds(res.data);
          setLoading(false);
        })
        .catch(err => {
          console.error("Erro ao carregar feeds:", err);
          setLoading(false);
        });
    }, 5000);
    
    // Carregamento inicial
    axios.get("http://https://comunidadedorock.onrender.com/api/rss-feeds")
      .then(res => {
        setFeeds(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Erro ao carregar feeds:", err);
        setLoading(false);
      });
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <aside className="portal"></aside>;
  }

  return (
    <aside className="portal">
      <div className="portal-content">
        <h3 className="portal-title">PORTAIS</h3>
        <ul className="portal-list">
          {feeds && feeds.length > 0 ? (
            feeds.map((feed, idx) => (
              <li key={idx} className="portal-item">
                <Link 
                  to={`/noticias?portal=${encodeURIComponent(feed.name)}`}
                  className="portal-link"
                  title={feed.name}
                >
                  {feed.logo ? (
                    <img 
                      src={feed.logo}
                      alt={feed.name}
                      className="portal-icon"
                      onError={(e) => {
                        // Se a logo falhar, tentar favicon
                        e.target.src = getFaviconUrl(feed.url);
                        e.target.onError = () => {
                          e.target.style.display = 'none';
                          e.target.parentElement.querySelector('.portal-placeholder')?.classList.remove('hidden');
                        };
                      }}
                    />
                  ) : (
                    <>
                      <img 
                        src={getFaviconUrl(feed.url)}
                        alt={feed.name}
                        className="portal-icon"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentElement.querySelector('.portal-placeholder')?.classList.remove('hidden');
                        }}
                      />
                      <div className="portal-placeholder hidden">🎵</div>
                    </>
                  )}
                  {feed.logo && <div className="portal-placeholder hidden">🎵</div>}
                  <span className="portal-name">{feed.name}</span>
                </Link>
              </li>
            ))
          ) : (
            <li className="portal-item empty">
              Nenhum site cadastrado
            </li>
          )}
        </ul>
      </div>
    </aside>
  );
}

export default Portal;
