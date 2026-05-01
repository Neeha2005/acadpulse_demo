import makeWASocket, {
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import pino from "pino";
import axios from "axios";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { readFile, rm, writeFile } from "node:fs/promises";

const AUTH_DIR = "./auth_info";
const SELECTED_GROUPS_FILE = "./selected_groups.json";
const BACKEND_RECEIVE_MESSAGE_URL = "http://127.0.0.1:8000/receive-message";

// Keep Baileys quiet unless something important happens in the socket layer.
const logger = pino({ level: "silent" });
let selectedGroupIds = new Set();
let groupSelectionReady = false;
let shouldReplaceSelectedGroups = false;

async function startWhatsAppListener() {
  // useMultiFileAuthState stores WhatsApp Web credentials as multiple files.
  // Reusing this folder lets the bot reconnect without scanning a QR every run.
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    auth: state,
    version,
    browser: Browsers.macOS("AcadPulse"),
    logger,
    printQRInTerminal: false,
  });

  // Persist credentials whenever Baileys refreshes them.
  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    // When WhatsApp requires login, Baileys gives us a QR string to render.
    if (qr) {
      shouldReplaceSelectedGroups = true;
      console.log("Scan this QR code with WhatsApp:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      console.log("WhatsApp connected successfully");
      setupSelectedGroups(sock, { replaceSavedGroups: shouldReplaceSelectedGroups }).catch((error) => {
        console.error("Could not load/select WhatsApp groups:", error);
      });
      shouldReplaceSelectedGroups = false;
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const errorMessage = lastDisconnect?.error?.message || "Unknown disconnect reason";
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      if (loggedOut) {
        console.log("WhatsApp logged out. Clearing old session and generating a new QR...");
        resetWhatsAppSession().catch((error) => {
          console.error("Failed to reset WhatsApp session:", error);
        });
        return;
      }

      console.log("WhatsApp disconnected. Reconnecting...", {
        statusCode,
        error: errorMessage,
      });

      setTimeout(() => {
        startWhatsAppListener().catch((error) => {
          console.error("Failed to reconnect WhatsApp:", error);
        });
      }, 5_000);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const rawMessage of messages) {
      await handleIncomingMessage(rawMessage);
    }
  });
}

async function resetWhatsAppSession() {
  await rm(AUTH_DIR, { recursive: true, force: true });
  await resetSelectedGroups();

  setTimeout(() => {
    startWhatsAppListener().catch((error) => {
      console.error("Failed to restart WhatsApp for QR login:", error);
    });
  }, 3_000);
}

async function setupSelectedGroups(sock, { replaceSavedGroups = false } = {}) {
  if (groupSelectionReady && !replaceSavedGroups) {
    return;
  }

  if (!replaceSavedGroups) {
    const savedGroupIds = await loadSelectedGroupIds();

    if (savedGroupIds.length > 0) {
      selectedGroupIds = new Set(savedGroupIds);
      groupSelectionReady = true;
      console.log("Using saved WhatsApp study groups:");
      for (const groupId of savedGroupIds) {
        console.log("-", groupId);
      }
      return;
    }
  } else {
    console.log("New WhatsApp login detected. Select groups again to replace saved groups.");
  }

  const groups = await fetchParticipatingGroups(sock);

  if (groups.length === 0) {
    console.log("No WhatsApp groups found for this account.");
    return;
  }

  console.log("\nSelect study group(s) for AcadPulse:");
  groups.forEach((group, index) => {
    console.log(`${index + 1}. ${group.subject} (${group.id})`);
  });

  const rl = createInterface({ input, output });
  const answer = await rl.question(
    "\nEnter group number(s), comma-separated if multiple, then press Enter: ",
  );
  rl.close();

  const selectedGroups = parseGroupSelection(answer, groups);

  if (selectedGroups.length === 0) {
    console.log("No valid group selected. Restart and select at least one group.");
    return;
  }

  selectedGroupIds = new Set(selectedGroups.map((group) => group.id));
  groupSelectionReady = true;

  await saveSelectedGroups(selectedGroups);

  console.log("\nSelected study group(s):");
  for (const group of selectedGroups) {
    console.log("-", `${group.subject} (${group.id})`);
  }
}

async function fetchParticipatingGroups(sock) {
  const groupMap = await sock.groupFetchAllParticipating();

  return Object.values(groupMap)
    .map((group) => ({
      id: group.id,
      subject: group.subject || "Unnamed group",
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject));
}

function parseGroupSelection(answer, groups) {
  const selectedIndexes = answer
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= groups.length);

  const uniqueIndexes = [...new Set(selectedIndexes)];
  return uniqueIndexes.map((index) => groups[index - 1]);
}

async function loadSelectedGroupIds() {
  try {
    const content = await readFile(SELECTED_GROUPS_FILE, "utf8");
    const savedGroups = JSON.parse(content);

    if (!Array.isArray(savedGroups)) {
      return [];
    }

    return savedGroups
      .map((group) => group.id)
      .filter((id) => typeof id === "string" && id.endsWith("@g.us"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function saveSelectedGroups(groups) {
  const content = JSON.stringify(groups, null, 2);
  await writeFile(SELECTED_GROUPS_FILE, `${content}\n`);
}

async function resetSelectedGroups() {
  selectedGroupIds = new Set();
  groupSelectionReady = false;
  shouldReplaceSelectedGroups = true;
  await rm(SELECTED_GROUPS_FILE, { force: true });
}

async function handleIncomingMessage(rawMessage) {
  const { key, message, messageTimestamp } = rawMessage;
  const remoteJid = key?.remoteJid;

  // Ignore messages sent by this WhatsApp account.
  if (key?.fromMe) {
    return;
  }

  // Only process WhatsApp group messages.
  if (!remoteJid?.endsWith("@g.us")) {
    return;
  }

  // Only process groups selected during first-time setup.
  if (!groupSelectionReady || !selectedGroupIds.has(remoteJid)) {
    return;
  }

  const senderId = key?.participant || "unknown";
  const messageText = extractMessageText(message);
  const timestamp = Number(messageTimestamp || Math.floor(Date.now() / 1000));

  console.log("Incoming WhatsApp group message");
  console.log("Group ID:", remoteJid);
  console.log("Sender ID:", senderId);
  console.log("Message text:", messageText || "Non-text message received");
  console.log("Timestamp:", timestamp);
  console.log("Full raw message object:");
  console.dir(rawMessage, { depth: null });

  // Send the extracted group message data to the FastAPI backend.
  await sendMessageToBackend({
    text: messageText,
    sender: senderId,
    group: remoteJid,
    timestamp: new Date().toISOString(),
  });
}

async function sendMessageToBackend(payload) {
  try {
    await axios.post(BACKEND_RECEIVE_MESSAGE_URL, payload, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log("Message sent to backend successfully");
  } catch (error) {
    const status = error.response?.status;
    const responseData = error.response?.data;
    const message = error.message || "Unknown backend error";

    console.error("Failed to send message to backend", {
      status,
      response: responseData,
      error: message,
    });
  }
}

function extractMessageText(message) {
  if (!message) {
    return "";
  }

  const content = unwrapMessage(message);

  return (
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    ""
  ).trim();
}

function unwrapMessage(message) {
  // Some WhatsApp messages are wrapped by ephemeral/view-once containers.
  return (
    message.ephemeralMessage?.message ||
    message.viewOnceMessage?.message ||
    message.viewOnceMessageV2?.message ||
    message
  );
}

startWhatsAppListener().catch((error) => {
  console.error("WhatsApp listener failed to start:", error);
  process.exitCode = 1;
});
