"""HTML-to-plaintext conversion and text normalization utilities."""

import html
import re

from bs4 import Tag


def html_to_plain(element: Tag) -> str:
    """
    Convert a BeautifulSoup element to clean plaintext.

    - Replaces <br> tags with newlines
    - Strips all remaining HTML tags
    - Normalizes whitespace (collapses multiple blank lines)
    - Unescapes HTML entities (&amp; → &, etc.)
    """
    # Replace <br> with newline before stripping
    for br in element.find_all("br"):
        br.replace_with("\n")

    text = element.get_text(separator="\n")

    # Collapse more than 2 consecutive newlines
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Strip leading/trailing whitespace on each line
    lines = [line.strip() for line in text.splitlines()]
    text = "\n".join(lines)

    # Remove leading/trailing blank lines
    text = text.strip()

    return html.unescape(text)


def join_paragraphs(paragraphs: list[str]) -> str:
    """Join a list of paragraph strings with double newlines."""
    return "\n\n".join(p.strip() for p in paragraphs if p.strip())
