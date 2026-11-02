# CI/CD Study Guide for Drumist

This document explains the CI/CD pipeline implemented for the Drumist project and how it helps in software delivery.

## 1. Project Overview

Drumist is an audio-to-pattern drum sequencer and analysis application. It has:

- a frontend built with React and Vite
- a backend built with FastAPI
- a Docker-based production deployment model
- a machine learning model used for audio classification

The app is designed to process drum recordings, detect hits, generate a sequencer pattern, and present it in a browser UI.

## 2. Why CI/CD Is Needed

A project like Drumist needs CI/CD because:

- code changes can break the frontend build
- backend code can fail to import or compile
- container builds may fail if dependencies or configuration are wrong
- deployment to production should be automated and repeatable

Without CI/CD, the team would need to manually validate every change, which is slow and error-prone.

## 3. Project Structure Relevant to CI/CD

The key project files involved in CI/CD are:

- `.github/workflows/ci-cd.yml` — GitHub Actions workflow
- `frontend/package.json` — frontend scripts and dependencies
- `Dockerfile` — production container build
- `requirements-deploy.txt` — backend runtime dependencies
- `backend/main.py` — FastAPI app entry point
- `README.md` — project setup and deployment instructions

## 4. CI/CD Workflow Added

The workflow file is located at:

[.github/workflows/ci-cd.yml](.github/workflows/ci-cd.yml)

It defines an automated pipeline with the following behavior:

### A. Trigger Conditions

The workflow runs when:

- a pull request targets the `main` branch
- code is pushed to `main`
- a version tag like `v1.2.3` is pushed
- the workflow is started manually using `workflow_dispatch`

This ensures that both validation and deployment are triggered under the correct situations.

### B. Concurrency Control

The workflow includes concurrency rules:

- same workflow + same ref
- cancel in-progress runs when a newer run starts

This prevents duplicate old runs from continuing when new code is already being tested.

## 5. CI Job: Frontend and Backend Validation

The CI job is named:

- `Frontend and backend checks`

It is executed on the `ubuntu-latest` runner and performs the following steps.

### Step 1: Checkout Repository

GitHub Actions checks out the project source so the workflow can access the repository files.

### Step 2: Set Up Node.js

The workflow installs Node.js version 22 because the frontend is built with Vite and React.

The cache is enabled using:

- `frontend/package-lock.json`

This speeds up dependency installation during future workflow runs.

### Step 3: Install Frontend Dependencies

Command used:

```bash
cd frontend
npm ci
```

This ensures a clean, consistent lockfile-based install.

### Step 4: Lint Frontend

The workflow runs:

```bash
npm run lint -- --deny-warnings
```

This checks for obvious frontend code issues and treats warnings as failures.

### Step 5: Build Frontend

The workflow runs:

```bash
npm run build
```

This validates that the production React app compiles successfully.

### Step 6: Set Up Python

Python 3.12 is configured because the project requires Python 3.12 or newer.

### Step 7: Install Backend Dependencies

Command used:

```bash
python -m pip install -r requirements-deploy.txt
```

This ensures the FastAPI backend and runtime libraries are available for validation.

### Step 8: Compile Backend Python Files

The workflow runs:

```bash
python -m compileall -q backend
```

This checks the Python files for syntax errors.

### Step 9: Import the FastAPI App

The workflow executes:

```bash
python -c "from backend.main import app; print(app.title)"
```

This confirms the FastAPI app imports correctly and the application entry point is valid.

## 6. Container Validation on Pull Requests

The workflow defines a second job:

- `container-check`

This job runs only for pull requests.

It does the following:

1. checks out the repository
2. sets up Docker Buildx
3. builds the image using the repository `Dockerfile`
4. does not push the image

This ensures that the application can be containerized successfully before merging code.

## 7. Production Deployment: Publish to GHCR

The `publish` job runs only on push events.

This job:

1. checks out the repository
2. sets up Docker Buildx
3. builds the image tag name based on the repository name in lowercase
4. generates metadata tags for:
   - branch references
   - tag references
   - commit SHA
   - `latest` on the `main` branch
5. logs into GitHub Container Registry (GHCR)
6. pushes the image to GHCR

This allows the project to have a packaged deployable version available as a container image.

## 8. Docker Build Strategy

The project already contains a Docker image definition in:

- [Dockerfile](Dockerfile)

This Dockerfile does the following:

- builds the frontend using Node.js
- installs frontend dependencies
- runs the frontend production build
- creates a Python runtime container
- installs backend dependencies
- copies the backend code and model file
- copies the compiled frontend assets into the final image
- launches the app with Uvicorn

This is important because it creates a single deployable artifact that includes both backend and frontend.

## 9. Local Validation Commands

The same checks done by CI were also validated locally in the project environment.

### Frontend validation

```bash
cd frontend
npm ci
npm run lint -- --deny-warnings
npm run build
```

Result: passed successfully.

### Backend validation

```bash
python -m pip install -r requirements-deploy.txt
python -m compileall -q backend
python -c "from backend.main import app; print(app.title)"
```

Result: passed successfully.

## 10. What This CI/CD Pipeline Achieves

This pipeline gives the project the following advantages:

- automated code quality checks
- early bug detection before merge
- consistent builds across machines
- Docker validation before deployment
- automatic container publishing for main branch or tagged releases
- reduced manual deployment effort

## 11. Why This Matters for Your Presentation

When explaining the project from scratch, you can present the CI/CD pipeline as the part that ensures the project is reliable and deployment-ready.

A simple storytelling flow could be:

1. The project is an audio-based drum analysis app.
2. It uses frontend, backend, Docker, and ML components.
3. The pipeline checks code quality and build correctness.
4. It validates that the Docker app builds successfully.
5. It publishes a production image to GHCR.
6. This makes the project more professional and production-ready.

## 12. Final Summary

The CI/CD implementation completed for Drumist includes:

- GitHub Actions workflow setup
- automated frontend lint and build checks
- backend syntax/import validation
- Docker image build checks on pull requests
- GHCR image publishing on main/tag pushes
- concurrency control for efficient automation

This is a complete and practical CI/CD setup for a full-stack project with a containerized deployment model.

## 13. Study Tip

When presenting this in front of a class or audience, explain it in simple terms:

> "We automated the quality checks and deployment process so that every code change is tested before it goes live. This reduces errors, saves time, and makes the application more stable."

This is a strong presentation summary because it connects technical implementation with business value.
