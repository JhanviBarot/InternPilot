"""Smoke test: LLM router + embedding pipeline (no DB required).

Tests:
  1. LLM fallback router — generates a cold-email research pitch via complete()
  2. Local embeddings — encodes two texts and checks cosine similarity

Run:  uv run python scripts/smoke_research_prep.py
"""
from __future__ import annotations

import asyncio
import math


async def smoke_llm() -> None:
    from app.llm.router import complete

    messages = [
        {"role": "system", "content": "You are an assistant helping CS students write cold emails to research professors. Be concise."},
        {"role": "user", "content": (
            "Write a 3-sentence cold email from a 3rd-year CS student interested in NLP research "
            "to Prof. Tanvir Ahmed at IIT Delhi's Language Technology Lab. "
            "The student has experience with PyTorch and transformer fine-tuning."
        )},
    ]
    print("=== LLM Router Smoke Test ===")
    print("Calling LLM (Gemini → Groq → OpenRouter fallback chain)…")
    text = await complete(messages)
    print(f"  Response ({len(text)} chars):\n")
    print("  " + text.replace("\n", "\n  "))
    print()


async def smoke_embeddings() -> None:
    from app.llm.embeddings import embed, EMBEDDING_DIM

    texts = [
        "Machine learning intern with PyTorch and transformer experience in NLP",
        "Natural language processing researcher specializing in multilingual models",
    ]
    print("=== Embedding Pipeline Smoke Test ===")
    print(f"  Model: all-MiniLM-L6-v2  |  dim: {EMBEDDING_DIM}")
    print("  Encoding 2 texts…")
    vectors = await embed(texts)
    assert len(vectors) == 2
    assert len(vectors[0]) == EMBEDDING_DIM

    # cosine similarity
    v1, v2 = vectors[0], vectors[1]
    dot = sum(a * b for a, b in zip(v1, v2))
    mag1 = math.sqrt(sum(a * a for a in v1))
    mag2 = math.sqrt(sum(b * b for b in v2))
    cosine = dot / (mag1 * mag2)

    print(f"  Text A: {texts[0][:60]}")
    print(f"  Text B: {texts[1][:60]}")
    print(f"  Cosine similarity: {cosine:.4f}  (>0.70 expected for semantically related texts)")
    assert cosine > 0.50, f"Similarity too low: {cosine}"
    print("  PASS\n")


async def main() -> None:
    await smoke_embeddings()
    await smoke_llm()
    print("=== All smoke tests passed ===")


if __name__ == "__main__":
    asyncio.run(main())
