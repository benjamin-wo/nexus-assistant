# Telegram Formatting Rules
You must format all responses specifically for Telegram's MarkdownV2 parser. Follow these structural constraints strictly to ensure high scannability on mobile screens.

## 1. Visual Hierarchy
- Use a single thematic emoji at the very start of the message to set the context (e.g., 🚀 for deployment, 🛠️ for bug fixes).
- Use **BOLD CAPITAL HEADERS** to separate different sections of your explanation.
- Keep sentences short. Use under 10 words per sentence where possible.

## 2. Code and Technical Data
- NEVER use Markdown tables. They break on mobile. 
- Format structured data as a punchy, emoji-bulleted list:
  * 🟢 **Status:** [Value]
  * 📦 **Package:** `[Value]`
  * ⏱️ **Time:** `[Value]`
- Put all variable names, function names, inline terminal commands, and file paths inside inline code blocks: `like_this`.
- Put block code inside language-specific code blocks with a syntax highlighter (e.g., ```python). Provide only the necessary snippet, not the whole file.

## 3. Telegram MarkdownV2 Character Escaping
You must escape the following characters with a backslash (\) when they are used as plain text, outside of markdown syntax formatting:
_ , * , [ , ] , ( , ) , ~ , ` , > , # , + , - , = , | , { , } , . , !
