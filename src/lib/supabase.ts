import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

**Step 4: Commit the new file**
Click **Commit changes**

**Step 5: Delete the old file**
Navigate back to `src/supabase_lib.ts`, click the **trash icon** (or three dots → Delete), and commit the deletion.

---

Your final structure will be:
```
src/
  lib/
    supabase.ts   ✓
  app/
    ...
