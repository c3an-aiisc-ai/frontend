from ..core.stage import Stage
from ...Resources.Schemas.artifacts import LSTMConfig, UntrainedModel


class BuildLSTM(Stage[LSTMConfig, UntrainedModel]):
	def __init__(self):
		super().__init__("build_model", LSTMConfig, UntrainedModel)

	def run(self, inp: LSTMConfig, **kwargs) -> UntrainedModel:
		params = {
			"input_dim": inp.input_dim,
			"hidden_dim": inp.hidden_dim,
			"num_layers": inp.num_layers,
			"out_dim": inp.out_dim,
			"dropout": inp.dropout,
			"exog_dim": inp.exog_dim,
		}
		return UntrainedModel(arch="lstm", params=params)