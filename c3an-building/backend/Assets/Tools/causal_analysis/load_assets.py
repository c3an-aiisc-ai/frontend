from ..core.stage import Stage
from ...Resources.Schemas.artifacts import CausalFeatures, RawFrame
import pandas as pd
import pickle
from causallearn.search.FCMBased import lingam

class LoadCSV(Stage[RawFrame, CausalFeatures]):
    def __init__(self): super().__init__("load_csv", RawFrame, CausalFeatures)
    def run(self, inp: RawFrame, **kwargs) -> CausalFeatures:
        csv_path = kwargs.get("csv_path"); assert csv_path, "csv_path is required"
        sample_size = kwargs.get("sample_size")
        feature_cols = kwargs.get("feature_cols")
        if feature_cols is not None and len(feature_cols) == 0:
            feature_cols = None
        df = pd.read_csv(csv_path, usecols=feature_cols)
        if sample_size is not None:
            df = df.head(int(sample_size))
        data = df.to_numpy()
        return CausalFeatures(rows=data.tolist(), columns=df.columns.tolist())

class LoadLiNGAM(Stage[RawFrame, lingam]):
    def __init__(self): super().__init__("load_lingam", RawFrame, lingam)
    def run(self, inp: RawFrame, **kwargs) -> lingam:
        model_path = kwargs.get("model_path"); assert model_path, "model_path is required"
        with open(model_path, "rb") as f: model = pickle.load(f)
        return model