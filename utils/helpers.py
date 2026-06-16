# utils/helpers.py

import re

STOPWORDS = {
    "the", "a", "an", "to", "in", "on", "for", "of", "and", "or", "is",
    "are", "with", "this", "that", "it", "fix", "issue", "task", "please",
    "need", "want", "make", "do", "my", "i", "we", "should", "can",
}


def extract_keywords(text: str) -> set:
    """Lowercase, strip punctuation, drop stopwords, return a set of tokens."""
    words = re.findall(r"[a-zA-Z0-9_.]+", text.lower())
    return {w for w in words if w not in STOPWORDS and len(w) > 1}
