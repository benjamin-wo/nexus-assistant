# nexus-assistant

A modular, self-evolving personal assistant built with Bun and TypeScript. Features an orchestrator-worker hierarchy, dynamic skill loading with hot-reloads, Telegram bot integration, background heartbeat reminders, and SQLite/Postgres persistence.

---

## 🏗️ System Architecture

Nexus Assistant splits the cognitive layer (prompts, rules, and skills) from the execution runtime code to ensure portability, security, and cleanliness.

```
                    ┌────────────────────────┐
                    │  User Input (TG / CLI) │
                    └───────────┬────────────┘
                                │
                                ▼
                     ┌──────────────────────┐
                     │  Orchestrator Router │
                     └──────────┬───────────┘
                                │
             ┌──────────────────┴──────────────────┐
             ▼                                     ▼
     Direct Response                         Spawn Worker Agent
    (Friendly Chitchat)                 (ReAct loop, max 5 turns)
                                                   │
                                          ┌────────┴────────┐
                                          ▼                 ▼
                                    Verify thoughts    Call skills
```

### 1. Orchestrator-Worker Hierarchy
- **Orchestrator (`src/core/Orchestrator.ts`)**: The coordinator. It evaluates user messages against `.agent/orchestrator.md` and routes queries by outputting a `<spawn>workerName</spawn>` tag, or replies directly.
- **Workers (`src/core/WorkerAgent.ts`)**: Spawned sub-agents loaded with focused profiles from `.agent/agents/` (e.g. `financialPlanner.md`, `searchNews.md`, `calendarManager.md`). They run ReAct loops executing specific subsets of skills.

### 2. Dynamic Skill Registry & Self-Evolution
- **Skill Registry (`src/core/SkillRegistry.ts`)**: Scans `.agent/skills/` folders. It parses `SKILL.md` frontmatter parameter schemas and dynamically imports `handler.ts` modules.
- **Self-Evolution (`.agent/skills/createSkill/`)**: A meta-skill that generates new tool directories at runtime, runs syntax compiling checks (`Bun.build`), and triggers in-memory cache hot-reloading (`reload()`).

### 3. Asynchronous & Non-Blocking Concurrency
- **Task Registry (`src/core/TaskRegistry.ts`)**: Spawns long-running tasks (e.g. crawls or calculations) as background Promises and returns an immediate receipt. 
- You can query running tasks (`status`), cancel them (`cancel task_id`), or continue chatting. The system alerts you via bot notifications when background tasks complete.

### 4. Heartbeat Scheduler (Secretary & DevOps)
- **Secretary Heartbeat**: Checks the database every 10 seconds for due reminders and pings the user proactively.
- **DevOps Self-Maintenance**: Reviews performance/error log tables every 12 hours. Spawns the `devops` worker to inspect logs, write diagnostic audits, or tune prompt instructions under `.agent/`.

---

## 📁 Repository Directory Structure

```
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── README.md
├── .agent/                   # Cognitive configurations
│   ├── orchestrator.md       # Master prompt router rules
│   ├── guardrails.md         # Sandbox and safety restrictions
│   ├── agents/               # Worker system instruction profiles
│   │   ├── financialPlanner.md
│   │   ├── searchNews.md
│   │   ├── calendarManager.md
│   │   ├── developer.md       # Worker that codes new skills
│   │   ├── devops.md          # Worker that audits log files
│   │   └── general.md
│   └── skills/               # Core dynamic skills (SKILL.md + handler.ts)
│       ├── createSkill/      # Meta-tool that builds new skills
│       ├── calculator/       # Safe math solver
│       ├── fileOps/          # Relative file manager
│       ├── weather/          # Forecast mock
│       ├── webScraper/       # Webpage HTML crawler
│       └── reminder/         # DB reminder creator
├── src/                      # TypeScript implementation
│   ├── cli.ts                # Terminal REPL runner
│   ├── telegram.ts           # Grammy Telegram Bot runner
│   ├── test_pipeline.ts      # Automated verification runner
│   ├── core/
│   │   ├── LlmService.ts     # Unified API client (Gemini/DeepSeek/OpenRouter)
│   │   ├── Orchestrator.ts
│   │   ├── WorkerAgent.ts
│   │   ├── SkillRegistry.ts
│   │   └── TaskRegistry.ts
│   ├── database/
│   │   ├── Storage.ts        # Database adapter (SQLite locally / PostgreSQL in prod)
│   │   └── schema.sql        # Reference SQL table definitions
│   └── services/
│       └── Scheduler.ts      # Timers for Secretary & DevOps audits
```

---

## 🚀 Setup & Installation

Ensure you have **Bun** or **Node.js** installed.

1. **Clone & Install Dependencies**:
   ```bash
   git clone https://github.com/benjamin-wo/nexus-assistant.git
   cd nexus-assistant
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and fill in your keys:
   *   `TELEGRAM_BOT_TOKEN` (from @BotFather)
   *   `LLM_PROVIDER` (`gemini` | `deepseek` | `openrouter`)
   *   `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, or `OPENROUTER_API_KEY`
   *   `DATABASE_URL` (optional: leave empty to use local SQLite `assistant.db`)

3. **Verify Installation**:
   Run the automated pipeline to check database schemas, dynamic registry hot-reloads, compiling checkers, and calculator operations:
   ```bash
   bun run src/test_pipeline.ts
   ```

---

## 🎮 Running the Assistant

### Local REPL Chat
Interact with the assistant directly in your terminal. You will see internal reasoning steps, thoughts, tool calls, and background notifications in real-time:
```bash
bun run src/cli.ts
```

### Telegram Bot
Launch the Telegram interface:
```bash
bun run src/telegram.ts
```

---

## 📈 Future Commercial Productization Roadmap

If you are planning to package and sell this agent as a commercial product, use the following deployment guidelines:

### 1. Cloud Hosting on Railway
- **Nixpacks**: Railway automatically detects Bun and installs everything cleanly. You only need to define a Start command: `bun run src/telegram.ts`.
- **Database**: Spin up a Railway PostgreSQL database and bind its reference to the project. Railway automatically exposes `DATABASE_URL` to your container, which tells `Storage.ts` to switch from SQLite to PostgreSQL.
- **Task Scaling**: Because the `TaskRegistry` runs tasks as asynchronous promises on Bun’s event loop, the service can scale to handle dozens of concurrent user sessions on a single low-spec Railway container.

### 2. Telegram Mini Apps (TMA) Integration
- Build a lightweight web dashboard (e.g., in React/Vite) showing transaction tables, budgeting graphs, calendar views, and agent logs.
- Bind the web app as a Telegram Mini App. When users message the bot asking for visualization (e.g. *"Show my monthly expenses"*), the bot responds with an inline button: `[📊 Open Dashboard]`. Clicking it opens the web layout inside Telegram, providing a premium application experience with zero download friction.
