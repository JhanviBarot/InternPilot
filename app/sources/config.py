"""Curated lists of company slugs to ingest per ATS.

Slugs are verified against live boards; 404s are removed.
"""
from __future__ import annotations

GREENHOUSE_SLUGS: list[str] = [
    # Consumer / social
    "airbnb",
    "reddit",
    "dropbox",
    "discord",
    "duolingo",
    "pinterest",
    "snap",
    "robinhood",
    # Fintech / payments
    "stripe",
    "brex",
    "coinbase",
    "plaid",
    "chime",
    "mercury",
    # Dev tools / infrastructure
    "figma",
    "databricks",
    "elastic",
    "fastly",
    "pagerduty",
    "hashicorp",
    "confluent",
    "grafana",
    "sentry",
    "vercel",
    "netlify",
    # Enterprise SaaS
    "asana",
    "mixpanel",
    "notion",
    "airtable",
    "lattice",
    "rippling",
    "deel",
    "hubspot",
    # Cloud / data
    "datadog",
    "cloudflare",
    "mongodb",
    "snowflake",
    "cockroachlabs",
    # AI / ML
    "scale",
    # Cybersecurity
    "crowdstrike",
    "lacework",
    # Health / biotech
    "flatiron",
    # Marketplace / logistics
    "doordash",
    "instacart",
    # Media / streaming
    "spotify",
    "twitch",
    "vimeo",
]

# Lever v0 public posting API (/v0/postings/{slug}) returns 404 for all tested
# companies as of June 2026 — the endpoint appears to be deprecated.
LEVER_SLUGS: list[str] = []

# Ashby boards — the boards are valid; data flows in automatically when roles open.
ASHBY_SLUGS: list[str] = [
    "openai",
    "cohere",
    "perplexity",
    "cursor",
    "anyscale",
    "replit",
    "modal",
    "linear",
    "letta",
    "codeium",
    "glean",
    "cognition",
    "imbue",
    "adept",
    "sierra",
    "contextual",
]
