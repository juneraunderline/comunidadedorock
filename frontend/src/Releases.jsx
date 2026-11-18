import { useEffect, useState } from "react";
import axios from "axios";
import API_URL, { getImageUrl } from "./config/api";

export default function Releases() {
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let active = true;
    axios.get(`${API_URL}/api/releases?limit=50`, { timeout: 25000 })
      .then(res => { if (active) setReleases(Array.isArray(res.data) ? res.data : []); })
      .catch(() => { if (active) setError("Não foi possível carregar os lançamentos. Tente novamente."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <main className="page-container cdr-releases-page" style={{ maxWidth: "980px", margin: "0 auto", padding: "104px 20px 60px", minHeight: "55vh", position: "relative", overflow: "visible" }}>
      <style>{`
        .cdr-releases-page .cdr-releases-heading { position:relative; z-index:2; display:flex; align-items:center; justify-content:flex-start; gap:16px; width:100%; min-height:58px; box-sizing:border-box; overflow:visible; margin:0 0 26px; padding:12px 0 18px; border-bottom:1px solid #292930; }
        .cdr-releases-page .cdr-releases-heading h1 { display:block !important; visibility:visible !important; opacity:1 !important; position:relative; width:100%; height:auto; max-height:none; overflow:visible !important; margin:0 !important; padding:0 !important; color:#fff !important; font-size:clamp(22px,3vw,30px) !important; line-height:1.35 !important; font-weight:900 !important; letter-spacing:.3px; white-space:normal; }
        .cdr-releases-page .cdr-releases-heading h1 span { color:#e9b61e !important; }
        .cdr-releases-page .cdr-release-more-wrap { display:flex; justify-content:center; margin-top:20px; }
        .cdr-releases-page .cdr-release-more { min-width:160px; padding:11px 22px; border:1px solid #e9b61e; border-radius:6px; background:#e9b61e; color:#17130a; font-size:12px; font-weight:900; letter-spacing:.35px; cursor:pointer; transition:background .18s,border-color .18s,transform .18s; }
        .cdr-releases-page .cdr-release-more:hover { background:#f4c735; border-color:#f4c735; transform:translateY(-1px); }
        .cdr-releases-page .cdr-release-list { display:flex; flex-direction:column; gap:12px; }
        .cdr-releases-page .cdr-release-item { display:grid; grid-template-columns:116px minmax(0,1fr); align-items:center; gap:18px; min-width:0; padding:12px; background:#141419; border:1px solid #292930; border-radius:10px; transition:border-color .18s ease,background .18s ease; }
        .cdr-releases-page .cdr-release-item:hover { border-color:#66531d; background:#18181e; }
        .cdr-releases-page .cdr-release-art { position:relative; width:116px; height:116px; overflow:hidden; border-radius:7px; background:#09090c; }
        .cdr-releases-page .cdr-release-art img { display:block; width:100%; height:100%; object-fit:cover; }
        .cdr-releases-page .cdr-release-placeholder { display:grid; place-items:center; width:100%; height:100%; color:#777; font-size:30px; }
        .cdr-releases-page .cdr-release-type { position:absolute; top:7px; left:7px; padding:4px 7px; border-radius:4px; background:#e9b61e; color:#17130a; font-size:9px; line-height:1.2; font-weight:900; text-transform:uppercase; letter-spacing:.35px; }
        .cdr-releases-page .cdr-release-info { min-width:0; }
        .cdr-releases-page .cdr-release-meta { display:flex; flex-wrap:wrap; align-items:center; gap:5px 10px; margin-bottom:7px; color:#e9b61e; font-size:11px; line-height:1.4; font-weight:800; text-transform:uppercase; letter-spacing:.35px; }
        .cdr-releases-page .cdr-release-date { color:#888; font-weight:600; }
        .cdr-releases-page .cdr-release-title { margin:0; color:#fff; font-size:17px; line-height:1.3; font-weight:800; overflow-wrap:anywhere; }
        .cdr-releases-page .cdr-release-actions { display:flex; flex-wrap:wrap; gap:7px; margin-top:11px; }
        .cdr-releases-page .cdr-release-actions a { display:inline-flex; align-items:center; justify-content:center; min-height:32px; padding:6px 10px; border:1px solid #35353d; border-radius:5px; background:#202027; color:#e5e5e8; font-size:11px; line-height:1.2; font-weight:700; text-decoration:none; transition:border-color .18s,color .18s,background .18s; }
        .cdr-releases-page .cdr-release-actions a:hover { border-color:#e9b61e; color:#e9b61e; background:#252219; }
        @media(max-width:600px) {
          .cdr-releases-page { padding:100px 14px 42px !important; }
          .cdr-releases-page .cdr-releases-heading { min-height:54px; margin-bottom:18px; padding:10px 0 14px; }
          .cdr-releases-page .cdr-release-list { gap:10px; }
          .cdr-releases-page .cdr-release-item { grid-template-columns:92px minmax(0,1fr); gap:12px; padding:9px; border-radius:8px; }
          .cdr-releases-page .cdr-release-art { width:92px; height:92px; }
          .cdr-releases-page .cdr-release-type { top:5px; left:5px; padding:3px 5px; font-size:8px; }
          .cdr-releases-page .cdr-release-meta { gap:3px 7px; margin-bottom:5px; font-size:9px; }
          .cdr-releases-page .cdr-release-title { font-size:14px; line-height:1.25; }
          .cdr-releases-page .cdr-release-actions { gap:6px; margin-top:8px; }
          .cdr-releases-page .cdr-release-actions a { min-height:29px; padding:5px 8px; font-size:10px; }
        }
        @media(max-width:360px) {
          .cdr-releases-page .cdr-release-item { grid-template-columns:78px minmax(0,1fr); gap:9px; }
          .cdr-releases-page .cdr-release-art { width:78px; height:78px; }
          .cdr-releases-page .cdr-release-title { font-size:13px; }
        }
      `}</style>

      <div className="cdr-releases-heading">
        <h1>LANÇAMENTOS <span>DA CENA</span></h1>
      </div>

      {loading ? (
        <p style={{ color:"#aaa", textAlign:"center", padding:"40px" }}>Carregando lançamentos…</p>
      ) : error ? (
        <p style={{ color:"#aaa", textAlign:"center", padding:"40px" }}>{error}</p>
      ) : releases.length ? (
        <div className="cdr-release-list">
          {releases.slice(0, showAll ? releases.length : 3).map(r => (
            <article className="cdr-release-item" key={r.id}>
              <div className="cdr-release-art">
                {r.image ? <img src={getImageUrl(r.image)} alt={r.title} loading="lazy" /> : <div className="cdr-release-placeholder">🎧</div>}
                <span className="cdr-release-type">{r.type || "Single"}</span>
              </div>
              <div className="cdr-release-info">
                <div className="cdr-release-meta">
                  <span>{(r.artist || "").replace(/\s*·\s*$/, "")}</span>
                  {r.release_date && <span className="cdr-release-date">{new Date(r.release_date + "T00:00:00").toLocaleDateString("pt-BR")}</span>}
                </div>
                <h2 className="cdr-release-title">{r.title}</h2>
                {(r.spotify || r.youtube) && (
                  <div className="cdr-release-actions">
                    {r.spotify && <a href={r.spotify} target="_blank" rel="noopener noreferrer">♫ Spotify</a>}
                    {r.youtube && <a href={r.youtube} target="_blank" rel="noopener noreferrer">▶ YouTube</a>}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p style={{ color:"#888", textAlign:"center", padding:"40px" }}>Nenhum lançamento publicado ainda.</p>
      )}
      {!loading && !error && releases.length > 3 && (
        <div className="cdr-release-more-wrap">
          <button className="cdr-release-more" type="button" onClick={() => setShowAll(value => !value)}>
            {showAll ? "MOSTRAR MENOS" : "MOSTRAR MAIS"}
          </button>
        </div>
      )}
    </main>
  );
}
