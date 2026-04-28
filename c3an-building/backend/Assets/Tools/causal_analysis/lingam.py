from typing import Iterable, Sequence

import numpy as np
from causallearn.search.FCMBased import lingam

from ..core.stage import Stage
from ...Resources.Schemas.artifacts import CausalFeatures, LiNGAM, LiNGAMResult
from .algorithms import algorithm_2


def fit_lingam_model(data: Iterable[Iterable[float]]):
    """Fit ICA-LiNGAM on a feature matrix."""
    model = lingam.ICALiNGAM()
    model.fit(np.asarray(list(data), dtype=float))
    return model


def extract_adjacency_matrix(model) -> np.ndarray:
    """Extract direct-effect adjacency matrix B from trained LiNGAM model."""
    return np.asarray(model.adjacency_matrix_, dtype=float)


def compute_total_effects_and_edges(adj_matrix: np.ndarray, node_labels: Sequence[str], edge_threshold: float = 0.0):
    """Compute total effects (I - B)^-1 and derive directed edge list."""
    total_effects = algorithm_2(adj_matrix)
    edges = []
    for i in range(len(adj_matrix)):
        for j in range(len(adj_matrix[i])):
            if abs(adj_matrix[i, j]) > edge_threshold:
                edges.append([node_labels[j], node_labels[i]])
    return total_effects, edges


class FitLiNGAM(Stage[CausalFeatures, LiNGAM]):
    def __init__(self):
        super().__init__("fit_lingam", CausalFeatures, LiNGAM)

    def run(self, inp: CausalFeatures, **kwargs) -> LiNGAM:
        if inp.rows is None or len(inp.rows) == 0:
            raise ValueError("CausalFeatures.rows is empty")

        node_labels = kwargs.get("node_labels") or inp.columns
        if not node_labels:
            width = len(inp.rows[0])
            node_labels = [f"X{i}" for i in range(width)]

        model = fit_lingam_model(inp.rows)
        out = LiNGAM(arch="LiNGAM", params={"node_labels": list(node_labels)})
        setattr(out, "_lingam_model", model)
        return out