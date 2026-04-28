import networkx as nx
from pyvis.network import Network

from ..core.stage import Stage
from ...Resources.Schemas.artifacts import LiNGAMResult

NODE_DESCRIPTIONS = {
    "I_R01_Gripper_Pot": ("Sensor", "measures the voltage difference of the gripper attached to RO1"),
    "I_R01_Gripper_Load": ("Sensor", "measures the force of the gripper attached to RO1"),
    "I_R02_Gripper_Pot": ("Sensor", "measures the voltage difference of the gripper attached to RO2"),
    "I_R02_Gripper_Load": ("Sensor", "measures the force of the gripper attached to RO2"),
    "I_R03_Gripper_Pot": ("Sensor", "measures the voltage difference of the gripper attached to RO3"),
    "I_R03_Gripper_Load": ("Sensor", "measures the force of the gripper attached to RO3"),
    "I_R04_Gripper_Load": ("Sensor", "measures the pressure of the gripper attached to RO4"),
    "I_R04_Gripper_Pot": ("Sensor", "measures the voltage difference of the gripper attached to RO4")
}

NODE_COLORS = {
    "Sensor": "#1f77b4",
    "Actuator": "#ff7f0e",
    "Unknown": "#d62728",
}


class RenderLiNGAMGraph(Stage[LiNGAMResult, LiNGAMResult]):
    def __init__(self):
        super().__init__("render_lingam_graph", LiNGAMResult, LiNGAMResult)

    def run(self, inp: LiNGAMResult, **kwargs) -> LiNGAMResult:
        output_html = kwargs.get("output_html")
        if not output_html:
            raise ValueError("output_html is required")

        graph = nx.DiGraph()
        for node in inp.node_labels:
            graph.add_node(node)
        for src, dst in inp.edges:
            graph.add_edge(src, dst)

        net = Network(height="800px", width="80%", directed=True, notebook=False)
        net.toggle_physics(False)

        for node in graph.nodes:
            node_type, desc = NODE_DESCRIPTIONS.get(node, ("Unknown", "No description available."))
            node_color = NODE_COLORS.get(node_type, NODE_COLORS["Unknown"])
            net.add_node(node, label=node, title=desc, color=node_color, size=20, physics=False)

        for src, dst in graph.edges():
            net.add_edge(src, dst, title=f"{src} -> {dst}", color="gray")

        net.save_graph(output_html)
        with open(output_html, "r", encoding="utf-8") as f:
            html_content = f.read()

        legend_html = """
    <div style="position: fixed; top: 50px; right: 20px; width: 300px; background-color: white;
                padding: 15px; border-radius: 10px; box-shadow: 2px 2px 10px gray;
                font-family: Arial, sans-serif; overflow-y: auto; max-height: 80vh;">
        <h4 style="margin: 0; padding-bottom: 10px;">Node Descriptions</h4>
        <ul style="list-style: none; padding: 0; margin: 0;">
"""
        for node, (_, desc) in NODE_DESCRIPTIONS.items():
            legend_html += f"<li><strong>{node}</strong>: {desc}</li>"

        legend_html += """
        </ul>
    </div>
"""

        node_type_legend = """
    <div style="position: fixed; top: 50px; left: 20px; width: 200px; background-color: white;
                padding: 15px; border-radius: 10px; box-shadow: 2px 2px 10px gray;
                font-family: Arial, sans-serif;">
        <h4 style="margin: 0; padding-bottom: 10px;">Node Types</h4>
        <ul style="list-style: none; padding: 0; margin: 0;">
"""
        for node_type, color in NODE_COLORS.items():
            node_type_legend += f'<li style="color: {color}; font-weight: bold;">* {node_type}</li>'

        node_type_legend += """
        </ul>
    </div>
"""

        html_content = html_content.replace("</body>", legend_html + node_type_legend + "</body>")
        with open(output_html, "w", encoding="utf-8") as f:
            f.write(html_content)

        return inp