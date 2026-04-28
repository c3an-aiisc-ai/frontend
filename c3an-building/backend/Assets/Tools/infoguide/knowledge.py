from ..core.stage import Stage
from ...Resources.Schemas.artifacts import TextBlob, TextChunks
from .memory_utils import Knowledge_Representation


class BuildKnowledgeStore(Stage[TextBlob, TextChunks]):
    def __init__(self):
        super().__init__("infoguide_knowledge", TextBlob, TextChunks)

    def run(self, inp: TextBlob, **kwargs) -> TextChunks:
        text = inp.text or ""
        chunks = Knowledge_Representation.organize_data(text)
        return TextChunks(chunks=chunks)