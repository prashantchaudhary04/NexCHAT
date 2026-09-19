import React, { useEffect, useState } from 'react';
import { Plus, Image, Type, Sparkles, Clock, Eye } from 'lucide-react';
import { api } from '../services/api';
import { Story, StoryGroup, User } from '../types';
import { StoryViewerModal } from './StoryViewerModal';

interface StoriesViewProps {
  currentUser: User | null;
}

const GRADIENTS = [
  'from-indigo-600 via-purple-600 to-pink-600',
  'from-blue-600 to-cyan-500',
  'from-emerald-600 to-teal-500',
  'from-rose-600 to-orange-500',
  'from-amber-500 to-pink-500',
  'from-purple-800 to-indigo-950',
];

export const StoriesView: React.FC<StoriesViewProps> = ({ currentUser }) => {
  const [myStories, setMyStories] = useState<Story[]>([]);
  const [recentUpdates, setRecentUpdates] = useState<StoryGroup[]>([]);
  const [viewedUpdates, setViewedUpdates] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Story Viewer Modal
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeStoryGroup, setActiveStoryGroup] = useState<StoryGroup | null>(null);

  // Create Story Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [storyMode, setStoryMode] = useState<'text' | 'media'>('text');
  const [textContent, setTextContent] = useState('');
  const [selectedGradient, setSelectedGradient] = useState(GRADIENTS[0]);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchStories = async () => {
    try {
      setLoading(true);
      const data = await api.stories.getAll();
      setMyStories(data.myStatus.stories || []);
      setRecentUpdates(data.recentUpdates || []);
      setViewedUpdates(data.viewedUpdates || []);
    } catch (err) {
      console.error('Failed to load stories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStories();
  }, []);

  const handleOpenMyStory = () => {
    if (!currentUser || myStories.length === 0) {
      setCreateModalOpen(true);
      return;
    }
    setActiveStoryGroup({
      user: currentUser,
      stories: myStories,
      allViewed: true,
      latestStoryTime: myStories[myStories.length - 1].createdAt,
    });
    setViewerOpen(true);
  };

  const handleOpenContactStory = (group: StoryGroup) => {
    setActiveStoryGroup(group);
    setViewerOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
    }
  };

  const handlePublishStory = async () => {
    setIsSubmitting(true);
    try {
      if (storyMode === 'text') {
        if (!textContent.trim()) return;
        await api.stories.create({
          mediaType: 'text',
          textContent: textContent.trim(),
          backgroundGradient: selectedGradient,
          textColor: '#ffffff',
          visibility: 'contacts',
        });
      } else {
        if (!mediaFile) return;
        const uploadRes = await api.upload.media(mediaFile);
        await api.stories.create({
          mediaType: uploadRes.fileType === 'video' ? 'video' : 'image',
          mediaUrl: uploadRes.fileUrl,
          textContent: caption.trim() || undefined,
          visibility: 'contacts',
        });
      }

      setCreateModalOpen(false);
      setTextContent('');
      setMediaFile(null);
      setMediaPreview(null);
      setCaption('');
      await fetchStories();
    } catch (err: any) {
      alert(err.message || 'Failed to post story');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-50/50 dark:bg-neutral-900/50 overflow-y-auto p-4 sm:p-6 pb-24 md:pb-6">
      <div className="max-w-3xl mx-auto w-full mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <span>Stories & Status</span>
              <Sparkles className="w-5 h-5 text-indigo-500" />
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              Share photos, videos and text updates with your contacts. Disappears after 24 hours.
            </p>
          </div>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Status
          </button>
        </div>

        {/* 1. My Status Card */}
        <div className="bg-white dark:bg-neutral-800/80 rounded-2xl p-4 border border-neutral-200/80 dark:border-neutral-700/80 shadow-xs mb-6">
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-3.5 cursor-pointer flex-1"
              onClick={handleOpenMyStory}
            >
              <div className="relative">
                <img
                  src={currentUser?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.username || 'me'}`}
                  alt="My Status"
                  className={`w-13 h-13 rounded-full object-cover p-0.5 ${
                    myStories.length > 0
                      ? 'border-2 border-indigo-500'
                      : 'border-2 border-neutral-300 dark:border-neutral-700'
                  }`}
                />
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setCreateModalOpen(true);
                  }}
                  className="absolute bottom-0 right-0 w-4 h-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center border-2 border-white dark:border-neutral-900 shadow-xs"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">My Status</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {myStories.length > 0
                    ? `${myStories.length} active update${myStories.length > 1 ? 's' : ''} • Tap to view`
                    : 'Tap to add your 24-hour status update'}
                </p>
              </div>
            </div>

            {myStories.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                <Eye className="w-3.5 h-3.5" />
                <span>
                  {myStories.reduce((acc, curr) => acc + (curr.views?.length || 0), 0)} views
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 2. Recent Updates (Unviewed) */}
        <div className="mb-6">
          <h2 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">
            Recent Updates ({recentUpdates.length})
          </h2>

          {loading ? (
            <div className="space-y-2.5">
              {[1, 2].map(n => (
                <div key={n} className="h-16 bg-neutral-200 dark:bg-neutral-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : recentUpdates.length === 0 ? (
            <div className="p-4 bg-white dark:bg-neutral-800/40 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 text-center text-xs text-neutral-400">
              No recent updates from your contacts.
            </div>
          ) : (
            <div className="space-y-2">
              {recentUpdates.map(group => (
                <div
                  key={group.user._id}
                  onClick={() => handleOpenContactStory(group)}
                  className="bg-white dark:bg-neutral-800/80 hover:bg-neutral-50 dark:hover:bg-neutral-750 p-3.5 rounded-xl border border-neutral-200/70 dark:border-neutral-700/60 shadow-xs cursor-pointer transition flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative p-0.5 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500">
                      <img
                        src={group.user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${group.user.username}`}
                        alt={group.user.displayName}
                        className="w-11 h-11 rounded-full object-cover border-2 border-white dark:border-neutral-900"
                      />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {group.user.displayName}
                      </h4>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {new Date(group.latestStoryTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-full font-medium">
                    {group.stories.length} new
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Viewed Updates */}
        {viewedUpdates.length > 0 && (
          <div>
            <h2 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">
              Viewed Updates ({viewedUpdates.length})
            </h2>
            <div className="space-y-2">
              {viewedUpdates.map(group => (
                <div
                  key={group.user._id}
                  onClick={() => handleOpenContactStory(group)}
                  className="bg-white/70 dark:bg-neutral-800/40 hover:bg-white dark:hover:bg-neutral-800 p-3 rounded-xl border border-neutral-200/60 dark:border-neutral-800 cursor-pointer transition flex items-center justify-between opacity-80 hover:opacity-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-0.5 rounded-full border-2 border-neutral-300 dark:border-neutral-700">
                      <img
                        src={group.user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${group.user.username}`}
                        alt={group.user.displayName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                        {group.user.displayName}
                      </h4>
                      <p className="text-xs text-neutral-400">
                        {new Date(group.latestStoryTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-neutral-400">Viewed</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Story Viewer Fullscreen Modal */}
      <StoryViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        currentUser={currentUser}
        activeStoryGroup={activeStoryGroup}
        onStoryDeleted={fetchStories}
      />

      {/* Create Story Dialog */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">Create Status Update</h3>
              <div className="flex bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg text-xs">
                <button
                  onClick={() => setStoryMode('text')}
                  className={`px-3 py-1 rounded-md font-medium transition flex items-center gap-1.5 ${
                    storyMode === 'text'
                      ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                      : 'text-neutral-500'
                  }`}
                >
                  <Type className="w-3.5 h-3.5" />
                  Text
                </button>
                <button
                  onClick={() => setStoryMode('media')}
                  className={`px-3 py-1 rounded-md font-medium transition flex items-center gap-1.5 ${
                    storyMode === 'media'
                      ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                      : 'text-neutral-500'
                  }`}
                >
                  <Image className="w-3.5 h-3.5" />
                  Photo/Video
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4">
              {storyMode === 'text' ? (
                <div>
                  {/* Live Gradient Preview Box */}
                  <div
                    className={`w-full h-44 rounded-xl p-4 flex items-center justify-center text-center bg-gradient-to-br ${selectedGradient} mb-3 shadow-inner`}
                  >
                    <textarea
                      value={textContent}
                      onChange={e => setTextContent(e.target.value)}
                      placeholder="Type a status update..."
                      maxLength={300}
                      rows={3}
                      className="w-full bg-transparent text-white text-base sm:text-lg font-bold placeholder-white/60 text-center outline-none resize-none drop-shadow-sm"
                    />
                  </div>

                  {/* Gradient Selector */}
                  <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 block mb-2">
                    Pick Background Gradient:
                  </label>
                  <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                    {GRADIENTS.map((grad, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedGradient(grad)}
                        className={`w-8 h-8 rounded-full bg-gradient-to-br ${grad} shrink-0 transition-transform ${
                          selectedGradient === grad ? 'scale-115 ring-2 ring-indigo-500 ring-offset-2' : ''
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  {mediaPreview ? (
                    <div className="relative w-full h-52 rounded-xl overflow-hidden bg-black mb-3">
                      {mediaFile?.type.startsWith('video') ? (
                        <video src={mediaPreview} controls className="w-full h-full object-cover" />
                      ) : (
                        <img src={mediaPreview} alt="Preview" className="w-full h-full object-cover" />
                      )}
                      <button
                        onClick={() => {
                          setMediaFile(null);
                          setMediaPreview(null);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full text-xs"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <label className="w-full h-40 border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 transition mb-3">
                      <Image className="w-8 h-8 text-neutral-400 mb-2" />
                      <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        Upload Photo or Video
                      </span>
                      <span className="text-[11px] text-neutral-400 mt-0.5">Supports PNG, JPG, MP4</span>
                      <input
                        type="file"
                        accept="image/*,video/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  )}

                  <input
                    type="text"
                    value={caption}
                    onChange={e => setCaption(e.target.value)}
                    placeholder="Add a caption..."
                    className="w-full p-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 outline-none focus:border-indigo-500 border border-transparent"
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  isSubmitting ||
                  (storyMode === 'text' && !textContent.trim()) ||
                  (storyMode === 'media' && !mediaFile)
                }
                onClick={handlePublishStory}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
              >
                {isSubmitting ? 'Sharing...' : 'Share to Status'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
