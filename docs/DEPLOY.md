# Deployment status

Checked 2026-10-24 from the `agent4-human` branch.

## Production

- Application: <https://financegamething.vercel.app/>
- AI gateway: <https://financegamething.vercel.app/api/ai>
- GitHub repository: <https://github.com/SuhasProjects/financegamething>
- CI workflow: <https://github.com/SuhasProjects/financegamething/actions/workflows/ci.yml>

The production home page returned HTTP 200. A valid `scenario` request to
`POST /api/ai` also returned HTTP 200 with `source: "ai"`, confirming that the
gateway is enabled and its server-side provider configuration is working. No
credential values were printed or copied.

GitHub Actions is enabled for the repository with `allowed_actions: all`, and
the `CI` workflow is active.

## Vercel project access

This checkout has no `.vercel/project.json`, and the Vercel CLI reports that
the machine is logged out. Consequently, the following project settings could
not be independently changed or verified from this machine:

- project ownership or transfer from `randyphantom21-commits/financegamething`;
- Git repository connection to `SuhasProjects/financegamething`;
- production branch `main`;
- framework preset `Vite`;
- names and scopes of `AI_API_KEY`, `AI_PROVIDER`, `AI_MODEL`, and
  `AI_BASE_URL`.

An owner must run `vercel login` (or provide an appropriately scoped
`VERCEL_TOKEN`) before those dashboard settings can be audited. The live
HTTP checks above show that the existing production deployment and AI route
are currently healthy, but do not prove which Git repository is connected.

## Verification command

The gateway can be checked without exposing secrets:

```bash
curl -X POST https://financegamething.vercel.app/api/ai \
  -H 'content-type: application/json' \
  --data '{"kind":"scenario","input":{"freeText":"test scenario"}}'
```

Expected: HTTP 200 and a JSON object with `kind: "scenario"` and
`source: "ai"`.
