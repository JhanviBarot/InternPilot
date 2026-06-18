"""Smoke test: LLM router + embedding pipeline (no DB required).

Tests:
  1. Local embeddings — dim check + cosine similarity between related texts
  2. LLM router — generates a rich, grounded research cold email with real profile data

Run:  uv run python scripts/smoke_research_prep.py
"""
from __future__ import annotations

import asyncio
import math


async def smoke_embeddings() -> None:
    from app.llm.embeddings import embed, EMBEDDING_DIM

    texts = [
        "Machine learning intern PyTorch transformer fine-tuning NLP low-resource",
        "NLP research lab multilingual models transformer pre-training low-resource",
    ]
    print("=== Embedding Pipeline ===")
    print(f"  Model: all-MiniLM-L6-v2  |  dim: {EMBEDDING_DIM}")
    vectors = await embed(texts)
    assert len(vectors) == 2 and len(vectors[0]) == EMBEDDING_DIM

    v1, v2 = vectors[0], vectors[1]
    dot = sum(a * b for a, b in zip(v1, v2))
    mag = lambda v: math.sqrt(sum(x * x for x in v))  # noqa: E731
    cosine = dot / (mag(v1) * mag(v2))

    print(f"  Cosine similarity (related texts): {cosine:.4f}  [threshold > 0.30]")
    assert cosine > 0.30, f"Too low: {cosine}"
    print("  PASS\n")


PROFILE = """\
Name: Priya Sharma
University: IIT Delhi — B.Tech Computer Science, GPA 9.2/10, Final Year
Skills: Python, PyTorch, Hugging Face Transformers, scikit-learn, SQL, CUDA, mBART, adapter tuning
Research interests: low-resource NLP, multilingual machine translation, cross-lingual transfer learning

Experience:
- NLP Research Intern, IIIT Hyderabad (Jan–Dec 2024)
  Fine-tuned mBART-50 for Hindi→Marathi translation using back-translation augmentation.
  Reduced WER by 18% on Dravidian test set vs baseline. Submitted to ACL 2025 workshop.

Projects:
- MultiLingualQA: Cross-lingual question-answering system using adapter-tuned mBERT across 12 languages.
  Achieved 73.4 F1 on XQuAD zero-shot benchmark. Code open-sourced (210 GitHub stars).
- LowResourceMT: Back-translation pipeline for Hindi→Marathi with data augmentation.
  Built custom tokenizer for Devanagari script; dataset released publicly on HuggingFace.

Publications / Recognition:
- ACL 2025 workshop paper (under review): "Adapter Tuning for Low-Resource Dravidian NLP"
- Recipient of IIT Delhi Merit Scholarship 2022–2024
"""

OPPORTUNITY = """\
Professor: Prof. Tanvir Ahmed
Institution: IIT Delhi — Language Technology Lab
Research area: Low-resource NLP for Indic languages, cross-lingual transfer, multilingual pre-training
Current projects: NER for Hindi/Bengali/Tamil using transformers with limited labelled data,
                  multilingual speech-to-text for under-resourced Indian languages
Looking for: Students with hands-on transformer fine-tuning experience, ideally with Indic language data
"""


async def smoke_llm() -> None:
    from app.llm.router import complete

    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert career coach helping top CS students write highly personalized, "
                "concise cold emails to research professors. "
                "Rules: (1) Never use placeholder text like [Your Name] — use real details from the profile. "
                "(2) Reference SPECIFIC projects, papers, and metrics from the student profile. "
                "(3) Reference SPECIFIC ongoing work from the professor's lab. "
                "(4) Maximum 4 sentences in the email body. (5) Include a clear Subject line. "
                "(6) End with student's real name from the profile. "
                "Output ONLY the email — no preamble, no explanation."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Write a cold email from this student to this professor.\n\n"
                f"=== STUDENT PROFILE ===\n{PROFILE}\n\n"
                f"=== RESEARCH OPPORTUNITY ===\n{OPPORTUNITY}"
            ),
        },
    ]

    print("=== LLM Router — Research Cold Email ===")
    print("Provider chain: Gemini 2.5 Flash -> Groq Llama 3.3 70B -> OpenRouter\n")
    text = await complete(messages)
    print(text)
    print()

    # Quality checks
    assert "Priya" in text, "Must use real student name"
    assert any(kw in text for kw in ["mBART", "MultiLingualQA", "LowResourceMT", "adapter", "Dravidian"]), \
        "Must reference specific project"
    assert "[" not in text, f"Placeholder text found: {text}"
    print("Quality checks: real name [OK]  specific project [OK]  no placeholders [OK]\n")


async def main() -> None:
    await smoke_embeddings()
    await smoke_llm()
    print("=== All smoke tests passed ===")


if __name__ == "__main__":
    asyncio.run(main())
