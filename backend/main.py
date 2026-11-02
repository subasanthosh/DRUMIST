import logging
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

if __package__:
    from .process import MODEL_PATH, process_audio
else:
    from process import MODEL_PATH, process_audio


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
ALLOWED_EXTENSIONS = {".wav", ".mp3", ".flac", ".ogg", ".m4a"}
FRONTEND_DIST = Path(__file__).resolve().parents[1] / "frontend" / "dist"

app = FastAPI(title="Drumist API", version="1.0.0")


@app.get("/api/health")
def health_check():
    return {"status": "ok", "model_available": MODEL_PATH.is_file()}


@app.post("/api/process_audio")
def analyze_audio(file: UploadFile = File(...)):
    extension = Path(file.filename or "").suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail="Upload a WAV, MP3, FLAC, OGG, or M4A audio file.",
        )

    content = file.file.read(MAX_UPLOAD_BYTES + 1)
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Audio files must be 25 MB or smaller.")

    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=extension, delete=False) as temporary_file:
            temporary_file.write(content)
            temporary_path = Path(temporary_file.name)
        return process_audio(temporary_path)
    except FileNotFoundError as error:
        logger.error("Audio analysis model is unavailable: %s", error)
        raise HTTPException(status_code=503, detail="The drum classifier is not installed.") from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        logger.exception("Audio analysis failed")
        raise HTTPException(status_code=422, detail="The audio file could not be analyzed.") from error
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
        file.file.close()


if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
else:
    @app.get("/")
    def read_root():
        return {"message": "Drumist API is running. Build the frontend to serve the application."}