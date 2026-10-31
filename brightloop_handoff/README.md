# Brightloop Subscription Management System

**Odoo × Lucknow Hackathon — Development Handoff**  
**Status:** Architecture and implementation contract  
**Source of required scope:** `Subscription_Management_System.pdf` (4 pages)

## Purpose

Build one unified platform for the subscription business described in the supplied problem statement. It must manage the lifecycle from product/plan configuration through quotations, subscriptions, recurring invoices, discounts, payment recording, customer self-service, and finance reporting.

This repository-style handoff is intended to be consumed by developers and coding agents. The problem statement remains the authority for required features. Recommendations and implementation decisions are explicitly marked as such.

## Read these files in order

1. `01_PRODUCT_REQUIREMENTS.md` — complete requirement inventory, roles, business rules, and acceptance criteria.
2. `02_ARCHITECTURE.md` — system architecture, module boundaries, flows, security and operational decisions.
3. `03_DATABASE_DESIGN.md` — entity relationships, invariants, data lifecycle and performance design.
4. `sql/001_initial_schema.sql` — PostgreSQL/Supabase schema baseline and core database protections.
5. `04_TECH_STACK.md` — selected technologies, rationale, dependencies and environment variables.
6. `05_API_CONTRACT.md` — REST endpoint contract and expected request/response behaviour.
7. `06_IMPLEMENTATION_PLAN.md` — phased build order for a short hackathon.
8. `08_BILLING_ALGORITHM.md` — precise recurring-billing, discount, tax, retry and calendar rules.
9. `07_TEST_AND_DEMO_PLAN.md` — acceptance tests, edge cases and judging demonstration.
10. `AGENTS.md` — rules for any AI coding assistant continuing development.
11. `09_PROJECT_STRUCTURE.md` — recommended source tree and route/module ownership.
12. `10_TRACEABILITY_MATRIX.md` — PDF requirements mapped to database, API, UI and tests.
13. `AI_HANDOFF_PROMPT.md` — ready-to-paste instructions for another coding AI.

## Architecture decision in one sentence

Use a **modular monolith**: a single Next.js 16 App Router application (UI + server-side API/domain services), backed by Supabase PostgreSQL and Supabase Auth, with database-enforced constraints/RLS and a scheduled billing function.

## Critical product boundary

The PDF requires recording payments against invoices. It does **not** require charging cards, UPI mandates, or integrating a payment gateway. Implement payment recording and invoice settlement; do not spend hackathon time building payment processing unless the team has spare time and a real sandbox credential.

## Currency boundary

The PDF's `560` variant surcharge does not state a currency. Keep currency configurable and use a seeded company currency for the demo (INR is a reasonable India-focused default, but it is an implementation assumption, not a PDF requirement).

## Build principle

Prefer a working vertical slice over disconnected screens. The critical end-to-end path is:

`Admin configures product/plan → staff creates quotation → quotation is confirmed → subscription becomes active → billing job creates invoice → staff records payment → dashboard reflects collected revenue and outstanding amount → customer sees their own records`.

## Source and research notes

- Requirements are derived from the user's 4-page problem statement.
- Industry patterns are informed by official Odoo, Stripe, PostgreSQL, Supabase and Next.js documentation. Competition delivery criteria were checked against the official Odoo × FLUX Lucknow Hackathon '26 page. URLs and design implications are listed in `02_ARCHITECTURE.md` and `04_TECH_STACK.md`.
