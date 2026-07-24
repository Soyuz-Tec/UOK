from __future__ import annotations


def assert_intelligence_manifest(
    manifests: dict[str, dict[str, object]],
) -> None:
    intelligence = manifests["intelligence.core"]
    assert intelligence["required"] is False
    assert intelligence["kind"] == "capability_module"
    assert intelligence["dependencies"] == ["shipments.core"]
    assert intelligence["api_prefixes"] == ["/api/intelligence"]
    assert intelligence["permissions"] == ["intelligence.read"]
    assert intelligence["commands"] == []
    assert intelligence["events"] == []
    assert intelligence["owned_tables"] == []
    assert (
        intelligence["api_router"]
        == "uok_intelligence_core.public_api:api_router"
    )
    assert (
        intelligence["role_grants"]
        == "uok_intelligence_core.public_api:role_grants"
    )
    assert "model_exports" not in intelligence
    assert (
        intelligence["candidate_verifier_script"]
        == "modules/intelligence.core/verify/UokCandidateShipmentReadiness.ps1"
    )
    assert (
        intelligence["candidate_verifier_function"]
        == "Invoke-UokShipmentReadinessCandidateScenario"
    )


__all__ = ["assert_intelligence_manifest"]
