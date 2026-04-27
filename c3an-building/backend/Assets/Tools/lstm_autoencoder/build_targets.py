from ..core.stage import Stage
from ...Resources.Schemas.artifacts import FrameEncoded, FrameWithTargets


class BuildTargets(Stage[FrameEncoded, FrameWithTargets]):
    def __init__(self):
        super().__init__("build_targets", FrameEncoded, FrameWithTargets)

    def run(self, inp: FrameEncoded, **kwargs) -> FrameWithTargets:
        n = len(inp.X or [])
        y_next = []
        for i in range(n):
            if i < n - 1:
                nxt = inp.X[i + 1][:2] + [inp.y_num[i + 1]]
            else:
                nxt = inp.X[i][:2] + [inp.y_num[i]]
            y_next.append([float(v) for v in nxt])
        return FrameWithTargets(X=inp.X, y_next=y_next)