import { Response } from 'express';
import crypto from 'crypto';
import { dbStore, IStory, IStoryView } from '../config/db.js';
import { AuthRequest } from '../middleware/auth.js';
import { getSocketIO } from '../socket/socketHandler.js';

export async function createStory(req: AuthRequest, res: Response) {
  try {
    const currentUserId = req.user?.id;
    if (!currentUserId) return res.status(401).json({ message: 'Unauthorized' });

    const { mediaType, mediaUrl, textContent, backgroundGradient, textColor, visibility } = req.body;

    if (!mediaType || !['image', 'video', 'text'].includes(mediaType)) {
      return res.status(400).json({ message: 'Valid mediaType (image, video, or text) is required' });
    }

    if (mediaType === 'text' && (!textContent || !textContent.trim())) {
      return res.status(400).json({ message: 'Text content is required for text status' });
    }

    if ((mediaType === 'image' || mediaType === 'video') && !mediaUrl) {
      return res.status(400).json({ message: 'Media URL is required for photo/video status' });
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours expiration

    const newStory: IStory = {
      _id: 'story_' + crypto.randomUUID(),
      userId: currentUserId,
      mediaType,
      mediaUrl: mediaUrl || undefined,
      textContent: textContent?.trim() || undefined,
      backgroundGradient: backgroundGradient || 'from-indigo-600 to-violet-800',
      textColor: textColor || '#ffffff',
      visibility: visibility || 'contacts',
      views: [],
      expiresAt,
      createdAt: new Date(),
    };

    dbStore.stories.set(newStory._id, newStory);

    const currentUser = dbStore.users.get(currentUserId);

    // Broadcast new story to contacts
    const io = getSocketIO();
    if (io && currentUser?.contacts) {
      currentUser.contacts.forEach(contactId => {
        io.to(`user:${contactId}`).emit('story:new', {
          story: newStory,
          user: {
            _id: currentUser._id,
            username: currentUser.username,
            displayName: currentUser.displayName,
            avatar: currentUser.avatar,
          },
        });
      });
    }

    return res.status(201).json({ story: newStory });
  } catch (error) {
    console.error('createStory error:', error);
    return res.status(500).json({ message: 'Failed to create status' });
  }
}

export async function getStories(req: AuthRequest, res: Response) {
  try {
    const currentUserId = req.user?.id;
    if (!currentUserId) return res.status(401).json({ message: 'Unauthorized' });

    const currentUser = dbStore.users.get(currentUserId);
    const now = new Date();

    const myStories: any[] = [];
    const contactStoriesMap: Map<string, any[]> = new Map();

    // Clean expired stories
    for (const [id, s] of dbStore.stories.entries()) {
      if (new Date(s.expiresAt) < now) {
        dbStore.stories.delete(id);
      }
    }

    for (const story of dbStore.stories.values()) {
      if (story.userId === currentUserId) {
        myStories.push(story);
      } else if (currentUser?.contacts?.includes(story.userId)) {
        if (!contactStoriesMap.has(story.userId)) {
          contactStoriesMap.set(story.userId, []);
        }
        contactStoriesMap.get(story.userId)?.push(story);
      }
    }

    // Sort user's own stories
    myStories.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const recentUpdates: any[] = [];
    const viewedUpdates: any[] = [];

    for (const [userId, stories] of contactStoriesMap.entries()) {
      const user = dbStore.users.get(userId);
      if (!user) continue;

      stories.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      // Check if all stories have been viewed by current user
      const allViewed = stories.every(s =>
        s.views.some((v: IStoryView) => v.userId === currentUserId)
      );

      const entry = {
        user: {
          _id: user._id,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
          isOnline: user.isOnline,
        },
        stories,
        allViewed,
        latestStoryTime: stories[stories.length - 1].createdAt,
      };

      if (allViewed) {
        viewedUpdates.push(entry);
      } else {
        recentUpdates.push(entry);
      }
    }

    recentUpdates.sort((a, b) => new Date(b.latestStoryTime).getTime() - new Date(a.latestStoryTime).getTime());
    viewedUpdates.sort((a, b) => new Date(b.latestStoryTime).getTime() - new Date(a.latestStoryTime).getTime());

    return res.json({
      myStatus: {
        user: {
          _id: currentUser?._id,
          username: currentUser?.username,
          displayName: currentUser?.displayName,
          avatar: currentUser?.avatar,
        },
        stories: myStories,
      },
      recentUpdates,
      viewedUpdates,
    });
  } catch (error) {
    console.error('getStories error:', error);
    return res.status(500).json({ message: 'Failed to fetch stories' });
  }
}

export async function viewStory(req: AuthRequest, res: Response) {
  try {
    const currentUserId = req.user?.id;
    const { storyId } = req.params;

    if (!currentUserId) return res.status(401).json({ message: 'Unauthorized' });

    const story = dbStore.stories.get(storyId);
    if (!story) return res.status(404).json({ message: 'Story not found or expired' });

    // Don't record own views as viewer
    if (story.userId === currentUserId) {
      return res.json({ views: story.views });
    }

    const viewer = dbStore.users.get(currentUserId);
    const existingViewIndex = story.views.findIndex(v => v.userId === currentUserId);

    if (existingViewIndex === -1) {
      const newView: IStoryView = {
        userId: currentUserId,
        username: viewer?.username || 'User',
        avatar: viewer?.avatar || '',
        viewedAt: new Date(),
      };
      story.views.push(newView);
      dbStore.stories.set(story._id, story);

      // Notify story owner in real-time
      const io = getSocketIO();
      if (io) {
        io.to(`user:${story.userId}`).emit('story:viewed', {
          storyId: story._id,
          view: newView,
          totalViews: story.views.length,
        });
      }
    }

    return res.json({ views: story.views });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to mark story as viewed' });
  }
}

export async function deleteStory(req: AuthRequest, res: Response) {
  try {
    const currentUserId = req.user?.id;
    const { storyId } = req.params;

    if (!currentUserId) return res.status(401).json({ message: 'Unauthorized' });

    const story = dbStore.stories.get(storyId);
    if (!story) return res.status(404).json({ message: 'Story not found' });

    if (story.userId !== currentUserId) {
      return res.status(403).json({ message: 'You can only delete your own status' });
    }

    dbStore.stories.delete(storyId);
    return res.json({ message: 'Status deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete status' });
  }
}
