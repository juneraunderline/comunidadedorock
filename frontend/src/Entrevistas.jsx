import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

function Entrevistas() {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get("http://localhost:3000/api/interviews")
      .then(res => {
        setInterviews(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Erro ao carregar entrevistas:", err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div><p>Carregando...</p></div>;

  return (
    <div>
      {/* ENTREVISTAS */}
      <section className="section">
        <div className="section-header">
          <h2>ÚLTIMAS <span className="highlight">ENTREVISTAS</span></h2>
        </div>
        <div className="grid grid-4">
          {interviews.length === 0 ? (
            <p style={{ gridColumn: "1 / -1", textAlign: "center", color: "#888" }}>Nenhuma entrevista publicada</p>
          ) : (
            interviews.map(interview => (
              <div 
                key={interview.id} 
                className="card"
                onClick={() => navigate(`/entrevistas/${interview.id}`)}
                style={{ cursor: "pointer" }}
              >
                <div className="card-image">
                  <img 
                    src={interview.image || "https://images.unsplash.com/photo-1516450360452-9312f5ff84d4?w=300&h=300&fit=crop"} 
                    alt={interview.title} 
                  />
                </div>
                <div className="card-content">
                  <h3>{interview.title}</h3>
                  <p><strong>{interview.artist}</strong></p>
                  <p>{interview.content ? interview.content.substring(0, 80) : "Sem descrição"}...</p>
                  <small>Publicado em {interview.date || new Date(interview.created_at).toLocaleDateString("pt-BR")}</small>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export default Entrevistas;