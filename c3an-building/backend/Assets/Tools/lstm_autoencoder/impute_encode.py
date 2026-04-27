from ..core.stage import Stage
from ...Resources.Schemas.artifacts import FrameEncoded, FrameSelected, LabelMap


class ImputeAndEncode(Stage[FrameSelected, FrameEncoded]):
    def __init__(self):
        super().__init__("impute_encode", FrameSelected, FrameEncoded)

    def run(self, inp: FrameSelected, **kwargs) -> FrameEncoded:
        y_num = []
        to_int = {}
        to_str = {}
        next_id = 0

        for y in inp.y_raw or []:
            if y is None or (isinstance(y, float) and y != y):
                y = 0
            if isinstance(y, str):
                if y not in to_int:
                    to_int[y] = next_id
                    to_str[next_id] = y
                    next_id += 1
                y_num.append(float(to_int[y]))
            else:
                y_num.append(float(y))

        label_map = LabelMap(to_int=to_int, to_str=to_str) if to_int else None
        return FrameEncoded(X=inp.X, y_num=y_num, label_map=label_map)