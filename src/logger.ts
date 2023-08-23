// Copyright (c) ppy Pty Ltd <contact@ppy.sh>. Licensed under the GNU Affero General Public License v3.0.
// See the LICENCE file in the repository root for full licence text.

import config from './config';
import noop from './noop';

function log(level: string, ...args: unknown[]) {
  // eslint-disable-next-line no-console
  return console.log(`[${(new Date()).toJSON()}][${level}]`, ...args);
}

let debug;
if (config.debug) {
  debug = (...args: unknown[]) => log('debug', ...args);
} else {
  debug = noop;
}

const info = (...args: unknown[]) => log('info', ...args);

const logger = {debug, info};

export default logger;
