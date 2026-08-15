# Mira Host Integration

Mira V2 is standalone by default, but a host application such as Soi can inject **context** and **actions** without forking Mira core.

## Context

Before Mira starts a turn, the host may provide:

```ts
window.__MIRA_HOST_CONTEXT__ = {
  id: 'soi',
  product: 'Soi',
  project: 'Landing Audit',
  screen: 'Compare / Findings',
  locale: 'vi-VN',
};
```

For React/TypeScript integration, prefer `setHostBridge(customBridge)` from `src/host` instead of globals.

## Actions

A same-window host can expose actions:

```ts
window.__MIRA_HOST_ACTIONS__ = {
  actions: [
    {
      id: 'audit.current',
      title: 'Audit màn hình hiện tại',
      description: 'Đọc kết quả audit UI/UX của màn hình đang mở.',
      risk: 'read',
      supportsVoice: true,
    },
  ],
  async execute(id, input, context) {
    if (id === 'audit.current') {
      const findings = await readCurrentAudit();
      return {
        content: {
          kind: 'list',
          data: {
            title: 'Phát hiện chính',
            items: findings.map((finding) => ({ title: finding.title, subtitle: finding.severity })),
          },
        },
        data: findings,
      };
    }
    return null;
  },
};
```

## Safety rule

- `read`: may execute when requested by an approved Brain/host tool call.
- `write`: Mira **does not auto-execute**. The host must own confirmation and then perform the mutation.
- `sensitive`: same as `write`, plus the host should show exactly what data will be used/sent.

This keeps voice interaction from bypassing the host application's RBAC, confirmation, audit trail or license rules.

## Brain tool-call shape

```ts
{
  skillId: 'host:audit.current',
  input: 'Kiểm tra màn hình hiện tại',
  reason: 'User explicitly asked for the current audit'
}
```

Plain-text Brain adapters remain compatible; `toolCalls` is optional.
