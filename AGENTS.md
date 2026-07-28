# DentFlow Agent Instructions

Before making a product, schema, API, permission, billing, or workflow change, read [docs/README.md](./docs/README.md) and then the relevant domain document.

Keep tenant isolation as a non-negotiable invariant: all tenant-owned data is scoped by verified tenant context, never by a client-supplied tenant ID alone. Keep SaaS billing separate from patient clinical payments as defined in [docs/01-payment-model.md](./docs/01-payment-model.md).

Use synthetic patient data only. Update the matching document in `docs/` whenever a public API, business state, role rule, entity relationship, or payment behavior changes.
