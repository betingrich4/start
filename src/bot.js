const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, pino } = require('@whiskeysockets/baileys');
const mongoose = require('mongoose');
const { initAutoBio, stopAutoBio } = require('./autobio');
const router = express.Router();

// MongoDB Session Model
const Session = mongoose.model('Session');

router.post('/connect', async (req, res) => {
  const { sessionId } = req.body;
  const session = await Session.findOne({ sessionId });
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { creds, keys, autoBioActive } = session;
  const sock = makeWASocket({
    auth: {
      creds,
      keys: makeCacheableSignalKeyStore(keys, pino({ level: 'fatal' }).child({ level: 'fatal' })),
    },
    logger: pino({ level: 'fatal' }).child({ level: 'fatal' }),
    browser: Browsers.macOS('Safari'),
  });

  sock.ev.on('connection.update', async ({ connection }) => {
    if (connection === 'open') {
      // Initialize auto-bio if active
      if (autoBioActive) {
        await initAutoBio(sock, sessionId);
      }
      res.json({ status: 'connected', sessionId, autoBioActive });
    }
  });

  // Auto view and like statuses
  sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
      for (const msg of messages) {
        if (msg.key.remoteJid === 'status@broadcast') {
          const emojiList = ['❤️', '💸', '😇', '🍂', '💥'];
          const randomEmoji = emojiList[Math.floor(Math.random() * emojiList.length)];
          await sock.readMessages([msg.key]); // Mark status as read
          await sock.sendMessage(msg.key.remoteJid, {
            react: { text: randomEmoji, key: msg.key },
          }, { statusJidList: [msg.key.participant, sock.user.id] });
        }
      }
    } catch (err) {
      console.error('Status reaction error:', err);
    }
  });
});

router.get('/statuses/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const session = await Session.findOne({ sessionId });
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { creds, keys } = session;
  const sock = makeWASocket({
    auth: {
      creds,
      keys: makeCacheableSignalKeyStore(keys, pino({ level: 'fatal' }).child({ level: 'fatal' })),
    },
    logger: pino({ level: 'fatal' }).child({ level: 'fatal' }),
    browser: Browsers.macOS('Safari'),
  });

  const statuses = [];
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (msg.key.remoteJid === 'status@broadcast') {
        statuses.push({
          id: msg.key.id,
          from: msg.key.participant,
          timestamp: msg.messageTimestamp,
          content: msg.message.statusMessage || 'Media',
        });
      }
    }
    await sock.ws.close();
    res.json(statuses);
  });
});

router.post('/like-status', async (req, res) => {
  const { sessionId, statusId, remoteJid } = req.body;
  const session = await Session.findOne({ sessionId });
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { creds, keys } = session;
  const sock = makeWASocket({
    auth: {
      creds,
      keys: makeCacheableSignalKeyStore(keys, pino({ level: 'fatal' }).child({ level: 'fatal' })),
    },
    logger: pino({ level: 'fatal' }).child({ level: 'fatal' }),
    browser: Browsers.macOS('Safari'),
  });

  await sock.sendMessage(remoteJid, { react: { text: '👍', key: { id: statusId, remoteJid } } });
  await sock.ws.close();
  res.json({ status: 'liked' });
});

router.post('/update-bio', async (req, res) => {
  const { sessionId, bio } = req.body;
  const session = await Session.findOne({ sessionId });
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { creds, keys } = session;
  const sock = makeWASocket({
    auth: {
      creds,
      keys: makeCacheableSignalKeyStore(keys, pino({ level: 'fatal' }).child({ level: 'fatal' })),
    },
    logger: pino({ level: 'fatal' }).child({ level: 'fatal' }),
    browser: Browsers.macOS('Safari'),
  });

  await sock.updateProfileStatus(bio);
  await sock.ws.close();
  res.json({ status: 'bio updated' });
});

router.post('/toggle-autobio', async (req, res) => {
  const { sessionId, enable } = req.body;
  const session = await Session.findOne({ sessionId });
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { creds, keys } = session;
  const sock = makeWASocket({
    auth: {
      creds,
      keys: makeCacheableSignalKeyStore(keys, pino({ level: 'fatal' }).child({ level: 'fatal' })),
    },
    logger: pino({ level: 'fatal' }).child({ level: 'fatal' }),
    browser: Browsers.macOS('Safari'),
  });

  if (enable) {
    await initAutoBio(sock, sessionId);
    await Session.updateOne({ sessionId }, { autoBioActive: true });
  } else {
    await stopAutoBio(sessionId);
    await Session.updateOne({ sessionId }, { autoBioActive: false });
  }

  await sock.ws.close();
  res.json({ status: `Auto-bio ${enable ? 'enabled' : 'disabled'}` });
});

module.exports = router;
