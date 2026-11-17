import { defineRpcContract } from "@get-bb/plugin-sdk";
import { z } from "zod";

export const rulesSchema = z.record(z.string().regex(/^proj_[\w-]+$/), z.string().min(1));
const target = z.object({ id: z.string(), name: z.string() });
const summary = z.object({ matched: z.number(), moved: z.number(), failed: z.number(), dryRun: z.boolean() });
export const rpcContract = defineRpcContract({
  state: {
    input: z.null(),
    output: z.object({ enabled: z.boolean(), rules: rulesSchema, projects: z.array(target), sections: z.array(target) }),
    tags: () => ["rules"],
  },
  setRule: {
    input: z.object({ projectId: z.string().min(1), sectionId: z.string().min(1) }).strict(),
    output: z.object({ saved: z.literal(true) }),
  },
  removeRule: {
    input: z.object({ projectId: z.string().min(1) }).strict(),
    output: z.object({ removed: z.literal(true) }),
  },
  apply: { input: z.object({ dryRun: z.boolean() }).strict(), output: summary },
});
