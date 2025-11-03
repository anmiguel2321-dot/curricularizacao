require('dotenv').config();
const express = require('express');
const axios = require('axios');
const msal = require('@azure/msal-node');

const app = express();
app.use(express.json());
app.use(express.static(__dirname)); // serve index.html

// Variáveis do .env
const TENANT_ID = process.env.TENANT_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const GROUP_ID = process.env.GROUP_ID; // workspace id
const REPORT_ID = process.env.REPORT_ID;

const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    clientSecret: CLIENT_SECRET,
  },
};

const cca = new msal.ConfidentialClientApplication(msalConfig);

// Função para pegar access token do AAD
async function getAccessToken() {
  const tokenResponse = await cca.acquireTokenByClientCredential({
    scopes: ['https://analysis.windows.net/powerbi/api/.default'],
  });
  return tokenResponse.accessToken;
}

// Endpoint para gerar embed token
app.get('/api/embed-token', async (req, res) => {
  try {
    const accessToken = await getAccessToken();

    // Pega info do relatório
    const reportResp = await axios.get(
      `https://api.powerbi.com/v1.0/myorg/groups/${GROUP_ID}/reports/${REPORT_ID}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const report = reportResp.data;

    // Gera embed token pelo endpoint correto
    const embedResp = await axios.post(
      `https://api.powerbi.com/v1.0/myorg/groups/${GROUP_ID}/reports/${REPORT_ID}/GenerateToken`,
      {
        accessLevel: "View" // "View" ou "Edit"
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    console.log("Embed token gerado:", embedResp.data);

    res.json({
      embedToken: embedResp.data.token,
      embedUrl: report.embedUrl,
      reportId: REPORT_ID,
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Falha ao gerar embed token' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
