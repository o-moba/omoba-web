# Dependency decision — implementation P0

User-selected runtime: Next.js with React/React DOM and TypeScript.
Pinned versions: Next.js 16.3.5, React/React DOM 19.3.0, TypeScript 7.0.2.
API: Axum 0.8.9 and ring 0.17.14. Browser tests use Playwright 1.63.0 (dev only).
Package and Cargo lockfiles record the resolved dependency graphs.

Approved by the user on 2026-09-15 ("делай как считаешь что будет лучше"):

- axum 0.8.x: maintained HTTP routing/extraction built on the existing Tokio/Hyper
  stack; avoids creating an HTTP parser or authentication transport from scratch.
- ring 0.17.x as a direct dependency (already locked transitively): SHA-256/HMAC
  and authenticated encryption for the short-lived pairing delivery envelope.

Reuse existing SQLx, Tokio, serde, Ed25519, getrandom, reqwest/rustls. Native client
transport uses the already locked HTTP stack; no new wallet/auth provider.
No ORM migration engine, Redis, hosted auth vendor, paid analytics or message broker.

Axum reference: https://docs.rs/axum/latest/axum/
