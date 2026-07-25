from __future__ import annotations


EXPECTED_BASES = (
    "python:3.14-alpine@sha256:"
    "26730869004e2b9c4b9ad09cab8625e81d256d1ce97e72df5520e806b1709f92",
    "node:26-alpine@sha256:"
    "e88a35be04478413b7c71c455cd9865de9b9360e1f43456be5951032d7ac1a66",
    "python:3.14-alpine@sha256:"
    "26730869004e2b9c4b9ad09cab8625e81d256d1ce97e72df5520e806b1709f92",
)
JOB_ORDER = (
    "validate",
    "qualify",
    "publish-image",
    "prepare-release-bundle",
    "attest",
    "release",
)
JOB_PERMISSIONS = {
    "validate": {"contents": "read"},
    "qualify": {"contents": "read"},
    "publish-image": {"actions": "read", "contents": "read", "packages": "write"},
    "prepare-release-bundle": {"actions": "read", "contents": "read"},
    "attest": {
        "actions": "read",
        "attestations": "write",
        "contents": "read",
        "id-token": "write",
        "packages": "write",
    },
    "release": {"actions": "read", "contents": "write"},
}
JOB_NEEDS = {
    "validate": (),
    "qualify": ("validate",),
    "publish-image": ("validate", "qualify"),
    "prepare-release-bundle": ("validate", "qualify", "publish-image"),
    "attest": ("validate", "publish-image", "prepare-release-bundle"),
    "release": (
        "validate",
        "qualify",
        "publish-image",
        "prepare-release-bundle",
        "attest",
    ),
}
STEP_ORDER = {
    "validate": (
        "Check out the exact tag",
        "Validate tag, source versions, commit, and main ancestry",
        "Read back immutable release prerequisites",
        "Validate immutable-release workflow policy",
    ),
    "qualify": (
        "Check out validated source commit",
        "Prepare qualification directory",
        "Set up pinned Buildx and BuildKit",
        "Build final OCI image once",
        "Capture immutable local image identity",
        "Verify image identity labels by immutable ID",
        "Scan qualified image for release-blocking vulnerabilities",
        "Preserve a failed vulnerability report",
        "Generate SPDX JSON SBOM from qualified image",
        "Generate CycloneDX JSON SBOM from qualified image",
        "Package exact committed source",
        "Export qualified image by immutable ID",
        "Seal qualification evidence",
        "Upload sealed qualification evidence",
    ),
    "publish-image": (
        "Download sealed qualification evidence",
        "Verify qualification evidence and load exact image",
        "Revalidate exact release-tag protection",
        "Authenticate to GHCR",
        "Revalidate remote tag and publish qualified image",
    ),
    "prepare-release-bundle": (
        "Check out validated source commit",
        "Download sealed qualification evidence",
        "Verify qualification evidence",
        "Create immutable release evidence",
        "Upload qualified release bundle",
    ),
    "attest": (
        "Download qualified release bundle",
        "Verify release checksums without executing repository code",
        "Authenticate to GHCR for registry attestations",
        "Attest immutable image provenance",
        "Attest SPDX SBOM to the immutable image",
        "Attest CycloneDX SBOM to the immutable image",
        "Attest release files from checksums",
    ),
    "release": (
        "Download qualified release bundle",
        "Verify exact release identity and checksums",
        "Revalidate exact release-tag protection",
        "Refuse an existing GitHub release",
        "Revalidate protected tag and create immutable prerelease",
    ),
}
EXPECTED_ACTIONS = {
    "actions/attest": "f7c74d28b9d84cb8768d0b8ca14a4bac6ef463e6",
    "actions/attest-build-provenance": "0f67c3f4856b2e3261c31976d6725780e5e4c373",
    "actions/checkout": "3d3c42e5aac5ba805825da76410c181273ba90b1",
    "actions/download-artifact": "3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c",
    "actions/upload-artifact": "043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
    "anchore/sbom-action": "e22c389904149dbc22b58101806040fa8d37a610",
    "aquasecurity/trivy-action": "ed142fd0673e97e23eac54620cfb913e5ce36c25",
    "docker/build-push-action": "53b7df96c91f9c12dcc8a07bcb9ccacbed38856a",
    "docker/login-action": "abd2ef45e78c5afb21d64d4ca52ee8550d9572c7",
    "docker/setup-buildx-action": "bb05f3f5519dd87d3ba754cc423b652a5edd6d2c",
}

