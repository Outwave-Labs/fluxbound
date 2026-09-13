# Code requirements

All of these specific points have to be met in order to be validated at the review process of your task.

1. `@repo/api` endpoint type enforcement.

Make sure to enforce the actual `@Body/@Query/@Param/...` `schema` parameter and its type, alongside endpoint Response type.

```ts
import * from "@repo/contracts";

@Post("code")
async code(@Body({ schema: contracts.auth.code }) body: contracts.auth.Code): Promise<contracts.auth.CodeResponse> {
  /* logic */
}
```

2. `id` generation

Our app uses specific `nanoid` ids and they may change in the future, so id generation on both API and Web apps must strictly be done via `@repo/lib` package `id` utility. ()

```ts
import { lib } from "@repo/lib";

const id = lib.id.create();
```
