/**
 * Provably fair verification engine.
 * Implements client-seed generation and server-seed verification
 * for transparent, auditable game outcomes.
 */

export const FairnessEngine = {
  /**
   * Generate a cryptographically random client seed (hex string).
   */
  generateClientSeed(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  },

  /**
   * Verify that a server seed matches its previously committed hash.
   * hash = SHA-256(seed)
   */
  async verifyServerSeed(seed: string, hash: string): Promise<boolean> {
    const encoder = new TextEncoder();
    const data = encoder.encode(seed);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const computedHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return computedHash === hash.toLowerCase();
  },

  /**
   * Combine server seed and client seed into a deterministic hash.
   * Used to derive game-specific random values.
   */
  async combinedSeed(serverSeed: string, clientSeed: string): Promise<string> {
    const combined = `${serverSeed}:${clientSeed}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(combined);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  },

  /**
   * Convert a hex seed string to a float between 0 and 1.
   * Uses the first 8 characters (32 bits) of the hash.
   */
  seedToFloat(seed: string): number {
    const hex = seed.substring(0, 8);
    const int = parseInt(hex, 16);
    return int / 0xffffffff;
  },

  /**
   * Generate multiple random floats from a seed by using successive
   * portions of the hash string.
   */
  seedToFloats(seed: string, count: number): number[] {
    const floats: number[] = [];
    for (let i = 0; i < count; i++) {
      const offset = (i * 8) % (seed.length - 8);
      const hex = seed.substring(offset, offset + 8);
      const int = parseInt(hex, 16);
      floats.push(int / 0xffffffff);
    }
    return floats;
  },

  /**
   * Format a verification summary for display to the user.
   */
  formatVerification(
    serverSeed: string,
    serverSeedHash: string,
    clientSeed: string,
  ): {
    serverSeed: string;
    serverSeedHash: string;
    clientSeed: string;
    serverSeedShort: string;
    clientSeedShort: string;
  } {
    return {
      serverSeed,
      serverSeedHash,
      clientSeed,
      serverSeedShort: `${serverSeed.substring(0, 8)}...${serverSeed.substring(serverSeed.length - 8)}`,
      clientSeedShort: `${clientSeed.substring(0, 8)}...${clientSeed.substring(clientSeed.length - 8)}`,
    };
  },
};
