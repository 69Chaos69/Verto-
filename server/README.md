# 🚀 EstoquePro - Servidor Backend & Banco de Dados (Ubuntu)

Este é o servidor backend em **Node.js** com banco de dados **SQLite** para o **EstoquePro**.

---

## 📋 Como Rodar no Ubuntu (Passo a Passo)

### 1. Instalar Node.js e Dependências no Ubuntu
Abra o terminal do seu Ubuntu e rode os comandos:

```bash
# Atualizar repositórios
sudo apt update

# Instalar Node.js e NPM (caso ainda não tenha)
sudo apt install -y nodejs npm

# Entrar na pasta do servidor (ajuste o caminho se necessário)
cd server

# Instalar as bibliotecas do servidor
npm install
```

---

### 2. Iniciar o Servidor

```bash
npm start
```
Você verá a mensagem:
`🚀 Servidor EstoquePro rodando na porta 3000`

---

### 3. Deixar o Servidor Rodando 24h em Segundo Plano (Opcional - Recomendado)
Para o servidor não fechar quando você fechar o terminal do Ubuntu:

```bash
# Instalar o gerenciador PM2
sudo npm install -g pm2

# Iniciar o servidor com PM2
pm2 start server.js --name estoquepro-server

# Fazer o PM2 iniciar sozinho sempre que o notebook ligar
pm2 startup
pm2 save
```

---

### 4. Gerar o Link HTTPS Público Gratuito (Cloudflare Tunnel)
Para a Vercel e seu celular conseguirem acessar o servidor de qualquer lugar:

```bash
# Baixar o cloudflared no Ubuntu
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

# Iniciar o túnel gratuito para a porta 3000
cloudflared tunnel --url http://localhost:3000
```

Copie a URL `https://xxxxxx.trycloudflare.com` que aparecer no terminal e cole no EstoquePro no botão **"Configurar Servidor"**!
