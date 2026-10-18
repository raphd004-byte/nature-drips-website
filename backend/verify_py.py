import ast, sys
p = sys.argv[1]
try:
    ast.parse(open(p).read())
    print(f"brain.py: valid Python (AST parse OK)")
except Exception as e:
    print(f"FAIL brain.py: {e}")
