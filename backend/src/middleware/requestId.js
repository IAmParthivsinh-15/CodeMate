import { randomUUID } from "crypto";

// Reuse an incoming correlation id or mint one; echoed back and attached to logs.
export const requestId = (req, res, next) => {
  const incoming = req.get("x-request-id");
  req.id = incoming && /^[\w-]{1,100}$/.test(incoming) ? incoming : randomUUID();
  res.setHeader("x-request-id", req.id);
  next();
};
