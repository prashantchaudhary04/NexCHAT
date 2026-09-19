import { IUser } from '../config/db.js';

export type PrivacyOption = 'all' | 'contacts' | 'selected' | 'nobody';

/**
 * Determines if a viewer is allowed to see targetUser's online status
 */
export function canViewOnline(
  targetUser: Partial<IUser> & { _id: string },
  viewerId: string
): boolean {
  if (targetUser._id === viewerId) return true;

  const setting: PrivacyOption = (targetUser.onlinePrivacy as PrivacyOption) || 'all';
  if (setting === 'all') return true;
  if (setting === 'nobody') return false;

  if (setting === 'contacts') {
    return Array.isArray(targetUser.contacts) && targetUser.contacts.includes(viewerId);
  }

  if (setting === 'selected') {
    return (
      Array.isArray(targetUser.onlineSelectedContacts) &&
      targetUser.onlineSelectedContacts.includes(viewerId)
    );
  }

  return true;
}

/**
 * Determines if a viewer is allowed to see targetUser's last seen timestamp
 */
export function canViewLastSeen(
  targetUser: Partial<IUser> & { _id: string },
  viewerId: string
): boolean {
  if (targetUser._id === viewerId) return true;

  const setting: PrivacyOption = (targetUser.lastSeenPrivacy as PrivacyOption) || 'all';
  if (setting === 'all') return true;
  if (setting === 'nobody') return false;

  if (setting === 'contacts') {
    return Array.isArray(targetUser.contacts) && targetUser.contacts.includes(viewerId);
  }

  if (setting === 'selected') {
    return (
      Array.isArray(targetUser.lastSeenSelectedContacts) &&
      targetUser.lastSeenSelectedContacts.includes(viewerId)
    );
  }

  return true;
}
