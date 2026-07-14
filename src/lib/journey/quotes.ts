// Splash-screen quote pool. Add freely — nothing else needs to change.

export const JOURNEY_QUOTES: string[] = [
  "Do or do not, there is no try.",
  "The lion does not turn around when a small dog barks.",
  "Bharat remembers. So must you.",
  "A river that forgets its source dries.",
  "One page a day writes a lifetime.",
  "Discipline is the bridge between dreams and truth.",
  "The night is longest just before dawn.",
  "Small steps, walked daily, cross oceans.",
  "Knowledge is the only wealth that grows when spent.",
  "The lion inside you is waiting for your voice.",
];

export function randomQuote(seed?: number): string {
  const i =
    typeof seed === "number"
      ? Math.abs(seed) % JOURNEY_QUOTES.length
      : Math.floor(Math.random() * JOURNEY_QUOTES.length);
  return JOURNEY_QUOTES[i] ?? JOURNEY_QUOTES[0];
}
