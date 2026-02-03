export type Track = "backend" | "frontend" | "fullstack";

export const TRACK_SKILLS: Record<Track, string[]> = {
  backend: ["SQL", "DSA", "System Design", "Backend APIs", "Databases", "Caching", "Concurrency"],
  frontend: ["React", "Next.js", "TypeScript", "HTML/CSS", "State Management", "Testing", "Performance", "Accessibility"],
  fullstack: [
    "SQL", "DSA", "System Design", "Backend APIs", "Databases", "Caching",
    "React", "Next.js", "TypeScript", "State Management", "Testing", "Performance",
  ],
};