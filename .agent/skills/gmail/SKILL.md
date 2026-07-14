---
name: gmail
description: Accesses the user's Gmail to list, read, or send emails.
parameters:
  type: object
  properties:
    action:
      type: string
      enum: [listEmails, getEmail, sendEmail]
      description: "The action to perform: 'listEmails' to search/list recent messages, 'getEmail' to fetch full content of a specific email, or 'sendEmail' to compose and send a new email."
    q:
      type: string
      description: "Optional for 'listEmails'. Search query string (Gmail format, e.g., 'from:boss' or 'is:unread')."
    messageId:
      type: string
      description: "Required for 'getEmail' action. The unique ID of the target Gmail message."
    to:
      type: string
      description: "Required for 'sendEmail' action. The recipient email address."
    subject:
      type: string
      description: "Required for 'sendEmail' action. The email subject line."
    body:
      type: string
      description: "Required for 'sendEmail' action. The plain text content of the email."
  required:
    - action
---
Use this skill when the user asks to check their emails, look up a message, read details of an email, or send a new email.
If the tool returns a NOT_AUTHENTICATED error, output the auth URL link directly to the user so they can authenticate.
