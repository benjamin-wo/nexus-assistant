---
name: reminder
description: Schedules a background notification or alarm event.
parameters:
  type: object
  properties:
    duration:
      type: string
      description: You can pass an absolute ISO date string OR a relative time (e.g. `5 minutes`).
        If using relative time, it accepts format: `[number] [unit]`, where unit is `s`, `m`, `h`, `d`.

        Examples of `duration`:
        - `10 minutes`
        - `2 hours`
        - `3 days`
        - `2026-10-28T09:00:00Z` (absolute ISO date).
    message:
      type: string
      description: The reminder alert text content.
  required:
    - duration
    - message
---
Use this tool when users ask to set reminders, alerts, alarms, or timers.
Confirm the precise scheduled execution time with the user.
