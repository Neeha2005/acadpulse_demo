import logging
from uuid import uuid4

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="AcadPulse Backend", version="0.1.0")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("acadpulse.backend")


class IncomingMessage(BaseModel):
    group_id: str
    group_name: str
    sender: str
    sender_name: str
    text: str
    timestamp: int


class StoredMessage(IncomingMessage):
    id: str


messages: list[StoredMessage] = []
MAX_MESSAGES = 500


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/messages")
async def list_messages(limit: int = 50):
    safe_limit = min(max(limit, 1), MAX_MESSAGES)
    return {"messages": messages[-safe_limit:]}


@app.post("/messages/incoming")
async def receive_incoming_message(message: IncomingMessage):
    message_id = str(uuid4())
    message_data = message.model_dump() if hasattr(message, "model_dump") else message.dict()
    stored_message = StoredMessage(id=message_id, **message_data)
    messages.append(stored_message)

    if len(messages) > MAX_MESSAGES:
        del messages[: len(messages) - MAX_MESSAGES]

    logger.info(
        "Received incoming WhatsApp message",
        extra={
            "message_id": message_id,
            "group_id": message.group_id,
            "group_name": message.group_name,
            "sender": message.sender,
        },
    )

    return {"status": "received", "message_id": message_id}
