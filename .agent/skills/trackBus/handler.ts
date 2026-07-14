import { TaskRegistry } from "../../../src/core/TaskRegistry";

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new Error("Task cancelled"));
    }, { once: true });
  });
}

async function fetchArrivals(
  stopCode: string,
  ltaKey: string
): Promise<{ serviceNo: string; next: string | null; next2: string | null; load: string }[]> {
  const res = await fetch(
    `https://datamall2.mytransport.sg/ltaodataservice/BusArrivalv2?BusStopID=${stopCode}`,
    { headers: { AccountKey: ltaKey, accept: "application/json" } }
  );
  if (!res.ok) return [];

  const data = (await res.json()) as any;
  const getMins = (estArrival: string) => {
    if (!estArrival) return null;
    const diff = new Date(estArrival).getTime() - Date.now();
    const mins = Math.ceil(diff / 60000);
    return mins <= 0 ? "Arr" : `${mins}m`;
  };

  return (data.Services || []).map((s: any) => ({
    serviceNo: s.ServiceNo,
    next: getMins(s.NextBus?.EstimatedArrival),
    next2: getMins(s.NextBus2?.EstimatedArrival),
    load: s.NextBus?.Load || "",
  }));
}

function formatUpdate(
  stopCode: string,
  stopLabel: string,
  services: { serviceNo: string; next: string | null; next2: string | null; load: string }[],
  filterService?: string
): string {
  const loadEmoji: Record<string, string> = { SEA: "🟢", SDA: "🟡", LSD: "🔴" };
  const filtered = filterService
    ? services.filter((s) => s.serviceNo === filterService)
    : services;

  if (filtered.length === 0) {
    return `🚌 **Bus Stop ${stopCode}** (${stopLabel})\n_No services currently available._`;
  }

  const lines = filtered.map((s) => {
    const load = loadEmoji[s.load] || "";
    const eta2 = s.next2 ? ` · ${s.next2}` : "";
    return `• Bus **${s.serviceNo}**: ${s.next ?? "—"}${eta2} ${load}`;
  });

  return `🚌 **Bus Stop ${stopCode}** — ${stopLabel}\n${lines.join("\n")}`;
}

export async function execute(
  args: {
    busStopId: string;
    serviceNo?: string;
    intervalSeconds?: number;
    maxMinutes?: number;
    stopName?: string;
  },
  context?: { chatId: string }
) {
  const ltaKey = process.env.LTA_ACCOUNT_KEY;
  if (!ltaKey) throw new Error("LTA_ACCOUNT_KEY is not configured.");

  const chatId = context?.chatId || "default_cli_chat";
  const {
    busStopId,
    serviceNo,
    intervalSeconds = 60,
    maxMinutes = 20,
    stopName,
  } = args;

  // Resolve stop name if not provided
  let stopLabel = stopName || busStopId;
  if (!stopName) {
    try {
      const res = await fetch(
        `https://datamall2.mytransport.sg/ltaodataservice/BusStops?$skip=0`,
        { headers: { AccountKey: ltaKey, accept: "application/json" } }
      );
      // Quick search in first batch (500 stops) — good enough for common stops
      if (res.ok) {
        const data = (await res.json()) as any;
        const match = (data.value || []).find((s: any) => s.BusStopCode === busStopId);
        if (match) stopLabel = `${match.Description}, ${match.RoadName}`;
      }
    } catch (_) { /* fallback to code */ }
  }

  const intervalMs = Math.max(15, intervalSeconds) * 1000;
  const maxMs = Math.max(1, maxMinutes) * 60 * 1000;
  const serviceLabel = serviceNo ? `Bus ${serviceNo} at` : "all buses at";
  const description = `Tracking ${serviceLabel} stop ${busStopId} every ${intervalSeconds}s for up to ${maxMinutes}m`;

  const taskRegistry = TaskRegistry.getInstance();

  const taskId = await taskRegistry.startTask(chatId, description, async (signal) => {
    const startTime = Date.now();
    let pollCount = 0;
    let arrivedDetected = false;

    while (!signal.aborted && Date.now() - startTime < maxMs) {
      pollCount++;
      const services = await fetchArrivals(busStopId, ltaKey);
      const message = formatUpdate(busStopId, stopLabel, services, serviceNo);

      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.ceil((maxMs - (Date.now() - startTime)) / 60000);
      const footer = `\n_Poll #${pollCount} · ${elapsed}s elapsed · stops in ~${remaining}m_`;

      await taskRegistry.sendUpdate(chatId, message + footer);

      // Auto-stop if the tracked bus is showing "Arr" (arrived)
      if (serviceNo) {
        const tracked = services.find((s) => s.serviceNo === serviceNo);
        if (tracked?.next === "Arr") {
          arrivedDetected = true;
          await taskRegistry.sendUpdate(
            chatId,
            `✅ Bus **${serviceNo}** has arrived at stop ${busStopId}! Tracking stopped.`
          );
          break;
        }
      }

      // Adaptive interval — tighten polling when bus is close
      let nextSleep = intervalMs;
      if (serviceNo) {
        const tracked = services.find((s) => s.serviceNo === serviceNo);
        if (tracked?.next) {
          const mins = parseInt(tracked.next);
          if (!isNaN(mins)) {
            if (mins <= 2) nextSleep = 15_000;
            else if (mins <= 5) nextSleep = 30_000;
          }
        }
      }

      await sleep(nextSleep, signal);
    }

    return arrivedDetected
      ? `Bus ${serviceNo} arrived at stop ${busStopId} after ${pollCount} polls.`
      : `Tracking session ended after ${pollCount} polls (${maxMinutes}m max reached).`;
  });

  return {
    success: true,
    taskId,
    message: `🚌 Now tracking **stop ${busStopId}** (${stopLabel})${serviceNo ? ` for Bus **${serviceNo}**` : ""}.\nPolling every **${intervalSeconds}s** for up to **${maxMinutes} minutes**.\n\nSend \`/cancel ${taskId}\` to stop tracking early.`,
  };
}
