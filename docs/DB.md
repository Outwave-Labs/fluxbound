# Database

The DB setup is Postgres + Drizzle

## Key Packages

- `@repo/db` (`packages/db`) - Contains schema and Drizzle config. Used for migrations. Builds to `dist/`
- `@repo/api` (`apps/api`) - Consumes `@repo/db` at runtime through `DrizzleService` (`src/modules/drizzle`)

## Environment

Set in `apps/api/.env` (Nest `ConfigModule`) and picked up by `drizzle-kit` via `dotenv`:

- **DATABASE_URL** - URL for app to use to connect to the database
- **DATABASE_DIRECT_URL** - Direct (unpooled) connection to the database for Drizzle-Kit
- **DATABASE_SECRET_KEY** - Idk, need to revisit

**NOTE:** **DATABASE_DIRECT_URL** can be set in `packages/db/.env` if the script is executed not via `@repo/api`

## Commands

Run from the repo root (they proxy to `pnpm --filter @repo/db ...`):

- `pnpm db:generate`- Generates new migration with introduced changes (migrations live in `packages/db/drizzle/`)
- `pnpm db:migrate` - Applies pending migrations to `DATABASE_DIRECT_URL`
- `pnpm db:push` - Pushes `schema.ts` straight to the DB with no migration file (dev / prototyping)
- `pnpm db:pull` - Looks in the DB and regenerate the Drizzle schema
- `pnpm db:studio` - Open Drizzle Studio (browser DB GUI)

## Working with the schema

1. Edit `packages/db/src/schema.ts`. Keep column/table names explicit and `snake_case` (the client and config both run
   `casing: 'snake_case'`)
2. `pnpm db:generate` then `pnpm db:migrate` (or `pnpm db:push` in dev). Migration's SQL can be edited if needed
3. `@repo/db` must be built before `apps/api` runs. Turbo handles the ordering when ran via `pnpm build`. Iff you run
   things manually, run `pnpm --filter @repo/db build` first

## Querying

Inject `DrizzleService` and use `.db`:

```ts
constructor(private readonly drizzle: DrizzleService) {}

// Use query builder
await this.drizzle.db.select().from(users).where(eq(users.id, id));

// Or relational API (relations are defined in schema.ts)
await this.drizzle.db.query.users.findMany({
  with: {
    connections_group: true
  }
});
```

Table objects and column helpers are imported from `@repo/db/schema` \

## Gotchas

- **Do not remove** `ignoredOptionalDependencies: ['@prisma/client']` from `pnpm-workspace.yaml`. `drizzle-orm` lists
  `@prisma/client` as an optional peer; without that line pnpm reinstalls Prisma (and its build scripts break
  `nest build`)
- `drizzle-zod` emits `.nullable()` (not `.nullish()`) for nullable columns and strict `z.date()` for timestamps -
  stricter than the old `prisma-zod-generator` output
