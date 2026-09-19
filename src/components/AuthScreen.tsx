import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Shield,
  Sparkles,
  User,
  Lock,
  Mail,
  AtSign,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Smartphone,
  Monitor,
  Loader2,
  Camera,
  Upload,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { processDeviceProfileImage } from '../utils/image';

export const AuthScreen: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState(() => {
    return localStorage.getItem('nexus_last_username') || '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register form state
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [avatar, setAvatar] = useState('');
  const [avatarSource, setAvatarSource] = useState<'default' | 'uploaded' | 'random'>('default');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [registerPassword, setRegisterPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [bio, setBio] = useState('');

  // Live username check state
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<{
    checked: boolean;
    available: boolean;
    message: string;
  }>({ checked: false, available: false, message: '' });

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { login, register } = useAuth();
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounced check for unique username
  useEffect(() => {
    if (!isRegister) return;

    const trimmed = username.trim().toLowerCase();
    if (trimmed.length < 3) {
      setUsernameStatus({ checked: false, available: false, message: '' });
      return;
    }

    if (!/^[a-z0-9_.]{3,24}$/.test(trimmed)) {
      setUsernameStatus({
        checked: true,
        available: false,
        message: '3-24 characters, only letters, numbers, underscores, or dots',
      });
      return;
    }

    if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    setIsCheckingUsername(true);

    checkTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await api.auth.checkUsername(trimmed);
        setUsernameStatus({
          checked: true,
          available: res.available,
          message: res.message,
        });
      } catch (err: any) {
        setUsernameStatus({
          checked: false,
          available: false,
          message: '',
        });
      } finally {
        setIsCheckingUsername(false);
      }
    }, 350);

    return () => {
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    };
  }, [username, isRegister]);

  const handleDeviceAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsUploadingAvatar(true);
    try {
      const dataUrl = await processDeviceProfileImage(file, 400);
      setAvatar(dataUrl);
      setAvatarSource('uploaded');
    } catch (err: any) {
      setError(err.message || 'Failed to process photo from your device.');
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRandomAvatar = () => {
    const seed = Math.random().toString(36).substring(7);
    setAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`);
    setAvatarSource('random');
  };

  const handleResetAvatar = () => {
    setAvatar('');
    setAvatarSource('default');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanId = loginIdentifier.trim();
    if (!cleanId) {
      setError('Please enter your unique username or email.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      await login(cleanId, password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your username and password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) {
      setError('Please choose a unique username.');
      return;
    }

    if (!/^[a-z0-9_.]{3,24}$/.test(cleanUsername)) {
      setError('Username must be 3-24 characters using letters, numbers, _, or .');
      return;
    }

    if (usernameStatus.checked && !usernameStatus.available) {
      setError(`Username "${cleanUsername}" is already taken. Please choose another.`);
      return;
    }

    // Validate email is MANDATORY
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Email address is mandatory. Please enter your email address.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setError('Please enter a valid email address (e.g. name@example.com).');
      return;
    }

    // Validate age is MANDATORY
    if (!age || !age.trim()) {
      setError('Age is mandatory. Please enter your age.');
      return;
    }
    const parsedAge = parseInt(age.trim(), 10);
    if (isNaN(parsedAge) || parsedAge < 13 || parsedAge > 120) {
      setError('Please enter a valid age between 13 and 120.');
      return;
    }

    // Validate gender is MANDATORY
    if (!gender || !gender.trim()) {
      setError('Gender is mandatory. Please select your gender.');
      return;
    }

    if (!registerPassword || registerPassword.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }

    setIsLoading(true);
    try {
      await register({
        username: cleanUsername,
        displayName: displayName.trim() || cleanUsername,
        email: cleanEmail,
        password: registerPassword,
        age: parsedAge,
        gender: gender.trim(),
        avatar: avatar || undefined,
        bio: bio.trim(),
      });
    } catch (err: any) {
      setError(err.message || 'Registration failed. Check username availability and details.');
    } finally {
      setIsLoading(false);
    }
  };

  // Compute live preview avatar
  const activeAvatarPreview =
    avatar ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${username.trim() || 'nexus'}`;

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Background Ambience */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-5">
          <div className="w-14 h-14 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-indigo-500/25">
            <MessageSquare className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">NexusChat</h1>
          <p className="text-xs text-slate-400 mt-1">
            Persistent Cross-Device Messaging • WebRTC Calls • 24h Stories
          </p>

          {/* Cross-device sync indicator banner */}
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-950/60 border border-indigo-500/30 rounded-full text-[11px] text-indigo-300 font-medium">
            <Smartphone className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Mobile</span>
            <span className="text-indigo-500">•</span>
            <Monitor className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>PC Sync Ready</span>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-slate-800/80 p-1 rounded-2xl mb-5 text-xs font-semibold">
          <button
            type="button"
            id="auth-tab-login"
            onClick={() => {
              setIsRegister(false);
              setError(null);
            }}
            className={`flex-1 py-2 rounded-xl transition ${
              !isRegister
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign In with Username
          </button>
          <button
            type="button"
            id="auth-tab-register"
            onClick={() => {
              setIsRegister(true);
              setError(null);
            }}
            className={`flex-1 py-2 rounded-xl transition ${
              isRegister
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Create Unique Account
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <Shield className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        {!isRegister ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Unique Username or Email
              </label>
              <div className="relative">
                <AtSign className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                <input
                  type="text"
                  id="input-login-username"
                  value={loginIdentifier}
                  onChange={e => setLoginIdentifier(e.target.value)}
                  placeholder="e.g. alex_dev or your_username"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition font-mono"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Password
                </label>
                <span className="text-[10px] text-slate-500">
                  Restores all chats & media
                </span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="input-login-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-800/60 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              id="btn-login-submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/30 transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Restoring Account Data...</span>
                </>
              ) : (
                <>
                  <span>Sign In & Restore Data</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* Register Form */
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
            {/* Profile Picture Upload Section */}
            <div className="p-3 bg-slate-800/40 border border-slate-700/60 rounded-2xl flex flex-col items-center text-center">
              <div className="relative group mb-2">
                <img
                  src={activeAvatarPreview}
                  alt="Profile Avatar"
                  className="w-20 h-20 rounded-full object-cover border-2 border-indigo-500 shadow-md shadow-indigo-500/20 bg-slate-800"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition cursor-pointer"
                  title="Upload picture from device"
                >
                  <Camera className="w-5 h-5" />
                  <span className="text-[9px] font-bold mt-0.5">Upload</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="absolute bottom-0 right-0 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow border-2 border-slate-900 cursor-pointer transition"
                  title="Upload from device"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleDeviceAvatarUpload}
                accept="image/png,image/jpeg,image/webp,image/gif,image/heic"
                className="hidden"
              />

              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="px-3 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 rounded-lg text-[11px] font-semibold text-indigo-300 transition flex items-center gap-1.5 cursor-pointer"
                >
                  {isUploadingAvatar ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Upload className="w-3 h-3" />
                  )}
                  <span>Upload from Device</span>
                </button>
                <button
                  type="button"
                  onClick={handleRandomAvatar}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[11px] font-medium text-slate-300 transition flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Random</span>
                </button>
                {avatarSource === 'uploaded' && (
                  <button
                    type="button"
                    onClick={handleResetAvatar}
                    className="p-1 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 rounded-lg text-[11px] text-rose-300 transition cursor-pointer"
                    title="Remove custom picture"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {avatarSource === 'uploaded' ? (
                <span className="text-[10px] text-emerald-400 font-medium mt-1.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Custom device photo attached
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 mt-1.5">
                  Optional: Upload any photo from your phone or PC
                </span>
              )}
            </div>

            {/* Username */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">
                  Choose Unique Username <span className="text-rose-400">*</span>
                </label>
                {isCheckingUsername && (
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Checking...
                  </span>
                )}
                {!isCheckingUsername && usernameStatus.checked && (
                  <span
                    className={`text-[10px] flex items-center gap-1 font-medium ${
                      usernameStatus.available ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {usernameStatus.available ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" /> Available
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3" /> Taken
                      </>
                    )}
                  </span>
                )}
              </div>
              <div className="relative">
                <AtSign className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                <input
                  type="text"
                  id="input-register-username"
                  value={username}
                  onChange={e => {
                    const clean = e.target.value.toLowerCase().replace(/\s+/g, '_');
                    setUsername(clean);
                  }}
                  placeholder="e.g. jordan_tech"
                  className={`w-full pl-10 pr-4 py-2 bg-slate-800/60 border rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 outline-none transition font-mono ${
                    usernameStatus.checked
                      ? usernameStatus.available
                        ? 'border-emerald-500/60 focus:border-emerald-400'
                        : 'border-rose-500/60 focus:border-rose-400'
                      : 'border-slate-700/80 focus:border-indigo-500'
                  }`}
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
            </div>

            {/* Display Name */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Display Name (Your Name) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                <input
                  type="text"
                  id="input-register-displayname"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="e.g. Jordan Smith"
                  className="w-full pl-10 pr-4 py-2 bg-slate-800/60 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition"
                  required
                />
              </div>
            </div>

            {/* Mandatory Email */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">
                  Email Address <span className="text-rose-400 font-bold">*</span>
                </label>
                <span className="text-[10px] text-rose-400 font-semibold uppercase tracking-wider">
                  Mandatory
                </span>
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                <input
                  type="email"
                  id="input-register-email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="jordan@example.com"
                  className="w-full pl-10 pr-4 py-2 bg-slate-800/60 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition"
                  required
                />
              </div>
            </div>

            {/* Mandatory Age & Gender (2-column row) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Age <span className="text-rose-400 font-bold">*</span>
                  </label>
                  <span className="text-[10px] text-rose-400 font-semibold uppercase tracking-wider">
                    Required
                  </span>
                </div>
                <input
                  type="number"
                  id="input-register-age"
                  min="13"
                  max="120"
                  value={age}
                  onChange={e => setAge(e.target.value)}
                  placeholder="e.g. 24"
                  className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition"
                  required
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Gender <span className="text-rose-400 font-bold">*</span>
                  </label>
                  <span className="text-[10px] text-rose-400 font-semibold uppercase tracking-wider">
                    Required
                  </span>
                </div>
                <select
                  id="select-register-gender"
                  value={gender}
                  onChange={e => setGender(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-800/60 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white outline-none focus:border-indigo-500 transition"
                  required
                >
                  <option value="" disabled className="bg-slate-900 text-slate-400">Select Gender</option>
                  <option value="Male" className="bg-slate-900 text-white">Male</option>
                  <option value="Female" className="bg-slate-900 text-white">Female</option>
                  <option value="Non-binary" className="bg-slate-900 text-white">Non-binary</option>
                  <option value="Other" className="bg-slate-900 text-white">Other</option>
                  <option value="Prefer not to say" className="bg-slate-900 text-white">Prefer not to say</option>
                </select>
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Password <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                <input
                  type={showRegisterPassword ? 'text' : 'password'}
                  id="input-register-password"
                  value={registerPassword}
                  onChange={e => setRegisterPassword(e.target.value)}
                  placeholder="Minimum 4 characters"
                  className="w-full pl-10 pr-10 py-2 bg-slate-800/60 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition"
                  required
                  minLength={4}
                />
                <button
                  type="button"
                  onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                  tabIndex={-1}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition"
                  aria-label={showRegisterPassword ? 'Hide password' : 'Show password'}
                >
                  {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Save this password to sign in from your mobile phone or PC.
              </p>
            </div>

            {/* Bio (Optional) */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Bio (Optional)
              </label>
              <input
                type="text"
                id="input-register-bio"
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Software engineer, traveler, gamer..."
                className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition"
                maxLength={120}
              />
            </div>

            <button
              type="submit"
              id="btn-register-submit"
              disabled={isLoading || (usernameStatus.checked && !usernameStatus.available)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/30 transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Register & Save Credentials</span>
                  <CheckCircle2 className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
