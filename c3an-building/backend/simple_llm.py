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


# ---------------------------------------------------------------------------
# Stage-2: synthesize multi-agent outputs into a final natural-language response
# ---------------------------------------------------------------------------

_SYNTHESIS_SYSTEM = (
    "You are SmartPilot, an industrial AI assistant for C3AN manufacturing analytics. "
    "You receive structured outputs from three specialist agents — PredictX (anomaly detection), "
    "ForeSight (production forecasting), and InfoGuide (domain Q&A) — and synthesize them into "
    "a single, concise, human-readable summary for an operator. "
    "Be factual, reference the numeric predictions, and highlight any anomalies or risks. "
    "Do not fabricate data. Keep the response under 200 words."
)

def synthesize_final_response(
    results: dict[str, Any],
    *,
    llm: Any | None = None,
    user_query: str = "",
) -> str:
    if llm is None:
        llm = build_smartpilot_llm()

    context_parts: list[str] = []

    predictx = results.get("predictx") or {}
    foresight = results.get("foresight") or {}
    infoguide = results.get("infoguide") or {}

    px_status = predictx.get("status", "not requested")
    px_result = predictx.get("result") or {}
    px_preds = px_result.get("predictions") or []
    px_first = px_preds[0] if px_preds else None
    px_mode = px_result.get("execution_mode", "")
    px_expls = px_result.get("row_explanations") or []
    context_parts.append(
        f"[PredictX — Anomaly Detection]\n"
        f"Status: {px_status}\n"
        f"Execution mode: {px_mode or 'standard'}\n"
        + (f"First prediction vector: {px_first}\n" if px_first is not None else "")
        + (f"Row explanations (first 3): {'; '.join(str(e) for e in px_expls[:3])}\n" if px_expls else "")
    )

    fs_status = foresight.get("status", "not requested")
    fs_result = foresight.get("result") or {}
    fs_preds = fs_result.get("predictions") or []
    fs_first = fs_preds[0] if fs_preds else None
    fs_labels = fs_result.get("label_cols") or []
    fs_expls = fs_result.get("row_explanations") or []
    fs_mode = fs_result.get("execution_mode", "")
    context_parts.append(
        f"[ForeSight — Production Forecasting]\n"
        f"Status: {fs_status}\n"
        f"Execution mode: {fs_mode or 'standard'}\n"
        + (f"Forecast labels: {fs_labels}\n" if fs_labels else "")
        + (f"First forecast vector: {fs_first}\n" if fs_first is not None else "")
        + (f"Explanations (first 3): {'; '.join(str(e) for e in fs_expls[:3])}\n" if fs_expls else "")
    )

    ig_status = infoguide.get("status", "not requested")
    ig_result = infoguide.get("result") or {}
    ig_response = ig_result.get("response") or ""
    ig_question = ig_result.get("question") or user_query or ""
    ig_dataset_answer = ig_result.get("dataset_answer") or ""
    context_parts.append(
        f"[InfoGuide — Domain Q&A]\n"
        f"Status: {ig_status}\n"
        + (f"Question: {ig_question}\n" if ig_question else "")
        + (f"LLM answer: {ig_response}\n" if ig_response else "")
        + (f"Dataset reference answer: {ig_dataset_answer}\n" if ig_dataset_answer else "")
    )

    context = "\n\n".join(context_parts)
    synthesis_query = (
        user_query
        or "Summarise the SmartPilot analysis results for the operator, "
           "highlighting any anomalies, forecasts, and domain insights."
    )

    try:
        return llm(_SYNTHESIS_SYSTEM, synthesis_query, context)
    except Exception as exc:
        parts = [
            "SmartPilot run complete.",
            f"PredictX: {px_status}." + (f" First anomaly vector: {px_first}." if px_first is not None else ""),
            f"ForeSight: {fs_status}." + (f" First forecast vector: {fs_first}." if fs_first is not None else ""),
            f"InfoGuide: {ig_status}." + (f" Answer: {ig_response}" if ig_response else ""),
            f"(LLM synthesis unavailable: {exc})",
        ]
        return " ".join(parts)
