---

description: Plan, challenge, security-review, and implement a pixaPOS feature
agent: build
------------

You are implementing a new feature for the pixaPOS restaurant management system.

The user's feature request is:

$ARGUMENTS

Follow this workflow strictly.

## Phase 1 — Understand

Before changing code:

1. Read `AGENTS.md`.
2. Read `docs/workflows.md`.
3. Inspect the existing codebase relevant to the requested feature.
4. Identify existing domain models, services, repositories, APIs, state machines, and tests that are affected.
5. Do not implement anything yet.

## Phase 2 — Architecture

Delegate the feature to `@planner`.

Ask the planner to produce:

* Requirements
* Assumptions
* Domain model
* Database changes
* API changes
* State transitions
* Commands/events
* Transaction boundaries
* Edge cases
* Testing strategy
* ADR proposal

The planner must not modify application code.

## Phase 3 — Architecture Challenge

Give the planner's proposal to `@debater`.

Ask the debater to aggressively challenge:

* Incorrect state transitions
* Invalid domain assumptions
* Money calculations and paise handling
* Snapshot immutability
* Order lifecycle
* Payment lifecycle
* Inventory consistency
* Transaction boundaries
* Concurrency/race conditions
* Offline synchronization
* Multi-tenant isolation
* Multi-branch behavior
* Performance
* Technical debt
* Backward compatibility

The debater must not modify application code.

Categorize findings as:

CRITICAL
HIGH
MEDIUM
LOW

Every finding must contain:

* Problem
* Why it matters
* Failure scenario
* Recommended solution

## Phase 4 — Security Review

Give the architecture proposal and debater findings to `@security_analyst`.

Review:

* Authentication
* Authorization
* Tenant isolation
* Branch isolation
* Clerk organization permissions
* API authorization
* Payment authorization
* Refund authorization
* Dangerous state transitions
* Injection risks
* PII exposure
* Sensitive data in logs
* Webhook security
* Secrets
* Audit logging

The security analyst must not modify application code.

## Phase 5 — Final Design

Before implementation, reconcile the outputs from:

* `@planner`
* `@debater`
* `@security_analyst`

Create a final implementation plan.

The final plan must explicitly state:

1. What will change
2. What will NOT change
3. Database changes
4. Domain changes
5. State-machine changes
6. API changes
7. UI changes
8. Migration requirements
9. Transaction boundaries
10. Authorization rules
11. Tests required
12. Risks

Do not implement if there is a CRITICAL unresolved architectural or security issue.

## Phase 6 — Implementation

After the final design is established:

1. Implement the feature.
2. Follow `AGENTS.md`.
3. Follow `docs/workflows.md`.
4. Reuse existing architecture where possible.
5. Do not introduce unnecessary abstractions.
6. Keep module boundaries clear.
7. Store monetary values as integer minor units/paise.
8. Snapshot sale-time values where required.
9. Enforce state transitions through domain/application services rather than arbitrary database mutations.
10. Preserve tenant and branch isolation.

## Phase 7 — Testing

Add or update tests for:

* Happy path
* Invalid state transitions
* Authorization failures
* Tenant/branch isolation
* Concurrency where relevant
* Money calculations
* Edge cases
* Regression cases

Run the relevant test suite.

Also run lint/type checking where available.

## Phase 8 — Final Review

After implementation, review your own changes against:

* `AGENTS.md`
* `docs/workflows.md`
* Planner proposal
* Debater findings
* Security findings

Report:

### Implementation

Files changed and what changed.

### Architecture

Whether implementation matches the approved design.

### Security

Security considerations and mitigations.

### Tests

Tests added/run and their result.

### Remaining Risks

Anything that still requires human review.

Do not silently ignore planner, debater, or security findings.
