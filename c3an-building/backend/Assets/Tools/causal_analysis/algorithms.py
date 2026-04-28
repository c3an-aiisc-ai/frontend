from typing import Sequence

import numpy as np
import pandas as pd
from causallearn.search.FCMBased import lingam


class Algorithm1Bootstrap:
    @staticmethod
    def run(
        df: pd.DataFrame,
        selected_features: Sequence[str],
        n_bootstrap: int = 20,
        seed: int = 42,
    ) -> pd.DataFrame:
        """
        Algorithm 1: Bootstrap-Based Edge Stability Analysis.
        """
        edge_strengths = {}

        for b in range(n_bootstrap):
            sample_df = df[list(selected_features)].sample(frac=1.0, replace=True, random_state=seed + b)
            model = lingam.DirectLiNGAM()
            model.fit(sample_df.values)
            adj_matrix = np.asarray(model.adjacency_matrix_, dtype=float)
            labels = list(selected_features)

            for i in range(len(labels)):
                for j in range(i + 1, len(labels)):
                    edge_strengths.setdefault((labels[i], labels[j]), []).append(adj_matrix[i, j])
                    edge_strengths.setdefault((labels[j], labels[i]), []).append(adj_matrix[j, i])

        rows = []
        for (src, tgt), vals in edge_strengths.items():
            mean_val = float(np.mean(vals))
            std_val = float(np.std(vals))
            stability = 1.0 / (1.0 + std_val)
            rows.append(
                {
                    "Source": src,
                    "Target": tgt,
                    "Mean Strength": round(mean_val, 4),
                    "Std Dev": round(std_val, 4),
                    "Stability Score": round(stability, 4),
                }
            )

        if not rows:
            return pd.DataFrame(columns=["Source", "Target", "Mean Strength", "Std Dev", "Stability Score"])
        return pd.DataFrame(rows).sort_values("Stability Score", ascending=False)


class Algorithm2TotalEffects:
    @staticmethod
    def compute_total_effects(adj_matrix: np.ndarray) -> np.ndarray:
        """
        Algorithm 2: Compute total effects as (I - B)^-1.
        """
        num_vars = adj_matrix.shape[0]
        identity = np.eye(num_vars)
        return np.linalg.inv(identity - adj_matrix)

    @classmethod
    def run(
        cls,
        adj_matrix: np.ndarray,
        node_labels: Sequence[str],
        edge_threshold: float = 0.0,
        
        
        
        
        
        
        
        
        
        
        
        
    ):
        total_effects = cls.compute_total_effects(adj_matrix)
        edges = []
        for i in range(len(adj_matrix)):
            for j in range(len(adj_matrix[i])):
                if abs(adj_matrix[i, j]) > edge_threshold:
                    edges.append([node_labels[j], node_labels[i]])
        return total_effects, edges


class Algorithm3Counterfactual:
    @staticmethod
    def validate_pair(
        df: pd.DataFrame,
        a_name: str,
        a1: float,
        a2: float,
        b_name: str,
        total_effects: np.ndarray,
        node_labels: Sequence[str],
        tolerance: float = 0.2,
    ):
        """
        Algorithm 3: Counterfactual Validation for one A->B pair.
        Mirrors validate_counterfactual from run_updated (1).py.
        """
        if a_name not in node_labels or b_name not in node_labels:
            return None

        i, j = node_labels.index(a_name), node_labels.index(b_name)
        strength = float(total_effects[i, j])
        predicted_change = float((a2 - a1) * strength)

        baseline_rows = df[np.isclose(df[a_name], a1, atol=tolerance)]
        counterfactual_rows = df[np.isclose(df[a_name], a2, atol=tolerance)]

        if len(baseline_rows) < 3 or len(counterfactual_rows) < 3:
            return {
                "predicted_change": predicted_change,
                "observed_change": None,
                "strength": strength,
                "note": f"Not enough rows around A={a1} and A={a2} (+/-{tolerance})",
            }

        observed_change = float(counterfactual_rows[b_name].mean() - baseline_rows[b_name].mean())
        return {
            "predicted_change": predicted_change,
            "observed_change": observed_change,
            "difference": abs(predicted_change - observed_change),
            "strength": strength,
            "note": "ok",
        }

    @classmethod
    def batch_evaluate(
        cls,
        df: pd.DataFrame,
        total_effects: np.ndarray,
        node_labels: Sequence[str],
        tolerance: float = 50,
    ) -> pd.DataFrame:
        """
        Batch counterfactual evaluation over all valid A->B pairs.
        Mirrors batch_evaluate_causal_pairs from run_updated (1).py.
        """
        results = []

        for i, a_name in enumerate(node_labels):
            a_data = df[a_name].dropna()
            if len(a_data) < 10:
                continue
            a1 = float(a_data.quantile(0.25))
            a2 = float(a_data.quantile(0.75))

            for j, b_name in enumerate(node_labels):
                if i == j:
                    continue
                strength = float(total_effects[i, j])
                if abs(strength) < 1e-5:
                    continue

                result = cls.validate_pair(
                    df=df,
                    a_name=a_name,
                    a1=a1,
                    a2=a2,
                    b_name=b_name,
                    total_effects=total_effects,
                    node_labels=node_labels,
                    tolerance=tolerance,
                )
                if result and result.get("observed_change") is not None:
                    results.append(
                        {
                            "A (Cause)": a_name,
                            "B (Effect)": b_name,
                            "Baseline A": a1,
                            "Intervened A": a2,
                            "Predicted dB": result["predicted_change"],
                            "Observed dB": result["observed_change"],
                            "Error (|d|)": result["difference"],
                            "Total Effect": result["strength"],
                        }
                    )

        return pd.DataFrame(results)


def algorithm_1(
    df: pd.DataFrame,
    selected_features: Sequence[str],
    n_bootstrap: int = 20,
    seed: int = 42,
) -> pd.DataFrame:
    return Algorithm1Bootstrap.run(
        df=df,
        selected_features=selected_features,
        n_bootstrap=n_bootstrap,
        seed=seed,
    )


def algorithm_2(
    adj_matrix: np.ndarray,
) -> np.ndarray:
    return Algorithm2TotalEffects.compute_total_effects(adj_matrix)


def algorithm_3(
    df: pd.DataFrame,
    total_effects: np.ndarray,
    node_labels: Sequence[str],
    tolerance: float = 50,
) -> pd.DataFrame:
    return Algorithm3Counterfactual.batch_evaluate(
        df=df,
        total_effects=total_effects,
        node_labels=node_labels,
        tolerance=tolerance,
    )


def algorithm_3_validate(
    df: pd.DataFrame,
    a_name: str,
    a1: float,
    a2: float,
    b_name: str,
    total_effects: np.ndarray,
    node_labels: Sequence[str],
    tolerance: float = 0.2,
):
    return Algorithm3Counterfactual.validate_pair(
        df=df,
        a_name=a_name,
        a1=a1,
        a2=a2,
        b_name=b_name,
        total_effects=total_effects,
        node_labels=node_labels,
        tolerance=tolerance,
    )