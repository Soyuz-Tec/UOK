from __future__ import annotations

from typing import Any

from .models import Party


def person_summary(party: Party, attrs: dict[str, Any]) -> str:
    title = attrs.get("title")
    company = attrs.get("organization_name") or attrs.get("company_name")
    if title and company:
        return f"{party.display_name} is listed as {title} at {company}."
    if title:
        return f"{party.display_name} is listed as {title}."
    if company:
        return f"{party.display_name} is associated with {company}."
    return f"{party.display_name} is a person contact in UOK."


def organization_summary(party: Party, attrs: dict[str, Any]) -> str:
    website = attrs.get("website")
    if website:
        return f"{party.display_name} is an organization contact with website {website}."
    return f"{party.display_name} is an organization contact in UOK."


def domain_from_website(website: str) -> str:
    text = str(website).strip().lower()
    text = text.removeprefix("https://").removeprefix("http://").removeprefix("www.")
    return text.split("/", 1)[0]
