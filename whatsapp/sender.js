import "dotenv/config";

const FASTAPI_URL = process.env.FASTAPI_URL || process.env.FASTAPI_BASE_URL || "http://localhost:8000";

export async function sendToFastAPI(messageData) {
  try {
    const response = await fetch(`${FASTAPI_URL}/messages/incoming`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messageData),
    });

    const bodyText = await response.text();
    const body = parseBody(bodyText);

    if (!response.ok) {
      console.error("FastAPI rejected WhatsApp message", {
        status: response.status,
        response: body,
      });
      return false;
    }

    console.log("FastAPI response:", body?.status || body?.success || "ok");
    return true;
  } catch (error) {
    console.error("Failed to reach FastAPI:", error.message);
    return false;
  }
}

function parseBody(bodyText) {
  if (!bodyText) {
    return null;
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    return bodyText;
  }
}
