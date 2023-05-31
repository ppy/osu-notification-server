// Copyright (c) ppy Pty Ltd <contact@ppy.sh>. Licensed under the GNU Affero General Public License v3.0.
// See the LICENCE file in the repository root for full licence text.

export default interface UserSession {
  ip?: string;
  key: string;
  requiresVerification: boolean;
  scopes: Set<string>;
  userId: number;
  verified: boolean;
}
