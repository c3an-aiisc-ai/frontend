from ..core.stage import Stage
from ...Resources.Schemas.artifacts import EvalReport, PredictionsBatch


def _cls_report(yt, yp):
    labs = sorted(set(yt) | set(yp))
    rep = {"accuracy": 0.0, "per_class": {}}
    corr = sum(1 for a, b in zip(yt, yp) if a == b)
    rep["accuracy"] = corr / max(1, len(yt))

    for lab in labs:
        tp = sum(1 for a, b in zip(yt, yp) if a == lab and b == lab)
        fp = sum(1 for a, b in zip(yt, yp) if a != lab and b == lab)
        fn = sum(1 for a, b in zip(yt, yp) if a == lab and b != lab)
        prec = tp / (tp + fp) if tp + fp else 0.0
        rec = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
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
        true_labels = [int(v[0]) for v in inp.y_true or []]
        pred_labels = [int(v) for v in inp.y_pred_state_int or []]
        cls = _cls_report(true_labels, pred_labels)
        return EvalReport(mse=None, mae=None, cls_report=cls)