# Generated from reviewed structural nodes. A policy-relevant workflow change
# requires intentional source review plus corresponding contract/test updates.
EXPECTED_JOB_CONFIG_FINGERPRINTS = {
    "validate": "0407b6e42b222ed6ae4338bd121ae4c16da1b1836db2f4b1d396453d5c9b00f2",
    "qualify": "6a35dc19a0530579014504da1b78c1ce22745f2cc946a660b787c87d4b933e54",
    "publish-image": "b6f4ce65986deaf11b2b89283b57913ee2bf0861472a78740e5146fe409290b1",
    "prepare-release-bundle": "2ec71e85ffc1393dc374dfc3fd7f9920a2774b0b3db063a6cb3a8a1a7f682680",
    "attest": "9f2174e18d2a3a2dcbfb09263b49b74a7d87d10237617346f53ce27e70f00228",
    "release": "dbf8458f96ac56e75d323f5e90de3629ee834d5f6617aa46b611f516f07349b5",
}
EXPECTED_STEP_FINGERPRINTS = {
    "validate": {
        "Check out the exact tag": "0cf6ed8bdeccf60e185eb387e786d58752a5978ec209d9aa20b4d0d8f70c4530",
        "Validate tag, source versions, commit, and main ancestry": "1d4eb6f0e659f7e3941f4201ffb7693965b1d3ff820c8c2d42337834b4eea03d",
        "Read back immutable release prerequisites": "fa9d6378a364b5df501d09e74a136d508951691944293d82fc5fceb2aa97241d",
        "Validate immutable-release workflow policy": "6799bfff9b787a6466a22c7212318e3267cfec843602e17bedddc01ea0a66fcc",
    },
    "qualify": {
        "Check out validated source commit": "163988c94142f5a147f05fcb0878c494755d67154058fa9cb657cca86b0a7d1b",
        "Prepare qualification directory": "d9c3a56af5650c1b78bd634f21d0053c55e07b51b22078582770bbb339a3ae3b",
        "Set up pinned Buildx and BuildKit": "dd0f9564522285c962c4da6a2138beb2ba82814315e7d0d4dee7703dfdc62374",
        "Build final OCI image once": "fc63025689a387c35bf2f4bd19daa58d4bab267661e1a5bf6af2da4af5ecbd71",
        "Capture immutable local image identity": "550ab116bc3f1e5b6b272803388d0a8f96738817f5ac8bf25b53c32fafe70563",
        "Verify image identity labels by immutable ID": "24aded60a91a4471f8af7ab00a6eabdc68963bbb7ccff9a6838b5cdd422600a4",
        "Scan qualified image for release-blocking vulnerabilities": "3f04a13f11f98c3cd434f874cfada1b21374fb3ebd9c4c957ce4ef0876951b63",
        "Preserve a failed vulnerability report": "864203da04e8b9b4b1e5df0ae71212b1126dfb897b4d2eae1f95f8d84e69a1f4",
        "Generate SPDX JSON SBOM from qualified image": "51bda2434940b42351211629104c696efa9f9c953419537890dc3441671ad615",
        "Generate CycloneDX JSON SBOM from qualified image": "215cb8992805a8773e08cce74036feb160307f48ff89d8696fe3b4b07cb67ce7",
        "Package exact committed source": "ab53b1b458d3069c74eb97c23fc0a6c67bb52dd020c4451f52b1e518adb48a6f",
        "Export qualified image by immutable ID": "8814439e25e1a71996d14606631c2230fa33c16b5d3f7cd8196827e2cc59f514",
        "Seal qualification evidence": "4a5607adde2eea58d7397476aa190a574b4a4ab9b3e9bce342e1397bf69574fc",
        "Upload sealed qualification evidence": "45e265d295f4972260c26bd13dc11cbe8e88f39ae9ea602047accc63bea551f4",
    },
    "publish-image": {
        "Download sealed qualification evidence": "5d8f73ed29fb5d67c619dfafa3d6b76dcede1f08ae81efa11058a9bbe07d9192",
        "Verify qualification evidence and load exact image": "bb742073cc12eace28dd59b188ca10a2be4d0690fb3fe28b720dcf5a81285b92",
        "Revalidate exact release-tag protection": "d7b60c7fc6aa5758a374d351368481e66b6766f4bd29375b0ee94b87dc70f1a3",
        "Authenticate to GHCR": "64b9732298127cf22516a3b78ff57596a33d8be383778a984720fff95b55ad56",
        "Revalidate remote tag and publish qualified image": "643ae97e4eddc7dd20cb1ca0cd5fdb1999ad458b513c722cf4f150469dfa91c0",
    },
    "prepare-release-bundle": {
        "Check out validated source commit": "163988c94142f5a147f05fcb0878c494755d67154058fa9cb657cca86b0a7d1b",
        "Download sealed qualification evidence": "5d8f73ed29fb5d67c619dfafa3d6b76dcede1f08ae81efa11058a9bbe07d9192",
        "Verify qualification evidence": "8d39cd24973fa128aa9cff1b40a03d19c09da01052a0d4e3d4e30853922d5642",
        "Create immutable release evidence": "7d334beaad74e585b2484897719ee155e6c1ea5e97ea24f14fc0aa526f23c8b1",
        "Upload qualified release bundle": "1665848924f2104b7ce0aa36bb838f7987bbf30cef8de730eb0766f530f11603",
    },
    "attest": {
        "Download qualified release bundle": "4e8aa77df1816c65e17b2ff62f3c0991d2a23c4bbb998c43c399619f3274cefe",
        "Verify release checksums without executing repository code": "b9e7662366afd581345c59fa27a3c364ddee2229e1fd51dfe62b1fb74a0adae9",
        "Authenticate to GHCR for registry attestations": "64b9732298127cf22516a3b78ff57596a33d8be383778a984720fff95b55ad56",
        "Attest immutable image provenance": "a70e6c95b5c775effd00e865edafde1e4d36832bd84df6ea2c72d202fc120ad8",
        "Attest SPDX SBOM to the immutable image": "c39dc5a06b8be3546960c0eae0ba8755ffded593682451d80f472aea196b583a",
        "Attest CycloneDX SBOM to the immutable image": "7d2b01eafaa7bb6582cd99373ea582d71c15e74f90501ed2e8ea55d28cf1b75e",
        "Attest release files from checksums": "3374bf13aafdd9b46345aa96a957517f87fb5f4d30449f795eed0cf9e0e4bbd9",
    },
    "release": {
        "Download qualified release bundle": "4e8aa77df1816c65e17b2ff62f3c0991d2a23c4bbb998c43c399619f3274cefe",
        "Verify exact release identity and checksums": "dd2b67d5d98d0eb904b2efec3b31d77faac4fa1b02c2319df911c62422f08f0d",
        "Revalidate exact release-tag protection": "d7b60c7fc6aa5758a374d351368481e66b6766f4bd29375b0ee94b87dc70f1a3",
        "Refuse an existing GitHub release": "1a06728602e4e73ca66fd1c7c69ad929dc3434a72d4a5c528007d8b69e83bda9",
        "Revalidate protected tag and create immutable prerelease": "94a07827de46a3520b7824475cdbbfe0958ad73110e2a44ab97679c52dfceeab",
    },
}
