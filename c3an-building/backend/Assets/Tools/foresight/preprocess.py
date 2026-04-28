from ..core.stage import Stage
from ...Resources.Schemas.artifacts import RawFrame
from typing import List
import pandas as pd


class MergeProductionProcess(Stage[RawFrame, RawFrame]):
    def __init__(self):
        super().__init__("foresight_preprocess", RawFrame, RawFrame)

    def run(self, inp: RawFrame, **kwargs) -> RawFrame:
        production_csv = kwargs.get("production_csv")
        process_csv = kwargs.get("process_csv")
        if not production_csv or not process_csv:
            raise ValueError("production_csv and process_csv are required")

        date_col = kwargs.get("date_col", "Date")
        time_col = kwargs.get("time_col", "Time")
        part_col = kwargs.get("part_col", "Part")
        dt_format = kwargs.get("datetime_format", "%d/%m/%Y %H:%M:%S")
        time_floor = kwargs.get("time_floor", "h")

        production_weight_col = kwargs.get("production_weight_col", "VYP - Yeast Weight")
        process_vya_col = kwargs.get("process_vya_col", "VYA - Batch")
        process_raw_col = kwargs.get("process_raw_col", "RawYeast Volume")
        process_ists_col = kwargs.get("process_ists_col", "VMBX - Res IS/TS (%)")

        parts: List[str] = kwargs.get("parts") or ["Yeast - BRD", "Yeast - BRN", "Yeast - FMX"]

        production_df = pd.read_csv(production_csv)
        process_df = pd.read_csv(process_csv)

        production_df["Datetime"] = pd.to_datetime(
            production_df[date_col].astype(str) + " " + production_df[time_col].astype(str),
            format=dt_format,
            errors="coerce",
        )
        production_df["Datetime"] = production_df["Datetime"].dt.floor(time_floor)
        production_pivot = production_df.pivot_table(
            index="Datetime",
            columns=part_col,
            values=production_weight_col,
            aggfunc="sum",
        ).reset_index()

        process_df["Datetime"] = pd.to_datetime(
            process_df[date_col].astype(str) + " " + process_df[time_col].astype(str),
            format=dt_format,
            errors="coerce",
        )
        process_df["Datetime"] = process_df["Datetime"].dt.floor(time_floor)

        relevant_cols = ["Datetime", part_col, process_vya_col, process_raw_col, process_ists_col]
        process_df_filtered = process_df[relevant_cols]

        pivot_vya = process_df_filtered.pivot_table(
            index="Datetime",
            columns=part_col,
            values=process_vya_col,
            aggfunc="sum",
        ).reset_index()
        pivot_raw = process_df_filtered.pivot_table(
            index="Datetime",
            columns=part_col,
            values=process_raw_col,
            aggfunc="sum",
        ).reset_index()
        pivot_ists = process_df_filtered.pivot_table(
            index="Datetime",
            columns=part_col,
            values=process_ists_col,
            aggfunc="mean",
        ).reset_index()

        process_merged = pd.merge(pivot_vya, pivot_raw, on="Datetime", suffixes=("_VYA", "_RawYeast"))
        process_merged = pd.merge(process_merged, pivot_ists, on="Datetime", suffixes=("", "_IS/TS"))

        columns_to_keep = ["Datetime"]
        for p in parts:
            columns_to_keep.append(f"{p}_VYA")
            columns_to_keep.append(f"{p}_RawYeast")
            columns_to_keep.append(p)

        process_filtered = process_merged[columns_to_keep].rename(
            columns={
                p: f"{p}_IS/TS" for p in parts
            }
        )

        merged = pd.merge(process_filtered, production_pivot, on="Datetime", how="inner")
        merged["Datetime"] = merged["Datetime"].dt.strftime("%Y-%m-%d %H:%M:%S")
        return RawFrame(rows=merged.to_dict(orient="records"))