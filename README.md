# Drumist

A 6-week learning project focused on audio processing, drum separation, and classification.

## Learning Plan

### Week 1: Audio Basics
- Learn about waveforms, STFT, and spectrograms
- Experiment with Librosa library
- Load audio files and plot waveforms

### Week 2: Drum Separation
- Use Demucs for drum separation
- Separate drums from songs
- Save output as WAV files
- Listen to and evaluate results

### Week 3: Hit Detection
- Implement onset detection using Librosa
- Mark timestamps of drum hits
- Plot detection results on waveforms

### Week 4: Drum Classification
- Extract MFCC features from audio
- Label a small dataset of drum samples
- Train a classifier for drum types
- Predict drum types from new audio

### Week 5: Backend API
- Build a FastAPI backend
- Create upload endpoint for audio files
- Process audio to extract timestamps and labels
- Return processed results

### Week 6: Frontend
- Create a web interface for file upload
- Display waveforms and beat timelines
- Play isolated drum tracks

## Setup

This project uses Python. Install dependencies with:

```bash
pip install -r requirements.txt
```

Or if using uv:

```bash
uv pip install -r requirements.txt
```

## Usage

Run the main application:

```bash
python main.py
```