const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const path = require('path');

const app = express();
app.use(cors());

const PORT = 5001;
const SPREADSHEET_ID = '1CZSXkDPMPCgVawL74UQyXFHP_psmR7HmWYz25eacT6M';
const SHEET_NAME = 'data';

async function getQuestions() {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, '../config/credentials.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:S`,
  });
  const questions = res.data.values.map(row => ({
    id: row[0],
    category: row[1],
    detailCategory: row[2],
    subCategory: row[3] || '', // D列の小分類
    question: row[4],
    answer: row[5],
    type: row[6],
    level: row[7],
    imageUrl: row[8],
    hint: row[9] || '',
    choice1: row[12] || '',
    choice2: row[13] || '',
    choice3: row[14] || '',
    choice4: row[15] || '',
    choice5: row[16] || '',
    choice6: row[17] || '',
    choice7: row[18] || '',
  }));
  return questions;
}

app.get('/api/questions', async (req, res) => {
  try {
    const questions = await getQuestions();
    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
}); 