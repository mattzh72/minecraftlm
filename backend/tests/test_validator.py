"""
Tests for code validator
"""

import pytest

from app.services.validator import CodeValidator


# Helper to create valid structure dict for tests
VALID_STRUCTURE = '{"width": 1, "height": 1, "depth": 1, "blocks": []}'


def test_validate_valid_code():
    """Test that valid code passes validation"""
    code = f"""
x = 10
y = 20
result = x + y
print(result)
structure = {VALID_STRUCTURE}
"""
    result = CodeValidator.validate_code(code)
    assert result.is_valid
    assert result.error is None
    assert result.structure is not None


def test_validate_syntax_error():
    """Test that syntax errors are caught"""
    code = """
def broken_function(
    print("Missing closing paren")
"""
    result = CodeValidator.validate_code(code)
    assert not result.is_valid
    assert "Syntax error" in result.error
    assert result.error_line is not None


def test_validate_execution_error():
    """Test that execution errors are caught"""
    code = """
x = 10
y = 0
result = x / y  # Division by zero
"""
    result = CodeValidator.validate_code(code)
    assert not result.is_valid
    assert "Execution error" in result.error
    assert "ZeroDivisionError" in result.error


def test_validate_undefined_variable():
    """Test that undefined variable errors are caught"""
    code = """
print(undefined_variable)
"""
    result = CodeValidator.validate_code(code)
    assert not result.is_valid
    assert "NameError" in result.error


def test_validate_with_function_definition():
    """Test that function definitions work"""
    code = f"""
def add(a, b):
    return a + b

result = add(5, 10)
<<<<<<< HEAD
structure = {"width": result, "height": 1, "depth": 1, "blocks": []}
=======
structure = {VALID_STRUCTURE}
>>>>>>> main
"""
    result = CodeValidator.validate_code(code)
    assert result.is_valid
    assert result.structure["width"] == 15


def test_validate_with_imports():
    """Test that basic imports work"""
    code = f"""
import math
result = math.sqrt(16)
<<<<<<< HEAD
structure = {"width": int(result), "height": 1, "depth": 1, "blocks": []}
=======
structure = {VALID_STRUCTURE}
>>>>>>> main
"""
    result = CodeValidator.validate_code(code)
    assert result.is_valid
    assert result.structure["width"] == 4


def test_validate_multiline_string():
    """Test code with multiline strings"""
    code = f'''
message = """
This is a multiline
string for testing
"""
print(message)
<<<<<<< HEAD
structure = {"width": 1, "height": 1, "depth": 1, "blocks": []}
=======
structure = {VALID_STRUCTURE}
>>>>>>> main
'''
    result = CodeValidator.validate_code(code)
    assert result.is_valid


<<<<<<< HEAD
def test_validate_missing_structure():
    """Test that missing structure variable is caught"""
    code = """
x = 10
y = 20
result = x + y
=======
def test_validate_missing_structure_variable():
    """Test that code without structure variable fails"""
    code = """
x = 10
y = 20
>>>>>>> main
"""
    result = CodeValidator.validate_code(code)
    assert not result.is_valid
    assert "structure" in result.error.lower()
