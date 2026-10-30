# Drumist

Drumist is an in-progress project for turning a drum-beat audio file into an
editable, playable drum-machine pattern. The goal is to identify drum hits in
recorded audio, place them on a sequencer grid, and let you hear and edit the
result.

## How it works

The project has two parts:

- **Sequencer UI (`frontend/`)** — a browser-based step sequencer for kick,
  snare, tom, and overhead parts. Set the tempo, time signature, and pattern
  length; edit hits on a grid with eight subdivisions per beat; and play the
  pattern using synthesized drum sounds. The UI can also import and export
  timestamped drum events as JSON.
- **Audio-analysis prototype (`backend/`)** — Python code that estimates a
  recording's tempo, divides it into short time slices, extracts MFCC audio
  features, and uses a saved classifier to label slices as drum types or
  silence.

## Current status

The sequencer and audio-analysis prototype are not yet connected into a complete
audio-to-pattern workflow. The frontend does not currently upload or analyze an
audio file; it can load timestamped event data as JSON. The FastAPI endpoint is
also a placeholder, so the audio classifier is not currently exposed to the UI
through the API.

## Run the sequencer UI

From the `frontend/` directory, install the JavaScript dependencies and start
the development server:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. You can create a pattern in the sequencer,
play it, copy its timestamped JSON, or paste compatible timestamped drum events
into the import panel.
