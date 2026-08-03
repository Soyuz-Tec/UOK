from __future__ import annotations

MAX_EMAIL_LENGTH = 254


def normalized_email(value: str) -> str:
    return value.strip().lower()


def is_valid_email(value: str) -> bool:
    if not value or len(value) > MAX_EMAIL_LENGTH:
        return False
    email = normalized_email(value)
    if not email or any(character.isspace() for character in email):
        return False
    local_part, separator, domain = email.partition("@")
    if not local_part or not separator or not domain or "@" in domain:
        return False
    domain_name, dot, top_level_label = domain.rpartition(".")
    return bool(domain_name and dot and top_level_label)
