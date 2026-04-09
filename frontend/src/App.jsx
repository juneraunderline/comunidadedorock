import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import API_URL from "./config/api";
import "./style.css";
import logo from "./assets/logo.png";
import hero from "./assets/hero-stage.jpg";
import NavLink from "./NavLink";
import Home from "./Home";
import News from "./News";
import NewsDetail from "./NewsDetail";
import Bandas from "./Bandas";
import BandaDetail from "./BandaDetail";
import Entrevistas from "./Entrevistas";
import EntrevistaDetail from "./EntrevistaDetail";
import Eventos from "./Eventos";
import EventDetail from "./EventDetail";
import Contato from "./Contato";
import CadastrarBanda from "./CadastrarBanda";
import Admin from "./Admin";
import TestImages from "./TestImages";
import Perfil from "./Perfil";
import Login from "./Login";

function App() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("user");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  useEffect(() => {
    // Buscar posts na montagem
    axios.get(`${API_URL}/api/posts`)
      .then(res => {
        console.log("🔄 App.jsx - Posts carregados:", res.data.length);
        setPosts(res.data);
        setLoading(false);
      })
      .catch(err => { console.error("❌ Erro ao carregar posts:", err); setLoading(false); });

    // Atualizar posts a cada 30 segundos
    const interval = setInterval(() => {
      axios.get(`${API_URL}/api/posts`)
        .then(res => setPosts(res.data))
        .catch(err => console.error("❌ Erro ao atualizar posts:", err));
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Router>
      <div className="app">
        {/* HEADER */}
        <header className="header">
          <Link to="/" className="header-logo-link">
            <img src={logo} alt="Comunidade do Rock Logo" className="header-logo" />
          </Link>
          <nav className={`nav-menu${menuOpen ? " open" : ""}`}>
            <NavLink to="/" onClick={() => setMenuOpen(false)}>HOME</NavLink>
            <NavLink to="/noticias" onClick={() => setMenuOpen(false)}>NOTÍCIAS</NavLink>
            <NavLink to="/bandas" onClick={() => setMenuOpen(false)}>BANDAS NOVAS</NavLink>
            <NavLink to="/entrevistas" onClick={() => setMenuOpen(false)}>ENTREVISTAS</NavLink>
            <NavLink to="/eventos" onClick={() => setMenuOpen(false)}>EVENTOS</NavLink>
            <NavLink to="/contato" onClick={() => setMenuOpen(false)}>CONTATO</NavLink>
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
            {user ? (
              <>
                <Link to="/perfil" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{
                    width: "32px", height: "32px", borderRadius: "50%",
                    background: user.avatar ? `url(${user.avatar}) center/cover` : "#e9b61e",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "14px", color: "#fff", border: "2px solid #e9b61e", flexShrink: 0
                  }}>
                    {!user.avatar && (user.display_name || user.username || "U").charAt(0).toUpperCase()}
                  </div>
                  <span style={{ color: "#fff", fontSize: "13px", fontWeight: "600" }} className="user-name-header">
                    {user.display_name || user.username}
                  </span>
                </Link>
                <button onClick={handleLogout} style={{
                  background: "none", border: "1px solid #444", color: "#999",
                  padding: "5px 12px", borderRadius: "4px", cursor: "pointer", fontSize: "11px",
                  fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px"
                }}>
                  Sair
                </button>
              </>
            ) : (
              <Link to="/login" style={{
                background: "#e9b61e", color: "#fff", textDecoration: "none",
                padding: "6px 16px", borderRadius: "4px", fontSize: "12px",
                fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px"
              }}>
                Entrar
              </Link>
            )}
          </div>
          <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? "✕" : "☰"}
          </button>
        </header>

        <Routes>
          <Route path="/" element={<Home posts={posts} />} />
          <Route path="/noticias" element={<News />} />
          <Route path="/noticias/:id" element={<NewsDetail />} />
          <Route path="/bandas" element={<Bandas />} />
          <Route path="/bandas/:id" element={<BandaDetail />} />
          <Route path="/entrevistas" element={<Entrevistas />} />
          <Route path="/entrevistas/:id" element={<EntrevistaDetail />} />
          <Route path="/eventos" element={<Eventos />} />
          <Route path="/eventos/:id" element={<EventDetail />} />
          <Route path="/contato" element={<Contato />} />
          <Route path="/cadastrar-banda" element={<CadastrarBanda />} />
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/perfil" element={<Perfil user={user} setUser={handleLogin} />} />
          <Route path="/admin" element={<Admin user={user} />} />
          <Route path="/test-images" element={<TestImages />} />
        </Routes>

        {/* FOOTER */}
        <footer className="footer">
          <div style={{ maxWidth: "400px", margin: "0 auto 16px" }}>
            <iframe
              src="https://open.spotify.com/embed/playlist/3pDLG8bJG1FtGjXmFnNT3D?utm_source=generator&theme=0"
              width="100%"
              height="80"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              style={{ borderRadius: "8px", border: "none" }}
            ></iframe>
          </div>
          <img src={logo} alt="Logo" className="footer-logo" />
          <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginBottom: "16px" }}>
            <a href="https://www.instagram.com/comunidadedorock" target="_blank" rel="noopener noreferrer" title="Instagram" style={{ color: "#999", fontSize: "24px", textDecoration: "none", transition: "color 0.3s" }} onMouseEnter={e => e.target.style.color = "#e9b61e"} onMouseLeave={e => e.target.style.color = "#999"}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            </a>
            <a href="https://www.tiktok.com/@comunidadedorock" target="_blank" rel="noopener noreferrer" title="TikTok" style={{ color: "#999", fontSize: "24px", textDecoration: "none", transition: "color 0.3s" }} onMouseEnter={e => e.target.style.color = "#e9b61e"} onMouseLeave={e => e.target.style.color = "#999"}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.75a8.18 8.18 0 004.76 1.52V6.84a4.84 4.84 0 01-1-.15z"/></svg>
            </a>
            <a href="https://www.youtube.com/@comunidadedorockbr" target="_blank" rel="noopener noreferrer" title="YouTube" style={{ color: "#999", fontSize: "24px", textDecoration: "none", transition: "color 0.3s" }} onMouseEnter={e => e.target.style.color = "#e9b61e"} onMouseLeave={e => e.target.style.color = "#999"}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            </a>
          </div>
          <p>© 2026 Comunidade do Rock. O melhor do rock independente brasileiro.</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;
