import { z } from "zod";

const email = z.string().trim().toLowerCase().email("Invalid email address").max(254);
const password = z.string().min(8, "Password must be at least 8 characters").max(128);

export const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters")
      .max(30)
      .regex(/^[a-zA-Z0-9_.-]+$/, "Username may contain letters, numbers, _ . -"),
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

export const loginSchema = z.object({ email, password: z.string().min(1, "Password is required").max(128) });

// Refresh token may come from the body or the httpOnly cookie.
export const refreshSchema = z.object({ refreshToken: z.string().min(1).optional() });
