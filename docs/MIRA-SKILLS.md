# Mira Skills — Native Capability Guide

Mira Skills are **runtime capabilities**, not Claude Code skill files. The design borrows useful patterns from skill systems such as `davila7/claude-code-templates` — progressive disclosure, explicit metadata and evaluation — but Mira has **no runtime dependency** on that repository.

## 1. Why a registry

Do not grow `useMira.ts` with more regex + fetch + UI branches.

```text
Conversation
   ↓
TurnManager
   ↓
SkillRegistry
   ├─ weather
   ├─ image
   ├─ future search
   ├─ future documents
   └─ host:* actions
```

## 2. Contract

```ts
interface MiraSkill {
  id: string;
  description: string;
  priority?: number;
  risk: 'local-read' | 'external-read' | 'write' | 'sensitive';
  requiresNetwork: boolean;
  supportsVoice: boolean;
  examples?: string[];
  match(input: string): number;
  execute(input: string, context: SkillContext): Promise<SkillResult | null>;
}
```

Rules:
- `match()` is pure and side-effect free;
- network/file/mutation work belongs in `execute()`;
- return a `ResultView` instead of rendering React inside the skill;
- `write/sensitive` requires explicit approval;
- skill errors must fail closed and must not break the conversation.

## 3. Progressive disclosure

Keep cheap metadata and matching logic small. Heavy code/data should be loaded only if the skill actually executes.

For a large skill:

```text
skills/my-skill/
├─ index.ts          # metadata + matcher
├─ execute.ts        # loaded on demand
├─ schema.ts
└─ references/       # optional domain material
```

The production shell must not import heavy capability code eagerly.

## 4. Result Surface

Current generic views:

```ts
type ResultView =
  | { kind: 'weather'; ... }
  | { kind: 'image'; ... }
  | { kind: 'card'; ... }
  | { kind: 'list'; ... };
```

Add a new generic view only when multiple skills need it. Avoid creating a one-off UI type for every tool.

## 5. Risk policy

| Risk | Example | Auto execute? |
|---|---|---|
| `local-read` | read local status | Yes |
| `external-read` | weather/search | Yes |
| `write` | create/update/delete | No, approval required |
| `sensitive` | personal/security data | No, explicit host/user confirmation |

Host actions use the analogous `read | write | sensitive` policy.

## 6. Add a skill

1. Create `src/intelligence/skills/<name>-skill.ts`.
2. Fill all metadata fields.
3. Keep `match()` deterministic.
4. Return `SkillResult` + optional `ResultView`.
5. Register the skill in `createDefaultSkillRegistry()`.
6. Run:

```bash
npm run check:skills
npm test
npm run check
```

The static skill guard deliberately fails if metadata is missing.

## 7. Eval pattern

For every non-trivial skill, write at least:
- 2 positive prompts;
- 2 negative/non-trigger prompts;
- 1 ambiguous prompt;
- risk/approval test if it mutates state;
- failure-path test for network/service errors.

Example:

```json
[
  { "prompt": "Thời tiết Hà Nội hôm nay?", "expect": "weather" },
  { "prompt": "Tạo ảnh thành phố tương lai", "expect": "image" },
  { "prompt": "Anh thích Hà Nội", "expect": null }
]
```

A skill should improve useful triggering **without** increasing false positives. This is the key lesson worth adopting from agent-skill benchmark workflows.

## 8. Voice behavior

A visual skill must not force a long spoken response. Prefer:
- short conversational answer;
- rich detail in `ResultView`;
- pronunciation/number normalization in the shared speech pipeline;
- no hidden audio persistence.

## 9. Host vs Mira skill

Use a native Mira skill for reusable product-independent capabilities.
Use `HostBridge` action when the capability belongs to Soi or another embedding application and depends on that app's auth/project/state.

Examples:
- weather → Mira skill;
- image display/generation → Mira skill;
- “audit current Soi screen” → host action;
- “create Jira issue from Soi finding” → host write action + confirmation.
