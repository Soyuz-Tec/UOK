from __future__ import annotations

import os

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import APP_VERSION, TARGET_VERSION
from .kernel_models import GovernanceRule, Membership, ModuleRecord, Organization, SchemaVersion, User
from .modules import module_catalog
from .util import dumps, hash_password

ORG_NAME = "UOK Local Sandbox"


DEMO_USER_CONFIG = [
    ("admin", "UOK_DEMO_ADMIN_PASSWORD", "admin", "Platform Admin", "platform_admin"),
    ("ops", "UOK_DEMO_OPS_PASSWORD", "ops123", "Operations Manager", "ops_manager"),
    ("trader", "UOK_DEMO_TRADER_PASSWORD", "trader123", "Trader", "trader"),
    ("finance", "UOK_DEMO_FINANCE_PASSWORD", "finance123", "Finance Manager", "finance_manager"),
    ("viewer", "UOK_DEMO_VIEWER_PASSWORD", "viewer123", "Read Only Viewer", "viewer"),
]


def _local_defaults_allowed() -> bool:
    return os.getenv("UOK_ALLOW_INSECURE_LOCAL_DEFAULTS", "0") == "1"


def _demo_password(env_name: str, fallback: str) -> str:
    value = os.getenv(env_name)
    if value:
        return value
    if _local_defaults_allowed():
        return fallback
    raise RuntimeError(f"{env_name} must be set when local demo seeding is enabled")


def seed(db: Session) -> str:
    _ensure_schema_version(db)
    org = _ensure_organization(db)
    _ensure_demo_users(db, org)
    _ensure_required_modules(db, org)
    _ensure_governance_rules(db, org)
    db.commit()
    return org.id


def _ensure_schema_version(db: Session) -> None:
    if not db.get(SchemaVersion, TARGET_VERSION):
        db.add(SchemaVersion(version=TARGET_VERSION, note="Initial baseline with one active migration baseline."))


def _ensure_organization(db: Session) -> Organization:
    org = db.scalar(select(Organization).where(Organization.name == ORG_NAME))
    if org:
        return org
    org = Organization(name=ORG_NAME)
    db.add(org)
    db.flush()
    return org


def _ensure_demo_users(db: Session, org: Organization) -> None:
    reset_demo_passwords = os.getenv("UOK_RESET_DEMO_PASSWORDS", "1") == "1"
    for username, password_env, fallback_password, display_name, role in DEMO_USER_CONFIG:
        password = _demo_password(password_env, fallback_password)
        user = db.scalar(select(User).where(User.username == username))
        if not user:
            user = User(username=username, password_hash=hash_password(password), display_name=display_name)
            db.add(user)
            db.flush()
        elif reset_demo_passwords:
            user.password_hash = hash_password(password)
            user.display_name = display_name
        membership = db.scalar(select(Membership).where(
            Membership.organization_id == org.id,
            Membership.user_id == user.id,
            Membership.role == role,
        ))
        if not membership:
            db.add(Membership(organization_id=org.id, user_id=user.id, role=role))


def _ensure_required_modules(db: Session, org: Organization) -> None:
    for module in module_catalog().values():
        if not module.get("required"):
            continue
        existing = db.scalar(select(ModuleRecord).where(ModuleRecord.organization_id == org.id, ModuleRecord.name == module["name"]))
        if not existing:
            db.add(ModuleRecord(
                organization_id=org.id,
                name=module["name"],
                kind=module["kind"],
                version=APP_VERSION,
                manifest_json=dumps(module),
            ))
        else:
            existing.kind = module["kind"]
            existing.version = APP_VERSION
            existing.status = "installed"
            existing.manifest_json = dumps(module)


def _ensure_governance_rules(db: Session, org: Organization) -> None:
    rules = [
        ("baseline.module_neutral.required", "architecture", "platform_admin"),
        ("apps.manager.bootstrap.required", "modules", "platform_admin"),
        ("module.lifecycle.boundary.required", "architecture", "platform_admin"),
        ("migration.initial_baseline.required", "release", "platform_admin"),
        ("baseline.evidence.required", "evidence", "ops_manager"),
    ]
    for rule_name, domain, owner_role in rules:
        existing = db.scalar(select(GovernanceRule).where(GovernanceRule.organization_id == org.id, GovernanceRule.rule_name == rule_name))
        if not existing:
            db.add(GovernanceRule(
                organization_id=org.id,
                rule_name=rule_name,
                domain=domain,
                owner_role=owner_role,
                details_json=dumps({"uok_version": APP_VERSION, "uok": True}),
            ))
