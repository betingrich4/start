const express = require('express');
const { makeid } = require('./gen-id');
const { default: makeWASocket, useMultiFileAuthState, delay, Browsers, makeCacheableSignalKeyStore, pino } = require('@whiskeysockets/baileys');
const mongoose = require('mongoose');
const { initAutoBio } = require('./autobio');
const router = express.Router();

// MongoDB Schema for sessions
const sessionSchema = new mongoose.Schema({
  sessionId: String,
  creds: Object,
  keys: Object,
  autoBioActive: { type: Boolean, default: true },
});
const Session = mongoose.model('Session', sessionSchema);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).catch(err => console.error('MongoDB connection error:', err));

router.get('/', async (req, res) => {
  const id = makeid();
  let num = req.query.number;

  async function generatePairingCode() {
    const { state, saveCreds } = await useMultiFileAuthState(`./temp/${id}`);
    try {
      const sock = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }).child({ level: 'fatal' })),
        },
        printQRInTerminal: false,
        logger: pino({ level: 'fatal' }).child({ level: 'fatal' }),
        browser: Browsers.macOS('Safari'),
      });

      if (!sock.authState.creds.registered) {
        await delay(1500);
        num = num.replace(/[^0-9]/g, '');
        const code = await sock.requestPairingCode(num);
        await res.send({ code, sessionId: id });

        // Save session to MongoDB
        await Session.create({
          sessionId: id,
          creds: state.creds,
          keys: state.keys,
          autoBioActive: true,
        });
      }

      sock.ev.on('creds.update', saveCreds);
      sock.ev.on('connection.update', async ({ connection }) => {
        if (connection === 'open') {
          console.log(`Session ${id} connected`);
          // Initialize auto-bio for this session
          await initAutoBio(sock, id);
          await delay(5000);
          await sock.ws.close();
        }
      });
    } catch (err) {
      console.error('Error generating pairing code:', err);
      await res.send({ code: 'Service Unavailable' });
    }
  }

  await generatePairingCode();
});

module.exports = router;
