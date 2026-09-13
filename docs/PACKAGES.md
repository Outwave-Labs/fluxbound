# All packages

We diligently separate code and concerns to different packages and apps. This allows us to scale and maintain code at a much higher quality, allowing everyone to contribute and work together in a team without much caveats.

## Apps

Our main apps and their stack.

- `@repo/web` (`apps/web`) - Frontend. (Next.js, Redux, Three.js, GLSL) - http://localhost:3000/
- `@repo/api` (`apps/api`) - Backend. (Nest.js + Drizzle ORM) - http://localhost:3001/

## Shared packages

Packages that are imported and shared in our main apps.

- `@repo/db` (`packages/db`) - Drizzle ORM schemas, enums and types. (PostgreSQL database)

Everything inherits the actual database table name in the Postgres.

```ts
import { db } from "@repo/db";

/* Types are exported with PascalCase */
type Type = db.Users;

/* Drizzle ORM tables are exported with camelCase */
const Table = db.users;

/* Zod schemas are exported with */
const Schema = db.usersSchema;
```

- `@repo/lib` (`packages/lib`) - Utility functions, classes, helpers.

```ts
import { lib } from "@repo/lib";

const id = lib.id.create();
const emoji = lib.random.groupEmoji();
const color = lib.random.hex();

const group = {
  id,
  owner_user_id: body.userId,
  title: `group-${id}`,
  emoji,
};
```

- `@repo/contracts` (`packages/contracts`) - DTOs for both API (Nest.js) and Web (Redux) applications. Also used in Web forms.

Make sure to enforce the actual `@Body/@Query/@Param/...` `schema` parameter and its type, alongside endpoint Response type.

```ts
import * from "@repo/contracts";

@Post("code")
async code(@Body({ schema: contracts.auth.code }) body: contracts.auth.Code): Promise<contracts.auth.CodeResponse> {
  /* logic */
}
```

- `@repo/config` (`packages/config`) - Shared configuration for all packages. Includes password/code lengths, token expiry dates and other utility stuff.

One of the examples of configuration file. (This is not a configuration like oxlint or prettier, this is intended for other packages and apps)

Put important static utility values for specific modules.

```ts
/* auth.ts */

export const password = {
  length: {
    min: 8,
    max: 128,
  },
};
export const code = { expiryMs: 5 * 60 * 1000, length: 6 };

/**
 * jwt-related
 */
export const accessToken = { expiryMs: 15 * 60 * 1000 };
export const refreshToken = { expiryMs: 30 * 24 * 60 * 60 * 1000 };
```

## Config packages

Configuration packages used solely for plugins, extensions, compilers and their configurations

- `@repo/oxlint-config` (`packages/oxlint-config`) - Oxlint configuration file. (Linter)
- `@repo/prettier-config` (`packages/prettier-config`) - Prettier configuration file. (Formatting)
- `@repo/typescript-config` (`packages/typescript-config`) - TypeScript configuration file.
