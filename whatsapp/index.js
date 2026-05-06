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
import http from "node:http";
import qrcode from "qrcode-terminal";
import pino from "pino";
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { sendToFastAPI } from "./sender.js";

const SESSION_ROOT = process.env.WHATSAPP_SESSION_PATH || "./sessions";
const DEFAULT_USER_ID = process.env.WHATSAPP_USER_ID || "";
const FASTAPI_URL = process.env.FASTAPI_URL || process.env.FASTAPI_BASE_URL || "http://localhost:8000";
const CONTROL_HOST = process.env.WHATSAPP_CONTROL_HOST || "127.0.0.1";
const CONTROL_PORT = Number(process.env.WHATSAPP_CONTROL_PORT || 3010);
const AUTO_START_DEFAULT = Boolean(DEFAULT_USER_ID) && process.env.WHATSAPP_AUTOSTART_DEFAULT !== "0";
const HEALTH_CHECK_INTERVAL_MS = 60 * 1000;
const MAX_RECONNECT_ATTEMPTS = 5;
const MIN_PROCESSING_DELAY_MS = 700;
const MAX_PROCESSING_DELAY_MS = 3_500;

const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const activeSessions = new Map();
const startingSessions = new Set();
const connectionTimes = new Map();
const presenceControllers = new Map();
const reconnectAttempts = new Map();
const reconnectTimers = new Map();

async function syncGroups(sock, userId) {
  try {
    const groups = await sock.groupFetchAllParticipating();
    const groupEntries = Object.values(groups);
    logger.info({ userId, count: groupEntries.length }, "Syncing WhatsApp groups to FastAPI");

    for (const group of groupEntries) {
      await postWhatsAppGroup(userId, {
        group_id: cleanJid(group.id),
        group_name: group.subject,
        is_general: false,
        selected: false,
      });
    }
  } catch (error) {
    logger.warn({ userId, error: error.message }, "Could not sync WhatsApp groups");
  }
}

async function postWhatsAppGroup(userId, groupData) {
  try {
    await fetch(`${FASTAPI_URL}/whatsapp/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...groupData, user_id: userId }),
    });
  } catch (error) {
    // Silently fail for individual group posts to avoid log spam
  }
}

async function postWhatsAppStatus(status, reason = null, userId = DEFAULT_USER_ID, qr = null) {
  try {
    await fetch(`${FASTAPI_URL}/whatsapp/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reason, user_id: userId, qr }),
    });
  } catch (error) {
    logger.warn({ error: error.message, status }, "Could not post WhatsApp status to FastAPI");
  }
}

async function pingFastApiHealth() {
  try {
    const response = await fetch(`${FASTAPI_URL}/whatsapp/health`);
    if (!response.ok) {
      logger.warn({ status: response.status }, "FastAPI WhatsApp health check failed");
    }
  } catch (error) {
    logger.warn({ error: error.message }, "FastAPI unavailable; WhatsApp connection stays alive");
  }
}

async function clearSession(sessionPath, userId, reason) {
  logger.warn({ userId, sessionPath, reason }, "Clearing WhatsApp session credentials");
  await rm(sessionPath, { recursive: true, force: true });
}

async function validateSessionFiles(sessionPath, userId) {
  try {
    const files = await readdir(sessionPath);
    const jsonFiles = files.filter((file) => file.endsWith(".json"));

    for (const file of jsonFiles) {
      const content = await readFile(path.join(sessionPath, file), "utf8");
      JSON.parse(content);
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      return;
    }

    logger.warn({ userId, error: error.message }, "WhatsApp session is corrupted; QR scan required");
    await clearSession(sessionPath, userId, "corrupted_credentials");
  }
}

