import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import {
  getStealthSocketConfig,
  rampPresenceAfterConnect,
  wrapSocket,
} from "baileys-antiban";
import "dotenv/config";
import qrcode from "qrcode-terminal";
import pino from "pino";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { sendToFastAPI } from "./sender.js";

const SESSION_ROOT = process.env.WHATSAPP_SESSION_PATH || "./sessions";
const DEFAULT_USER_ID = process.env.WHATSAPP_USER_ID || "test-user";
const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const RECONNECT_DELAY_MS = 5_000;
const MIN_PROCESSING_DELAY_MS = 700;
const MAX_PROCESSING_DELAY_MS = 3_500;

const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const activeSessions = new Map();
const connectionTimes = new Map();
const presenceControllers = new Map();

async function startSession(userId) {
  const sessionPath = path.join(SESSION_ROOT, userId);
  await mkdir(sessionPath, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();
  const presenceController = new AbortController();

  presenceControllers.get(userId)?.abort();
  presenceControllers.set(userId, presenceController);

  const rawSock = makeWASocket({
    ...getStealthSocketConfig({ os: "AcadPulse" }),
    auth: state,
    version,
    logger: logger.child({ module: "baileys", userId }),
    printQRInTerminal: false,
    syncFullHistory: false,
  });

  const sock = wrapSocket(rawSock, {
    preset: "conservative",
    persist: path.join(sessionPath, "antiban-state.json"),
    logging: true,
  });

  connectionTimes.set(userId, Date.now());
  activeSessions.set(userId, sock);

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      logger.info({ userId }, "Scan this QR code with WhatsApp");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      connectionTimes.set(userId, Date.now());
      logger.info({ userId }, "WhatsApp connected successfully");
      rampPresenceAfterConnect(sock, {
        minDelayMs: 30_000,
        maxDelayMs: 90_000,
        signal: presenceController.signal,
      }).catch((error) => {
        if (error?.name !== "AbortError") {
          logger.warn({ userId, error: error.message }, "Presence ramp failed");
        }
      });
    }

    if (connection === "close") {
      presenceController.abort();
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      logger.warn(
        { userId, statusCode, shouldReconnect },
        "WhatsApp connection closed",
      );

      if (shouldReconnect) {
        setTimeout(() => {
          startSessionWithMonitor(userId).catch((error) => {
            logger.error({ userId, error }, "Failed to reconnect WhatsApp session");
          });
        }, RECONNECT_DELAY_MS);
      } else {
        activeSessions.delete(userId);
        connectionTimes.delete(userId);
        logger.warn({ userId, sessionPath }, "Logged out. Delete session folder and scan again.");
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") {
      return;
    }

    for (const message of messages) {
      await handleIncomingMessage(sock, userId, message);
    }
  });

  return sock;
}

async function startSessionWithMonitor(userId) {
  activeSessions.set(userId, await startSession(userId));
}

async function handleIncomingMessage(sock, userId, message) {
  if (!message.message || message.key?.fromMe) {
    return;
  }

  const remoteJid = message.key?.remoteJid;
  if (!remoteJid?.endsWith("@g.us")) {
    return;
  }

  const msgTimestampMs = Number(message.messageTimestamp || 0) * 1000;
  const connectedAt = connectionTimes.get(userId) || 0;
  if (msgTimestampMs && msgTimestampMs < connectedAt) {
    logger.debug({ userId, remoteJid }, "Skipped pre-connection WhatsApp message");
    return;
  }

  const text = extractText(message.message);
  if (!text) {
    return;
  }

  await sleep(gaussianJitter(MIN_PROCESSING_DELAY_MS, MAX_PROCESSING_DELAY_MS));

  const groupName = await resolveGroupName(sock, remoteJid);
  const sender = message.key.participant || remoteJid;

  logger.info(
    {
      userId,
      group: groupName,
      preview: text.slice(0, 80),
    },
    "Forwarding WhatsApp group message to FastAPI",
  );

  await sendToFastAPI({
    user_id: userId,
    group_id: cleanJid(remoteJid),
    group_name: groupName,
    group_type: "general",
    sender: cleanJid(sender),
    sender_name: message.pushName || cleanJid(sender),
    text,
    timestamp: Number(message.messageTimestamp || Math.floor(Date.now() / 1000)),
  });
}

function extractText(message) {
  const content = unwrapMessage(message);

  return (
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    content.buttonsResponseMessage?.selectedDisplayText ||
    content.listResponseMessage?.title ||
    ""
  ).trim();
}

function unwrapMessage(message) {
  return (
    message.ephemeralMessage?.message ||
    message.viewOnceMessage?.message ||
    message.viewOnceMessageV2?.message ||
    message
  );
}

async function resolveGroupName(sock, groupJid) {
  try {
    const metadata = await sock.groupMetadata(groupJid);
    return metadata?.subject || cleanJid(groupJid);
  } catch {
    return cleanJid(groupJid);
  }
}

function cleanJid(jid) {
  return jid.split("@")[0].split(":")[0];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function gaussianJitter(minMs, maxMs) {
  const mean = (minMs + maxMs) / 2;
  const stdDev = (maxMs - minMs) / 6;
  let value = mean;

  for (let i = 0; i < 6; i += 1) {
    value += (Math.random() - 0.5) * stdDev;
  }

  return Math.max(minMs, Math.min(maxMs, Math.round(value)));
}

setInterval(() => {
  for (const [userId, sock] of activeSessions.entries()) {
    const readyState = sock?.ws?.readyState;

    if (readyState !== 1) {
      logger.warn({ userId, readyState }, "WhatsApp session appears dead; restarting");
      startSessionWithMonitor(userId).catch((error) => {
        logger.error({ userId, error }, "Failed to restart dead WhatsApp session");
      });
      continue;
    }

    const stats = sock.antiban?.getStats?.();
    if (stats) {
      logger.info({ userId, antiban: stats }, "WhatsApp antiban health stats");
    }
  }
}, HEALTH_CHECK_INTERVAL_MS).unref();

startSessionWithMonitor(DEFAULT_USER_ID).catch((error) => {
  logger.error({ error }, "WhatsApp service failed to start");
  process.exitCode = 1;
});
