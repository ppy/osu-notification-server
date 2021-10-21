/**
 * Copyright (c) ppy Pty Ltd <contact@ppy.sh>.
 *
 * This file is part of osu!web. osu!web is distributed with the hope of
 * attracting more community contributions to the core ecosystem of osu!.
 *
 * osu!web is free software: you can redistribute it and/or modify
 * it under the terms of the Affero GNU General Public License version 3
 * as published by the Free Software Foundation.
 *
 * osu!web is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with osu!web.  If not, see <http://www.gnu.org/licenses/>.
 */

export type Message = LogoutMessage | VerificationRequirementChangeMessage | VerifiedMessage;

export default interface MessageBase {
  data: Record<string, unknown>;
  event: string;
}

export interface LogoutMessage extends MessageBase {
  data: { keys: string[] };
  event: 'logout';
}

export interface VerificationRequirementChangeMessage extends MessageBase  {
  data: { requires_verification: boolean };
  event: 'verification_requirement_change';
}

export interface VerifiedMessage extends MessageBase {
  data: { key: string };
  event: 'verified';
}
