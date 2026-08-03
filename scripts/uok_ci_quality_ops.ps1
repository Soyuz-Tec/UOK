function Invoke-UokCiQuality {
    Invoke-UokStep "Python lint" {
        Invoke-Native "python" @("-m", "ruff", "check", ".")
    }
    Invoke-UokStep "Python type policy" {
        Invoke-Native "python" @("-m", "mypy")
    }
    Invoke-UokStep "Sequential Python tests and coverage" {
        Invoke-Native "python" @("scripts/run_python_tests.py", "--coverage")
    }
    Invoke-UokStep "Offline database-security inventory" {
        Invoke-Native "python" @("scripts/verify_database_security.py")
    }
    Invoke-UokStep "Immutable-release workflow policy" {
        Invoke-Native "python" @("scripts/validate_release_workflow.py")
    }
    Push-Location web
    try {
        Invoke-UokStep "Frontend dependency policy" {
            Invoke-Native "npm" @("run", "check:dependencies")
        }
        Invoke-UokStep "Frontend ESLint" {
            Invoke-Native "npm" @("run", "lint")
        }
        Invoke-UokStep "Frontend Stylelint" {
            Invoke-Native "npm" @("run", "lint:styles")
        }
        Invoke-UokStep "Frontend Biome lint" {
            Invoke-Native "npm" @("run", "lint:biome")
        }
        Invoke-UokStep "Frontend quality formatting" {
            Invoke-Native "npm" @("run", "format:check")
        }
        Invoke-UokStep "Frontend type check" {
            Invoke-Native "npm" @("run", "typecheck")
        }
        Invoke-UokStep "Frontend tests" {
            Invoke-Native "npm" @("test")
        }
        Invoke-UokStep "Frontend coverage" {
            Invoke-Native "npm" @("run", "test:coverage")
        }
    } finally {
        Pop-Location
    }
}
