/**
 * Sanitize user input by stripping HTML tags to prevent XSS.
 * Use this for any user-provided text before storing in the database.
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
}
