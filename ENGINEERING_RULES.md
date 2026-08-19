# ENGINEERING_RULES.md

This document serves as the permanent development contract and authoritative engineering guide for the `vision-quiz-craft` repository. All future development must strictly adhere to these rules.

## Core Policies

- **Branch Policy**: All development occurs on the `ui-redesign` branch. Never commit directly to `main`.
- **Zero Regression Policy**: Existing features must continue to function exactly as before. Any change that modifies valid existing behavior is a regression.
- **Store.ts Protection Policy**: `src/lib/store.ts` is a protected file. Any modifications require an impact analysis including:
  - Rationale for the change.
  - Risk assessment.
  - List of affected call sites.
  - Explicit verification steps.
- **Validation Architecture**: Business logic is separate from persistence. Data validation is handled via pure, read-only utilities (`db-validation.ts`) using the `Result<T>` pattern. Validation is a prerequisite to writes, never a replacement for business logic.
- **Data Model Rules**: Strict differentiation between internal IDs and user-provided names.
- **Migration Policy**: No hidden or automatic migrations. Data integrity is enforced via explicit validation/diagnostic tools.
- **Testing Checklist**: Every change must include functional verification.
- **Commit Workflow**: Clear, concise messages focused on "why" rather than "what". No `git add .` without explicit intent.
- **Feature/AI Implementation Workflow**: Research -> Strategy (including risks/verification) -> Implementation -> Validation.
- **Code Review Workflow**: All changes must be self-verified against this contract before submission.
- **Performance Rules**: Validation must not impact user-perceived performance. Avoid heavy operations in hot loops.
- **Error Handling Rules**: Fail safely. Do not use uncaught exceptions for normal validation failures. Use the `Result<T>` pattern. Log clearly for developers.
- **Documentation Rules**: Keep READMEs and architecture docs updated with architectural changes.

## Protected Files

Changes to these files require a formal impact analysis before implementation:

- `src/lib/store.ts`
- `src/lib/db-validation.ts`

## Engineering Principles

- **One feature per task**: Maintain tight focus.
- **One responsibility per task**: Do not conflate unrelated concerns.
- **UI separate from business logic**: Maintain structural isolation.
- **Validation separate from persistence**: Validation is pure, persistence is stateful.
- **No silent fallbacks**: Never infer or "repair" data automatically. If data is invalid, fail explicitly.
- **No automatic data repair**: Manual maintenance tools may exist, but they are never invoked automatically.
- **No hidden migrations**: All structural changes must be explicit.
- **Fail safely**: If in doubt, return a structured error.
- **Preserve backwards compatibility**: Existing data and workflows must work as expected.

## Definition of Done

A task is NOT complete until:

1. Build passes.
2. Existing features verified.
3. Regression checklist completed.
4. Documentation updated (if architecture changed).
