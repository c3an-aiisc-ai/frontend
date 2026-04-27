from dataclasses import dataclass
from typing import List, Dict, Optional

# from ...Tools.core.artifact import Artifact

from Tools.core.artifacts import Artifact 

@dataclass
class RawFrame(Artifact):
    rows: List[Dict] = None    
@dataclass
class CausalFeatures(Artifact): # For CausalTrace
    rows: List[List] = None
    columns: List[str] = None
@dataclass
class GraphNodesFeatures(Artifact): # For CausalTrace
    rows: Dict[str, List] = None
@dataclass
class LiNGAM(Artifact): # For CausalTrace
    arch: str = "LiNGAM"; params: Dict = None
@dataclass
class LiNGAMResult(Artifact):
    adjacency_matrix: List[List[float]] = None
    total_effects_matrix: List[List[float]] = None
    node_labels: List[str] = None
    edges: List[List[str]] = None
@dataclass
class LiNGAMExportPaths(Artifact):
    graph_html: Optional[str] = None
    edges_pkl: Optional[str] = None
    adjacency_pkl: Optional[str] = None
    total_effects_pkl: Optional[str] = None
    summary_json: Optional[str] = None
    bootstrap_csv: Optional[str] = None
    batch_eval_csv: Optional[str] = None
@dataclass
class FrameSelected(Artifact):
    X: List[List[float]] = None; y_raw: List[float] = None

@dataclass
class FrameSelectedSeq(Artifact):
    X_seq: List[List[float]] = None; X_exog: Optional[List[List[float]]] = None; y_raw: List = None
@dataclass
class LabelMap(Artifact):
    to_int: Dict[str, int] = None; to_str: Dict[int, str] = None
@dataclass
class FrameEncoded(Artifact):
    X: List[List[float]] = None; y_num: List[float] = None; label_map: Optional[LabelMap] = None

@dataclass
class FrameEncodedSeq(Artifact):
    X_seq: List[List[float]] = None; X_exog: Optional[List[List[float]]] = None; y_num: List = None; label_map: Optional[LabelMap] = None
@dataclass
class FrameWithTargets(Artifact):
    X: List[List[float]] = None; y_next: List[List[float]] = None

@dataclass
class SequenceBatch(Artifact):
    X_seq: List[List[List[float]]] = None; y_next: List[List[float]] = None; X_exog: Optional[List[List[float]]] = None

@dataclass
class ImageFrameSelected(Artifact):
    image_paths: List[str] = None; y_raw: List = None

@dataclass
class ImageFrameEncoded(Artifact):
    X_images: List = None; y_num: List[int] = None; label_map: Optional[LabelMap] = None; image_shape: Optional[List[int]] = None

@dataclass
class ImageFrameWithTargets(Artifact):
    X_images: List = None; y_next: List[int] = None; image_shape: Optional[List[int]] = None
@dataclass
class FusionFrameSelected(Artifact):
    ts_rows: List[List[float]] = None; img_rows: List[List[float]] = None; y_target: List[List[float]] = None
    image_available: List[int] = None; knowledge_adjustment: List[float] = None

@dataclass
class FusionFrameEncoded(Artifact):
    ts_rows: List[List[float]] = None; img_rows: List[List[float]] = None; y_target: List[List[float]] = None
    image_available: List[int] = None; knowledge_adjustment: List[float] = None
@dataclass
class TrainSplit(Artifact):
    train_idx: List[int] = None; valid_idx: List[int] = None
@dataclass
class ModelConfig(Artifact):
    in_dim: int = 3; hidden: int = 32; out_dim: int = 3; activation: str = "relu"

@dataclass
class LSTMConfig(Artifact):
    input_dim: int = 3; hidden_dim: int = 64; num_layers: int = 2; out_dim: int = 3; dropout: float = 0.0; exog_dim: int = 0

@dataclass
class CNNConfig(Artifact):
    in_channels: int = 3; num_classes: int = 2; image_size: int = 64; hidden_dim: int = 64
    pretrained: bool = True; backbone: str = "efficientnet-b0"
@dataclass
class FusionConfig(Artifact):
    ts_dim: int = 3; img_dim: int = 5; hidden_dim: int = 64; out_dim: int = 3
    include_knowledge: bool = True; include_image_presence: bool = True
@dataclass
class TrainConfig(Artifact):
    epochs: int = 50; batch_size: int = 1; lr: float = 1e-3; seed: int = 42; shuffle: bool = False
@dataclass
class UntrainedModel(Artifact):
    arch: str = "mlp"; params: Dict = None
@dataclass
class TrainedModel(Artifact):
    arch: str = "mlp"; state_dict_path: Optional[str] = None; params: Dict = None
@dataclass
class PredictionsBatch(Artifact):
    y_true: List[List[float]] = None; y_pred: List[List[float]] = None; y_pred_state_int: List[int] = None
@dataclass
class EvalReport(Artifact):
    mse: Dict[str, float] = None; mae: Dict[str, float] = None; cls_report: Dict = None
@dataclass
class ExportPaths(Artifact):
    preds_csv: Optional[str] = None; weights_pth: Optional[str] = None; metrics_json: Optional[str] = None

# InfoGuide artifacts
@dataclass
class TextBlob(Artifact):
    text: str = ""

@dataclass
class TextChunks(Artifact):
    chunks: List[str] = None

@dataclass
class RetrievalResult(Artifact):
    contexts: List[str] = None

@dataclass
class RouteResult(Artifact):
    route: str = "documentation"
    score: float = 0.0

@dataclass
class HFTextClassifierExport(Artifact):
    model_dir: Optional[str] = None
    adapter_dir: Optional[str] = None
    metrics_json: Optional[str] = None
    label_map_json: Optional[str] = None