# Pre-approves opencode's bridge postinstall (pnpm 10+ ERR_PNPM_IGNORED_BUILDS) so
# @ai-sdk/harness-opencode's bootstrap install succeeds on first run.
# bridge/{package.json,pnpm-lock.yaml} are vendored from its dist/bridge/ — re-copy on upgrade.
FROM ghcr.io/vercel/eve:latest

COPY bridge/package.json bridge/pnpm-lock.yaml /tmp/harness/opencode/

RUN cd /tmp/harness/opencode && \
    (pnpm install --frozen-lockfile --store-dir /tmp/harness/opencode/.pnpm-store || true) && \
    pnpm approve-builds --all && \
    ./node_modules/.bin/opencode --version
