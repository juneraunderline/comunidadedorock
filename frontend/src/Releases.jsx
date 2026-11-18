import { useEffect, useState } from "react";
import axios from "axios";
import API_URL, { getImageUrl } from "./config/api";

export default function Releases() {
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    axios.get(`${API_URL}/api/releases?limit=50`, { timeout: 25000 })
      .then(res => { if (active) setReleases(Array.isArray(res.data) ? res.data : []); })
      .catch(() => { if (active) setError("Não foi possível carregar os lançamentos. Tente novamente."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return (
    <main className="page-container" style={{maxWidth:"1100px",margin:"0 auto",padding:"36px 20px 60px",minHeight:"55vh"}}>
      <div className="section-header"><h1>LANÇAMENTOS <span className="highlight">DA CENA</span></h1></div>
      {loading ? <p style={{color:"#aaa",textAlign:"center",padding:"40px"}}>Carregando lançamentos…</p> :
       error ? <p style={{color:"#aaa",textAlign:"center",padding:"40px"}}>{error}</p> :
       releases.length ? <div className="grid grid-2">
        {releases.map(r => <article className="release-card" key={r.id}>
          <div className="release-image">{r.image ? <img src={getImageUrl(r.image)} alt={r.title} loading="lazy" /> : <div className="release-placeholder">🎧</div>}<span>{r.type || "Single"}</span></div>
          <div className="release-content"><small>{(r.artist || "").replace(/\s*·\s*$/, "")}{r.release_date ? " " + new Date(r.release_date + "T00:00:00").toLocaleDateString("pt-BR") : ""}</small><h3>{r.title}</h3><div className="release-actions">{r.spotify && <a href={r.spotify} target="_blank" rel="noopener noreferrer">🎧 Spotify</a>}{r.youtube && <a href={r.youtube} target="_blank" rel="noopener noreferrer">▶ YouTube</a>}</div></div>
        </article>)}
       </div> : <p style={{color:"#888",textAlign:"center",padding:"40px"}}>Nenhum lançamento publicado ainda.</p>}
    </main>
  );
}
