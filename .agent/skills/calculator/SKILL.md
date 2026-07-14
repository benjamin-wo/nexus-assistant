---
name: calculator
description: Safely evaluates simple mathematical expressions (addition, subtraction, multiplication, division, parentheses).
parameters:
  type: object
  properties:
    expression:
      type: string
      description: The mathematical expression to evaluate (e.g., "(120 + 35) * 4").
  required:
    - expression
---
Use this tool for all arithmetic, percentages, interest rates, and budget calculations. 
Do not contain variables or alphabetic characters (except standard math functions if needed).
