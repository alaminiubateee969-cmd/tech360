# AI services command center

Admin and Super Admin can access Core Agents and Command Center. Other workforce internals (private memory, logs, infrastructure) retain their existing Super Admin policy. Agent tool grants, approval gates and API CSRF protections remain in place. Command conversation history is scoped to the authenticated user as well as session ID.

In Command Center, expand **AI services & free-model assistant**. Configure `OPENROUTER_API_KEY` in the server environment and restart. Never put it in a public variable or browser. The catalog is fetched live from OpenRouter; only `:free` IDs with zero prompt and completion prices are selectable. Each completion rechecks the catalog and sets zero maximum provider prices. A failure never retries a paid route. Configuration status is not a successful connectivity test.

This is a separate single-turn text assistant, not the Oracle execution engine. It receives only the entered prompt, has no tools, and cannot modify business records. Existing Oracle commands continue through the existing model router, configuration and approval system; this change does NOT guarantee that existing providers are free. Do not submit sensitive customer data to external providers without authorization.

The directory identifies setup references for speech, images, embeddings, search, local inference, memory and workflows. Those references do not install or connect those services. There is no complete permanent list of free AI services, nor a guarantee of unlimited free use. Check provider quotas, licenses, region restrictions and terms. Hardware, hosting and electricity can cost money even with local open weights.

The sandbox cannot reach OpenRouter, so live discovery and generation must be tested on a deployment with outbound access. No API key is supplied by the repository.
