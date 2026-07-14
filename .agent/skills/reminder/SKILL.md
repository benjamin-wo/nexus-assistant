---
name: reminder
description: Schedules a background notification or alarm event.
parameters:
  type: object
  properties:
    duration:
      type: string
      description: Relative offset offset until the reminder (e.g., "5 minutes", "30 seconds", "1 hour", "1 day").
    message:
      type: string
      description: The reminder alert text content.
  required:
    - duration
    - message
---
Use this tool when users ask to set reminders, alerts, alarms, or timers.
Confirm the precise scheduled execution time with the user.
