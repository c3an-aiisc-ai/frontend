from typing import List

from ..core.stage import Stage
from ...Resources.Schemas.artifacts import TextBlob, RouteResult


class RouteQuery(Stage[TextBlob, RouteResult]):
    def __init__(self, *, sentence_model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        super().__init__("infoguide_route", TextBlob, RouteResult)
        self.sentence_model_name = sentence_model_name
        self._model = None
        self._util = None
        self._device = None
        
    def _load_model(self):
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer, util
                import torch
            except ImportError as exc:
                raise ImportError(
                    "sentence-transformers is required for routing queries"
                ) from exc

            # ---- Device detection ----
            if torch.cuda.is_available():
                device = "cuda"
            elif torch.backends.mps.is_available() and torch.backends.mps.is_built():
                device = "mps"
            else:
                device = "cpu"

            # ---- Load model on detected device ----
            self._model = SentenceTransformer(self.sentence_model_name, device=device)
            self._util = util
            self._device = device

    def run(self, inp: TextBlob, **kwargs) -> RouteResult:
        self._load_model()
        documentation_queries: List[str] = kwargs.get("documentation_queries") or [
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
        production_queries: List[str] = kwargs.get("production_queries") or [
            "What is the next hour production when current values are 0.0, 0.0, 1482.75?",
            "0.0,0.0,1482.75, What is the next hour production?",
        ]
        anomaly_queries: List[str] = kwargs.get("anomaly_queries") or [
            "What is the anomaly status when sensor values are 594. 355. 500?",
            "594. 355. 500. ; is there an anomaly in this time?",
        ]

        doc_embeddings = self._model.encode(documentation_queries, convert_to_tensor=True)
        prod_embeddings = self._model.encode(production_queries, convert_to_tensor=True)
        anom_embeddings = self._model.encode(anomaly_queries, convert_to_tensor=True)

        user_embedding = self._model.encode(inp.text or "", convert_to_tensor=True)

        doc_score = max(self._util.pytorch_cos_sim(user_embedding, doc_embeddings)[0]).item()
        prod_score = max(self._util.pytorch_cos_sim(user_embedding, prod_embeddings)[0]).item()
        anom_score = max(self._util.pytorch_cos_sim(user_embedding, anom_embeddings)[0]).item()

        scores = {"documentation": doc_score, "production": prod_score, "anomaly": anom_score}
        best_match = max(scores, key=scores.get)
        return RouteResult(route=best_match, score=float(scores[best_match]))