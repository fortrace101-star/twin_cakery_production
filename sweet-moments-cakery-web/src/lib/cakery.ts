import { z } from "zod";
export const enquirySchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(6).max(30),
  kind: z.enum(["cake", "course", "event", "contact"]),
  item: z.string().trim().min(1).max(150),
  preferred_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  message: z.string().trim().max(2000),
});
/**
 * Launched the ERP product catalogue here.
 *
 * The ERP entry interface now owns the public catalogue. The previous export
 * (`cakes`) was the front-end's hard-coded inventory. It has been removed and
 * replaced by the synchronised source in `lib/products.ts`:
 *
 *   - ERP page (admin) writes new/edited products into the shared store.
 *   - `listActiveProducts()` is the public read model.
 *   - The website reads from this synchronised store, so published items on
 *     "Our cakes" stay in sync with what the business enters in the ERP.
 */
