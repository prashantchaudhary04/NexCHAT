import React, { useState, useRef } from 'react';
import { X, User, Camera, Sparkles, Check, AlertCircle, Upload, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { processDeviceProfileImage } from '../utils/image';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, updateUser, logout } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [age, setAge] = useState(user?.age ? String(user.age) : '');
  const [gender, setGender] = useState(user?.gender || '');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !user) return null;

  const handleDeviceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    try {
      const processedDataUrl = await processDeviceProfileImage(file, 400);
      setAvatar(processedDataUrl);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to process image from device');
    } finally {
      // Reset input value to allow selecting same file again if wanted
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRandomAvatar = () => {
    const randomSeed = Math.random().toString(36).substring(7);
    const newAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${randomSeed}`;
    setAvatar(newAvatar);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setUploadError(null);

    const parsedAge = age ? parseInt(age, 10) : undefined;
    if (age && (isNaN(parsedAge!) || parsedAge! < 13 || parsedAge! > 120)) {
      setUploadError('Please enter a valid age between 13 and 120');
      setIsSaving(false);
      return;
    }

    try {
      await updateUser({
        displayName: displayName.trim(),
        bio: bio.trim(),
        avatar: avatar.trim(),
        age: parsedAge,
        gender: gender || undefined,
      });
      setNotice('Profile updated successfully!');
      setTimeout(() => {
        setNotice(null);
        onClose();
      }, 1200);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-500" />
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">Profile Settings</h3>
          </div>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {notice && (
          <div className="m-4 mb-0 p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
            <Check className="w-4 h-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {uploadError && (
          <div className="m-4 mb-0 p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2 border border-rose-200 dark:border-rose-800">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* Avatar edit with device upload */}
          <div className="flex flex-col items-center gap-2.5">
            <div className="relative group">
              <img
                src={avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                alt={user.displayName}
                className="w-24 h-24 rounded-full object-cover border-2 border-indigo-500 shadow-md bg-neutral-100 dark:bg-neutral-800"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/50 text-white rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                title="Upload Photo from Device"
              >
                <Camera className="w-6 h-6" />
                <span className="text-[10px] mt-1 font-bold">Upload Photo</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow border-2 border-white dark:border-neutral-900 cursor-pointer transition"
                title="Upload Photo from Device"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Hidden file input for device photo */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleDeviceUpload}
              accept="image/png,image/jpeg,image/webp,image/gif,image/heic"
              className="hidden"
            />

            <div className="flex items-center gap-3 mt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs px-3 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload from Device
              </button>
              <button
                type="button"
                onClick={handleRandomAvatar}
                className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Randomize
              </button>
            </div>
          </div>

          {/* Username (Unique, Immutable) */}
          <div>
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">
              Username
            </label>
            <div className="py-2.5 px-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-xs text-neutral-600 dark:text-neutral-300 font-mono">
              @{user.username}
            </div>
            <span className="text-[10px] text-neutral-400 mt-1 block">
              Unique handle used across all devices to sign in and find you.
            </span>
          </div>

          {/* Display Name */}
          <div>
            <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full py-2.5 px-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 outline-none focus:border-indigo-500 transition"
              required
            />
          </div>

          {/* Age and Gender */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                Age
              </label>
              <input
                type="number"
                min="13"
                max="120"
                value={age}
                onChange={e => setAge(e.target.value)}
                placeholder="e.g. 24"
                className="w-full py-2 px-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 outline-none focus:border-indigo-500 transition"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
                Gender
              </label>
              <select
                value={gender}
                onChange={e => setGender(e.target.value)}
                className="w-full py-2 px-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 outline-none focus:border-indigo-500 transition"
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
          </div>

          {/* Email (Read-only / verified) */}
          <div>
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">
              Registered Email
            </label>
            <div className="py-2.5 px-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-xs text-neutral-600 dark:text-neutral-300 font-mono truncate">
              {user.email}
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
              About / Bio
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell your contacts about yourself..."
              className="w-full p-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 outline-none focus:border-indigo-500 transition resize-none"
              maxLength={150}
            />
          </div>

          {/* Footer buttons */}
          <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                logout();
              }}
              className="px-3.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              title="Log out of this account"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

