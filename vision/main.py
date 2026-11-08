import asyncio
import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import StreamingResponse

from capture import FrameGrabber

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s.%(msecs)03d %(levelname)s %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("vision")

STREAM_BOUNDARY = "frame"
STREAM_POLL_SECONDS = 0.01

grabber = FrameGrabber(os.getenv("PHONE_STREAM_URL", "0"))


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    grabber.start()
    logger.info("vision started, source=%s", grabber.source)
    yield
    grabber.stop()
    logger.info("vision stopped")


app = FastAPI(title="Patrol Robot Vision", lifespan=lifespan)


async def mjpeg_frames() -> AsyncIterator[bytes]:
    last_id = -1
    while True:
        frame_id, jpeg = grabber.latest()
        if jpeg is None or frame_id == last_id:
            await asyncio.sleep(STREAM_POLL_SECONDS)
            continue
        last_id = frame_id
        yield (
            (
                f"--{STREAM_BOUNDARY}\r\nContent-Type: image/jpeg\r\n"
                f"Content-Length: {len(jpeg)}\r\n\r\n"
            ).encode()
            + jpeg
            + b"\r\n"
        )


@app.get("/stream")
def stream() -> StreamingResponse:
    return StreamingResponse(
        mjpeg_frames(),
        media_type=f"multipart/x-mixed-replace; boundary={STREAM_BOUNDARY}",
    )


@app.get("/health")
def health() -> dict[str, str | bool | float]:
    return {
        "status": "ok" if grabber.connected else "no_source",
        "source_connected": grabber.connected,
        "fps": round(grabber.fps, 1),
    }
