# docs

Planning and strategy docs for the MOMUTO platform.

| Doc | What it covers |
|-----|----------------|
| [oemsaas-api-notes.md](./oemsaas-api-notes.md) | **Read this before writing to the CMS API.** What the endpoints actually do, as opposed to what they document: which silently discard fields, which replace rather than merge, which omit data on read. Plus the payload shapes that work, how to decode the Chinese error messages, and the storefront gotchas. |
| [cms-product-create-api.md](./cms-product-create-api.md) | `POST /products` — the create payload field by field, and the custom-jersey shape. |
| [iconic-series.md](./iconic-series.md) | The Iconic Series pipeline: pages from data, translation rules, product creation, collection pages. |
| [us-hub-plan.md](./us-hub-plan.md) | **US plan** — moving US-English SEO to `us.momuto.com`, the exact EN→US mirror strategy, pipeline wiring for a `us` locale, hreflang cross-linking, and a step-by-step handoff sequence a future agent can execute. |
