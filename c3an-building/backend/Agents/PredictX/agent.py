import random
import csv
import torch
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from ...Assets.Resources.Schemas.artifacts import (
    CNNConfig,
    ExportPaths,
    FusionConfig,
    ModelConfig,
    RawFrame,
    TrainConfig,
)
from ...Assets.Tools.efficientnet.build_model import BuildEfficientNet
from ...Assets.Tools.efficientnet.build_targets import BuildTargets as ENBuildTargets
from ...Assets.Tools.efficientnet.evaluate import EvaluatePredictions as ENEvaluatePredictions
from ...Assets.Tools.efficientnet.export import ExportRunArtifacts as ENExportRunArtifacts
from ...Assets.Tools.efficientnet.impute_encode import ImputeAndEncode as ENImputeAndEncode
from ...Assets.Tools.efficientnet.infer import PredictOnValid as ENPredictOnValid
from ...Assets.Tools.efficientnet.load_images import LoadImages as ENLoadImages
from ...Assets.Tools.efficientnet.select_columns import SelectColumns as ENSelectColumns
from ...Assets.Tools.efficientnet.split import TrainValidSplit as ENTrainValidSplit
from ...Assets.Tools.efficientnet.train import TrainModel as ENTrainModel
from ...Assets.Tools.fusion.build_model import BuildFusionModel
from ...Assets.Tools.fusion.build_targets import BuildTargets as FUBuildTargets
from ...Assets.Tools.fusion.evaluate import EvaluatePredictions as FUEvaluatePredictions
from ...Assets.Tools.fusion.export import ExportRunArtifacts as FUExportRunArtifacts
from ...Assets.Tools.fusion.impute_encode import ImputeAndEncode as FUImputeAndEncode
from ...Assets.Tools.fusion.infer import PredictOnValid as FUPredictOnValid
from ...Assets.Tools.fusion.select_columns import SelectColumns as FUSelectColumns
from ...Assets.Tools.fusion.split import TrainValidSplit as FUTrainValidSplit
from ...Assets.Tools.fusion.train import TrainModel as FUTrainModel
from ...Assets.Tools.io.runfs import RunFS
from ...Assets.Tools.lstm_autoencoder.build_model import BuildLSTMAE
from ...Assets.Tools.lstm_autoencoder.build_targets import BuildTargets as LSTMBuildTargets
from ...Assets.Tools.lstm_autoencoder.evaluate import EvaluatePredictions as LSTMEvaluatePredictions
from ...Assets.Tools.lstm_autoencoder.export import ExportRunArtifacts as LSTMExportRunArtifacts
from ...Assets.Tools.lstm_autoencoder.impute_encode import ImputeAndEncode as LSTMImputeAndEncode
from ...Assets.Tools.lstm_autoencoder.infer import PredictOnValid as LSTMPredictOnValid
from ...Assets.Tools.lstm_autoencoder.select_columns import SelectColumns as LSTMSelectColumns
from ...Assets.Tools.lstm_autoencoder.split import TrainValidSplit as LSTMTrainValidSplit
from ...Assets.Tools.lstm_autoencoder.train import TrainModel as LSTMTrainModel
from ...Assets.Tools.predictx_preprocessing.align_cycle_time import AlignCycleTime
from ...Assets.Tools.predictx_preprocessing.build_cycle_state import BuildContinuousCycleState
from ...Assets.Tools.predictx_preprocessing.combine_multimodal_json import CombineMultimodalJSON
from ...Assets.Tools.predictx_preprocessing.derive_actual_state import DeriveActualState
from ...Assets.Tools.predictx_preprocessing.export_csv import ExportCSV
from ...Assets.Tools.predictx_preprocessing.filter_cycle_state import FilterCycleState
from ...Assets.Tools.predictx_preprocessing.load_csv import LoadCSV as PPLoadCSV
from ...Assets.Tools.predictx_preprocessing.merge_asof import MergeAsof
from ...Assets.Tools.fusion import train as fusion_train
from ...paths import resolve_backend_path


