# Drumist: Project and Deployment Guide

Drumist is a browser-based drum step sequencer with an audio-to-pattern feature. This guide describes the application as it exists in this repository: how its parts fit together, how the drum classifier is produced, how to run it locally, and how to package and deploy it with Docker.

The repository includes a Docker deployment path, but it does not identify or configure a cloud hosting provider. Publishing the image to a registry, setting provider-specific environment variables, and configuring a public domain or HTTPS are deployment-operator steps.

## 1. What the application does

- Builds and edits a drum pattern on a grid with eight subdivisions per beat.
- Supports time signatures, pattern lengths, tempo adjustment, and output volume.
- Plays the pattern using synthesized kick, snare, tom, and overhead sounds in the browser.
- Accepts a drum recording, estimates its tempo, and asks the backend to classify short audio slices.
- Displays the resulting pattern on the grid and lets the user copy or import timestamped JSON.

The sequencer can be used without uploading audio. The pattern and imported JSON are held in browser memory; this implementation does not include user accounts, a database, or cloud pattern storage.

## 2. Architecture and request flow

### Frontend

The production frontend is in `frontend/`. It is a React application built with Vite. Its main interface is implemented in `frontend/src/App.jsx`.

The frontend maintains the tempo, meter, bar count, volume, and active grid cells. Playback is synthesized through the Web Audio API; the application does not play back the uploaded recording. The JSON panel serializes the current grid as timestamp-keyed events, and the import panel validates and maps timestamped events back onto the grid.

When a user analyzes a recording, the frontend sends it as multipart form data in the `file` field to `POST /api/process_audio`. On success, it uses the returned tempo and event timestamps to choose a grid length and populate the sequencer. During local development, Vite proxies `/api` requests to the backend. In production, the FastAPI application serves the built frontend from `frontend/dist`.

### Backend

The FastAPI application is `backend/main.py`; audio processing is in `backend/process.py`.

`GET /api/health` returns the API status and whether the configured classifier file exists. `POST /api/process_audio` validates the file extension and size, writes the upload to a temporary file, invokes the processor, and removes the temporary file afterward. The processor loads the classifier once per process, decodes audio as mono at 22,050 Hz, estimates tempo with librosa, and extracts 13 mean MFCC features from each non-silent slice.

The processing result has this shape:

```json
{
  "bpm": 120,
  "duration": 2.0,
  "events": {
    "0.0000": "Kick",
    "0.0625": "Silent",
    "0.1250": "Snare"
  }
}
```

The exact tempo, timestamps, and predictions depend on the input audio. The processor divides the recording into slices of one eighth of a beat and predicts one class for each non-silent slice. This is classification, not source separation: simultaneous drum sounds in a slice are not independently separated by the backend.

### Classifier and training materials

The serialized classifier is `drumist_model.pkl`. The notebook `drumtrain.ipynb` shows the training workflow:

1. Read WAV samples from the `dataset/` class folders (`kick`, `snare`, `overheads`, and `toms`).
2. Load each sample with librosa and calculate the mean of its 13 MFCC coefficients.
3. Assign numeric labels: 0 for kick, 1 for snare, 2 for overheads, and 3 for toms.
4. Split the examples into training and test sets with an 80/20 split.
5. Fit a `GradientBoostingClassifier` and save it with joblib as `drumist_model.pkl`.

The current dataset folders contain 40 files each. The notebook uses absolute Windows paths, so update those paths to the location of your dataset before running it on another machine. The notebook prints predictions but does not provide a complete model evaluation report; do not treat the sample count or a successful Docker build as proof of classifier accuracy. Retrain and evaluate the model with representative recordings before relying on its predictions.

The backend looks for the model at the repository root by default. Set `DRUMIST_MODEL_PATH` to use another file. Since joblib deserializes Python objects, only load a model artifact from a trusted source, and keep the training and runtime scikit-learn versions compatible.

## 3. Repository map

| Path | Purpose |
|---|---|
| `backend/main.py` | FastAPI routes, upload validation, temporary-file cleanup, and frontend serving |
| `backend/process.py` | Model loading, audio decoding, tempo estimation, feature extraction, and predictions |
| `frontend/` | Production React/Vite sequencer |
| `drumtrain.ipynb` | Example classifier training notebook |
| `dataset/` | WAV training samples used by the notebook |
| `drumist_model.pkl` | Serialized classifier used at runtime |
| `Dockerfile` | Multi-stage frontend build and Python runtime image |
| `requirements-deploy.txt` | Pinned runtime Python dependencies |
| `pyproject.toml` and `uv.lock` | Project and development dependency metadata |
| `drummer/` | Retained Vite scaffold; it is not the production frontend |

