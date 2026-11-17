import argparse
import csv
from dataclasses import dataclass
from pathlib import Path

THRESHOLDS = [0.30, 0.363, 0.40, 0.45]
HEIGHT_BUCKETS = [(0, 100), (100, 200), (200, 300), (300, 450), (450, 10_000)]
STRANGER = "stranger"


@dataclass(frozen=True)
class Interval:
    start: int
    end: int
    who: str


@dataclass(frozen=True)
class Row:
    ts: int
    box_h: int
    face_found: bool
    best_person: str
    best_score: float | None


def read_intervals(path: Path) -> list[Interval]:
    with path.open(newline="", encoding="utf-8") as file:
        return [
            Interval(int(item["start_ts"]), int(item["end_ts"]), item["person_name"].strip())
            for item in csv.DictReader(file)
        ]


def read_rows(path: Path) -> list[Row]:
    with path.open(newline="", encoding="utf-8") as file:
        return [
            Row(
                int(item["ts"]),
                int(item["box_h_px"]),
                item["face_found"] == "1",
                item["best_person"],
                float(item["best_score"]) if item["best_score"] else None,
            )
            for item in csv.DictReader(file)
        ]


def who_at(intervals: list[Interval], ts: int) -> str | None:
    for interval in intervals:
        if interval.start <= ts <= interval.end:
            return interval.who
    return None


def rate(part: int, total: int) -> str:
    return f"{part / total * 100:5.1f}% ({part}/{total})" if total else "    — (0/0)"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="FAR/FRR за CSV з EXPERIMENT_LOG і розміткою who.csv"
    )
    parser.add_argument("faces_csv", type=Path)
    parser.add_argument("who_csv", type=Path, help="start_ts,end_ts,person_name (або stranger)")
    args = parser.parse_args()

    intervals = read_intervals(args.who_csv)
    labelled = [
        (row, who) for row in read_rows(args.faces_csv) if (who := who_at(intervals, row.ts))
    ]
    faces = [(row, who) for row, who in labelled if row.face_found and row.best_score is not None]
    print(f"Рядків у розмічених інтервалах: {len(labelled)}, з обличчям: {len(faces)}\n")

    print(f"{'поріг':<8}{'FAR (чужий → свій)':<26}{'FRR (свій → не той)':<26}")
    for threshold in THRESHOLDS:
        strangers = [row for row, who in faces if who == STRANGER]
        known = [(row, who) for row, who in faces if who != STRANGER]
        false_accepts = sum(1 for row in strangers if row.best_score >= threshold)
        false_rejects = sum(
            1 for row, who in known if row.best_score < threshold or row.best_person != who
        )
        print(
            f"{threshold:<8}{rate(false_accepts, len(strangers)):<26}{rate(false_rejects, len(known)):<26}"
        )

    print(f"\n{'висота рамки, px':<20}{'обличчя знайдено':<26}")
    for low, high in HEIGHT_BUCKETS:
        bucket = [row for row, _ in labelled if low <= row.box_h < high]
        found = sum(1 for row in bucket if row.face_found)
        label = f"{low}–{high}" if high < 10_000 else f"≥{low}"
        print(f"{label:<20}{rate(found, len(bucket)):<26}")


if __name__ == "__main__":
    main()
