# Repository Guidelines

## Project Structure & Module Organization
- `src/`: Rust source (Axum server)
  - `routes/`: HTTP handlers (e.g., `post.rs`, `comment.rs`, `filter.rs`)
  - `models/`: request/response and DB models
  - `schema/`: API response types
  - `utils/`: helpers (`sanitize.rs`, `filter.rs`, `pagination.rs`)
  - `main.rs`: app entry, router, middleware
- `migrations/`: SQLx migrations (auto-run on startup)
- `static/`: static assets served at `/`
- `filter.txt`: sensitive-words list used by the filter
- `.env.example`: env template; copy to `.env`

## Build, Test, and Development Commands
- `cargo run`: run the API locally (requires `DATABASE_URL`).
- `cargo build --release`: compile release binary.
- `cargo test`: run unit tests in modules (utils, filters, sanitizers).
- `SQLX_OFFLINE=true cargo build`: build using bundled `sqlx-data.json` without DB access.
- `docker compose up --build`: run app + Postgres via Docker.

## Coding Style & Naming Conventions
- Use standard Rust 2021 style; format with `cargo fmt` (4-space indentation).
- Lint with `cargo clippy -- -D warnings` before pushing.
- Naming: `snake_case` for modules/functions, `UpperCamelCase` for types, `SCREAMING_SNAKE_CASE` for consts.
- Routes live in `src/routes`, grouped by resource; keep validation in models and sanitization in utils.

## Testing Guidelines
- Place unit tests with code using `#[cfg(test)]` (see `utils/`).
- Name tests `test_*` and cover: content sanitization, XSS filters, pagination edge cases.
- Run `cargo test` locally; prefer deterministic, DB-free tests where possible.

## Commit & Pull Request Guidelines
- Commits: concise, present-tense summaries (English or Chinese OK), e.g., `优化 UI; 修复 XSS 过滤` or `Add pagination to posts`.
- PRs must include: purpose, linked issues, screenshots/GIFs for UI changes, and test notes.
- Before opening a PR: `cargo fmt`, `cargo clippy -- -D warnings`, `cargo test`, and verify local run (`cargo run` or Docker).

## Security & Configuration Tips
- Required env: `DATABASE_URL`, `SERVER_ADDR`, `RUST_LOG` (see `.env.example`).
- Sensitive-word updates: edit `filter.txt`, then POST `/api/filter/reload` to apply without restart.
- All user content is sanitized server-side; keep new endpoints using `utils::sanitize` and `utils::filter`.

