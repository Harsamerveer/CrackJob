import json
import os
import re

from emergentintegrations.llm.chat import LlmChat, UserMessage

from core import db, new_id
from seed import DEFAULT_SETTINGS

LLM_KEY = os.environ["EMERGENT_LLM_KEY"]
MODEL_PROVIDERS = {
    "claude-opus-5-5": "anthropic",
    "claude-sonnet-5-5": "anthropic",
    "gpt-6-luna": "openai",
}


async def model_for(user_id: str, task: str) -> tuple[str, str]:
    s = await db.settings.find_one({"user_id": user_id}, {"_id": 0, "models": 1}) or {}
    model = (s.get("models") or {}).get(task) or DEFAULT_SETTINGS["models"][task]
    return MODEL_PROVIDERS.get(model, "anthropic"), model


def make_chat(provider: str, model: str, system: str, web_uses: int = 0) -> LlmChat:
    chat = LlmChat(api_key=LLM_KEY, session_id=new_id("llm"), system_message=system).with_model(provider, model)
    if web_uses and provider == "anthropic":
        chat = chat.with_tools([{"type": "web_search_20250305", "name": "web_search", "max_uses": web_uses},
                                {"type": "web_fetch_20250910", "name": "web_fetch", "max_uses": web_uses}])
    return chat


def parse_json(text: str) -> dict:
    text = re.sub(r'<?/?cite(?:\s+index="[^"]*")?>', "", text or "")
    fence = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.S)
    if fence:
        text = fence.group(1)
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        return {}
    try:
        return json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        return {}


async def ask_json(user_id: str, task: str, system: str, prompt: str, web_uses: int = 0) -> dict:
    provider, model = await model_for(user_id, task)
    chat = make_chat(provider, model, system, web_uses)
    if web_uses and provider == "anthropic":
        resp = await chat.send_message_with_tools(UserMessage(text=prompt))
        return parse_json(resp.content or "")
    return parse_json(await chat.send_message(UserMessage(text=prompt)))
