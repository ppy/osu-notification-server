// Copyright (c) ppy Pty Ltd <contact@ppy.sh>. Licensed under the GNU Affero General Public License v3.0.
// See the LICENCE file in the repository root for full licence text.

import * as WebSocket from 'ws';
import logger from '../logger';

function isSocketMessage(arg: unknown): arg is SocketMessage {
  return typeof arg === 'object'
    && arg != null
    && 'event' in arg
    && typeof (arg as SocketMessage).event === 'string';
}

export function parseSocketMessage(data: WebSocket.Data) {
  if (typeof data !== 'string') return null;

  try {
    const json = JSON.parse(data) as unknown;
    if (isSocketMessage(json)) {
      return json;
    }
  } catch (error) {
    logger.debug(error);
  }

  return null;
}

interface SocketMessage {
  event: string;
}
