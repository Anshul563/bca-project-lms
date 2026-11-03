import globals from "globals";
import { base } from "./base.js";

/** Node/server-side TypeScript projects (API, shared package). */
export const node = [
  ...base,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];
