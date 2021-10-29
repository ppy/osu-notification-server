// Copyright (c) ppy Pty Ltd <contact@ppy.sh>. Licensed under the GNU Affero General Public License v3.0.
// See the LICENCE file in the repository root for full licence text.

type Message = LogoutMessage | VerificationRequirementChangeMessage | VerifiedMessage;
export default Message;

interface MessageBase {
  data: Record<string, unknown>;
  event: string;
}

interface LogoutMessage extends MessageBase {
  data: { keys: string[] };
  event: 'logout';
}

interface VerificationRequirementChangeMessage extends MessageBase  {
  data: { requires_verification: boolean };
  event: 'verification_requirement_change';
}

interface VerifiedMessage extends MessageBase {
  data: { key: string };
  event: 'verified';
}
