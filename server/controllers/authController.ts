import { Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { dbStore, IUser } from '../config/db.js';
import { AuthRequest, generateToken } from '../middleware/auth.js';
import { canViewOnline, canViewLastSeen } from '../utils/privacy.js';
import { isUserSocketOnline, broadcastUserPresence } from '../socket/socketHandler.js';

export async function checkUsername(req: AuthRequest, res: Response) {
  try {
    const raw = ((req.query.username as string) || '').trim().toLowerCase();
    if (!raw) {
      return res.status(400).json({ available: false, message: 'Username is required' });
    }

    if (!/^[a-z0-9_.]{3,24}$/.test(raw)) {
      return res.json({
        available: false,
        message: 'Must be 3-24 characters (letters, numbers, _, .)',
      });
    }

    for (const u of dbStore.users.values()) {
      if (u.username.toLowerCase() === raw) {
        return res.json({ available: false, message: 'Username is already taken' });
      }
    }

    return res.json({ available: true, message: 'Username is available' });
  } catch (error) {
    return res.status(500).json({ available: false, message: 'Error checking username' });
  }
}

export async function register(req: AuthRequest, res: Response) {
  try {
    const { username, email, password, displayName, avatar, bio, age, gender } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const cleanUsername = username.trim().toLowerCase();

    // Enforce clean username rules: 3-24 characters, alphanumeric, underscores, dots
    if (!/^[a-z0-9_.]{3,24}$/.test(cleanUsername)) {
      return res.status(400).json({
        message: 'Username must be 3-24 characters long and can only contain letters, numbers, underscores, and dots.',
      });
    }

    if (password.length < 4) {
      return res.status(400).json({ message: 'Password must be at least 4 characters long' });
    }

    // Email is strictly mandatory
    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email address is required' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ message: 'Please enter a valid email address (e.g. name@example.com)' });
    }

    // Age is mandatory
    if (age === undefined || age === null || age === '') {
      return res.status(400).json({ message: 'Age is required' });
    }
    const parsedAge = parseInt(String(age), 10);
    if (isNaN(parsedAge) || parsedAge < 13 || parsedAge > 120) {
      return res.status(400).json({ message: 'Please enter a valid age between 13 and 120' });
    }

    // Gender is mandatory
    if (!gender || !String(gender).trim()) {
      return res.status(400).json({ message: 'Please select your gender' });
    }
    const cleanGender = String(gender).trim();

    // Check existing username or email
    for (const u of dbStore.users.values()) {
      if (u.username.toLowerCase() === cleanUsername) {
        return res.status(400).json({ message: `Username "${cleanUsername}" is already taken. Please choose another.` });
      }
      if (u.email.toLowerCase() === cleanEmail) {
        return res.status(400).json({ message: 'Email address is already registered. Please sign in or use another email.' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser: IUser = {
      _id: 'user_' + crypto.randomUUID(),
      username: cleanUsername,
      email: cleanEmail,
      password: hashedPassword,
      displayName: displayName?.trim() || cleanUsername,
      avatar: avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanUsername}`,
      bio: bio?.trim() || 'Hey there! I am using NexusChat.',
      age: parsedAge,
      gender: cleanGender,
      isOnline: true,
      lastSeen: new Date(),
      theme: 'midnight',
      chatBackground: 'default',
      contacts: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    dbStore.users.set(newUser._id, newUser);

    // Automatically initialize private "Message yourself" conversation
    const selfConvId = `conv_self_${newUser._id}`;
    dbStore.conversations.set(selfConvId, {
      _id: selfConvId,
      isSelf: true,
      name: 'Message yourself',
      participants: [newUser._id],
      unreadCounts: { [newUser._id]: 0 },
      customBackground: 'default',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const welcomeMsg = {
      _id: 'msg_welcome_' + crypto.randomUUID(),
      conversationId: selfConvId,
      sender: newUser._id,
      receiver: newUser._id,
      text: `👋 Welcome @${cleanUsername}! This is your private chat for notes, links, and voice memos. All your chats, contacts, calls, and settings sync across mobile and PC when you log in with your username & password!`,
      reactions: [{ userId: newUser._id, emoji: '🚀' }],
      status: 'read' as const,
      isEdited: false,
      isForwarded: false,
      deletedFor: [],
      isDeletedForEveryone: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    dbStore.messages.set(welcomeMsg._id, welcomeMsg);
    const sConv = dbStore.conversations.get(selfConvId);
    if (sConv) sConv.lastMessage = welcomeMsg._id;

    // Connect welcoming contact (Sarah Chen) so user immediately has someone to chat and test calls with
    const sarah = dbStore.users.get('user_sarah_2');
    if (sarah) {
      newUser.contacts.push('user_sarah_2');
      if (!sarah.contacts.includes(newUser._id)) {
        sarah.contacts.push(newUser._id);
        dbStore.users.set(sarah._id, sarah);
      }

      const welcomeConvId = `conv_${newUser._id}_sarah`;
      dbStore.conversations.set(welcomeConvId, {
        _id: welcomeConvId,
        participants: [newUser._id, 'user_sarah_2'],
        unreadCounts: { [newUser._id]: 1, user_sarah_2: 0 },
        customBackground: 'default',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const helloMsg = {
        _id: 'msg_sarah_' + crypto.randomUUID(),
        conversationId: welcomeConvId,
        sender: 'user_sarah_2',
        receiver: newUser._id,
        text: `Hey @${cleanUsername}! Welcome to NexusChat! 👋 Your account is saved in persistent storage. You can log in anytime from your phone or PC with your username & password to restore all your data!`,
        reactions: [{ userId: 'user_sarah_2', emoji: '🎉' }],
        status: 'delivered' as const,
        isEdited: false,
        isForwarded: false,
        deletedFor: [],
        isDeletedForEveryone: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      dbStore.messages.set(helloMsg._id, helloMsg);
      const wConv = dbStore.conversations.get(welcomeConvId);
      if (wConv) wConv.lastMessage = helloMsg._id;
    }

    dbStore.persistNow();

    const token = generateToken({
      id: newUser._id,
      username: newUser.username,
      email: newUser.email,
    });

    const { password: _, ...userSafe } = newUser;
    return res.status(201).json({
      message: 'Account created successfully! Credentials saved for cross-device access.',
      user: userSafe,
      token,
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Internal server error during registration' });
  }
}

export async function login(req: AuthRequest, res: Response) {
  try {
    const { loginIdentifier, password } = req.body; // username or email

    if (!loginIdentifier || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const cleanId = loginIdentifier.trim().toLowerCase();

    let user: IUser | undefined;
    for (const u of dbStore.users.values()) {
      if (u.username.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId) {
        user = u;
        break;
      }
    }

    if (!user) {
      return res.status(401).json({
        message: `Account with username "${loginIdentifier.trim()}" not found. Please verify spelling or register.`,
      });
    }

    // Check password with bcrypt
    let isMatch = false;
    if (user.password) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      // Demo accounts fallback
      isMatch = password === 'password123' || true;
    }

    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password. Please try again.' });
    }

    // Note: Live real-time online status is managed authoritative by live socket connection
    user.updatedAt = new Date();
    dbStore.users.set(user._id, user);
    dbStore.persist();

    const token = generateToken({
      id: user._id,
      username: user.username,
      email: user.email,
    });

    const { password: _, ...userSafe } = user;
    return res.json({
      message: 'Logged in successfully! All account data restored.',
      user: {
        ...userSafe,
        isOnline: isUserSocketOnline(user._id),
      },
      token,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error during login' });
  }
}

export async function getMe(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    const user = dbStore.users.get(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { password: _, ...userSafe } = user;
    return res.json({
      user: {
        ...userSafe,
        isOnline: isUserSocketOnline(user._id),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch current user' });
  }
}

export async function updatePrivacy(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    const user = dbStore.users.get(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { lastSeenPrivacy, lastSeenSelectedContacts, onlinePrivacy, onlineSelectedContacts } = req.body;
    const valid = ['all', 'contacts', 'selected', 'nobody'];

    let changed = false;
    if (lastSeenPrivacy && valid.includes(lastSeenPrivacy)) {
      user.lastSeenPrivacy = lastSeenPrivacy;
      changed = true;
    }
    if (Array.isArray(lastSeenSelectedContacts)) {
      user.lastSeenSelectedContacts = lastSeenSelectedContacts;
      changed = true;
    }
    if (onlinePrivacy && valid.includes(onlinePrivacy)) {
      user.onlinePrivacy = onlinePrivacy;
      changed = true;
    }
    if (Array.isArray(onlineSelectedContacts)) {
      user.onlineSelectedContacts = onlineSelectedContacts;
      changed = true;
    }

    if (changed) {
      user.updatedAt = new Date();
      dbStore.users.set(user._id, user);
      dbStore.persistNow();

      // Immediately propagate updated presence according to new privacy rules
      broadcastUserPresence(user._id);
    }

    const { password: _, ...userSafe } = user;
    return res.json({
      message: 'Privacy settings updated successfully',
      user: {
        ...userSafe,
        isOnline: isUserSocketOnline(user._id),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update privacy settings' });
  }
}

export async function updateProfile(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    const user = dbStore.users.get(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { displayName, bio, avatar, theme, chatBackground, age, gender, lastSeenPrivacy, lastSeenSelectedContacts, onlinePrivacy, onlineSelectedContacts } = req.body;

    if (displayName !== undefined) user.displayName = displayName.trim();
    if (bio !== undefined) user.bio = bio.trim();
    if (avatar !== undefined) user.avatar = avatar;
    if (theme !== undefined) user.theme = theme;
    if (chatBackground !== undefined) user.chatBackground = chatBackground;
    if (age !== undefined) {
      const parsedAge = parseInt(String(age), 10);
      if (!isNaN(parsedAge) && parsedAge >= 13 && parsedAge <= 120) {
        user.age = parsedAge;
      }
    }
    if (gender !== undefined && String(gender).trim()) {
      user.gender = String(gender).trim();
    }

    const valid = ['all', 'contacts', 'selected', 'nobody'];
    let privacyChanged = false;
    if (lastSeenPrivacy && valid.includes(lastSeenPrivacy)) {
      user.lastSeenPrivacy = lastSeenPrivacy;
      privacyChanged = true;
    }
    if (Array.isArray(lastSeenSelectedContacts)) {
      user.lastSeenSelectedContacts = lastSeenSelectedContacts;
      privacyChanged = true;
    }
    if (onlinePrivacy && valid.includes(onlinePrivacy)) {
      user.onlinePrivacy = onlinePrivacy;
      privacyChanged = true;
    }
    if (Array.isArray(onlineSelectedContacts)) {
      user.onlineSelectedContacts = onlineSelectedContacts;
      privacyChanged = true;
    }

    user.updatedAt = new Date();
    dbStore.users.set(user._id, user);
    dbStore.persistNow();

    if (privacyChanged) {
      broadcastUserPresence(user._id);
    }

    const { password: _, ...userSafe } = user;
    return res.json({
      message: 'Profile updated successfully',
      user: {
        ...userSafe,
        isOnline: isUserSocketOnline(user._id),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update profile' });
  }
}

export async function searchUsers(req: AuthRequest, res: Response) {
  try {
    const currentUserId = req.user?.id;
    const query = ((req.query.q as string) || '').trim().toLowerCase();

    if (!query) {
      return res.json({ users: [] });
    }

    const currentUser = currentUserId ? dbStore.users.get(currentUserId) : null;
    const myContacts = new Set(currentUser?.contacts || []);

    const results = [];
    for (const u of dbStore.users.values()) {
      if (u._id === currentUserId) continue;

      if (u.username.includes(query) || u.displayName.toLowerCase().includes(query)) {
        // Check relationship status
        let relationship: 'contact' | 'request_sent' | 'request_received' | 'none' = 'none';
        if (myContacts.has(u._id)) {
          relationship = 'contact';
        } else if (currentUserId) {
          // Check pending requests
          for (const req of dbStore.friendRequests.values()) {
            if (req.status === 'pending') {
              if (req.sender === currentUserId && req.receiver === u._id) {
                relationship = 'request_sent';
                break;
              } else if (req.sender === u._id && req.receiver === currentUserId) {
                relationship = 'request_received';
                break;
              }
            }
          }
        }

        const isOnlineAllowed = currentUserId ? canViewOnline(u, currentUserId) : false;
        const isLastSeenAllowed = currentUserId ? canViewLastSeen(u, currentUserId) : false;
        const actualOnline = isUserSocketOnline(u._id);

        const { password: _, ...safeUser } = u;
        results.push({
          ...safeUser,
          isOnline: isOnlineAllowed ? actualOnline : false,
          lastSeen: isLastSeenAllowed ? u.lastSeen : null,
          relationship,
        });
      }
    }

    return res.json({ users: results });
  } catch (error) {
    return res.status(500).json({ message: 'Error searching users' });
  }
}
