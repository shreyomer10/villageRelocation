# Village Relocation Management System

This repository documents the backend side of the Village Relocation Management System. The platform is designed to support relocation planning, field validation, asset tracking, and stakeholder reporting through a structured data backend, operational workflows, and a focused AI assistant layer.

The AI component is intentionally only one part of the system. Most of the application is built around managing villages, families, plots, materials, facilities, employees, meetings, and relocation stages. The assistant is used to surface information quickly, while the core platform keeps the operational records consistent and traceable.

## System Overview

The application combines a Flask API, MongoDB collections, route-based business logic, and shared utility layers for authentication and verification. It supports the data flow needed for relocation operations, including stage tracking, material updates, facility management, and community records.

The project also reflects a broader field workflow vision: offline-first usage, location-aware verification, integrity flagging, and computer-vision-assisted stage checks are part of the intended operational model described in the project presentation.

## Core Capabilities

- Village, family, plot, material, facility, employee, and meeting data management.
- Relocation stage tracking and workflow-based operational updates.
- Admin and analytics routes for community, material, and facility oversight.
- AI-assisted querying for quick access to key summaries and insights.
- Prompt caching and deterministic chat handling for repeatable demo responses.
- Parallel query execution to improve response time for dashboard and reporting requests.
- Session persistence and trace logging for chat interactions.
- Integrity-oriented validation concepts such as geolocation checks and suspicious-entry flagging.

## Architecture

- `backend.py` provides the Flask application entry point.
- `config.py` centralizes environment and service configuration.
- `models/` defines the collections used by the system.
- `routes/` contains the API surface for authentication, family records, village operations, meetings, complaints, logs, admin workflows, and AI assistant endpoints.
- `routes/ai_agent/` contains the orchestration logic, protocol handling, executor flow, prompt reasoning, and session management for the assistant.
- `utils/` holds shared helpers, token authentication, and verification pipeline support.
- `scripts/` contains utility scripts such as prompt cache population and schema/data helpers.

## AI Layer

The AI assistant is built for focused conversational access to the underlying relocation data. It uses a MongoDB-backed prompt cache for exact-match responses, which keeps demo behavior stable and avoids unnecessary recomputation for repeated questions.

The assistant flow is also designed to work with parallel or DAG-style query execution so that multi-step questions can be answered more efficiently. This keeps the conversational layer responsive while the main platform continues to handle data integrity and workflow control.

## Operational Direction

The presentation highlights several forward-looking directions for the system, including offline-first field support, stage detection from submitted photos, geolocation-based verification, automated integrity alerts, and local model integration for low-latency reasoning. These ideas position the platform as a practical tool for on-ground relocation work rather than just a chat interface.

## Future Scope

- Expand offline sync for field agents working in low-connectivity areas.
- Add richer GIS and map-based planning support.
- Support multilingual input for regional deployment.
- Strengthen audit trails and automated validation workflows.
- Extend the AI layer to cover more operational and predictive questions.

## Supporting Files

- `routes/ai_agent/` for the AI orchestration flow.
- `scripts/populate_prompt_cache.py` for seeding stable demo responses.
- `requirements.txt` for Python dependency tracking.
- `README.md` for the project-level explanation.