class PredictXAgent:
    def __init__(self, fs: RunFS):
        self.fs = fs

    def _resolve_image_path(self, path_value: Any, image_root_dir: Optional[str] = None) -> Optional[str]:
        if path_value is None:
            return None
        raw = str(path_value).strip()
        if not raw:
            return None

        p = Path(raw)
        if p.exists():
            return str(p.resolve())

        if image_root_dir:
            root = Path(image_root_dir)
            if raw.startswith("Dataset/"):
                cand = (root / raw[len("Dataset/") :]).resolve()
                if cand.exists():
                    return str(cand)
            cand = (root / raw).resolve()
            if cand.exists():
                return str(cand)

        return None

    def _sample_rows(self, rows: List[Dict[str, Any]], max_rows: Optional[int], sample_seed: int) -> List[Dict[str, Any]]:
        if max_rows is None or max_rows <= 0:
            return rows
        if len(rows) <= max_rows:
            return rows
        rng = random.Random(int(sample_seed))
        idx = sorted(rng.sample(range(len(rows)), int(max_rows)))
        return [rows[i] for i in idx]

    def _filter_train_cfg(self, train_cfg: Optional[Dict[str, Any]]) -> TrainConfig:
        cfg = train_cfg or {}
        allowed = {"epochs", "batch_size", "lr", "seed", "shuffle"}
        return TrainConfig(**{k: v for k, v in cfg.items() if k in allowed})

    @staticmethod
    def _load_yaml_config(config_path: Optional[str]) -> Dict[str, Any]:
        if not config_path:
            return {}
        cfg_path = resolve_backend_path(config_path)
        if not cfg_path.exists():
            raise FileNotFoundError(f"Config not found: {cfg_path}")
        import yaml

        cfg = yaml.safe_load(cfg_path.read_text(encoding="utf-8")) or {}
        if not isinstance(cfg, dict):
            raise ValueError("Config must be a mapping (YAML dictionary)")
        return cfg

    @staticmethod
    def _merge_cfg(base: Optional[Dict[str, Any]], override: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        out = dict(base or {})
        out.update(override or {})
        return out

    @staticmethod
    def _resolve_path_value(path_value: Optional[str], *, must_exist: bool = False) -> Optional[str]:
        if path_value is None:
            return None
        raw = str(path_value).strip()
        if not raw:
            return None
        return str(resolve_backend_path(raw, must_exist=must_exist))

    @classmethod
    def _resolve_path_values(cls, values: Optional[List[str]], *, must_exist: bool = False) -> Optional[List[str]]:
        if not values:
            return values
        return [resolved for value in values if (resolved := cls._resolve_path_value(value, must_exist=must_exist))]
        
    def _build_fusion_rows(
            self,
            *,
            lstm_preds,
            image_preds,
            image_prob_dim: int,
            default_knowledge_adjustment: float = 0.0,
            knowledge_adjustments: Optional[List[float]] = None,
        ) -> List[Dict[str, float]]:
            rows: List[Dict[str, float]] = []
            n = len(lstm_preds.y_pred or [])
            for i in range(n):
                ts_pred = [float(v) for v in lstm_preds.y_pred[i]]
                ts_true = [float(v) for v in lstm_preds.y_true[i]]

                has_img = i < len(image_preds.y_pred or [])
                img_pred = [float(v) for v in (image_preds.y_pred[i] if has_img else [0.0] * image_prob_dim)]

                if knowledge_adjustments and i < len(knowledge_adjustments):
                    know_adj = float(knowledge_adjustments[i])
                else:
                    know_adj = float(default_knowledge_adjustment)

                row: Dict[str, float] = {}
                for j, v in enumerate(ts_pred):
                    row[f"ts_pred_{j}"] = float(v)
                for j, v in enumerate(img_pred):
                    row[f"img_prob_{j}"] = float(v)

                row["target_1"] = float(ts_true[0])
                row["target_2"] = float(ts_true[1])
                row["target_state"] = float(ts_true[2])
                row["has_image"] = float(1 if has_img else 0)
                row["knowledge_adjustment"] = float(know_adj)
                rows.append(row)

            return rows

    def preprocess(
        self,
        *,
        preprocessed_csv: Optional[str] = None,
        cycle_csv: Optional[str] = None,
        multimodal_json_paths: Optional[List[str]] = None,
        multimodal_json_glob: Optional[str] = None,
        multimodal_json_dir: Optional[str] = None,
        export_csv_path: Optional[str] = None,
        include_cycle_filter: bool = False,
        allowed_cycle_states: Optional[List[int]] = None,
    ) -> Tuple[RawFrame, str]:
        if preprocessed_csv:
            preprocessed_csv = self._resolve_path_value(preprocessed_csv, must_exist=True)
            raw = PPLoadCSV().run(RawFrame(), csv_path=preprocessed_csv)
            return raw, preprocessed_csv

        if not cycle_csv:
            raise ValueError("cycle_csv is required when preprocessed_csv is not provided")

        cycle_csv = self._resolve_path_value(cycle_csv, must_exist=True)
        multimodal_json_paths = self._resolve_path_values(multimodal_json_paths, must_exist=True)
        multimodal_json_glob = self._resolve_path_value(multimodal_json_glob) if multimodal_json_glob else None
        multimodal_json_dir = self._resolve_path_value(multimodal_json_dir, must_exist=True)

        combined = CombineMultimodalJSON().run(
            RawFrame(),
            json_paths=multimodal_json_paths,
            json_glob=multimodal_json_glob,
            data_dir=multimodal_json_dir,
            time_col="time",
        )

        cycle_raw = PPLoadCSV().run(RawFrame(), csv_path=cycle_csv)
        cycle_aligned = AlignCycleTime().run(
            cycle_raw,
            time_col="_time",
            out_col="_time_new",
            keep_cols=["_time", "Description", "CycleState"],
        )

        merged = MergeAsof().run(
            combined,
            cycle_frame=cycle_aligned,
            left_time_col="time",
            right_time_col="_time_new",
            direction="nearest",
        )
        cycle_state = BuildContinuousCycleState().run(
            merged,
            cycle_col="Q_Cell_CycleCount",
            out_col="Cycle_State_New",
            description_col="Description",
            estop_label="E_STOPPED",
        )
        labeled = DeriveActualState().run(
            cycle_state,
            cycle_state_col="CycleState",
            description_col="Description",
            cycle_group_col="Cycle_State_New",
            out_col="actual_state",
            default_state="Normal",
        )

        out = labeled
        if include_cycle_filter:
            out = FilterCycleState().run(
                out,
                cycle_col="CycleState",
                allowed=allowed_cycle_states or [4, 9],
            )

        target_csv = (
            self._resolve_path_value(export_csv_path)
            if export_csv_path
            else str((self.fs.secondary / "predictx_preprocessed.csv").resolve())
        )
        Path(target_csv).parent.mkdir(parents=True, exist_ok=True)
        ExportCSV().run(out, csv_path=target_csv, index=False)
        return out, target_csv

    def train(
        self,
        *,
        preprocessed_csv: Optional[str] = None,
        cycle_csv: Optional[str] = None,
        multimodal_json_paths: Optional[List[str]] = None,
        multimodal_json_glob: Optional[str] = None,
        multimodal_json_dir: Optional[str] = None,
        image_csv: Optional[str] = None,
        image_col: Optional[str] = None,
        image_label_col: Optional[str] = None,
        lstm_feature_cols: Optional[List[str]] = None,
        lstm_label_col: Optional[str] = None,
        lstm_model_cfg: Optional[Dict[str, Any]] = None,
        efficientnet_model_cfg: Optional[Dict[str, Any]] = None,
        fusion_model_cfg: Optional[Dict[str, Any]] = None,
        train_cfg: Optional[Dict[str, Any]] = None,
        include_cycle_filter: Optional[bool] = None,
        allowed_cycle_states: Optional[List[int]] = None,
        default_knowledge_adjustment: Optional[float] = None,
        knowledge_adjustments: Optional[List[float]] = None,
        max_rows: Optional[int] = None,
        sample_seed: Optional[int] = None,
        image_root_dir: Optional[str] = None,
        output_dir: Optional[str] = None,
        preprocess_export_csv_path: Optional[str] = None,
        config_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        cfg = self._load_yaml_config(config_path)
        preprocess_cfg = cfg.get("preprocess") if isinstance(cfg.get("preprocess"), dict) else {}
        train_section = cfg.get("train") if isinstance(cfg.get("train"), dict) else {}

        def _cfg_get(section, key, default=None):
            if isinstance(section, dict) and key in section and section[key] is not None:
                return section[key]
            if key in cfg and cfg[key] is not None:
                return cfg[key]
            return default

        preprocessed_csv = preprocessed_csv or _cfg_get(preprocess_cfg, "preprocessed_csv")
        cycle_csv = cycle_csv or _cfg_get(preprocess_cfg, "cycle_csv")
        multimodal_json_paths = multimodal_json_paths or _cfg_get(preprocess_cfg, "multimodal_json_paths")
        multimodal_json_glob = multimodal_json_glob or _cfg_get(preprocess_cfg, "multimodal_json_glob")
        multimodal_json_dir = multimodal_json_dir or _cfg_get(preprocess_cfg, "multimodal_json_dir")
        preprocess_export_csv_path = preprocess_export_csv_path or _cfg_get(preprocess_cfg, "export_csv_path")

        include_cycle_filter_cfg = _cfg_get(train_section, "include_cycle_filter", _cfg_get(preprocess_cfg, "include_cycle_filter", False))
        include_cycle_filter = include_cycle_filter if include_cycle_filter is not None else bool(include_cycle_filter_cfg)
        allowed_cycle_states = allowed_cycle_states or _cfg_get(train_section, "allowed_cycle_states", _cfg_get(preprocess_cfg, "allowed_cycle_states"))

        image_csv = image_csv or _cfg_get(train_section, "image_csv")
        image_col = image_col or _cfg_get(train_section, "image_col", "Cam1")
        image_label_col = image_label_col or _cfg_get(train_section, "image_label_col", "actual_state")
        lstm_feature_cols = lstm_feature_cols or _cfg_get(train_section, "lstm_feature_cols")
        lstm_label_col = lstm_label_col or _cfg_get(train_section, "lstm_label_col", "actual_state")

        lstm_model_cfg = self._merge_cfg(_cfg_get(train_section, "lstm_model_cfg", {}), lstm_model_cfg)
        efficientnet_model_cfg = self._merge_cfg(_cfg_get(train_section, "efficientnet_model_cfg", {}), efficientnet_model_cfg)
        fusion_model_cfg = self._merge_cfg(_cfg_get(train_section, "fusion_model_cfg", {}), fusion_model_cfg)
        train_cfg = self._merge_cfg(_cfg_get(train_section, "train_cfg", {}), train_cfg)

        default_knowledge_adjustment = (
            default_knowledge_adjustment
            if default_knowledge_adjustment is not None
            else float(_cfg_get(train_section, "default_knowledge_adjustment", 0.0))
        )
        knowledge_adjustments = knowledge_adjustments or _cfg_get(train_section, "knowledge_adjustments")
        max_rows = max_rows if max_rows is not None else _cfg_get(train_section, "max_rows")
        sample_seed = sample_seed if sample_seed is not None else _cfg_get(train_section, "sample_seed", 42)
        image_root_dir = image_root_dir or _cfg_get(train_section, "image_root_dir")
        output_dir = output_dir or _cfg_get(train_section, "output_dir")

        image_csv = self._resolve_path_value(image_csv, must_exist=True)
        image_root_dir = self._resolve_path_value(image_root_dir, must_exist=True)
        preprocess_export_csv_path = self._resolve_path_value(preprocess_export_csv_path)

        if output_dir:
            export_dir = resolve_backend_path(output_dir)
        else:
            export_dir = Path(self.fs.root) / "Workflow" / "Test_Workflow" / "saved_models"
        lstm_feature_cols = lstm_feature_cols or ["I_R04_Gripper_Load", "I_R01_Gripper_Load"]
        if len(lstm_feature_cols) < 2:
            raise ValueError("lstm_feature_cols must contain at least two features")

        raw, preprocessed_csv_path = self.preprocess(
            preprocessed_csv=preprocessed_csv,
            cycle_csv=cycle_csv,
            multimodal_json_paths=multimodal_json_paths,
            multimodal_json_glob=multimodal_json_glob,
            multimodal_json_dir=multimodal_json_dir,
            export_csv_path=preprocess_export_csv_path,
            include_cycle_filter=include_cycle_filter,
            allowed_cycle_states=allowed_cycle_states,
        )
        sampled_rows = self._sample_rows(raw.rows or [], max_rows=max_rows, sample_seed=sample_seed)
        raw = RawFrame(rows=sampled_rows)

        lstm_selected = LSTMSelectColumns().run(raw, feature_cols=lstm_feature_cols, label_col=lstm_label_col)
        lstm_encoded = LSTMImputeAndEncode().run(lstm_selected)
        lstm_with_targets = LSTMBuildTargets().run(lstm_encoded)
        lstm_split = LSTMTrainValidSplit().run(
            lstm_with_targets,
            train_ratio=(train_cfg or {}).get("train_ratio", 0.8),
            shuffle=(train_cfg or {}).get("shuffle", False),
            seed=(train_cfg or {}).get("seed", 42),
        )

        lstm_model_cfg = dict(lstm_model_cfg or {})
        lstm_model_cfg.setdefault("in_dim", len(lstm_feature_cols))
        lstm_model_cfg.setdefault("hidden", 32)
        lstm_model_cfg.setdefault("out_dim", 3)
        lstm_num_layers = int(lstm_model_cfg.pop("num_layers", 1))
        lstm_untrained = BuildLSTMAE().run(ModelConfig(**lstm_model_cfg), num_layers=lstm_num_layers)

        lstm_train_config = self._filter_train_cfg(train_cfg)
        lstm_trained = LSTMTrainModel().run(
            lstm_with_targets,
            split=lstm_split,
            untrained=lstm_untrained,
            train_config=lstm_train_config,
        )
        lstm_preds = LSTMPredictOnValid().run(lstm_with_targets, split=lstm_split, trained=lstm_trained)
        lstm_metrics = LSTMEvaluatePredictions().run(lstm_preds)
        lstm_export: ExportPaths = LSTMExportRunArtifacts().run(
            lstm_trained,
            fs=self.fs,
            preds=lstm_preds,
            metrics=lstm_metrics,
            output_dir=str(export_dir),
            filename_prefix="predictx",
        )

        image_rows_raw = []
        if image_csv:
            image_raw_loaded = ENLoadImages().run(RawFrame(), file_path=image_csv)
            for row in image_raw_loaded.rows or []:
                p = row.get("image_path", row.get(image_col))
                resolved = self._resolve_image_path(p, image_root_dir=image_root_dir)
                if resolved:
                    image_rows_raw.append(
                        {"image_path": resolved, "label": row.get("label", row.get(image_label_col, row.get(lstm_label_col, "unknown")))}
                    )
        else:
            for row in raw.rows or []:
                p = row.get(image_col)
                resolved = self._resolve_image_path(p, image_root_dir=image_root_dir)
                if resolved:
                    image_rows_raw.append(
                        {"image_path": resolved, "label": row.get(image_label_col, row.get(lstm_label_col, "unknown"))}
                    )
        image_raw = RawFrame(rows=image_rows_raw)

        image_selected = ENSelectColumns().run(image_raw, feature_cols=["image_path"], label_col="label")
        image_encoded = ENImputeAndEncode().run(image_selected, image_size=(efficientnet_model_cfg or {}).get("image_size", 224))
        image_with_targets = ENBuildTargets().run(image_encoded)
        image_split = ENTrainValidSplit().run(
            image_with_targets,
            train_ratio=(train_cfg or {}).get("train_ratio", 0.8),
            shuffle=(train_cfg or {}).get("shuffle", False),
            seed=(train_cfg or {}).get("seed", 42),
        )

        num_classes = len((image_encoded.label_map.to_int if image_encoded.label_map else {}) or {})
        if num_classes <= 0:
            num_classes = 1

        efficientnet_model_cfg = efficientnet_model_cfg or {}
        efficientnet_model_cfg.setdefault("in_channels", 3)
        efficientnet_model_cfg.setdefault("num_classes", num_classes)
        efficientnet_model_cfg.setdefault("image_size", image_encoded.image_shape[0] if image_encoded.image_shape else 224)
        efficientnet_model_cfg.setdefault("hidden_dim", 128)
        efficientnet_model_cfg.setdefault("pretrained", True)
        efficientnet_model_cfg.setdefault("backbone", "efficientnet-b0")
        image_untrained = BuildEfficientNet().run(CNNConfig(**efficientnet_model_cfg))

        image_train_config = self._filter_train_cfg(train_cfg)
        image_trained = ENTrainModel().run(
            image_with_targets,
            split=image_split,
            untrained=image_untrained,
            train_config=image_train_config,
        )
        image_preds = ENPredictOnValid().run(image_with_targets, split=image_split, trained=image_trained)
        image_metrics = ENEvaluatePredictions().run(image_preds)
        image_export: ExportPaths = ENExportRunArtifacts().run(
            image_trained,
            fs=self.fs,
            preds=image_preds,
            metrics=image_metrics,
            output_dir=str(export_dir),
            filename_prefix="predictx",
        )

        image_prob_dim = len(image_preds.y_pred[0]) if image_preds.y_pred else num_classes
        fusion_rows = self._build_fusion_rows(
            lstm_preds=lstm_preds,
            image_preds=image_preds,
            image_prob_dim=image_prob_dim,
            default_knowledge_adjustment=default_knowledge_adjustment,
            knowledge_adjustments=knowledge_adjustments,
        )
        fusion_raw = RawFrame(rows=fusion_rows)

        ts_feature_cols = [f"ts_pred_{i}" for i in range(len(lstm_preds.y_pred[0]) if lstm_preds.y_pred else 3)]
        img_feature_cols = [f"img_prob_{i}" for i in range(image_prob_dim)]
        fusion_selected = FUSelectColumns().run(
            fusion_raw,
            ts_feature_cols=ts_feature_cols,
            img_feature_cols=img_feature_cols,
            target_cols=["target_1", "target_2", "target_state"],
            image_present_col="has_image",
            knowledge_col="knowledge_adjustment",
        )
        fusion_encoded = FUImputeAndEncode().run(fusion_selected)
        fusion_model_cfg = fusion_model_cfg or {}
        fusion_model_cfg.setdefault("ts_dim", len(ts_feature_cols))
        fusion_model_cfg.setdefault("img_dim", len(img_feature_cols))
        fusion_model_cfg.setdefault("hidden_dim", 64)
        fusion_model_cfg.setdefault("out_dim", 3)
        fusion_model_cfg.setdefault("include_knowledge", True)
        fusion_model_cfg.setdefault("include_image_presence", True)

        fusion_with_targets = FUBuildTargets().run(
            fusion_encoded,
            include_knowledge=fusion_model_cfg.get("include_knowledge", True),
            include_image_presence=fusion_model_cfg.get("include_image_presence", True),
        )
        fusion_split = FUTrainValidSplit().run(
            fusion_with_targets,
            train_ratio=(train_cfg or {}).get("train_ratio", 0.8),
            shuffle=(train_cfg or {}).get("shuffle", False),
            seed=(train_cfg or {}).get("seed", 42),
        )
        fusion_untrained = BuildFusionModel().run(FusionConfig(**fusion_model_cfg))
        fusion_train_config = self._filter_train_cfg(train_cfg)
        fusion_trained = FUTrainModel().run(
            fusion_with_targets,
            split=fusion_split,
            untrained=fusion_untrained,
            train_config=fusion_train_config,
        )
        fusion_preds = FUPredictOnValid().run(fusion_with_targets, split=fusion_split, trained=fusion_trained)
        fusion_metrics = FUEvaluatePredictions().run(fusion_preds)
        fusion_export: ExportPaths = FUExportRunArtifacts().run(
            fusion_trained,
            fs=self.fs,
            preds=fusion_preds,
            metrics=fusion_metrics,
            output_dir=str(export_dir),
            filename_prefix="predictx",
        )

        return {
            "preprocessed_csv": preprocessed_csv_path,
            "rows_used": len(raw.rows or []),
            "image_rows_usable": len(image_rows_raw),
            "lstm_export": lstm_export,
            "efficientnet_export": image_export,
            "fusion_export": fusion_export,
        }

    def infer_fusion(
        self,
        *,
        features_csv: str,
        model_path: Optional[str] = None,
        ts_feature_cols: Optional[List[str]] = None,
        img_feature_cols: Optional[List[str]] = None,
        include_knowledge: bool = True,
        include_image_presence: bool = True,
        image_present_col: str = "has_image",
        knowledge_col: str = "knowledge_adjustment",
        export_csv_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        import pandas as pd

        default_model_path = (
            Path(self.fs.root)
            / "Workflow"
            / "Test_Workflow"
            / "saved_models"
            / "predictx_fusion_model.pth"
        )
        features_csv = self._resolve_path_value(features_csv, must_exist=True)
        model_path = self._resolve_path_value(model_path, must_exist=True) if model_path else str(default_model_path)
        if not Path(model_path).exists():
            raise FileNotFoundError(f"Model not found: {model_path}")

        df = pd.read_csv(features_csv)
        ts_feature_cols = ts_feature_cols or [c for c in df.columns if c.startswith("ts_pred_")]
        img_feature_cols = img_feature_cols or [c for c in df.columns if c.startswith("img_prob_")]
        if not ts_feature_cols:
            raise ValueError("ts_feature_cols not provided and none inferred from csv")

        try:
            state = torch.load(model_path, map_location="cpu", weights_only=True)
        except TypeError:
            state = torch.load(model_path, map_location="cpu")
        w0 = state.get("net.0.weight")
        w2 = state.get("net.2.weight")
        if w0 is None or w2 is None:
            raise ValueError("Invalid fusion weights: missing net.0.weight or net.2.weight")
        hidden_dim = int(w0.shape[0])
        in_dim = int(w0.shape[1])
        out_dim = int(w2.shape[0])

        X = []
        for _, row in df.iterrows():
            ts_vals = [float(row.get(c, 0.0)) for c in ts_feature_cols]
            img_vals = [float(row.get(c, 0.0)) for c in img_feature_cols]
            know_val = float(row.get(knowledge_col, 0.0))
            has_val = float(row.get(image_present_col, 1.0 if img_feature_cols else 0.0))

            use_knowledge = include_knowledge
            use_image_presence = include_image_presence

            base_len = len(ts_vals) + len(img_vals)
            full_len = base_len + (1 if use_knowledge else 0) + (1 if use_image_presence else 0)

            if full_len != in_dim:
                if use_image_presence and (base_len + (1 if use_knowledge else 0) == in_dim):
                    use_image_presence = False
                elif use_knowledge and (base_len + (1 if use_image_presence else 0) == in_dim):
                    use_knowledge = False
                elif base_len == in_dim:
                    use_knowledge = False
                    use_image_presence = False

            img_slots = in_dim - len(ts_vals) - (1 if use_knowledge else 0) - (1 if use_image_presence else 0)
            if img_slots < 0:
                raise ValueError(f"Feature dimension mismatch: expected {in_dim}, got {full_len}")
            if img_slots < len(img_vals):
                img_vals = img_vals[:img_slots]
            elif img_slots > len(img_vals):
                img_vals = img_vals + [0.0] * (img_slots - len(img_vals))

            feats = list(ts_vals) + list(img_vals)
            if use_knowledge:
                feats.append(know_val)
            if use_image_presence:
                feats.append(has_val)
            X.append(feats)

        if X and len(X[0]) != in_dim:
            raise ValueError(f"Feature dimension mismatch: expected {in_dim}, got {len(X[0])}")

        model = fusion_train._FusionMLP(in_dim=in_dim, hidden_dim=hidden_dim, out_dim=out_dim)
        model.load_state_dict(state)
        model.eval()

        preds = []
        with torch.no_grad():
            for row in X:
                xb = torch.tensor([row], dtype=torch.float32)
                out = model(xb).cpu().numpy().tolist()[0]
                preds.append([float(v) for v in out])

        output = {
            "model_path": model_path,
            "predictions": preds,
            "count": len(preds),
        }

        if export_csv_path:
            export_csv_path = self._resolve_path_value(export_csv_path)
            Path(export_csv_path).parent.mkdir(parents=True, exist_ok=True)
            with open(export_csv_path, "w", newline="") as f:
                writer = csv.writer(f)
                writer.writerow([f"y_pred_{i}" for i in range(out_dim)])
                for row in preds:
                    writer.writerow(row)
            output["predictions_csv"] = export_csv_path

        return output



