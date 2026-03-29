import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import axios from "axios";
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
import Contato from "./Contato";
import CadastrarBanda from "./CadastrarBanda";
import Admin from "./Admin";
import TestImages from "./TestImages";

function App() {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    // Buscar posts na montagem
    axios.get("http://localhost:3000/api/posts")
      .then(res => {
        console.log("🔄 App.jsx - Posts carregados:", res.data.length);
        console.log("   Imagens esperadas de:", "http://localhost:3000/images/...");
        setPosts(res.data);
      })
      .catch(err => console.error("❌ Erro ao carregar posts:", err));

    // Atualizar posts a cada 10 segundos para pegar novos que foram importados
    const interval = setInterval(() => {
      axios.get("http://localhost:3000/api/posts")
        .then(res => setPosts(res.data))
        .catch(err => console.error("❌ Erro ao atualizar posts:", err));
    }, 10000);

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
          <nav className="nav-menu">
            <NavLink to="/">HOME</NavLink>
            <NavLink to="/noticias">NOTÍCIAS</NavLink>
            <NavLink to="/bandas">BANDAS NOVAS</NavLink>
            <NavLink to="/entrevistas">ENTREVISTAS</NavLink>
            <NavLink to="/eventos">EVENTOS</NavLink>
            <NavLink to="/contato">CONTATO</NavLink>
          </nav>
          <button className="menu-toggle">☰</button>
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
          <Route path="/contato" element={<Contato />} />
          <Route path="/cadastrar-banda" element={<CadastrarBanda />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/test-images" element={<TestImages />} />
        </Routes>

        {/* FOOTER */}
        <footer className="footer">
          <img src={logo} alt="Logo" className="footer-logo" />
          <p>© 2026 Comunidade do Rock. O melhor do rock independente brasileiro.</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;