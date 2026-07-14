export async function execute(args: { phase: "framework" | "report"; subject: string; data?: string }) {
  const { phase, subject, data } = args;

  if (phase === "framework") {
    return {
      success: true,
      message: `Framework requested for subject: "${subject}". Please construct a rigorous McKinsey/BCG-style analysis framework matching the chapter skeleton, data query requirements, and visualization plans as detailed in the skill instructions.`,
      subject,
    };
  }

  if (phase === "report") {
    if (!data) {
      throw new Error("Parameter 'data' is required when executing the 'report' phase.");
    }
    return {
      success: true,
      message: `Report compilation requested for subject: "${subject}". Please synthesize all collected facts and data into the final consulting-grade report structure, ensuring MECE division, structured tables, and strategic insights.`,
      subject,
      dataLength: data.length,
    };
  }

  throw new Error(`Unsupported phase: ${phase}`);
}
