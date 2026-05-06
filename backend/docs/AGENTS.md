# IKF Solutions Workspace Governance

## 1) Authority and Scope
- `SPEC.md` at workspace root is the primary governance document for system/product architecture.
- `SPEC.md` is **immutable for routine implementation passes**.
- `SPEC.md` may only be changed for major product or major architectural decisions explicitly approved by product/architecture owners.

## 2) Compliance Requirement
- Any implementation drift, conflict, or contradiction against `SPEC.md` is a **violation**.
- During each pass, implementation decisions must be validated against `SPEC.md` before merge.

## 3) Compatibility Policy (Non-Negotiable)
- Do **not** maintain legacy code paths, compatibility shims, or backward-compatible duplicate endpoints.
- Do **not** preserve deprecated behavior for convenience.
- New architecture replaces old architecture directly; migration is done as hard cutover.
- Any compatibility layer added without explicit architecture-owner approval is a governance violation.

## 4) Modeling Standard (Backend)
- Use Pydantic models for request/response/internal service contracts.
- Do not use dataclasses for service/API contracts.
- Keep schemas in dedicated `schemas/` directories; do not define inline local schema classes in route/service files.

## 5) Change Logging
- Each repository maintains its own independent `CHANGELOGS.md`.
- At the end of every implementation pass, append entries to that repo’s `CHANGELOGS.md` describing:
  - what changed
  - why it changed
  - validation/tests executed
- Do not overwrite previous changelog entries; append only.