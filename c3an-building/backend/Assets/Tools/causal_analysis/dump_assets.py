import pickle
import csv
from pathlib import Path

from ..core.stage import Stage
from ..io.runfs import RunFS
from ...Resources.Schemas.artifacts import LiNGAMResult, LiNGAMExportPaths


class ExportLiNGAMArtifacts(Stage[LiNGAMResult, LiNGAMExportPaths]):
    def __init__(self):
        super().__init__("export_lingam", LiNGAMResult, LiNGAMExportPaths)

    def run(self, inp: LiNGAMResult, **kwargs) -> LiNGAMExportPaths:
        fs: RunFS = kwargs.get("fs")
        if fs is None:
            raise ValueError("RunFS (fs) is required")

        graph_html = kwargs.get("graph_html") or str((fs.tertiary / "lingam_causal_graph.html").resolve())
        graph_path = Path(graph_html)
        graph_path.parent.mkdir(parents=True, exist_ok=True)

        edges_pkl = str((fs.tertiary / "lingam_graph_edges.pkl").resolve())
        adjacency_pkl = str((fs.tertiary / "lingam_adjacency_matrix.pkl").resolve())
        total_effects_pkl = str((fs.tertiary / "lingam_total_effects.pkl").resolve())

        with open(edges_pkl, "wb") as f:
            pickle.dump([tuple(edge) for edge in inp.edges], f)
        with open(adjacency_pkl, "wb") as f:
            pickle.dump((inp.adjacency_matrix, inp.node_labels), f)
        with open(total_effects_pkl, "wb") as f:
            pickle.dump((inp.total_effects_matrix, inp.node_labels), f)

        summary_json = fs.write_json(
            "tertiary",
            "lingam_summary",
            {
                "node_labels": inp.node_labels,
                "edge_count": len(inp.edges or []),
                "edges": inp.edges,
            },
        )

        bootstrap_csv = None
        bootstrap_rows = kwargs.get("bootstrap_rows")
        if bootstrap_rows:
            bootstrap_csv = str((fs.tertiary / "lingam_bootstrap_stability.csv").resolve())
            keys = list(bootstrap_rows[0].keys())
            with open(bootstrap_csv, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=keys)
                writer.writeheader()
                writer.writerows(bootstrap_rows)

        batch_eval_csv = None
        batch_eval_rows = kwargs.get("batch_eval_rows")
        if batch_eval_rows:
            batch_eval_csv = str((fs.tertiary / "lingam_batch_counterfactual.csv").resolve())
            keys = list(batch_eval_rows[0].keys())
            with open(batch_eval_csv, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=keys)
                writer.writeheader()
                writer.writerows(batch_eval_rows)

        return LiNGAMExportPaths(
            graph_html=str(graph_path.resolve()),
            edges_pkl=edges_pkl,
            adjacency_pkl=adjacency_pkl,
            total_effects_pkl=total_effects_pkl,
            summary_json=summary_json,
            bootstrap_csv=bootstrap_csv,
            batch_eval_csv=batch_eval_csv,
        )