The repository-root `main.py` is a small Python entry-point placeholder. Start the API using `backend.main:app`, not that placeholder.

## 4. Run locally

Prerequisites:

- Python 3.12 or newer
- Node.js 22 or newer and npm
- FFmpeg and libsndfile if your operating system needs them to decode the audio formats you plan to test
- The `drumist_model.pkl` file at the project root, unless `DRUMIST_MODEL_PATH` points to another location

From the repository root, install the runtime API dependencies and start FastAPI:

```powershell
python -m pip install -r requirements-deploy.txt
python -m uvicorn backend.main:app --reload
```

In a second terminal:

```powershell
Set-Location frontend
npm ci
npm run dev
```

Open the Vite URL printed in the terminal. The development proxy targets `http://127.0.0.1:8000` by default. To use a different backend, set `VITE_API_PROXY_TARGET` before starting Vite. FastAPI's interactive API documentation is available at `http://127.0.0.1:8000/docs`.

To run a production-style frontend locally, build it first and then start the API from the repository root:

```powershell
Set-Location frontend
npm ci
npm run build
Set-Location ..
python -m uvicorn backend.main:app
```

FastAPI serves the generated `frontend/dist` directory when it exists.

## 5. Verify the running application

Check backend health:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
```

The response should report `"status": "ok"` and `"model_available": true` when the configured model file exists. This checks availability, not whether the model produces useful predictions.

Submit an audio sample from the repository root:

```powershell
curl.exe -F "file=@drumist_test.wav" http://127.0.0.1:8000/api/process_audio
```

The request should return JSON containing `bpm`, `duration`, and `events`. A file with an unsupported extension returns HTTP 415; an empty file returns 400; a file above 25 MiB returns 413; and invalid or overlong audio can return 422. If the classifier is missing, analysis returns 503.

## 6. Build and deploy with Docker

The Dockerfile builds the frontend with Node 22, then copies the static build into a Python 3.12 image with the API and model. The runtime image installs FFmpeg and libsndfile, runs the API as a non-root user, and listens on port 8000 by default.

Run these commands from the repository root:

```powershell
docker build -t drumist .
docker run --rm -p 8000:8000 drumist
```

Open `http://localhost:8000`; check `http://localhost:8000/api/health` to confirm the container can see its model. The image build expects `drumist_model.pkl` in the repository root because the Dockerfile copies that file into the image.

For a hosting platform that assigns a port, set `PORT` to the supplied port. The container command binds Uvicorn to `0.0.0.0` and uses `PORT`, defaulting to `8000`. If the classifier should not be baked into the image, mount it into the container and set `DRUMIST_MODEL_PATH` to its in-container path. Ensure the mounted file is readable by the container's non-root `appuser`.

For a public deployment:

1. Build the image from the repository root and run it locally first.
2. Push the image to a container registry available to your hosting provider.
3. Configure the service to run the image, expose the configured `PORT`, and provide or mount the model artifact.
4. Configure HTTPS and a public hostname through the hosting provider or its reverse proxy.
5. Check `/api/health`, load the frontend, and submit a representative short audio file after deployment.

These are provider-neutral steps; the repository contains no provider-specific service manifest, credentials, or public deployment URL.

## 7. Input and operational limits

- Accepted upload extensions: WAV, MP3, FLAC, OGG, and M4A.
- Maximum upload size: 25 MiB.
- Maximum analyzed duration: 40 seconds.
- Audio is converted to mono at 22,050 Hz for processing.
- Silence is detected using a fixed RMS threshold and emitted as `"Silent"`.
- The classifier predicts one of four labels per non-silent slice; real-world accuracy depends on training data and recording conditions.
- The API keeps no uploaded files after processing and does not persist user patterns.
- The API has no authentication or rate limiting configured. Add appropriate access controls and request limits before exposing it to untrusted public traffic.

## 8. Maintenance and next steps

- Use representative, clearly labeled audio to expand and evaluate the training dataset.
- Replace notebook-specific absolute paths with portable paths and record evaluation metrics before distributing an updated model.
- Keep the model artifact, pinned Python runtime dependencies, and Docker image in sync.
- Add automated API and frontend tests for audio validation, event conversion, and sequencer behavior.
- Configure provider-specific health checks, resource limits, logging, authentication, and rate limiting when selecting a public hosting environment.
