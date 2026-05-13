import datetime as dt
import json
import re

from flask import Blueprint, request, jsonify, abort
from google import genai
from google.genai import types

from config import GEMINI_API, GEMINI_MODEL
from utils.helpers import make_response
from utils.tokenAuth import auth_required

from .prompt import SYSTEM_PROMPT
from .tools import TOOLS_MAP
from .sessions import (
    _chat_sessions,
    _normalize_chat_messages,
    _message_to_content,
    _serialize_chat_session,
    _load_chat_session,
    _create_chat_session,
    _save_chat_session,
)

ai_bp = Blueprint("ai", __name__)


def _extract_json(text: str) -> dict:
    """Parse JSON from model output, stripping markdown fences if present."""
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if fence:
        text = fence.group(1).strip()
    return json.loads(text)


@ai_bp.route("/ai/chat", methods=["POST"])
@auth_required
def ai_chat(claims):
    body      = request.get_json(silent=True) or {}
    messages  = body.get("messages")
    prompt    = (body.get("prompt") or "").strip()
    chat_id   = body.get("chat_id")
    user_id   = claims.get("userId")

    if not messages and not prompt:
        return jsonify({"error": True, "message": "Prompt or messages are required", "result": None}), 400

    if not GEMINI_API:
        return jsonify({"error": True, "message": "AI service not configured (missing GEMINI_API)", "result": None}), 503

    try:
        client     = genai.Client(api_key=GEMINI_API)
        model_name = GEMINI_MODEL or "gemini-2.0-flash"

        history_messages = []
        if messages is not None:
            history_messages = _normalize_chat_messages(messages)
        else:
            history_messages = [{"role": "user", "content": prompt}]

        if not chat_id:
            new_session = _create_chat_session(user_id)
            chat_id = str(new_session["_id"])

        history = [_message_to_content(message) for message in history_messages]

        max_iterations = 6
        for _ in range(max_iterations):
            response = client.models.generate_content(
                model=model_name,
                contents=history,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    temperature=0.1,
                ),
            )

            reply_text = response.text.strip()

            try:
                parsed = _extract_json(reply_text)
            except (json.JSONDecodeError, ValueError):
                return jsonify({
                    "error": False,
                    "result": {
                        "type":    "text",
                        "title":   "Answer",
                        "summary": reply_text,
                        "assistantText": reply_text,
                        "sessionId": chat_id,
                    },
                }), 200

            if "final" in parsed:
                final_payload = dict(parsed["final"])
                final_payload["assistantText"] = reply_text
                final_payload["sessionId"] = chat_id

                persisted_messages = history_messages + [{"role": "assistant", "content": reply_text}]
                try:
                    session = _save_chat_session(user_id, chat_id, persisted_messages)
                except Exception as exc:
                    abort(500, description=str(exc))
                if not session:
                    return jsonify({
                        "error":   True,
                        "message": "Chat session not found",
                        "result":  None,
                    }), 404
                final_payload["sessionId"] = session["id"]
                final_payload["sessionTitle"] = session["title"]
                return jsonify({"error": False, "result": final_payload}), 200

            if "action" in parsed:
                tool_name = parsed.get("action", "")
                args      = parsed.get("args") or {}

                if tool_name not in TOOLS_MAP:
                    return jsonify({
                        "error":   True,
                        "message": f"Model requested unknown tool '{tool_name}'.",
                        "result":  None,
                    }), 500

                tool_result      = TOOLS_MAP[tool_name](**args)
                tool_result_text = f"Tool '{tool_name}' returned: {json.dumps(tool_result, indent=2)}"

                history.append(types.Content(role="model", parts=[types.Part(text=reply_text)]))
                history.append(types.Content(role="user", parts=[types.Part(text=tool_result_text)]))
                history_messages.append({"role": "assistant", "content": reply_text})
                history_messages.append({"role": "user", "content": tool_result_text})
                continue

            return jsonify({
                "error": False,
                "result": {
                    "type":    "text",
                    "title":   "Answer",
                    "summary": reply_text,
                    "assistantText": reply_text,
                    "sessionId": chat_id,
                },
            }), 200

        return jsonify({
            "error":   True,
            "message": "The AI could not converge on an answer. Please rephrase your question.",
            "result":  {"sessionId": chat_id},
        }), 500

    except Exception as exc:
        return jsonify({
            "error":   True,
            "message": f"AI service error: {str(exc)}",
            "result":  None,
        }), 500


@ai_bp.route("/ai/chat-sessions", methods=["GET"])
@auth_required
def list_chat_sessions(claims):
    user_id = claims.get("userId")
    sessions = list(_chat_sessions.find({"userId": user_id}, {"messages": 0}).sort("updatedAt", -1))
    payload = [_serialize_chat_session(session) for session in sessions]
    return make_response(False, "Chat sessions fetched successfully", payload)


@ai_bp.route("/ai/chat-sessions", methods=["POST"])
@auth_required
def create_chat_session(claims):
    body = request.get_json(silent=True) or {}
    title = str(body.get("title", "New chat") or "New chat").strip() or "New chat"
    user_id = claims.get("userId")
    new_session = _create_chat_session(user_id, title)
    return make_response(False, "Chat session created successfully", _serialize_chat_session(new_session), 201)


@ai_bp.route("/ai/chat-sessions/<chat_id>", methods=["GET"])
@auth_required
def get_chat_session(claims, chat_id):
    user_id = claims.get("userId")
    session = _load_chat_session(user_id, chat_id)
    if not session:
        return make_response(True, "Chat session not found", None, 404)
    return make_response(False, "Chat session loaded", _serialize_chat_session(session))


@ai_bp.route("/ai/chat-sessions/<chat_id>", methods=["PUT"])
@auth_required
def update_chat_session(claims, chat_id):
    body = request.get_json(silent=True) or {}
    user_id = claims.get("userId")
    session = _load_chat_session(user_id, chat_id)
    if not session:
        return make_response(True, "Chat session not found", None, 404)

    update_payload = {}
    if "title" in body:
        update_payload["title"] = str(body.get("title") or session.get("title", "New chat")).strip() or session.get("title", "New chat")
    if "messages" in body:
        update_payload["messages"] = _normalize_chat_messages(body.get("messages") or [])
    update_payload["updatedAt"] = dt.datetime.utcnow().isoformat()

    _chat_sessions.update_one({"_id": session["_id"]}, {"$set": update_payload})
    session.update(update_payload)
    return make_response(False, "Chat session updated successfully", _serialize_chat_session(session))


@ai_bp.route("/ai/chat-sessions/<chat_id>", methods=["DELETE"])
@auth_required
def delete_chat_session(claims, chat_id):
    user_id = claims.get("userId")
    session = _load_chat_session(user_id, chat_id)
    if not session:
        return make_response(True, "Chat session not found", None, 404)
    _chat_sessions.delete_one({"_id": session["_id"]})
    return make_response(False, "Chat session deleted successfully", None, 200)
