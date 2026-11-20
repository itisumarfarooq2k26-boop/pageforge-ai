# Security policy

PageForge AI is intended for local or private self-hosted use. It is **not** a public multi-tenant application. Do not deploy its API routes to the open internet without authentication, HTTPS, request quotas and rate limiting.

API keys are not stored by this app, but **do pass through the server process you run**. Anyone using a hosted instance must trust its operator. Do not commit credentials. If you discover a security issue, please open a private security advisory in the project's GitHub repository instead of posting credentials publicly.
