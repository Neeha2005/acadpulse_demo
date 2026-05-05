import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { logger } from "./logger.js";

const QUEUE_DIR = "queue";
const PENDING_FILE = path.join(QUEUE_DIR, "pending-messages.jsonl");
const RETRY_FILE = path.join(QUEUE_DIR, "retry-messages.jsonl");
const MAX_ATTEMPTS = 3;

export async function sendIncomingMessage(message) {
  const endpoint = new URL("/messages/incoming", config.fastApiBaseUrl);

  await flushQueuedMessages(endpoint);
  const delivered = await postMessage(endpoint, message);

  if (!delivered) {
    await queueMessage(message).catch((error) => {
      logger.error(
        { error: error.message },
        "Could not queue WhatsApp message after FastAPI bridge failure",
      );
    });
  }
}

async function postMessage(endpoint, message) {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const bodyText = await response.text();
    const body = parseJsonBody(bodyText);

    if (!response.ok) {
      logger.warn(
        { status: response.status, body },
        "FastAPI bridge rejected incoming WhatsApp message",
      );
      return false;
    }

    logger.info({ response: body }, "FastAPI bridge accepted WhatsApp message");
    return true;
  } catch (error) {
    logger.warn(
      { error: error.message, endpoint: endpoint.toString() },
      "FastAPI bridge unavailable; message will be retried later",
    );
    return false;
  }
}

async function queueMessage(message, attempts = 0) {
  await mkdir(QUEUE_DIR, { recursive: true });
  const entry = JSON.stringify({
    attempts,
    message,
    queued_at: new Date().toISOString(),
  });

  await writeFile(PENDING_FILE, `${entry}\n`, { flag: "a" });
}

async function flushQueuedMessages(endpoint) {
  const entries = await readQueue();

  if (!entries.length) {
    return;
  }

  const retryEntries = [];

  for (const entry of entries) {
    const delivered = await postMessage(endpoint, entry.message);

    if (!delivered) {
      if (entry.attempts + 1 < MAX_ATTEMPTS) {
        retryEntries.push({ ...entry, attempts: entry.attempts + 1 });
      } else {
        logger.error(
          { attempts: entry.attempts + 1, messageId: entry.message?.message_id },
          "Dropping WhatsApp message after max FastAPI bridge retry attempts",
        );
      }
    }
  }

  await replaceQueue(retryEntries);
}

async function readQueue() {
  try {
    const content = await readFile(PENDING_FILE, "utf8");
    return content
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    logger.warn({ error: error.message }, "Could not read WhatsApp retry queue");
    return [];
  }
}

async function replaceQueue(entries) {
  await mkdir(QUEUE_DIR, { recursive: true });

  if (!entries.length) {
    await writeFile(PENDING_FILE, "");
    return;
  }

  const content = entries.map((entry) => JSON.stringify(entry)).join("\n");
  await writeFile(RETRY_FILE, `${content}\n`);
  await rename(RETRY_FILE, PENDING_FILE);
}

export async function flushPendingMessages() {
  const endpoint = new URL("/messages/incoming", config.fastApiBaseUrl);
  await flushQueuedMessages(endpoint);
}

function parseJsonBody(bodyText) {
  if (!bodyText) {
    return null;
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    return bodyText;
  }
}
