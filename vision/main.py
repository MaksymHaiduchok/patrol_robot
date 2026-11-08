import logging

from fastapi import FastAPI

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s.%(msecs)03d %(levelname)s %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("vision")

app = FastAPI(title="Patrol Robot Vision")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
