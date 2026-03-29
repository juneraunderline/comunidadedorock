import { Link, useLocation } from "react-router-dom";

function NavLink({ to, children }) {
  const location = useLocation();
  
  // Comparar a rota atual com o destino
  // Para rotas exatas como /noticias, /bandas, etc
  const isActive = location.pathname === to || 
                   (to === "/" && location.pathname === "/");
  
  // Para rotas que começam com /noticias ou /bandas (includes detail pages)
  const isDetailPage = (to === "/noticias" && location.pathname.startsWith("/noticias")) ||
                       (to === "/bandas" && location.pathname.startsWith("/bandas"));
  
  const finalIsActive = isActive || isDetailPage;

  return (
    <Link 
      to={to} 
      className={`nav-link ${finalIsActive ? "active" : ""}`}
    >
      {children}
    </Link>
  );
}

export default NavLink;
