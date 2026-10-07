# Mira Identity Capsule

Identity Capsule is Mira's portable continuity format.

It is designed to preserve **user-approved data** across devices, deployments, model providers and future hardware. It does not claim to contain hidden consciousness, private inner state or anything outside stored application data.

## Contents

- schema version and creation time;
- durable user facts from Neon;
- bounded conversation history;
- optional Mira Desktop structured-memory graph (up to 240 nodes / 600 links in capsule portability flow);
- voice/persona/response-length preferences;
- theme, avatar selection and 2D/3D preference;
- smart turn-taking, VAD and memory preference;
- a continuity summary generated through the existing Brain Gateway when a provider is available;
- SHA-256 integrity hash.

## Provider independence

Structured continuity generation uses the same Brain Gateway as normal Mira chat. It can therefore use OpenAI/GPT, Gemini or Anthropic according to the configured server-side provider order.

Embeddings are optional. When Gemini embeddings are unavailable, Mira keeps durable facts as text and memory recall falls back to recent context instead of failing.

## Storage

The latest generated/imported capsule is stored in Neon table `identity_capsules`, scoped by the existing HttpOnly `mira_scope` identity.

The JSON export is portable and can be kept offline by the user.

## Import policy

Import is merge-only in schema v1:

- existing facts are not deleted;
- Desktop structured memories merge by `kind + normalized_text`; imported IDs are remapped before links are restored;
- only known structured-memory kinds and `co_occurs | semantic_temporal` relations are accepted;
- graph import is bounded to 240 nodes / 600 links; browser-only IndexedDB runtimes ignore the optional graph field;
- duplicate facts are skipped;
- duplicate message text/role pairs are skipped;
- imported browser preferences are restored from a strict allow-list;
- destructive replacement is intentionally not supported.

## Desktop graph portability

The optional `structuredMemory` field is additive and backward-compatible with schema v1. Mira Desktop exports node IDs only to reconnect links during import. Editing a node invalidates its derived semantic-temporal edges before future memory events can form new evidence; historical co-occurrence links are preserved.

## Security

- provider keys remain server-side;
- the capsule contains personal conversation data, so exported files should be treated as private;
- import verifies the SHA-256 digest before writing;
- unknown preference fields are discarded;
- no camera or microphone data is included.
