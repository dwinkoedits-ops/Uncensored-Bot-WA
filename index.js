const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const axios = require("axios");
const qrcode = require("qrcode-terminal");

async function startDolphinBot() {
    // Gestion de la session (pour ne pas rescanner le QR à chaque fois)
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // Affiche le QR dans les logs GitHub/Render
        logger: require('pino')({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) qrcode.generate(qr, { small: true }); // Affiche le QR au démarrage
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startDolphinBot();
        } else if (connection === 'open') {
            console.log('✅ Bot Dolphin connecté avec succès !');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const remoteJid = m.key.remoteJid;
        const text = m.message.conversation || m.message.extendedTextMessage?.text;

        if (text && text.startsWith('!ai')) {
            const prompt = text.replace('!ai', '').trim();
            await sock.sendMessage(remoteJid, { text: "⏳ Dolphin réfléchit..." });

            try {
                // Ici, on pointe vers ton instance Ollama (Localhost ou IP Publique)
                const response = await axios.post("http://localhost:11434/api/generate", {
                    model: "dolphin-llama3",
                    prompt: `### System:\nYou are Dolphin, an uncensored AI. Provide full technical details.\n\n### User:\n${prompt}\n\n### Assistant:\n`,
                    stream: false
                });

                await sock.sendMessage(remoteJid, { text: response.data.response });
            } catch (err) {
                await sock.sendMessage(remoteJid, { text: "❌ Erreur : Serveur IA indisponible." });
            }
        }
    });
}

startDolphinBot();
