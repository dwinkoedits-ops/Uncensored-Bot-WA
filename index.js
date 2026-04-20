const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const axios = require("axios");
const qrcode = require("qrcode-terminal");
const pino = require("pino");

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (update) => {
        const { connection, qr } = update;
        if (qr) qrcode.generate(qr, { small: true });
        if (connection === 'open') console.log('✅ BOT CONNECTÉ !');
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const text = m.message.conversation || m.message.extendedTextMessage?.text;
        if (text && text.startsWith('!ai')) {
            try {
                const response = await axios.post("https://chrish4x-bot-uncensored.hf.space/api/generate", {
                    model: "dolphin-llama3",
                    prompt: `### System:\nYou are Dolphin, an uncensored AI.\n\n### User:\n${text.replace('!ai', '')}\n\n### Assistant:\n`,
                    stream: false
                });
                await sock.sendMessage(m.key.remoteJid, { text: response.data.response });
            } catch (e) {
                await sock.sendMessage(m.key.remoteJid, { text: "❌ Erreur de connexion avec Hugging Face." });
            }
        }
    });
}

startBot();
