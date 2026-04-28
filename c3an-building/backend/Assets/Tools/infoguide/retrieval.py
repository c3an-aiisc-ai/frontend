from ..core.stage import Stage
from ...Resources.Schemas.artifacts import TextChunks, RetrievalResult
from .memory_utils import Retr, Symbolic_Model, Neural_Net


class RetrieveContext(Stage[TextChunks, RetrievalResult]):
    def __init__(self):
        super().__init__("infoguide_retrieve", TextChunks, RetrievalResult)

    def run(self, inp: TextChunks, **kwargs) -> RetrievalResult:
        query = kwargs.get("query")
        if not query:
            raise ValueError("query is required")
        top_k = kwargs.get("top_k", 1)
        use_symbolic = kwargs.get("use_symbolic", True)
        use_neural = kwargs.get("use_neural", False)

        symb_model = Symbolic_Model() if use_symbolic else None
        neural_net = Neural_Net() if use_neural else None

        contexts = Retr.retrieve_context(
            inp.chunks or [],
            query,
            neural_net=neural_net,
            symb_model=symb_model,
            top_k=top_k,
        )
        return RetrievalResult(contexts=contexts)