async function startSession(userId) {
  const sessionPath = path.join(SESSION_ROOT, userId);
  await mkdir(sessionPath, { recursive: true });
  await validateSessionFiles(sessionPath, userId);

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
      postWhatsAppStatus("qr_required", null, userId, qr);
    }

    if (connection === "connecting") {
      const attempt = reconnectAttempts.get(userId) || 0;
      logger.info({ userId, attempt, maxAttempts: MAX_RECONNECT_ATTEMPTS }, "WhatsApp connecting");
    }

    if (connection === "open") {
      connectionTimes.set(userId, Date.now());
      reconnectAttempts.set(userId, 0);
      clearTimeout(reconnectTimers.get(userId));
      reconnectTimers.delete(userId);
      logger.info({ userId }, "WhatsApp connected successfully");
      postWhatsAppStatus("connected", null, userId);
      syncGroups(sock, userId).catch((error) => {
        logger.warn({ userId, error: error.message }, "Initial group sync failed");
      });
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
      const reason = DisconnectReason[statusCode] || String(statusCode || "unknown");

      logger.warn(
        { userId, statusCode, reason },
        "WhatsApp connection closed",
      );

      if (statusCode === DisconnectReason.loggedOut) {
        activeSessions.delete(userId);
        connectionTimes.delete(userId);
        reconnectAttempts.set(userId, 0);
        clearSession(sessionPath, userId, "logged_out").catch((error) => {
          logger.warn({ userId, error: error.message }, "Could not clear logged-out WhatsApp session");
        });
        logger.warn({ userId, sessionPath }, "WhatsApp logged out. Student must scan QR again.");
        postWhatsAppStatus("logged_out", reason, userId);
        return;
      }

      if (statusCode === DisconnectReason.restartRequired) {
        logger.info({ userId }, "WhatsApp restart required; restarting immediately");
        startSessionWithMonitor(userId).catch((error) => {
          logger.error({ userId, error }, "Immediate WhatsApp restart failed");
        });
        return;
      }

      scheduleReconnect(userId, reason);
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

function scheduleReconnect(userId, reason) {
  const nextAttempt = (reconnectAttempts.get(userId) || 0) + 1;

  if (nextAttempt > MAX_RECONNECT_ATTEMPTS) {
    logger.error({ userId, reason }, "WhatsApp reconnect attempts exhausted");
    postWhatsAppStatus("disconnected", reason, userId);
    return;
  }

  reconnectAttempts.set(userId, nextAttempt);
  const delayMs = 3_000 * (2 ** (nextAttempt - 1));
  logger.warn(
    { userId, attempt: nextAttempt, maxAttempts: MAX_RECONNECT_ATTEMPTS, delayMs, reason },
    "Scheduling WhatsApp reconnect",
  );
  postWhatsAppStatus("reconnecting", reason, userId);

  clearTimeout(reconnectTimers.get(userId));
  reconnectTimers.set(
    userId,
    setTimeout(() => {
      startSessionWithMonitor(userId).catch((error) => {
        logger.error({ userId, error }, "WhatsApp reconnect failed");
        scheduleReconnect(userId, error.message);
      });
    }, delayMs),
  );
}

async function simulateReconnectForTest() {
  const userId = DEFAULT_USER_ID || "test-user";
  const reason = process.env.WHATSAPP_SIMULATE_REASON || "simulated_timeout";
  reconnectAttempts.set(userId, 0);
  logger.info({ userId, attempt: 0, maxAttempts: MAX_RECONNECT_ATTEMPTS }, "WhatsApp connecting");
  await postWhatsAppStatus("reconnecting", reason, userId);

  for (let attempt = 1; attempt <= MAX_RECONNECT_ATTEMPTS; attempt += 1) {
    reconnectAttempts.set(userId, attempt);
    const delayMs = 3_000 * (2 ** (attempt - 1));
    logger.warn(
      { userId, attempt, maxAttempts: MAX_RECONNECT_ATTEMPTS, delayMs, reason },
      "Scheduling WhatsApp reconnect",
    );
  }

  await postWhatsAppStatus("disconnected", reason, userId);
  logger.error({ userId, reason }, "WhatsApp reconnect attempts exhausted");
}

async function startSessionWithMonitor(userId) {
  const normalizedUserId = cleanUserId(userId);
  if (!normalizedUserId) {
    throw new Error("userId is required");
  }
  if (startingSessions.has(normalizedUserId)) {
    return activeSessions.get(normalizedUserId) || null;
  }
  const existing = activeSessions.get(normalizedUserId);
  if (existing && existing.ws?.readyState === 1) {
    return existing;
  }
  startingSessions.add(normalizedUserId);
  try {
    const sock = await startSession(normalizedUserId);
    activeSessions.set(normalizedUserId, sock);
    return sock;
  } finally {
    startingSessions.delete(normalizedUserId);
  }
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
    message_id: message.key?.id,
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

function cleanUserId(userId) {
  return String(userId || "").trim().replace(/[^\w.-]/g, "_");
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

function startControlServer() {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || "/", `http://${CONTROL_HOST}:${CONTROL_PORT}`);

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, {
        status: "ok",
        active_sessions: Array.from(activeSessions.keys()),
        starting_sessions: Array.from(startingSessions),
      });
      return;
    }

    const startMatch = url.pathname.match(/^\/sessions\/([^/]+)\/start$/);
    if (request.method === "POST" && startMatch) {
      const userId = cleanUserId(decodeURIComponent(startMatch[1]));
      startSessionWithMonitor(userId)
        .then(() => {
          sendJson(response, 202, { status: "starting", user_id: userId });
        })
        .catch((error) => {
          logger.error({ userId, error }, "Could not start WhatsApp user session");
          sendJson(response, 500, { status: "error", user_id: userId, detail: error.message });
        });
      return;
    }

    sendJson(response, 404, { status: "not_found" });
  });

  server.listen(CONTROL_PORT, CONTROL_HOST, () => {
    logger.info(
      { host: CONTROL_HOST, port: CONTROL_PORT },
      "WhatsApp control server listening",
    );
  });
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
      logger.warn(
        { userId, readyState },
        "WhatsApp socket is not open; waiting for Baileys connection.update before restarting",
      );
      continue;
    }

    const stats = sock.antiban?.getStats?.();
    if (stats) {
      logger.info({ userId, antiban: stats }, "WhatsApp antiban health stats");
    }
  }
}, HEALTH_CHECK_INTERVAL_MS).unref();

setInterval(() => {
  pingFastApiHealth();
}, HEALTH_CHECK_INTERVAL_MS).unref();

if (process.env.WHATSAPP_SIMULATE_DISCONNECT === "1") {
  simulateReconnectForTest()
    .then(() => {
      process.exitCode = 0;
    })
    .catch((error) => {
      logger.error({ error }, "WhatsApp disconnect simulation failed");
      process.exitCode = 1;
    });
} else {
  startControlServer();
  if (AUTO_START_DEFAULT) {
    startSessionWithMonitor(DEFAULT_USER_ID).catch((error) => {
      logger.error({ error }, "WhatsApp service failed to start");
      process.exitCode = 1;
    });
  }
}
