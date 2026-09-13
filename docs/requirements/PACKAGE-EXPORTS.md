# Export requirements

All packages that are not configs must be exported with this or similar folder structure:

```ts
/*
 * this is only an example
 * you can have different file and folder names
 * you can also have multiple folders
*/

─src
  │   index.ts (1)
  │
  └───core
          enums.ts
          index.ts (2)
          misc.ts
          relations.ts
          schemas.ts
          tables.ts
          types.ts
```

1. Outer `index.ts` wraps them in a namespace like this:

```ts
export * as contracts from "./contracts/index.ts";
```

2. Inner `index.ts` barrel-exports all the files inside that `./core` folder:

```ts
export * from "./enums.js";
export * from "./misc.js";
export * from "./relations.js";
export * from "./schemas.js";
export * from "./tables.js";
export * from "./types.js";
```

## The goal

The goal and use case for this is importing eveything from `contracts` (or any name you had). This allows us to not remember 100 different folders, filenames, modules, hence everything is in one place and very easy to access.

Example below consists:

- Zod contract schema
- Type derived from that schema
- Endpoint response type

```ts
import * from "@repo/contracts";

@Post("code")
async code(@Body({ schema: contracts.auth.code }) body: contracts.auth.Code): Promise<contracts.auth.CodeResponse> {
  /* logic */
}
```

## Caveats

Deep nesting like this will technically work, but Intellisense and compiler will cause many problems down the line and is strictly **not recommended.**

Only **3** layers of `index.ts` barrel files (layers) have been proven to work seamlessly in production. (Bad example below is **4**). And if you really need deep nesting, use regular objects or classes.

```ts
─src
  │   index.ts (1)
  │
  └───core
        │   index.ts (2)
        │
        └───nested
              │   index.ts (3)
              │
              └───deeply
                      enums.ts
                      index.ts (4)
                      misc.ts
                      relations.ts
                      schemas.ts
                      tables.ts
                      types.ts

/*
  this will produce bugs and phantom variables
*/
```
