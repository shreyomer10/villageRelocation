# Village Relocation AI Assistant

This repository contains the backend and supporting scripts for the Village Relocation project. It provides an AI-driven chat assistant with a MongoDB-backed prompt cache, a single-agent Gemini orchestration flow, and a set of utilities for building AI query responses from village relocation data.

## Project Structure

- `backend.py` – Flask application entry point for the backend API.
- `config.py` – Environment configuration loader for MongoDB and Gemini settings.
- `routes/ai_agent/` – AI agent route handlers, executor logic, prompt protocol, and supporting modules.
- `scripts/` – Utility scripts, including prompt cache population.
- `models/` – Data model definitions for application collections.
- `utils/` – Shared helper utilities and authentication logic.

## Key Features

- Single-agent AI orchestration using Google Gemini.
- Exact-match prompt cache for demo latency control and deterministic responses.
- Parallel/DAG query execution for faster data retrieval from MongoDB.
- Chat session management with persistence and trace logging.
- Prompt population script for seeding stable cached responses.

## Setup

1. Create and activate a Python virtual environment.
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Add `.env` variables:
   - `MONGO_URI`
   - `DB_NAME`
   - `GEMINI_API`
   - `GEMINI_MODEL`
   - `JWT_SECRET`
4. Run the backend:
   ```bash
   python backend.py
   ```

## Usage

- Use the `/ai/chat` endpoint to submit user prompts.
- Use the prompt cache script to pre-populate demo responses for exact questions.
- The `prompt_cache` collection is checked before invoking the AI, and cached answers are returned with a simulated 4-7 second delay.

## Script

- `scripts/populate_prompt_cache.py` — populates `prompt_cache` with selected questions and their AI responses.

## Notes

- The system requires a running MongoDB instance reachable via `MONGO_URI`.
- The AI backend uses Google Gemini, so valid Gemini credentials are required.
- Exact prompt matching is intentional for demo confidence and reproducible output.
