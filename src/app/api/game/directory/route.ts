import { gameDirectoryResponse } from '@/lib/game-directory-server.mjs';

export function GET(request: Request) { return gameDirectoryResponse(request); }
export function HEAD(request: Request) { return gameDirectoryResponse(request); }
