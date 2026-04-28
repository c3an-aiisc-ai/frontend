from typing import Dict, Any, List, Optional
from pathlib import Path
import torch
from ...Assets.Tools.io.runfs import RunFS
from ...Assets.Resources.Schemas.artifacts import (
	RawFrame, LSTMConfig, TrainConfig, ExportPaths
)
from ...Assets.Tools.foresight.preprocess import MergeProductionProcess
from ...Assets.Tools.lstm.select_columns import SelectColumns
from ...Assets.Tools.lstm.impute_encode import ImputeAndEncode
from ...Assets.Tools.lstm.build_targets import BuildTargets
from ...Assets.Tools.lstm.split import TrainValidSplit
from ...Assets.Tools.lstm.build_model import BuildLSTM
from ...Assets.Tools.lstm.train import TrainModel
from ...Assets.Tools.lstm.infer import PredictOnValid
from ...Assets.Tools.lstm.evaluate import EvaluatePredictions
from ...Assets.Tools.lstm.export import ExportRunArtifacts
from ...Assets.Tools.lstm import train as lstm_train


class ForesightAgent:
	def __init__(self, fs: RunFS):
		self.fs = fs

	@staticmethod
	def _load_yaml_config(config_path: Optional[str]) -> Dict[str, Any]:
		if not config_path:
			return {}
		cfg_path = Path(config_path)
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
	def train(
		self,
		*,
		production_csv: Optional[str] = None,
		process_csv: Optional[str] = None,
		seq_feature_cols: Optional[List[str]] = None,
		exog_feature_cols: Optional[List[str]] = None,
		label_cols: Optional[List[str]] = None,
		model_cfg: Optional[Dict[str, Any]] = None,
		train_cfg: Optional[Dict[str, Any]] = None,
		look_back: Optional[int] = None,
		time_floor: Optional[str] = None,
		datetime_format: Optional[str] = None,
		output_dir: Optional[str] = None,
		config_path: Optional[str] = None,
	) -> ExportPaths:
		cfg = self._load_yaml_config(config_path)
		def _cfg_get(key: str, default=None):
			if key in cfg and cfg[key] is not None:
				return cfg[key]
			return default

		production_csv = production_csv or _cfg_get("production_csv")
		process_csv = process_csv or _cfg_get("process_csv")
		if not production_csv or not process_csv:
			raise ValueError("production_csv and process_csv are required")

		seq_feature_cols = seq_feature_cols or _cfg_get("seq_feature_cols")
		exog_feature_cols = exog_feature_cols or _cfg_get("exog_feature_cols")
		label_cols = label_cols or _cfg_get("label_cols")
		model_cfg = self._merge_cfg(_cfg_get("model_cfg", {}), model_cfg)
		train_cfg = self._merge_cfg(_cfg_get("train_cfg", {}), train_cfg)

		look_back = int(look_back if look_back is not None else _cfg_get("look_back", 30))
		time_floor = time_floor or _cfg_get("time_floor", "h")
		datetime_format = datetime_format or _cfg_get("datetime_format", "%d/%m/%Y %H:%M:%S")
		output_dir = output_dir or _cfg_get("output_dir")

		seq_feature_cols = seq_feature_cols or ["Yeast - BRD", "Yeast - BRN", "Yeast - FMX"]
		exog_feature_cols = exog_feature_cols or [
			"Yeast - BRD_VYA",
			"Yeast - BRN_VYA",
			"Yeast - FMX_VYA",
			"Yeast - BRD_RawYeast",
			"Yeast - BRN_RawYeast",
			"Yeast - FMX_RawYeast",
			"Yeast - BRD_IS/TS",
			"Yeast - BRN_IS/TS",
			"Yeast - FMX_IS/TS",
		]
		label_cols = label_cols or ["Yeast - BRD", "Yeast - BRN", "Yeast - FMX"]

		raw = MergeProductionProcess().run(
			RawFrame(),
			production_csv=production_csv,
			process_csv=process_csv,
			time_floor=time_floor,
			datetime_format=datetime_format,
		)
		selected = SelectColumns().run(
			raw,
			seq_feature_cols=seq_feature_cols,
			exog_feature_cols=exog_feature_cols,
			label_cols=label_cols,
		)
		encoded = ImputeAndEncode().run(selected)
		seq_batch = BuildTargets().run(encoded, look_back=look_back)
		train_cfg = train_cfg or {}
		split = TrainValidSplit().run(
			seq_batch,
			train_ratio=train_cfg.get("train_ratio", 0.8),
			shuffle=train_cfg.get("shuffle", False),
			seed=train_cfg.get("seed", 42),
		)

		model_cfg = model_cfg or {}
		model_cfg.setdefault("input_dim", len(seq_feature_cols))
		model_cfg.setdefault("exog_dim", len(exog_feature_cols) if exog_feature_cols else 0)
		model_cfg.setdefault("out_dim", len(label_cols))
		untrained = BuildLSTM().run(LSTMConfig(**model_cfg))

		train_config = TrainConfig(**{k: v for k, v in train_cfg.items() if k in {"epochs", "batch_size", "lr", "seed", "shuffle"}})
		trained = TrainModel().run(seq_batch, split=split, untrained=untrained, train_config=train_config)
		preds = PredictOnValid().run(seq_batch, split=split, trained=trained)
		metrics = EvaluatePredictions().run(preds)
		if output_dir:
			export_dir = Path(output_dir)
			if not export_dir.is_absolute():
				export_dir = Path(self.fs.root) / export_dir
		else:
			export_dir = Path(self.fs.root) / "Workflow" / "Test_Workflow" / "saved_models"
		export = ExportRunArtifacts().run(
			trained,
			fs=self.fs,
			preds=preds,
			metrics=metrics,
			output_dir=str(export_dir),
			filename_prefix="foresight",
		)
		return export

	def infer(
		self,
		*,
		production_csv: str,
		process_csv: str,
		model_path: Optional[str] = None,
		seq_feature_cols: Optional[List[str]] = None,
		exog_feature_cols: Optional[List[str]] = None,
		label_cols: Optional[List[str]] = None,
		look_back: int = 30,
		time_floor: str = "h",
		datetime_format: str = "%d/%m/%Y %H:%M:%S",
		export_csv_path: Optional[str] = None,
	) -> Dict[str, Any]:
		seq_feature_cols = seq_feature_cols or ["Yeast - BRD", "Yeast - BRN", "Yeast - FMX"]
		exog_feature_cols = exog_feature_cols or [
			"Yeast - BRD_VYA",
			"Yeast - BRN_VYA",
			"Yeast - FMX_VYA",
			"Yeast - BRD_RawYeast",
			"Yeast - BRN_RawYeast",
			"Yeast - FMX_RawYeast",
			"Yeast - BRD_IS/TS",
			"Yeast - BRN_IS/TS",
			"Yeast - FMX_IS/TS",
		]
		label_cols = label_cols or ["Yeast - BRD", "Yeast - BRN", "Yeast - FMX"]

		default_model_path = Path(self.fs.root) / "Workflow" / "Test_Workflow" / "saved_models" / "foresight_lstm_model.pth"
		model_path = model_path or str(default_model_path)
		if not Path(model_path).exists():
			raise FileNotFoundError(f"Model not found: {model_path}")

		raw = MergeProductionProcess().run(
			RawFrame(),
			production_csv=production_csv,
			process_csv=process_csv,
			time_floor=time_floor,
			datetime_format=datetime_format,
		)
		selected = SelectColumns().run(
			raw,
			seq_feature_cols=seq_feature_cols,
			exog_feature_cols=exog_feature_cols,
			label_cols=label_cols,
		)
		encoded = ImputeAndEncode().run(selected)
		available_steps = len(encoded.X_seq or [])
		if available_steps < 2:
			raise ValueError("Not enough rows to build a sequence batch for inference.")
		look_back = min(int(look_back), max(1, available_steps - 1))
		seq_batch = BuildTargets().run(encoded, look_back=look_back)

		try:
			state = torch.load(model_path, map_location="cpu", weights_only=True)
		except TypeError:
			state = torch.load(model_path, map_location="cpu")
		ih = state.get("lstm.weight_ih_l0")
		if ih is None:
			raise ValueError("Invalid LSTM weights: missing lstm.weight_ih_l0")
		hidden_dim = int(ih.shape[0] // 4)
		input_dim = int(ih.shape[1])
		num_layers = len([k for k in state.keys() if k.startswith("lstm.weight_ih_l")])
		fc_w = state.get("fc.weight")
		if fc_w is None:
			raise ValueError("Invalid LSTM weights: missing fc.weight")
		out_dim = int(fc_w.shape[0])
		exog_dim = int(fc_w.shape[1] - hidden_dim)

		model = lstm_train._LSTMModel(
			input_dim=input_dim,
			hidden_dim=hidden_dim,
			num_layers=num_layers,
			out_dim=out_dim,
			dropout=0.0,
			exog_dim=exog_dim,
		)
		model.load_state_dict(state)
		model.eval()

		X = torch.tensor(seq_batch.X_seq or [], dtype=torch.float32)
		X_exog = torch.tensor(seq_batch.X_exog, dtype=torch.float32) if seq_batch.X_exog is not None else None

		preds = []
		with torch.no_grad():
			for i in range(len(X)):
				xb = X[i : i + 1]
				exb = X_exog[i : i + 1] if X_exog is not None else None
				out = model(xb, exb).cpu().numpy().tolist()[0]
				preds.append([float(v) for v in out])

		output = {
			"model_path": model_path,
			"predictions": preds,
			"count": len(preds),
		}

		if export_csv_path:
			Path(export_csv_path).parent.mkdir(parents=True, exist_ok=True)
			with open(export_csv_path, "w", newline="") as f:
				import csv

				writer = csv.writer(f)
				header = [f"y_pred_{i}" for i in range(out_dim)]
				if seq_batch.y_next:
					header = [f"y_true_{i}" for i in range(out_dim)] + header
				writer.writerow(header)
				for i, pred in enumerate(preds):
					if seq_batch.y_next:
						writer.writerow([*seq_batch.y_next[i], *pred])
					else:
						writer.writerow(pred)
			output["predictions_csv"] = export_csv_path

		return output





