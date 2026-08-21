import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid verification code");

export type VerifiedCard = {
  full_name: string | null;
  org_name: string | null;
  job_position: string | null;
  card_state: string | null;
  expiry: string | null;
  card_number: string | null;
};

export const verifyCard = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ({ token: tokenSchema.parse((data as { token?: unknown })?.token) }))
  .handler(async ({ data }): Promise<VerifiedCard | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("verify_card", { _token: data.token });
    if (error) {
      console.error("[verifyCard] lookup failed", error);
      throw new Error("Verification is unavailable right now");
    }
    return (rows?.[0] as VerifiedCard | undefined) ?? null;
  });
