import { badRequest } from "../shared/errors.js";

// validate({ body, params, query }) with zod schemas. Parsed (coerced, stripped)
// values replace the originals so controllers only ever see validated input.
export const validate = (schemas) => (req, res, next) => {
  const issues = [];
  for (const part of ["params", "query", "body"]) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (!result.success) {
      issues.push(...result.error.issues.map((i) => ({ path: [part, ...i.path].join("."), message: i.message })));
    } else if (part === "query") {
      // Express 5 makes req.query a getter; store parsed query separately.
      req.validatedQuery = result.data;
    } else {
      req[part] = result.data;
    }
  }
  if (issues.length) return next(badRequest("Validation failed", issues, "VALIDATION_ERROR"));
  next();
};
