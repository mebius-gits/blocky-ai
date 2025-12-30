from parser import parse_document
import json

sample_doc = """
score_name: SampleScore
variables:
  age: int
  has_disease: boolean
rules:
  - if: age >= 65
    add: 1
  - if: has_disease == true
    add: 2
"""

try:
    ast = parse_document(sample_doc)
    print(json.dumps(ast, indent=2))
except Exception as e:
    print(f"Error: {e}")
