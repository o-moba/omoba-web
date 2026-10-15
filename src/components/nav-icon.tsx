const paths: Record<string, string> = {
  "/me": "M3 10 12 3l9 7v11h-6v-7H9v7H3Z",
  "/me/matches": "M4 4h16v16H4ZM8 8h8M8 12h8M8 16h4",
  "/me/stats": "M4 20V4M4 20h16M8 16v-4M12 16V8M16 16V5",
  "/players": "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  "/friends":
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M17 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-4",
  "/creators": "M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z",
  "/workshop": "M12 3 3 8l9 5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5",
  "/market": "M4 8h16l-1.5 12h-13ZM8 8a4 4 0 0 1 8 0",
  "/supporters": "m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3ZM3 3h3M18 21h3",
  "/supporter": "m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3Z",
  "/devices": "M4 3h16v13H4ZM8 21h8M12 16v5",
  "/settings": "M3 6h18M3 12h18M3 18h18M8 3v6M16 9v6M8 15v6",
};
export function NavIcon({ href }: { href: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[href] || paths["/me"]} />
    </svg>
  );
}
