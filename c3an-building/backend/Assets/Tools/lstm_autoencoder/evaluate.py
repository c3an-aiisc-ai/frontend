from ..core.stage import Stage
from ...Resources.Schemas.artifacts import EvalReport, PredictionsBatch


def _mse_mae(y_true, y_pred):
    n = len(y_true)
    mse = [0.0, 0.0, 0.0]
    mae = [0.0, 0.0, 0.0]
    if n == 0:
        return {"load1": 0.0, "load2": 0.0, "state": 0.0}, {"load1": 0.0, "load2": 0.0, "state": 0.0}

    for t, p in zip(y_true, y_pred):
        for i in range(3):
            d = float(p[i]) - float(t[i])
            mse[i] += d * d
            mae[i] += abs(d)

    mse = [v / n for v in mse]
    mae = [v / n for v in mae]
    return {"load1": mse[0], "load2": mse[1], "state": mse[2]}, {"load1": mae[0], "load2": mae[1], "state": mae[2]}


def _cls_report(yt, yp):
    labs = sorted(set(yt) | set(yp))
    rep = {"accuracy": 0.0, "per_class": {}}
    corr = sum(1 for a, b in zip(yt, yp) if int(a) == int(b))
    rep["accuracy"] = corr / max(1, len(yt))

    for lab in labs:
        tp = sum(1 for a, b in zip(yt, yp) if a == lab and b == lab)
        fp = sum(1 for a, b in zip(yt, yp) if a != lab and b == lab)
        fn = sum(1 for a, b in zip(yt, yp) if a == lab and b != lab)
        prec = tp / (tp + fp) if tp + fp else 0.0
        rec = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0
        rep["per_class"][str(lab)] = {
            "precision": prec,
            "recall": rec,
            "f1": f1,
            "support": sum(1 for a in yt if a == lab),
        }

    return rep


class EvaluatePredictions(Stage[PredictionsBatch, EvalReport]):
    def __init__(self):
        super().__init__("evaluate", PredictionsBatch, EvalReport)

    def run(self, inp: PredictionsBatch, **kwargs) -> EvalReport:
        mse, mae = _mse_mae(inp.y_true or [], inp.y_pred or [])
        true_state = [int(round(v[2])) for v in (inp.y_true or [])]
        cls = _cls_report(true_state, inp.y_pred_state_int or [])
        return EvalReport(mse=mse, mae=mae, cls_report=cls)