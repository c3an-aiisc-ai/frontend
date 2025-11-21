HOT_PATH = "/content/hotpot_dev10.json"
with open(HOT_PATH, "r") as f:
    HOT = json.load(f)
assert len(HOT) >= 2, "Need at least 2 items for ERD tuning."

HOT_SUB = HOT[:1]
print("Loaded Hotpot items:", len(HOT_SUB))