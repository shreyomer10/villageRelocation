import datetime as dt

from bson import ObjectId
from google.genai import types

from config import db

_chat_sessions = db.chat_sessions


def _normalize_chat_messages(messages):
    if not isinstance(messages, list):
        raise ValueError("messages must be an array")

    normalized = []
    for item in messages:
        if not isinstance(item, dict):
            raise ValueError("each message must be an object")
        role = str(item.get("role", "")).lower()
        if role not in {"user", "assistant", "system"}:
            raise ValueError("message role must be 'user', 'assistant', or 'system'")
        content = item.get("content")
        if content is None:
            raise ValueError("each message must include a content field")
        entry = {
            "role": role,
            "content": str(content),
        }
        if role == "assistant" and isinstance(item.get("trace"), list):
            entry["trace"] = item["trace"]
        normalized.append(entry)
    return normalized


def _message_to_content(message):
    role = message["role"]
    if role == "assistant":
        role = "model"
    return types.Content(role=role, parts=[types.Part(text=message["content"])])


def _generate_chat_title(messages):
    first_user = next(
        (m for m in messages if m.get("role") == "user" and str(m.get("content", "")).strip()),
        None,
    )
    if not first_user:
        return "New chat"

    text = str(first_user["content"]).strip()
    title = text[:48].strip()
    if len(text) > 48:
        title = title.rstrip() + "..."
    return title or "New chat"


def _serialize_chat_session(doc):
    return {
        "id": str(doc["_id"]),
        "title": doc.get("title", "New chat"),
        "messages": doc.get("messages", []),
        "createdAt": doc.get("createdAt"),
        "updatedAt": doc.get("updatedAt"),
    }


def _load_chat_session(user_id, chat_id):
    if not ObjectId.is_valid(chat_id):
        return None
    return _chat_sessions.find_one({"_id": ObjectId(chat_id), "userId": user_id})


def _create_chat_session(user_id, title="New chat"):
    now = dt.datetime.utcnow().isoformat()
    doc = {
        "userId": user_id,
        "title": (title or "").strip() or "New chat",
        "messages": [],
        "createdAt": now,
        "updatedAt": now,
    }
    result = _chat_sessions.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


def _save_chat_session(user_id, chat_id, messages, title=None):
    try:
        session = _load_chat_session(user_id, chat_id)
        if not session:
            return None

        update_data = {
            "messages": messages,
            "updatedAt": dt.datetime.utcnow().isoformat(),
        }
        if title is not None:
            update_data["title"] = title.strip() or session.get("title", "New chat")
        elif not session.get("title") or session.get("title") == "New chat":
            update_data["title"] = _generate_chat_title(messages)

        _chat_sessions.update_one(
            {"_id": session["_id"]},
            {"$set": update_data},
        )
        session.update(update_data)
        return _serialize_chat_session(session)
    except Exception as exc:
        raise Exception(f"Failed to save chat session: {str(exc)}")
