import React, { useEffect, useState, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Eye, Trash2, Clock } from 'lucide-react';
import { Story, StoryGroup, User } from '../types';
import { api } from '../services/api';

interface StoryViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  activeStoryGroup: StoryGroup | null;
  onStoryDeleted?: (storyId: string) => void;
}

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  activeStoryGroup,
  onStoryDeleted,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showViewersSheet, setShowViewersSheet] = useState(false);
  const timerRef = useRef<any>(null);

  const stories = activeStoryGroup?.stories || [];
  const currentStory: Story | undefined = stories[currentIndex];
  const isOwnStory = activeStoryGroup?.user._id === currentUser?._id;

  // Mark viewed when viewing someone else's story
  useEffect(() => {
    if (!currentStory || !isOpen || isOwnStory) return;
    api.stories.view(currentStory._id).catch(console.error);
  }, [currentStory?._id, isOpen, isOwnStory]);

  // Story playback timer
  useEffect(() => {
    if (!isOpen || !currentStory || isPaused || showViewersSheet) return;

    setProgress(0);
    const duration = 5000; // 5 seconds per story
    const stepTime = 50;
    const increment = (stepTime / duration) * 100;

    timerRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          handleNext();
          return 0;
        }
        return prev + increment;
      });
    }, stepTime);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, currentIndex, isPaused, showViewersSheet, stories.length]);

  if (!isOpen || !activeStoryGroup || stories.length === 0 || !currentStory) {
    return null;
  }

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setProgress(0);
    }
  };

  const handleDeleteStory = async () => {
    if (!window.confirm('Delete this story update?')) return;
    try {
      await api.stories.delete(currentStory._id);
      onStoryDeleted?.(currentStory._id);
      if (stories.length <= 1) {
        onClose();
      } else {
        handleNext();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete story');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md select-none">
      {/* Mobile-sized or desktop centered story player container */}
      <div
        className="relative w-full max-w-md h-[95vh] max-h-[850px] bg-neutral-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between border border-neutral-800"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Top Progress Bars */}
        <div className="absolute top-0 inset-x-0 z-30 p-3 pt-3 flex gap-1.5">
          {stories.map((story, idx) => (
            <div key={story._id} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-75"
                style={{
                  width:
                    idx < currentIndex
                      ? '100%'
                      : idx === currentIndex
                      ? `${progress}%`
                      : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* User Header */}
        <div className="absolute top-6 inset-x-0 z-30 px-4 py-2 flex items-center justify-between bg-gradient-to-b from-black/70 via-black/30 to-transparent">
          <div className="flex items-center gap-2.5">
            <img
              src={activeStoryGroup.user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeStoryGroup.user.username}`}
              alt={activeStoryGroup.user.displayName}
              className="w-9 h-9 rounded-full object-cover border border-white/60"
            />
            <div>
              <h4 className="text-white text-xs sm:text-sm font-bold leading-tight">
                {activeStoryGroup.user.displayName}
              </h4>
              <p className="text-white/70 text-[10px] sm:text-xs">
                {new Date(currentStory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {isOwnStory && (
              <button
                onClick={handleDeleteStory}
                className="p-1.5 text-white/80 hover:text-rose-400 rounded-full transition"
                title="Delete story"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-white/80 hover:text-white rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Story Body */}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
          {currentStory.mediaType === 'image' && currentStory.mediaUrl && (
            <img
              src={currentStory.mediaUrl}
              alt="Story"
              className="w-full h-full object-cover"
            />
          )}

          {currentStory.mediaType === 'video' && currentStory.mediaUrl && (
            <video
              src={currentStory.mediaUrl}
              autoPlay
              muted
              playsInline
              loop
              className="w-full h-full object-cover"
            />
          )}

          {currentStory.mediaType === 'text' && (
            <div
              className={`w-full h-full p-8 flex items-center justify-center text-center bg-gradient-to-br ${
                currentStory.backgroundGradient || 'from-indigo-600 to-purple-800'
              }`}
            >
              <p
                className="text-xl sm:text-2xl font-bold leading-relaxed max-w-sm drop-shadow-md break-words"
                style={{ color: currentStory.textColor || '#ffffff' }}
              >
                {currentStory.textContent}
              </p>
            </div>
          )}

          {/* Caption for photo/video */}
          {currentStory.mediaType !== 'text' && currentStory.textContent && (
            <div className="absolute bottom-16 inset-x-0 px-4 py-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-center">
              <p className="text-white text-sm font-medium drop-shadow-sm">
                {currentStory.textContent}
              </p>
            </div>
          )}

          {/* Navigation Tap Zones */}
          <div
            className="absolute inset-y-0 left-0 w-1/3 cursor-pointer z-10"
            onClick={handlePrev}
          />
          <div
            className="absolute inset-y-0 right-0 w-2/3 cursor-pointer z-10"
            onClick={handleNext}
          />
        </div>

        {/* Left / Right chevron desktop buttons */}
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="hidden sm:flex absolute -left-14 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition disabled:opacity-30"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={handleNext}
          className="hidden sm:flex absolute -right-14 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Bottom Bar: Viewers button if own story */}
        {isOwnStory && (
          <div className="absolute bottom-0 inset-x-0 z-30 p-3 pb-4 bg-gradient-to-t from-black/90 to-transparent flex justify-center">
            <button
              onClick={() => setShowViewersSheet(true)}
              className="px-4 py-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full text-white text-xs font-semibold flex items-center gap-2 transition"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{currentStory.views?.length || 0} Views</span>
            </button>
          </div>
        )}

        {/* Viewers Sheet (Slides up for own story) */}
        {showViewersSheet && (
          <div className="absolute inset-x-0 bottom-0 z-40 bg-neutral-900/95 backdrop-blur-xl border-t border-neutral-800 rounded-t-3xl max-h-[60%] flex flex-col p-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Eye className="w-4 h-4 text-indigo-400" />
                <span>Viewed by ({currentStory.views?.length || 0})</span>
              </div>
              <button
                onClick={() => setShowViewersSheet(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2 space-y-2.5">
              {!currentStory.views || currentStory.views.length === 0 ? (
                <div className="text-center py-6 text-neutral-500 text-xs">
                  No views yet. When your contacts view this status, they will appear here with exact timestamps.
                </div>
              ) : (
                currentStory.views.map((viewer, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={viewer.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${viewer.username}`}
                        alt={viewer.username}
                        className="w-8 h-8 rounded-full object-cover border border-neutral-700"
                      />
                      <div>
                        <p className="text-xs font-semibold text-white">@{viewer.username}</p>
                        <p className="text-[10px] text-neutral-400 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(viewer.viewedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                      Viewed
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
