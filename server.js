import 'dotenv/config';
import axios from 'axios';
import msal from '@azure/msal-node';

export default async function handler(req, res) {
  const TENANT_ID = process.env.TENANT_ID;
  const CLIENT_ID = process.env.CLIENT_ID;
  const CLIENT_SECRET = process.env.CLIENT_SECRET;
  const GROUP_ID = process.env.GROUP_ID;
  const REPORT_ID = process.env.REPORT_ID;

  const cca = new msal.ConfidentialClientApplication({
    auth: { clientId: CLIENT_ID, authority: `https://login.microsoftonline.com/${TENANT_ID}`, clientSecret: CLIENT_SECRET }
  });

  try {
    const tokenResponse = await cca.acquireTokenByClientCredential({
      scopes: ['https://analysis.windows.net/powerbi/api/.default']
    });
    const accessToken = tokenResponse.accessToken;

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

    res.status(200).json({
      embedToken: embedResp.data.token,
      embedUrl: report.embedUrl,
      reportId: REPORT_ID
    });

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Falha ao gerar embed token' });
  }
}
