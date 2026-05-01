from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from typing import Any


def _compact_text(value: str, *, max_chars: int = 900) -> str:
    text = re.sub(r"\s+", " ", value or "").strip()
    if len(text) <= max_chars:
        return text
    return f"{text[: max_chars - 3]}..."


class SimpleManufacturingLLM:
    """Small no-dependency LLM-shaped callable for serverless demos."""

    def __init__(self) -> None:
        self._prompt: tuple[str, str, str] = ("", "", "")

    def set_prompt(self, system_template: str, user_query: str, context: str) -> None:
        self._prompt = (system_template, user_query, context)

    def respond_to_prompt(self) -> str:
        return self(*self._prompt)

    def __call__(self, system_template: str, user_query: str, context: str) -> str:
        del system_template
        answers: list[str] = []
        for match in re.finditer(r"(?:^|\n)\s*Answer:\s*(.+?)(?=\n\s*(?:Time series|Question|Answer):|\Z)", context or "", re.I | re.S):
            answer = _compact_text(match.group(1), max_chars=420)
            if answer:
                answers.append(answer)

        for line in (context or "").splitlines():
            cleaned = line.strip()
            if not cleaned:
                continue
            if cleaned.lower().startswith("answer:"):
                answer = cleaned.split(":", 1)[1].strip()
                if answer:
                    answers.append(answer)

        if answers:
            return _compact_text(
                "Based on the retrieved InfoGuide context, "
                + " ".join(dict.fromkeys(answers))
            )

        if context:
            return _compact_text(
                "Based on the retrieved InfoGuide context, "
                + context
            )

        return _compact_text(
            "I could not find a matching InfoGuide context for the request: "
            + (user_query or "unknown request")
        )


class RemoteChatCompletionsLLM:
    """OpenAI-compatible chat-completions adapter using only the standard library."""

    def __init__(
        self,
        *,
        api_url: str,
        api_key: str,
        model: str,
        timeout_seconds: float = 12.0,
        fallback: Any | None = None,
    ) -> None:
        self.api_url = api_url
        self.api_key = api_key
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.fallback = fallback

    def __call__(self, system_template: str, user_query: str, context: str) -> str:
        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": system_template or "You answer manufacturing questions using the supplied context.",
                },
                {
                    "role": "user",
                    "content": (
                        "Question:\n"
                        f"{user_query}\n\n"
                        "Context:\n"
                        f"{context}\n\n"
                        "Answer concisely and ground the answer in the context."
                    ),
                },
            ],
            "temperature": 0.1,
        }
        request = urllib.request.Request(
            self.api_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                raw = response.read().decode("utf-8")
            data = json.loads(raw)
            choices = data.get("choices") if isinstance(data, dict) else None
            if isinstance(choices, list) and choices:
                message = choices[0].get("message") if isinstance(choices[0], dict) else None
                content = message.get("content") if isinstance(message, dict) else None
                if content:
                    return str(content)
            raise ValueError("Remote LLM response did not include choices[0].message.content.")
        except (OSError, urllib.error.URLError, ValueError, json.JSONDecodeError):
            if self.fallback is not None:
                return str(self.fallback(system_template, user_query, context))
            raise


def build_smartpilot_llm() -> Any:
    fallback = SimpleManufacturingLLM()
    provider = os.environ.get("SMARTPILOT_LLM_PROVIDER", "simple").strip().lower()
    if provider not in {"remote", "openai", "openai-compatible"}:
        return fallback

    api_key = os.environ.get("SMARTPILOT_LLM_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return fallback

    api_url = os.environ.get("SMARTPILOT_LLM_API_URL") or "https://api.openai.com/v1/chat/completions"
    model = os.environ.get("SMARTPILOT_LLM_MODEL") or "gpt-4o-mini"
    timeout_raw = os.environ.get("SMARTPILOT_LLM_TIMEOUT_SECONDS", "12")
    try:
        timeout_seconds = max(1.0, float(timeout_raw))
    except ValueError:
        timeout_seconds = 12.0

    return RemoteChatCompletionsLLM(
        api_url=api_url,
        api_key=api_key,
        model=model,
        timeout_seconds=timeout_seconds,
        fallback=fallback,
    )
