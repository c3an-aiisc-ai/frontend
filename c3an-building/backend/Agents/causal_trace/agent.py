from typing import List, Optional

import numpy as np
import pandas as pd

from ...Assets.Resources.Schemas.artifacts import LiNGAMExportPaths, LiNGAMResult, RawFrame
from ...Assets.Tools.causal_analysis.algorithms import algorithm_1, algorithm_2, algorithm_3
from ...Assets.Tools.causal_analysis.display_graphs import RenderLiNGAMGraph
from ...Assets.Tools.causal_analysis.dump_assets import ExportLiNGAMArtifacts
from ...Assets.Tools.causal_analysis.lingam import FitLiNGAM, extract_adjacency_matrix
from ...Assets.Tools.causal_analysis.load_assets import LoadCSV
from ...Assets.Tools.io.runfs import RunFS
from ...paths import resolve_backend_path


class CausalTraceAgent:
    def __init__(self, fs: RunFS):
        self.fs = fs

    def run(
        self,
        *,
        csv_path: str,
        feature_cols: Optional[List[str]] = None,
        sample_size: Optional[int] = None,
        output_html_name: str = "lingam_causal_graph.html",
        run_bootstrap: bool = False,
        bootstrap_n: int = 20,
        bootstrap_seed: int = 42,
        run_batch_eval: bool = False,
        batch_tolerance: float = 50.0,
    ) -> LiNGAMExportPaths:
        csv_path = str(resolve_backend_path(csv_path, must_exist=True))
        features = LoadCSV().run(
            RawFrame(),
            csv_path=csv_path,
            feature_cols=feature_cols,
            sample_size=sample_size,
        )
        df = pd.DataFrame(features.rows, columns=features.columns)
        node_labels = list(features.columns or [])

        trained = FitLiNGAM().run(features)
        model = getattr(trained, "_lingam_model", None)
        if model is None:
            raise ValueError("LiNGAM model instance missing on trained artifact")

        adj_matrix = np.asarray(extract_adjacency_matrix(model), dtype=float)

        total_effects = algorithm_2(adj_matrix)
        edges = []
        for i in range(len(adj_matrix)):
            for j in range(len(adj_matrix[i])):
                if abs(adj_matrix[i, j]) > 0.0:
                    edges.append([node_labels[j], node_labels[i]])

        lingam_result = LiNGAMResult(
            adjacency_matrix=np.asarray(adj_matrix, dtype=float).tolist(),
            total_effects_matrix=np.asarray(total_effects, dtype=float).tolist(),
            node_labels=node_labels,
            edges=edges,
        )

        graph_path = str((self.fs.tertiary / output_html_name).resolve())
        RenderLiNGAMGraph().run(lingam_result, output_html=graph_path)

        algo1_df = algorithm_1(
            df=df,
            selected_features=node_labels,
            n_bootstrap=bootstrap_n,
            seed=bootstrap_seed,
        )
        bootstrap_rows = algo1_df.to_dict(orient="records")

        algo3_df = algorithm_3(
            df=df,
            total_effects=np.asarray(lingam_result.total_effects_matrix, dtype=float),
            node_labels=node_labels,
            tolerance=batch_tolerance,
        )
        batch_eval_rows = algo3_df.to_dict(orient="records")

        return ExportLiNGAMArtifacts().run(
            lingam_result,
            fs=self.fs,
            graph_html=graph_path,
            bootstrap_rows=bootstrap_rows,
            batch_eval_rows=batch_eval_rows,
        )


__all__ = ["CausalTraceAgent"]
