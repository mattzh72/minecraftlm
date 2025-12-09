"""
Tests for code validator
"""

import pytest

from app.services.validator import CodeValidator


def test_validate_valid_code():
    """Test that valid code passes validation"""
    code = """
x = 10
y = 20
result = x + y
structure = {"blocks": [], "size": {"x": result, "y": 1, "z": 1}}
"""
    result = CodeValidator.validate_code(code)
    assert result.is_valid
    assert result.error is None
    assert result.structure is not None
    assert result.structure["size"]["x"] == 30


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
    code = """
def add(a, b):
    return a + b

result = add(5, 10)
structure = {"blocks": [], "result": result}
"""
    result = CodeValidator.validate_code(code)
    assert result.is_valid
    assert result.structure["result"] == 15


def test_validate_with_imports():
    """Test that basic imports work"""
    code = """
import math
result = math.sqrt(16)
structure = {"blocks": [], "sqrt_result": result}
"""
    result = CodeValidator.validate_code(code)
    assert result.is_valid
    assert result.structure["sqrt_result"] == 4.0


def test_validate_multiline_string():
    """Test code with multiline strings"""
    code = '''
message = """
This is a multiline
string for testing
"""
structure = {"blocks": [], "message": message}
'''
    result = CodeValidator.validate_code(code)
    assert result.is_valid
    assert "multiline" in result.structure["message"]
