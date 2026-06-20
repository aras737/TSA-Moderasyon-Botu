const express = require('express');
const { InteractionType, InteractionResponseType, verifyKeyMiddleware } = require('discord-interactions');
const app = express();
const PORT = process.env.PORT || 3000;

// Vercel panelinden ekleyeceğimiz genel anahtar
const CLIENT_PUBLIC_KEY = process.env.PUBLIC_KEY;

// Discord'un güvenlik doğrulamasını yapacağı özel kapı (Route)
app.post('/interactions', verifyKeyMiddleware(CLIENT_PUBLIC_KEY), (req, res) => {
  const { type } = req.body;

  // Discord'un gönderdiği doğrulama (PING) isteği buraya düşer
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  // İleride yazacağın Slash komutların tetiklendiğinde burası çalışacak
  if (type === InteractionType.APPLICATION_COMMAND) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: 'Vercel üzerinden başarıyla yanıt verildi!' }
    });
  }
});

app.get('/', (req, res) => {
  res.send('Bot Webhook Sunucusu Aktif!');
});

app.listen(PORT, () => {
  console.log(`Bot ${PORT} portunda dinleniyor.`);
});

module.exports = app; // Vercel için kritik satır
