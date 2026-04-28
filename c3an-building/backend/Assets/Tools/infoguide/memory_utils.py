import re
from typing import List


class Cluster_Model:
    def __init__(self, max_depth: int = 4):
        try:
            import torch
            import torch.nn as nn
        except ImportError as exc:
            raise ImportError("torch is required for clustering") from exc

        self._torch = torch
        self._cos = nn.CosineSimilarity(dim=0, eps=1e-6)
        self.max_depth = max_depth
        self.index = {}
        self.clusters = {}

    def find_closest_and_avg(self):
        min_sim, closest_pair = 1.0, (0, 0)
        min_i, min_j = None, None
        for frozen_vector_i in self.index:
            v_i = self._torch.tensor(list(frozen_vector_i))
            v_i_idx = self.index[frozen_vector_i]
            for frozen_vector_j in self.index:
                v_j = self._torch.tensor(list(frozen_vector_j))
                v_j_idx = self.index[frozen_vector_j]
                if v_i_idx == v_j_idx:
                    continue
                sim_i_j = self._cos(v_i, v_j)
                if sim_i_j <= min_sim:
                    min_sim = sim_i_j
                    closest_pair = (v_i_idx, v_j_idx)
                    min_i, min_j = v_i, v_j

        vector_pair = self._torch.stack([min_i, min_j])
        mean_repr = self._torch.mean(vector_pair, dim=0)
        return mean_repr, (closest_pair, min_sim)

    def cluster(self, demo_text_split_vectors, cut_threshold: float = 0.0):
        n_vectors = len(demo_text_split_vectors)
        splits = [str(item) + ";" for item in range(n_vectors)]
        for i in range(n_vectors):
            vector = demo_text_split_vectors[i]
            self.index[frozenset(vector.tolist())] = i

        level = 0
        while True:
            try:
                if level == self.max_depth - 1:
                    break

                mean_repr, closest_pair = self.find_closest_and_avg()
                closest_pair_threshold = closest_pair[1]
                if closest_pair_threshold <= cut_threshold:
                    break
                self.index[frozenset(mean_repr.tolist())] = closest_pair[0]
                for frozen_set in list(self.index.keys()):
                    if self.index[frozen_set] in closest_pair[0]:
                        del self.index[frozen_set]
                level += 1

            except Exception:
                break

        clusters = []

        for frozen_set in self.index:
            item, new_item = self.index[frozen_set], []
            if not isinstance(item, int):
                new_item += [
                    [int(l) for l in list(re.sub(r"[^0-9]+", "", str(sub_item)))]
                    for sub_item in item
                ]
            else:
                new_item += [[item]]
            split_items = [
                "".join([splits[sub_sub_item] for sub_sub_item in sub_item])
                for sub_item in new_item
            ]
            clusters += split_items

        return clusters

    def prune_splits(self, query: str, text_splits: List[str], top_k: int = 3) -> str:
        neural_net = Neural_Net()
        query_vector = neural_net.vectorize(query)
        query_vectors = [query_vector for _ in range(len(text_splits))]
        split_vectors = [neural_net.vectorize(split) for split in text_splits]
        similarities = [
            neural_net.vector_similarity(x[0], x[1]).item() for x in zip(query_vectors, split_vectors)
        ]
        top_k_idxs = [
            similarities.index(y) for y in sorted(similarities)[::-1][:top_k]
        ]
        return "\n ===== \n".join([text_splits[idx] for idx in top_k_idxs])


class Text_Preprocessor:
    @staticmethod
    def text_splitter(text: str, split_size: int = 4) -> List[str]:
        if split_size <= 0:
            raise ValueError("split_size must be positive")
        a, n = text or "", split_size
        k, m = divmod(len(a), n)
        return_list = list(
            a[i * k + min(i, m):(i + 1) * k + min(i + 1, m)] for i in range(n)
        )
        processed_return_list = []
        for item in return_list:
            processed_return_list.append(
                ";".join([sub_item for sub_item in item.split("\n") if item.strip()])
            )

        return processed_return_list


class Symbolic_Model:
    def __init__(self):
        def vector_similarity(keywords1, keywords2):
            A, B = set(keywords1), set(keywords2)
            C = A.intersection(B)
            D = A.union(B)
            return float(len(C)) / float(len(D)) if D else 0.0

        def vectorize(sentence: str):
            return re.findall(r"[A-Za-z][A-Za-z\-']{1,}", sentence or "")

        self.vectorize = vectorize
        self.vector_similarity = vector_similarity


class Neural_Net:
    def __init__(self):
        try:
            import torch.nn as nn
        except ImportError as exc:
            raise ImportError("torch is required for neural retrieval") from exc

        def vector_similarity(vector1, vector2):
            cos = nn.CosineSimilarity(dim=0, eps=1e-6)
            return cos(vector1, vector2)

        def vectorize(sentence: str):
            try:
                from sentence_transformers import SentenceTransformer
            except ImportError as exc:
                raise ImportError(
                    "sentence-transformers is required for neural retrieval"
                ) from exc

            embedding_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
            return embedding_model.encode(sentence or "", convert_to_tensor=True)

        self.vectorize = vectorize
        self.vector_similarity = vector_similarity


class Retr:
    @staticmethod
    def retrieve_context_neural(text_splits, random_question, neural_net, top_k: int = 3):
        query_vector = neural_net.vectorize(random_question)
        query_vectors = [query_vector for _ in range(len(text_splits))]
        split_vectors = [neural_net.vectorize(split) for split in text_splits]
        similarities = [
            neural_net.vector_similarity(x[0], x[1]).item() for x in zip(query_vectors, split_vectors)
        ]
        top_idxs = [similarities.index(y) for y in sorted(similarities)[::-1][:top_k]]
        return [text_splits[idx] for idx in top_idxs]

    def retrieve_context_symbolic(text_splits, random_question, symb_model, top_k: int = 3):
        n = len(text_splits)
        query_vector = symb_model.vectorize(random_question)
        query_vectors = [query_vector for _ in range(n)]
        split_vectors = [symb_model.vectorize(split) for split in text_splits]
        similarities = [symb_model.vector_similarity(x[0], x[1]) for x in zip(query_vectors, split_vectors)]
        top_idxs = [similarities.index(y) for y in sorted(similarities)[::-1][:top_k]]
        return [text_splits[idx] for idx in top_idxs]

    def retrieve_context(text_splits, query, neural_net=None, symb_model=None, top_k: int = 3):
        neural_context, symbolic_context = [], []
        if neural_net is not None:
            neural_context += Retr.retrieve_context_neural(
                text_splits, query, neural_net, top_k=top_k
            )
        if symb_model is not None:
            symbolic_context += Retr.retrieve_context_symbolic(
                text_splits, query, symb_model, top_k=top_k
            )
        return neural_context + symbolic_context


class Knowledge_Representation:
    @staticmethod
    def organize_data(article_text):
        text_splits = Text_Preprocessor.text_splitter(article_text, split_size=100)
        text_clusters = text_splits
        return text_clusters