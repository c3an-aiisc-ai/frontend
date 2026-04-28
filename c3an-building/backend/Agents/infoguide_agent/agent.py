from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from ...Assets.Resources.Schemas.artifacts import TextBlob, RawFrame, HFTextClassifierExport
from ...Assets.Tools.io.runfs import RunFS
from ...Assets.Tools.infoguide import BuildKnowledgeStore, RetrieveContext, RouteQuery, TrainSequenceClassifier


class InfoGuideAgent:
    DEFAULT_DOCUMENTATION_QUERIES = [
        "What are the safety protocols for the manufacturing process?",
        "How to troubleshoot common issues in the manufacturing pipeline?",
        "Describe the maintenance procedure for the assembly line machines.",
        "What are the steps to calibrate the sensors in the manufacturing setup?",
        "How to perform a quality check on the manufactured toy rockets?",
        "What materials are needed for the manufacturing process?",
        "How to store and handle materials safely?",
        "What are the emergency procedures in case of a malfunction?",
        "How to document the production cycle for future reference?",
    ]
    DEFAULT_PRODUCTION_QUERIES = [
        "What is the next hour production when current values are 0.0, 0.0, 1482.75?",
        "0.0,0.0,1482.75, What is the next hour production?",
    ]
    DEFAULT_ANOMALY_QUERIES = [
        "What is the anomaly status when sensor values are 594. 355. 500?",
        "594. 355. 500. ; is there an anomaly in this time?",
    ]

    def __init__(
        self,
        fs: RunFS,
        *,
        sentence_model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
        documentation_queries: Optional[List[str]] = None,
        production_queries: Optional[List[str]] = None,
        anomaly_queries: Optional[List[str]] = None,
        downstream_route_map: Optional[Dict[str, str]] = None,
    ) -> None:
        self.fs = fs
        self._router = RouteQuery(sentence_model_name=sentence_model_name)
        self._knowledge_builder = BuildKnowledgeStore()
        self._retriever = RetrieveContext()

        self._documentation_queries = documentation_queries
        self._production_queries = production_queries
        self._anomaly_queries = anomaly_queries

        self._anomaly_model_bundle = None
        self._production_model_bundle = None
        self._query_model_bundle = None
        self._downstream_route_map = {
            "documentation": "predictx",
            "infoguide": "predictx",
            "production": "foresight",
            "foresight": "foresight",
            "forecast": "foresight",
            "anomaly": "predictx",
            "predictx": "predictx",
            "causal": "causalpulse",
            "causalpulse": "causalpulse",
            "causal_trace": "causalpulse",
            "causaltrace": "causalpulse",
            "root_cause": "causalpulse",
        }
        if downstream_route_map:
            self._downstream_route_map.update(
                {str(key).strip().lower(): str(value).strip().lower() for key, value in downstream_route_map.items()}
            )

    def classify_query(self, user_query: str) -> Tuple[str, float]:
        result = self._router.run(
            TextBlob(text=user_query),
            documentation_queries=self._documentation_queries or self.DEFAULT_DOCUMENTATION_QUERIES,
            production_queries=self._production_queries or self.DEFAULT_PRODUCTION_QUERIES,
            anomaly_queries=self._anomaly_queries or self.DEFAULT_ANOMALY_QUERIES,
        )
        return result.route, result.score

    def classify_query_payload(
        self,
        *,
        user_query: str,
        mode: Optional[str] = None,
    ) -> Dict[str, Any]:
        route, confidence, routing_source = self.determine_route(user_query=user_query, mode=mode)
        parsed_series, parsed_query = self._split_series_and_query(user_query)
        return {
            "route": route,
            "confidence": confidence,
            "routing_source": routing_source,
            "user_query": user_query,
            "parsed_query": parsed_query,
            "time_series_data": parsed_series,
            "target_agent": self.resolve_downstream_agent(route=route, user_query=user_query),
        }

    @staticmethod
    def _load_label_source(label_source_path: str, label_source_column: str) -> List[str]:
        import pandas as pd

        suffix = Path(label_source_path).suffix.lower()
        if suffix in {".xlsx", ".xls"}:
            df = pd.read_excel(label_source_path)
        elif suffix == ".csv":
            df = pd.read_csv(label_source_path)
        elif suffix == ".json":
            df = pd.read_json(label_source_path)
        else:
            raise ValueError(f"Unsupported label source file: {label_source_path}")

        if label_source_column not in df.columns:
            raise ValueError(
                f"Column '{label_source_column}' not found in {label_source_path}"
            )
        labels = df[label_source_column].unique().tolist()
        return [str(label) for label in labels]

    @staticmethod
    def load_sequence_classifier(
        *,
        model_checkpoint: str,
        label_source_path: Optional[str] = None,
        label_source_column: Optional[str] = None,
        labels: Optional[List[str]] = None,
    ) -> Tuple[Any, Any, Dict[int, str], Dict[str, int]]:
        from transformers import AutoTokenizer, AutoModelForSequenceClassification

        if labels is None:
            if not label_source_path or not label_source_column:
                raise ValueError("Provide labels or label_source_path + label_source_column")
            labels = InfoGuideAgent._load_label_source(label_source_path, label_source_column)

        id2label = {i: label for i, label in enumerate(labels)}
        label2id = {label: i for i, label in enumerate(labels)}

        tokenizer = AutoTokenizer.from_pretrained(model_checkpoint)
        model = AutoModelForSequenceClassification.from_pretrained(
            model_checkpoint, num_labels=len(labels), id2label=id2label, label2id=label2id
        )
        return tokenizer, model, id2label, label2id

    @staticmethod
    def _normalize_series(time_series_data: Optional[List[Any]]) -> List[str]:
        if not time_series_data:
            return ["[0. 0. 0.]"]
        return [str(item).strip() for item in time_series_data if str(item).strip()]

    @staticmethod
    def predict_labels(
        *,
        tokenizer: Any,
        model: Any,
        id2label: Dict[int, str],
        user_query: str,
        time_series_data: Optional[List[Any]],
    ) -> List[str]:
        import torch

        series_list = InfoGuideAgent._normalize_series(time_series_data)
        new_text_inputs = [f"{series} {user_query}" for series in series_list]
        tokenized_inputs = tokenizer(new_text_inputs, padding=True, truncation=True, return_tensors="pt")
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        tokenized_inputs = {key: value.to(device) for key, value in tokenized_inputs.items()}
        model.to(device)
        with torch.no_grad():
            logits = model(**tokenized_inputs).logits
        predicted_labels = [id2label[label.item()] for label in torch.argmax(logits, axis=1)]
        return predicted_labels

    def set_anomaly_model(
        self,
        *,
        model_checkpoint: str,
        label_source_path: Optional[str] = None,
        label_source_column: str = "predicted_label",
        labels: Optional[List[str]] = None,
    ) -> None:
        self._anomaly_model_bundle = self.load_sequence_classifier(
            model_checkpoint=model_checkpoint,
            label_source_path=label_source_path,
            label_source_column=label_source_column,
            labels=labels,
        )

    def set_production_model(
        self,
        *,
        model_checkpoint: str,
        label_source_path: Optional[str] = None,
        label_source_column: str = "completion",
        labels: Optional[List[str]] = None,
    ) -> None:
        self._production_model_bundle = self.load_sequence_classifier(
            model_checkpoint=model_checkpoint,
            label_source_path=label_source_path,
            label_source_column=label_source_column,
            labels=labels,
        )

    def set_query_classifier(
        self,
        *,
        model_checkpoint: str,
        label_source_path: Optional[str] = None,
        label_source_column: str = "predicted_label",
        labels: Optional[List[str]] = None,
    ) -> None:
        self._query_model_bundle = self.load_sequence_classifier(
            model_checkpoint=model_checkpoint,
            label_source_path=label_source_path,
            label_source_column=label_source_column,
            labels=labels,
        )


    def train_sequence_classifier(
        self,
        *,
        config_path: str = "Code/Assets/Resources/Configs/infoguide.yaml",
    ) -> HFTextClassifierExport:
        return TrainSequenceClassifier().run(
            RawFrame(),
            fs=self.fs,
            config_path=config_path,
        )

    def build_context(
        self,
        *,
        knowledge_text: str,
        user_query: str,
        top_k: int = 1,
        use_symbolic: bool = True,
        use_neural: bool = False,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        chunks = self._knowledge_builder.run(TextBlob(text=knowledge_text))
        retrieval = self._retriever.run(
            chunks,
            query=user_query,
            top_k=top_k,
            use_symbolic=use_symbolic,
            use_neural=use_neural,
        )
        contexts = retrieval.contexts or []
        context_text = "\n".join(contexts)
        if conversation_history:
            history = "\n".join(
                [f"{msg.get('role')}: {msg.get('content')}" for msg in conversation_history]
            )
            return f"{history}\n{context_text}" if history else context_text
        return context_text

    @staticmethod
    def _call_llm(
        *,
        llm: Any,
        system_template: str,
        user_query: str,
        context: str,
    ) -> str:
        if llm is None:
            raise ValueError("LLM instance or callable is required for documentation responses")

        if callable(llm):
            return str(llm(system_template, user_query, context))

        set_prompt = getattr(llm, "set_prompt", None)
        respond = getattr(llm, "respond_to_prompt", None)
        if callable(set_prompt) and callable(respond):
            llm.set_prompt(system_template, user_query, context)
            return str(llm.respond_to_prompt())

        raise ValueError("LLM must be callable or expose set_prompt/respond_to_prompt")

    def answer_documentation(
        self,
        *,
        user_query: str,
        knowledge_text: str,
        llm: Any,
        system_template: str = "",
        conversation_history: Optional[List[Dict[str, str]]] = None,
        top_k: int = 1,
        use_symbolic: bool = True,
        use_neural: bool = False,
    ) -> str:
        context = self.build_context(
            knowledge_text=knowledge_text,
            user_query=user_query,
            top_k=top_k,
            use_symbolic=use_symbolic,
            use_neural=use_neural,
            conversation_history=conversation_history,
        )
        return self._call_llm(
            llm=llm,
            system_template=system_template,
            user_query=user_query,
            context=context,
        )

    @staticmethod
    def _split_series_and_query(user_query: str) -> Tuple[List[str], str]:
        if ";" not in user_query:
            return ["[0. 0. 0.]"], user_query
        parts = user_query.split(";", 1)
        series_part = parts[0].strip()
        query_part = parts[1].strip() if len(parts) > 1 else ""
        series_list = [item.strip() for item in series_part.split(",") if item.strip()]
        if not series_list:
            series_list = ["[0. 0. 0.]"]
        return series_list, (query_part or user_query)

    def predict_anomaly(
        self,
        *,
        user_query: str,
        time_series_data: Optional[List[Any]] = None,
        model_bundle: Optional[Tuple[Any, Any, Dict[int, str], Dict[str, int]]] = None,
    ) -> List[str]:
        bundle = model_bundle or self._anomaly_model_bundle
        if bundle is None:
            raise ValueError("Anomaly model bundle not set. Call set_anomaly_model first.")
        tokenizer, model, id2label, _ = bundle
        return self.predict_labels(
            tokenizer=tokenizer,
            model=model,
            id2label=id2label,
            user_query=user_query,
            time_series_data=time_series_data,
        )

    def predict_production(
        self,
        *,
        user_query: str,
        time_series_data: Optional[List[Any]] = None,
        model_bundle: Optional[Tuple[Any, Any, Dict[int, str], Dict[str, int]]] = None,
    ) -> List[str]:
        bundle = model_bundle or self._production_model_bundle
        if bundle is None:
            raise ValueError("Production model bundle not set. Call set_production_model first.")
        tokenizer, model, id2label, _ = bundle
        return self.predict_labels(
            tokenizer=tokenizer,
            model=model,
            id2label=id2label,
            user_query=user_query,
            time_series_data=time_series_data,
        )

    def predict_query_type(
        self,
        *,
        user_query: str,
        model_bundle: Optional[Tuple[Any, Any, Dict[int, str], Dict[str, int]]] = None,
    ) -> List[str]:
        bundle = model_bundle or self._query_model_bundle
        if bundle is None:
            raise ValueError("Query classifier bundle not set. Call set_query_classifier first.")
        tokenizer, model, id2label, _ = bundle
        return self.predict_labels(
            tokenizer=tokenizer,
            model=model,
            id2label=id2label,
            user_query=user_query,
            time_series_data=None,
        )

    @staticmethod
    def _normalize_route_name(route: Optional[str]) -> str:
        if route is None:
            return ""
        return str(route).strip().lower().replace("-", "_").replace(" ", "_")

    def determine_route(
        self,
        *,
        user_query: str,
        mode: Optional[str] = None,
    ) -> Tuple[str, Optional[float], str]:
        if mode is not None:
            return mode, None, "manual"

        if self._query_model_bundle is not None:
            predicted = self.predict_query_type(user_query=user_query)
            return predicted[0], None, "sequence_classifier"

        route, confidence = self.classify_query(user_query)
        return route, confidence, "semantic_router"

    def resolve_downstream_agent(self, *, route: str, user_query: str = "") -> str:
        query_text = (user_query or "").lower()
        causal_keywords = (
            "root cause",
            "cause of",
            "why did",
            "why is",
            "why are",
            "impact of",
            "driver of",
            "drivers of",
            "correlation",
            "causal",
        )
        if any(keyword in query_text for keyword in causal_keywords):
            return "causalpulse"

        normalized_route = self._normalize_route_name(route)
        if normalized_route in self._downstream_route_map:
            return self._downstream_route_map[normalized_route]

        if normalized_route in {"documentation", "infoguide", ""}:
            return "predictx"

        return normalized_route or "predictx"

    def route_request(
        self,
        *,
        user_query: str,
        mode: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload = self.classify_query_payload(user_query=user_query, mode=mode)
        return {
            "route": payload["route"],
            "confidence": payload["confidence"],
            "routing_source": payload["routing_source"],
            "target_agent": payload["target_agent"],
        }

    def process_classified_query(
        self,
        *,
        classification: Dict[str, Any],
        knowledge_text: Optional[str] = None,
        llm: Any = None,
        system_template: str = "",
        conversation_history: Optional[List[Dict[str, str]]] = None,
        top_k: int = 1,
        use_symbolic: bool = True,
        use_neural: bool = False,
    ) -> Dict[str, Any]:
        route = classification["route"]
        parsed_query = classification["parsed_query"]
        time_series_data = classification["time_series_data"]

        if route == "documentation":
            if knowledge_text is None:
                raise ValueError("knowledge_text is required for documentation responses")
            response = self.answer_documentation(
                user_query=parsed_query,
                knowledge_text=knowledge_text,
                llm=llm,
                system_template=system_template,
                conversation_history=conversation_history,
                top_k=top_k,
                use_symbolic=use_symbolic,
                use_neural=use_neural,
            )
            return {**classification, "response": response}

        if route == "anomaly":
            labels = self.predict_anomaly(user_query=parsed_query, time_series_data=time_series_data)
            return {**classification, "predicted_labels": labels}

        if route == "production":
            labels = self.predict_production(user_query=parsed_query, time_series_data=time_series_data)
            return {**classification, "predicted_labels": labels}

        return classification

    def run(
        self,
        *,
        user_query: str,
        knowledge_text: Optional[str] = None,
        llm: Any = None,
        system_template: str = "",
        conversation_history: Optional[List[Dict[str, str]]] = None,
        top_k: int = 1,
        use_symbolic: bool = True,
        use_neural: bool = False,
        mode: Optional[str] = None,
        time_series_data: Optional[List[Any]] = None,
    ) -> Dict[str, Any]:
        classification = self.classify_query_payload(user_query=user_query, mode=mode)
        if time_series_data is not None:
            classification["time_series_data"] = self._normalize_series(time_series_data)
        return self.process_classified_query(
            classification=classification,
            knowledge_text=knowledge_text,
            llm=llm,
            system_template=system_template,
            conversation_history=conversation_history,
            top_k=top_k,
            use_symbolic=use_symbolic,
            use_neural=use_neural,
        )


