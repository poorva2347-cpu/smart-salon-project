require('dotenv').config();

const path     = require('path');
const express  = require('express');
const cors     = require('cors');
const pool     = require('./config/db');
const authRoutes          = require('./routes/auth');
const profileRoutes       = require('./routes/profile');
const servicesRoutes      = require('./routes/services');
const barbersRoutes       = require('./routes/barbers');
const appointmentsRoutes  = require('./routes/appointments');
const adminRoutes         = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 3000;

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/', authRoutes);
app.use('/', profileRoutes);
app.use('/', servicesRoutes);
app.use('/', barbersRoutes);
app.use('/', appointmentsRoutes);
app.use('/', adminRoutes);

app.post('/chat', async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required.' });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY is not set in .env.' });
  }

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + process.env.OPENROUTER_API_KEY,
        'HTTP-Referer':  process.env.SITE_URL  || 'http://localhost',
        'X-Title':       process.env.SITE_NAME || 'Smart Salon'
      },
      body: JSON.stringify({
        model:    process.env.MODEL || 'openai/gpt-3.5-turbo',
        messages: messages
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('OpenRouter error:', response.status, errorBody);
      return res.status(502).json({ error: 'OpenRouter request failed.', status: response.status });
    }

    const data  = await response.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res.status(502).json({ error: 'Empty response from OpenRouter.' });
    }

    return res.json({ reply });

  } catch (err) {
    console.error('Server error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

app.listen(PORT, async () => {
  try {
    const conn = await pool.getConnection();
    conn.release();
    console.log('Database Connected Successfully');
  } catch (err) {
    console.error('Database Connection Failed:', err.message);
  }
  console.log('Smart Salon backend running on port ' + PORT);
});
