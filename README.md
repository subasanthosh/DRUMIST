# Drumist

Drumist turns a drum recording into an editable step-sequencer pattern. The React UI can analyze an audio upload through the FastAPI service, edit detected hits, play a synthesized kit, and import or export timestamped event JSON.

For the full architecture, classifier workflow, local setup, and Docker deployment steps, see [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md).

## Local Development

Python 3.12 or newer and Node.js 22 or newer are required. From the repository root, install the API dependencies and start FastAPI:

```bash
python -m pip install -r requirements-deploy.txt
uvicorn backend.main:app --reload
```

In a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open the Vite URL printed in the terminal. The Vite development server proxies `/api` requests to `http://127.0.0.1:8000` by default. Set `VITE_API_PROXY_TARGET` to use a different local API address. FastAPI's interactive API documentation is available at `http://127.0.0.1:8000/docs`.

## Analyze Audio

Choose a WAV, MP3, FLAC, OGG, or M4A file up to 25 MB and 40 seconds long, then select **Analyze recording**. Drumist estimates tempo, classifies short audio slices, adjusts the sequencer tempo, and places the detected events on the grid. The analysis endpoint is `POST /api/process_audio` with a multipart `file` field. It returns `bpm`, `duration`, and timestamp-keyed `events`.

The classifier is loaded from `drumist_model.pkl` in the project root. Set `DRUMIST_MODEL_PATH` to use a model stored elsewhere. The bundled model is a prototype classifier, so detection quality depends on the recording and model training data.

## Deploy With Docker

Build and run the combined frontend/API image from the repository root:

```bash
docker build -t drumist .
docker run --rm -p 8000:8000 drumist
```

Open `http://localhost:8000`. The same-origin health endpoint is `GET /api/health`; it reports whether the model file is present. The container listens on port 8000 by default; set `PORT` if your hosting provider supplies a different port. Supply `DRUMIST_MODEL_PATH` and mount the model at that path if the classifier is not included in the image.

## Project Layout

- `frontend/` contains the production sequencer UI.
- `backend/` contains the audio processor and FastAPI service.
- `drumist_model.pkl` is the bundled classifier used by audio analysis.
- `drummer/` is an unused Vite scaffold retained from early development.