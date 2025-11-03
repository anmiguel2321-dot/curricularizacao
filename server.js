require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const msal = require('@azure/msal-node');

const TENANT_ID = process.env.TENANT_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const GROUP_ID = process.env.GROUP_ID;
const REPORT_ID = process.env.REPORT_ID;

const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    clientSecret: CLIENT_SECRET,
  },
};

const cca = new msal.ConfidentialClientApplication(msalConfig);

async function getAccessToken() {
  const tokenResponse = await cca.acquireTokenByClientCredential({
    scopes: ['https://analysis.windows.net/powerbi/api/.default'],
  });
  return tokenResponse.accessToken;
}

module.exports = async (req, res) => {
  const url = req.url.split('?')[0]; // ignora parâmetros da query
  const query = new URLSearchParams(req.url.split('?')[1] || '');
  const alunoId = query.get('alunoId'); // captura ?alunoId=101 se existir

  // ✅ Serve o index.html na raiz, mesmo com ?alunoId=...
  if (url === '/' || url === '/index.html') {
    const filePath = path.join(__dirname, 'index.html');
    let html = fs.readFileSync(filePath, 'utf8');

    // (Opcional) injeta o alunoId no HTML como variável JS global
    if (alunoId) {
      html = html.replace(
        '</body>',
        `<script>window.alunoId = "${alunoId}";</script></body>`
      );
    }

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
    return;
  }

  // ✅ Endpoint para gerar o embed token
  if (url.startsWith('/api/embed-token')) {
    try {
      const accessToken = await getAccessToken();

      const reportResp = await axios.get(
        `https://api.powerbi.com/v1.0/myorg/groups/${GROUP_ID}/reports/${REPORT_ID}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const embedResp = await axios.post(
        `https://api.powerbi.com/v1.0/myorg/groups/${GROUP_ID}/reports/${REPORT_ID}/GenerateToken`,
        { accessLevel: 'View' },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      res.setHeader('Content-Type', 'application/json');
      res.status(200).json({
        embedToken: embedResp.data.token,
        embedUrl: reportResp.data.embedUrl,
        reportId: REPORT_ID,
      });
    } catch (err) {
      console.error(err.response?.data || err.message);
      res.status(500).json({ error: 'Falha ao gerar embed token' });
    }
    return;
  }

  // ❌ Rota não encontrada
  res.status(404).send('Rota não encontrada');
};
