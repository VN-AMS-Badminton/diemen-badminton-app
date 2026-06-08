# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository (VN-AMS Badminton — Next.js 15 + Supabase web app).

**IMPORTANT:** Before you plan or proceed with any implementation, always read `./README.md` first for context.
**IMPORTANT:** Sacrifice grammar for the sake of concision when writing reports.
**IMPORTANT:** In reports, list any unresolved questions at the end, if any.

## Git

Use conventional commit types (`feat`, `fix`, `refactor`, `test`, `style`, `perf`, `ci`, `build`, `revert`). Only commit when the user explicitly asks.

## Hook Response Protocol

### Privacy Block Hook (`@@PRIVACY_PROMPT@@`)

When a tool call is blocked by the privacy-block hook, the output contains a JSON marker between `@@PRIVACY_PROMPT_START@@` and `@@PRIVACY_PROMPT_END@@`. **You MUST use the `AskUserQuestion` tool** to get proper user approval.

**Required Flow:**

1. Parse the JSON from the hook output
2. Use `AskUserQuestion` with the question data from the JSON
3. Based on user's selection:
   - **"Yes, approve access"** → Use `bash cat "filepath"` to read the file (bash is auto-approved)
   - **"No, skip this file"** → Continue without accessing the file

**Example AskUserQuestion call:**
```json
{
  "questions": [{
    "question": "I need to read \".env\" which may contain sensitive data. Do you approve?",
    "header": "File Access",
    "options": [
      { "label": "Yes, approve access", "description": "Allow reading .env this time" },
      { "label": "No, skip this file", "description": "Continue without accessing this file" }
    ],
    "multiSelect": false
  }]
}
```

**IMPORTANT:** Always ask the user via `AskUserQuestion` first. Never try to work around the privacy block without explicit user approval.

## [IMPORTANT] Consider Modularization
- If a code file exceeds 200 lines of code, consider modularizing it
- Check existing modules before creating new
- Analyze logical separation boundaries (functions, classes, concerns)
- Use kebab-case naming with long descriptive names, it's fine if the file name is long because this ensures file names are self-documenting for LLM tools (Grep, Glob, Search)
- Write descriptive code comments
- After modularization, continue with main task
- When not to modularize: Markdown files, plain text files, bash scripts, configuration files, environment variables files, etc.

## Documentation

Important docs live in `./docs`. Keep them updated.

```
./docs
├── project-overview.md
├── system-architecture.md
├── database-schema.md
├── design-guidelines.md
├── local-development.md
├── deployment-guide.md
├── code-standards.md
├── project-roadmap.md
├── soft-launch-playbook.md
└── future/
    ├── bunq-integration.md
    └── refactor-write-audit-injectable-sb.md
```
