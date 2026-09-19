import React, { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Maximize2, Minimize2, Volume2, Users, UserCheck } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export const CallModal: React.FC = () => {
  const {
    activeCall,
    localStream,
    remoteStream,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    switchCallType,
  } = useSocket();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Bind local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, activeCall.isOpen]);

  // Bind remote stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, activeCall.isOpen]);

  if (!activeCall.isOpen) return null;

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const displayName = activeCall.isGroup
    ? activeCall.groupName || 'Group Call'
    : activeCall.peerUser?.displayName || activeCall.peerUser?.username || 'User';

  const avatarSrc = activeCall.isGroup
    ? `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(activeCall.groupName || 'group')}`
    : activeCall.peerUser?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeCall.peerUser?.username || 'user'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 sm:backdrop-blur-md p-0 sm:p-4 select-none">
      <div className="relative w-full h-full sm:max-w-2xl sm:h-[80vh] sm:max-h-[700px] bg-neutral-900 rounded-none sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between border-0 sm:border sm:border-neutral-800">
        {/* Top Call Info */}
        <div className="absolute top-0 inset-x-0 z-20 p-4 sm:p-5 pt-[max(1rem,env(safe-area-inset-top,1rem))] bg-gradient-to-b from-black/85 via-black/45 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={avatarSrc}
                alt={displayName}
                className="w-10 h-10 rounded-full object-cover border border-white/40 bg-neutral-800"
              />
              {activeCall.isGroup && (
                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center text-white text-[9px] border border-white">
                  <Users className="w-2.5 h-2.5" />
                </span>
              )}
            </div>
            <div>
              <h3 className="text-white text-sm sm:text-base font-bold flex items-center gap-2">
                <span>{displayName}</span>
                {activeCall.isGroup && (
                  <span className="text-[10px] px-2 py-0.5 bg-indigo-500/30 border border-indigo-400/40 text-indigo-300 rounded-full font-normal">
                    Group Call ({activeCall.participantsCount || 2})
                  </span>
                )}
              </h3>
              <p className="text-white/70 text-xs">
                {activeCall.status === 'incoming' && (
                  activeCall.isGroup
                    ? `Incoming Group Call from ${activeCall.callerUser?.displayName || 'Member'}...`
                    : 'Incoming Call...'
                )}
                {activeCall.status === 'outgoing' && 'Ringing...'}
                {activeCall.status === 'connected' && `Connected • ${formatDuration(activeCall.duration)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-white text-xs font-medium uppercase tracking-wider">
              {activeCall.isGroup ? `Group ${activeCall.callType}` : `${activeCall.callType} Call`}
            </span>
          </div>
        </div>

        {/* Center Canvas / Video Area */}
        <div className="flex-1 relative w-full h-full flex items-center justify-center bg-neutral-950 overflow-hidden">
          {/* Incoming Call Screen */}
          {activeCall.status === 'incoming' && (
            <div className="text-center p-6 z-10 flex flex-col items-center">
              <div className="relative mb-6">
                <div className="w-28 h-28 rounded-full bg-indigo-500/20 animate-ping absolute inset-0" />
                <img
                  src={avatarSrc}
                  alt={displayName}
                  className="w-28 h-28 rounded-full object-cover border-4 border-indigo-500 relative z-10 shadow-xl bg-neutral-800"
                />
              </div>
              <h2 className="text-xl font-bold text-white mb-1">
                {displayName}
              </h2>
              <p className="text-neutral-400 text-sm mb-8">
                {activeCall.isGroup
                  ? `${activeCall.callerUser?.displayName || 'A member'} is inviting you to a group ${activeCall.callType} call`
                  : `Incoming ${activeCall.callType} call...`}
              </p>

              <div className="flex items-center gap-8">
                <button
                  onClick={() => rejectCall('Declined by user')}
                  className="w-16 h-16 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition"
                  title="Decline"
                >
                  <PhoneOff className="w-7 h-7" />
                </button>
                <button
                  onClick={acceptCall}
                  className="w-16 h-16 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition animate-bounce"
                  title="Accept"
                >
                  <Phone className="w-7 h-7" />
                </button>
              </div>
            </div>
          )}

          {/* Outgoing Call Screen */}
          {activeCall.status === 'outgoing' && (
            <div className="text-center p-6 z-10 flex flex-col items-center">
              <div className="relative mb-6">
                <div className="w-24 h-24 rounded-full bg-indigo-500/20 animate-pulse absolute inset-0" />
                <img
                  src={avatarSrc}
                  alt={displayName}
                  className="w-24 h-24 rounded-full object-cover border-4 border-indigo-500 relative z-10 shadow-xl bg-neutral-800"
                />
              </div>
              <h2 className="text-xl font-bold text-white mb-1">
                {displayName}
              </h2>
              <p className="text-neutral-400 text-sm mb-8">Calling...</p>

              <div className="flex items-center justify-center">
                <button
                  onClick={endCall}
                  className="w-16 h-16 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition"
                  title="Cancel Call"
                >
                  <PhoneOff className="w-7 h-7" />
                </button>
              </div>
            </div>
          )}

          {/* Connected Call Screen */}
          {activeCall.status === 'connected' && (
            <div className="relative w-full h-full">
              {activeCall.isGroup ? (
                /* Group Call Active Grid */
                <div className="w-full h-full p-6 pt-20 pb-24 grid grid-cols-2 gap-4 items-center justify-center bg-radial from-neutral-800 to-neutral-950 overflow-y-auto">
                  {/* Self Tile */}
                  <div className="relative aspect-video sm:aspect-square bg-neutral-800/90 rounded-2xl border border-neutral-700 overflow-hidden flex flex-col items-center justify-center p-4 shadow-lg">
                    {activeCall.callType === 'video' && !activeCall.isVideoOff ? (
                      <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-full bg-indigo-600/30 border-2 border-indigo-400 flex items-center justify-center mb-2">
                          <Users className="w-8 h-8 text-indigo-300" />
                        </div>
                        <span className="text-white text-xs font-bold">You</span>
                        <span className="text-neutral-400 text-[10px]">
                          {activeCall.isAudioMuted ? 'Muted' : 'Speaking...'}
                        </span>
                      </div>
                    )}
                    <span className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[10px] text-white">
                      You {activeCall.isAudioMuted ? '(Muted)' : ''}
                    </span>
                  </div>

                  {/* Group Members Tile */}
                  <div className="relative aspect-video sm:aspect-square bg-neutral-800/90 rounded-2xl border border-neutral-700 overflow-hidden flex flex-col items-center justify-center p-4 shadow-lg">
                    <div className="w-16 h-16 rounded-full bg-emerald-600/20 border-2 border-emerald-400 flex items-center justify-center mb-2 animate-pulse">
                      <Volume2 className="w-8 h-8 text-emerald-400" />
                    </div>
                    <span className="text-white text-xs font-bold">{activeCall.groupName || 'Group'}</span>
                    <span className="text-emerald-400 text-[10px] font-mono mt-1">
                      {activeCall.participantsCount || 2} Connected • {formatDuration(activeCall.duration)}
                    </span>
                    <span className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[10px] text-emerald-400">
                      Active Call Room
                    </span>
                  </div>
                </div>
              ) : activeCall.callType === 'video' ? (
                <>
                  {/* Remote Video (Full) */}
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  {/* Local Video (Floating Picture-in-Picture) */}
                  <div className="absolute bottom-24 right-5 w-36 h-48 bg-neutral-800 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl z-20">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className={`w-full h-full object-cover ${activeCall.isVideoOff ? 'hidden' : ''}`}
                    />
                    {activeCall.isVideoOff && (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900 text-neutral-400 text-[10px]">
                        <VideoOff className="w-6 h-6 mb-1 opacity-60" />
                        Camera Off
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Audio Call Screen */
                <div className="w-full h-full flex flex-col items-center justify-center bg-radial from-neutral-800 to-neutral-950">
                  <div className="relative mb-4">
                    <div className="w-32 h-32 rounded-full bg-emerald-500/10 animate-ping absolute inset-0" />
                    <img
                      src={avatarSrc}
                      alt={displayName}
                      className="w-32 h-32 rounded-full object-cover border-4 border-emerald-500 relative z-10 shadow-2xl bg-neutral-800"
                    />
                  </div>
                  <h3 className="text-white text-lg font-bold">
                    {displayName}
                  </h3>
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs mt-2 font-mono">
                    <Volume2 className="w-4 h-4 animate-pulse" />
                    <span>In Call: {formatDuration(activeCall.duration)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Control Dock (Connected mode) */}
        {activeCall.status === 'connected' && (
          <div className="absolute bottom-0 inset-x-0 z-30 p-4 sm:p-5 pb-[max(1.25rem,env(safe-area-inset-bottom,1.25rem))] bg-gradient-to-t from-black/90 via-black/60 to-transparent flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
            {/* Mute Mic */}
            <button
              onClick={toggleMute}
              className={`p-3.5 rounded-full transition ${
                activeCall.isAudioMuted
                  ? 'bg-rose-500 text-white'
                  : 'bg-white/20 hover:bg-white/30 text-white'
              }`}
              title={activeCall.isAudioMuted ? 'Unmute Mic' : 'Mute Mic'}
            >
              {activeCall.isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Toggle Video */}
            <button
              onClick={toggleVideo}
              className={`p-3.5 rounded-full transition ${
                activeCall.isVideoOff
                  ? 'bg-rose-500 text-white'
                  : 'bg-white/20 hover:bg-white/30 text-white'
              }`}
              title={activeCall.isVideoOff ? 'Enable Camera' : 'Turn Off Camera'}
            >
              {activeCall.isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>

            {/* Switch Call Type */}
            <button
              onClick={switchCallType}
              className="p-3.5 bg-white/20 hover:bg-white/30 text-white rounded-full transition"
              title="Switch Voice/Video mode"
            >
              {activeCall.callType === 'video' ? <Phone className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>

            {/* End Call */}
            <button
              onClick={endCall}
              className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center gap-2 text-sm font-bold shadow-lg transition hover:scale-105"
            >
              <PhoneOff className="w-5 h-5" />
              <span>{activeCall.isGroup ? 'Leave Call' : 'End Call'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
