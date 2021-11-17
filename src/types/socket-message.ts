// Copyright (c) ppy Pty Ltd <contact@ppy.sh>. Licensed under the GNU Affero General Public License v3.0.
// See the LICENCE file in the repository root for full licence text.

export function isSocketMessage(arg: unknown): arg is SocketMessage {
  return typeof arg === 'object'
    && arg != null
    && 'event' in arg;
}

interface SocketMessage {
  data?: unknown;
  event: string;
}
