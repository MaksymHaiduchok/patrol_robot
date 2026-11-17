import argparse
import csv
import statistics
import time
from datetime import datetime
from pathlib import Path

import httpx

FIELDS = ["capture_fps", "detection_fps", "inference_ms_avg", "inference_ms_max", "face_ms_avg"]
LOGS_DIR = Path(__file__).resolve().parent.parent / "logs"


def main() -> None:
    parser = argparse.ArgumentParser(description="Опитує vision /metrics і рахує середні значення")
    parser.add_argument("--url", default="http://localhost:8001")
    parser.add_argument("--seconds", type=int, default=60)
    parser.add_argument("--label", default="", help="мітка в імені файлу, наприклад mps або cpu")
    args = parser.parse_args()

    LOGS_DIR.mkdir(exist_ok=True)
    suffix = f"-{args.label}" if args.label else ""
    path = LOGS_DIR / f"metrics-{datetime.now():%Y%m%d-%H%M}{suffix}.csv"
    samples: list[dict[str, float]] = []
    device = "?"

    with httpx.Client(base_url=args.url, timeout=5) as client, path.open("w", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["ts", "device", *FIELDS])
        for _ in range(args.seconds):
            started = time.monotonic()
            data = client.get("/metrics").json()
            device = data.get("device", "?")
            sample = {field: float(data.get(field, 0.0)) for field in FIELDS}
            samples.append(sample)
            writer.writerow([int(time.time() * 1000), device, *sample.values()])
            time.sleep(max(0.0, 1.0 - (time.monotonic() - started)))

    print(f"Файл: {path}")
    print(f"Пристрій: {device}, вибірок: {len(samples)}")
    print(f"{'метрика':<20}{'середнє':>10}{'макс':>10}")
    for field in FIELDS:
        values = [sample[field] for sample in samples]
        print(f"{field:<20}{statistics.fmean(values):>10.1f}{max(values):>10.1f}")


if __name__ == "__main__":
    main()
