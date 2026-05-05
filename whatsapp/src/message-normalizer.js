export async function normalizeIncomingMessage(sock, eventMessage) {
  const remoteJid = eventMessage.key.remoteJid;

  if (!remoteJid || eventMessage.key.fromMe || !eventMessage.message) {
    return null;
  }

  const text = extractText(eventMessage.message);

  if (!text) {
    return null;
  }

  const isGroup = remoteJid.endsWith("@g.us");
  const senderJid = eventMessage.key.participant || remoteJid;
  const groupName = isGroup ? await resolveGroupName(sock, remoteJid) : null;

  return {
    message_id: eventMessage.key?.id,
    group_id: cleanJid(remoteJid),
    group_name: groupName || cleanJid(remoteJid),
    sender: cleanJid(senderJid),
    sender_name: eventMessage.pushName || cleanJid(senderJid),
    text,
    timestamp: Number(eventMessage.messageTimestamp || Math.floor(Date.now() / 1000)),
  };
}

function extractText(message) {
  const content = unwrapEphemeral(message);

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

function unwrapEphemeral(message) {
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
    return metadata?.subject || null;
  } catch {
    return null;
  }
}

function cleanJid(jid) {
  return jid.split("@")[0].split(":")[0];
}
