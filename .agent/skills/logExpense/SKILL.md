---
name: logExpense
description: Logs a new transaction expense directly into the database.
parameters:
  type: object
  properties:
    amount:
      type: number
      description: The numeric value of the expense (e.g. 14.50).
    category:
      type: string
      description: A single-word category (e.g. Food, Transport, Entertainment, Shopping, Bills, Others).
    description:
      type: string
      description: What the expense was for (e.g. Lunch at Subway).
    date:
      type: string
      description: "Optional. Date of the transaction in YYYY-MM-DD format (e.g. 2026-07-13). Defaults to today if not provided."
  required:
    - amount
    - category
    - description
---
Use this skill whenever the user asks to log, track, record, or add an expense. Parse the amount, select an appropriate category, and extract the descriptive text.
