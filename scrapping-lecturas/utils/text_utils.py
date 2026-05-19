"""HTML-to-plaintext conversion and text normalization utilities."""

import html
import re

from bs4 import Tag


def html_to_plain(element: Tag, prose: bool = False) -> str:
    """
    Convert a BeautifulSoup element to clean plaintext.

    - prose=False (default): <br> → newline (for structured text like poetry/verses)
    - prose=True: <br> → space (for flowing paragraph text where <br> is a CMS artifact)
    - Strips all remaining HTML tags
    - Normalizes whitespace
    - Unescapes HTML entities (&amp; → &, etc.)
    """
    br_replacement = " " if prose else "\n"
    for br in element.find_all("br"):
        br.replace_with(br_replacement)

    text = element.get_text(separator="")

    if prose:
        # Collapse any internal whitespace runs (including stray \n) to a single space
        text = re.sub(r"[ \t]*\n[ \t]*", " ", text)
        text = re.sub(r" {2,}", " ", text)
    else:
        # Collapse more than 2 consecutive newlines
        text = re.sub(r"\n{3,}", "\n\n", text)
        # Strip leading/trailing whitespace on each line
        lines = [line.strip() for line in text.splitlines()]
        text = "\n".join(lines)

    return html.unescape(text.strip())


def join_paragraphs(paragraphs: list[str]) -> str:
    """Join a list of paragraph strings with double newlines."""
    return "\n\n".join(p.strip() for p in paragraphs if p.strip())
