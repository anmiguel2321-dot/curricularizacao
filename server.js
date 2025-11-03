require('dotenv').config();
const express = require('express');
const axios = require('axios');
const msal = require('@azure/msal-node');
const path = require('path');
const serverless = require('serverless-http'); // npm install serverless-http

const app = express();
app.use(express.json());

// Serve index.html para a raiz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Variáveis de ambiente (configure no Vercel, não no .env)
const TENANT_ID = process.env.TENANT_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const GROUP_ID = process.env.GROUP_ID; // workspace id
const REPORT_ID = process.env.REPORT_ID;

// Configuração MSAL
const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    clientSecret: CLIENT_SECRET,
  },
};
const cca = new msal.ConfidentialClientApplication(msalConfig);

// Função para pegar access token
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

    const reportResp = await axios.get(
      `https://api.powerbi.com/v1.0/myorg/groups/${GROUP_ID}/reports/${REPORT_ID}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const report = reportResp.data;

    const embedResp = await axios.post(
      `https://api.powerbi.com/v1.0/myorg/groups/${GROUP_ID}/reports/${REPORT_ID}/GenerateToken`,
      { accessLevel: 'View' },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

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

// **IMPORTANTE**: não usar app.listen no Vercel
module.exports = app;
module.exports.handler = serverless(app);
