import os
from functools import lru_cache
from pathlib import Path

import joblib
import librosa
import numpy as np


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = Path(os.environ.get("DRUMIST_MODEL_PATH", PROJECT_ROOT / "drumist_model.pkl"))
DRUM_LABELS = {0: "Kick", 1: "Snare", 2: "overhead", 3: "tom"}
MAX_AUDIO_SECONDS = 40


@lru_cache(maxsize=1)
def load_model():
    if not MODEL_PATH.is_file():
        raise FileNotFoundError(f"Drum classifier not found: {MODEL_PATH}")
    return joblib.load(MODEL_PATH)


def extract_mfcc(audio: np.ndarray, sample_rate: int) -> np.ndarray:
    features = librosa.feature.mfcc(y=audio, sr=sample_rate, n_mfcc=13)
    return features.mean(axis=1)


def process_audio(file_path: str | Path) -> dict:
    duration = float(librosa.get_duration(path=file_path))
    if duration > MAX_AUDIO_SECONDS:
        raise ValueError(f"Audio must be {MAX_AUDIO_SECONDS} seconds or shorter.")

    audio, sample_rate = librosa.load(file_path, sr=22050, mono=True)
    if audio.size == 0:
        raise ValueError("The uploaded audio file is empty or unreadable.")

    tempo, _ = librosa.beat.beat_track(y=audio, sr=sample_rate)
    bpm = max(1, round(float(np.asarray(tempo).reshape(-1)[0])))
    step_duration = 60 / bpm / 8
    step_count = max(1, int(np.ceil(duration / step_duration)))
    model = load_model()
    events = {}

    for step in range(step_count):
        start = step * step_duration
        end = min(start + step_duration, duration)
        chunk = audio[int(start * sample_rate):int(end * sample_rate)]
        timestamp = f"{start:.4f}"

        if chunk.size == 0 or float(np.sqrt(np.mean(chunk**2))) < 0.01:
            events[timestamp] = "Silent"
            continue

        prediction = model.predict([extract_mfcc(chunk, sample_rate)])[0]
        label = DRUM_LABELS.get(prediction, DRUM_LABELS.get(str(prediction)))
        if label is None:
            raise ValueError(f"The classifier returned an unsupported drum label: {prediction}")
        events[timestamp] = label

    return {"bpm": bpm, "duration": round(duration, 4), "events": events}