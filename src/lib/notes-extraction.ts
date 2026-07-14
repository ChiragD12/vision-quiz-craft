import { extractNotes } from "./gemini";

export async function importNotes(input: {
  images?: string[];
  pdf?: string;
  text?: string;
}): Promise<string> {
  return await extractNotes(input);
}
