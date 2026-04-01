# 🚀 GUIA DEPLOY - ROCK INDEPENDENTE

## Opções Recomendadas

### Opção 1: **Railway** (Recomendado - Tudo integrado)
- ✅ Front + Backend: **$5-10/mês**
- ✅ Banco de dados PostgreSQL ou MySQL incluído
- ✅ Deploy automático GitHub
- ✅ Domínio próprio suportado

### Opção 2: **Vercel + Railway**
- ✅ Frontend Vercel: **GRATUITO** (deploy instantâneo)
- ✅ Backend Railway: **~$5/mês**
- ✅ Melhor separação de responsabilidades

---

## 📋 PRÉ-REQUISITOS

1. **GitHub Account** - Para versionamento
2. **Domínio próprio** (opcional) - Já tem
3. **Railway.app Account** - Gratuito (https://railway.app)

---

## 🎯 PASSOS DE DEPLOY COM RAILWAY

### 1️⃣ Preparar Repositório Git

```bash
# Na raiz do projeto
git init
git add .
git commit -m "Initial commit - Rock Independente"
git remote add origin https://github.com/seu-usuario/rock-independente.git
git branch -M main
git push -u origin main
```

### 2️⃣ Criar Conta Railway

1. Acesse https://railway.app
2. Clique em "Sign in with GitHub"
3. Autorize Railway a acessar seus repositórios

### 3️⃣ Deploy do Backend

**No Railway Dashboard:**

1. Clique em "+ New"
2. Selecione "GitHub Repo" (ou "Deploy from repo")
3. Selecione seu repositório `rock-independente`
4. Configure:
   - **Root directory**: `backend`
   - **Build command**: `npm install`
   - **Start command**: `npm start`

5. Clique em "Deploy"
6. Railway vai atribuir uma URL automática (ex: `https://app-production-abc123.up.railway.app`)
7. Copie essa URL - você vai precisar

### 4️⃣ Deploy do Frontend (Estático)

**No Railway Dashboard:**

1. Crie um novo serviço "+ New"
2. Selecione "GitHub Repo"
3. Mesmo repositório, mas:
   - **Root directory**: `frontend`
   - **Build command**: `npm run build`
   - **Start command**: `npm run preview` OU use `npx serve -s dist`

**OU use Vercel (mais fácil):**

1. Acesse https://vercel.com
2. Clique "Import Project"
3. Selecione seu repositório GitHub
4. Configure:
   - **Root directory**: `frontend`
   - **Build command**: `npm run build`
   - **Output directory**: `dist`
5. Clique "Deploy"

### 5️⃣ Configurar URLs (IMPORTANTE!)

**Atualizar Frontend para usar URL do Backend em Produção:**

Edite `frontend/src/App.jsx` ou `Admin.jsx` e altere:

```javascript
// De:
axios.get("http://localhost:3000/api/posts")

// Para:
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";
axios.get(`${API_URL}/api/posts`)
```

**Variáveis de Ambiente (Frontend):**

No Vercel, vá para **Settings > Environment Variables**:
```
REACT_APP_API_URL = https://seu-backend-railway.up.railway.app
```

### 6️⃣ Conectar Domínio Próprio

**Em Railway (Backend):**

1. Vá para seu serviço
2. **Settings > Environment**
3. Clique em "Generate Domain"
4. Vai gerar algo como `rock-api.railway.app`

**Adicionar domínio próprio:**

1. Vá para seu registrador de domínio
2. Configure subdomain como CNAME:
   ```
   Subdomain: api
   CNAME: seu-railway-domain.railway.app
   ```

**Em Vercel (Frontend):**

1. Vá para **Settings > Domains**
2. Adicione seu domínio
3. Siga as instruções de configuração DNS
4. Configure:
   ```
   Domínio: seudominio.com
   CNAME: cname.vercel-dns.com
   ```

---

## 🔐 Variáveis de Ambiente

### Backend (.env)

```env
PORT=3000
NODE_ENV=production
DB_PATH=./database.db
```

### Frontend (.env)

```env
VITE_API_URL=https://seudominio.com/api
```

---

## 📱 Checklist Final

- [ ] GitHub Push realizado
- [ ] Conta Railway criada
- [ ] Backend deployado no Railway
- [ ] Frontend deployado (Vercel ou Railway)
- [ ] URLs atualizadas
- [ ] Domínio conectado
- [ ] Admin testado em produção
- [ ] Ingressos dos eventos funcionando

---

## 🆘 Troubleshooting

### Backend retorna 404

**Causa**: Frontend está tentando acessar `http://localhost:3000`

**Solução**: Verificar variável de ambiente `REACT_APP_API_URL`

### Imagens não carregam

**Causa**: URLs relativas `/images/...` não funcionam em produção

**Solução**: Garantir que backend está servindo `/images` com CORS habilitado

### CORS errors

**Causa**: Frontend e Backend em domínios diferentes

**Solução**: Backend já tem CORS configurado com `*`, mas melhor especificar:

```javascript
app.use(cors({
  origin: "https://seudominio.com",
  credentials: true
}));
```

---

## 📞 Contactos Úteis

- **Railway Support**: https://docs.railway.app
- **Vercel Docs**: https://vercel.com/docs
- **GitHub Actions**: Para CI/CD automático

---

## 💡 Próximos Passos

1. Testar tudo localmente (`npm start` backend + frontend)
2. Fazer commit e push para GitHub
3. Seguir passos de deploy
4. Testar em produção
5. Configurar domínio permanente

Boa sorte! 🎸🔥
