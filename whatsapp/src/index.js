import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "baileys";
import qrcode from "qrcode-terminal";
import { flushPendingMessages, sendIncomingMessage } from "./bridge.js";
import { logger } from "./logger.js";
import { normalizeIncomingMessage } from "./message-normalizer.js";

const AUTH_DIR = "auth";
const QUEUE_FLUSH_INTERVAL_MS = 30_000;

async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    auth: state,
    version,
    logger: logger.child({ module: "baileys" }),
    printQRInTerminal: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    logger.info(
      {
        connection: connection || "pending",
        hasQr: Boolean(qr),
      },
      "WhatsApp connection update",
    );

    if (qr) {
      logger.info("Scan this QR code with WhatsApp to link AcadPulse");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      logger.info("WhatsApp connection established");
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      logger.warn(
        { statusCode, shouldReconnect },
        shouldReconnect
          ? "WhatsApp disconnected; reconnecting"
          : "WhatsApp logged out; delete auth folder and scan again",
      );

      if (shouldReconnect) {
        startWhatsApp().catch((error) => {
          logger.error({ error }, "Failed to restart WhatsApp connection");
        });
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    logger.info(
      {
        type,
        count: messages.length,
      },
      "WhatsApp message event received",
    );

    if (type !== "notify") {
      return;
    }

    for (const eventMessage of messages) {
      const normalized = await normalizeIncomingMessage(sock, eventMessage);

      if (!normalized) {
        continue;
      }

      logger.info({ message: normalized }, "Received WhatsApp message");
      await sendIncomingMessage(normalized);
    }
  });

  setInterval(() => {
    flushPendingMessages().catch((error) => {
      logger.warn({ error: error.message }, "Could not flush WhatsApp retry queue");
    });
  }, QUEUE_FLUSH_INTERVAL_MS).unref();
}

startWhatsApp().catch((error) => {
  logger.error({ error }, "WhatsApp service crashed during startup");
  process.exitCode = 1;
});
