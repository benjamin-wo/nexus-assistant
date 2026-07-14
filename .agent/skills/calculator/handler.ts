export async function execute(args: { expression: string }) {
  const { expression } = args;

  // Clean the expression of whitespace
  const sanitized = expression.replace(/\s+/g, "");

  // Safe check: Only allow digits, decimals, basic operators, and parentheses
  if (!/^[0-9+\-*/().]+$/.test(sanitized)) {
    throw new Error("Invalid characters in expression. Only numbers and operators (+, -, *, /, .) are allowed.");
  }

  // Double-check no malicious JavaScript properties can be accessed (e.g. __proto__, constructor)
  if (sanitized.includes("__") || sanitized.includes("constructor") || sanitized.includes("prototype")) {
    throw new Error("Invalid expression structure.");
  }

  try {
    // Evaluate safely since string is strictly validated
    const result = new Function(`return (${sanitized})`)();
    if (typeof result !== "number" || isNaN(result) || !isFinite(result)) {
      throw new Error("Expression did not resolve to a valid number.");
    }
    return {
      expression,
      result,
    };
  } catch (error: any) {
    throw new Error(`Math evaluation error: ${error.message}`);
  }
}
