// Check authentication
const token = localStorage.getItem('token');
const username = localStorage.getItem('username');

if (!token) {
    alert('Please login to join a meeting');
    window.location.href = 'login.html';
}

// Get room code from URL
const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get('code'); // Changed from 'room' to 'code'

if (!roomCode) {
    alert('Invalid room code');
    window.location.href = 'home.html';
}

// Display room code
document.getElementById('roomCodeDisplay').textContent = roomCode;

// Socket.io connection - uses dynamic URL from config.js
const socket = io(SOCKET_URL);


// WebRTC Configuration
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

let localStream;
let peerConnections = {};
let isVideoEnabled = true;
let isAudioEnabled = true;

// Initialize media
async function initMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });

        document.getElementById('localVideo').srcObject = localStream;

        // Join room after getting media - using backend's event name
        socket.emit('join-call', roomCode);
        console.log('Joined room:', roomCode);
    } catch (error) {
        console.error('Error accessing media devices:', error);
        alert('Could not access camera/microphone. Please check permissions.');
    }
}

// Socket event handlers - Updated to match backend events
socket.on('user-joined', (socketId, connections) => {
    console.log('User joined:', socketId, 'Total connections:', connections);
    updateParticipantCount(connections.length);

    // Only create peer connection for OTHER users, not yourself
    if (socketId !== socket.id) {
        console.log('Creating peer connection for new user:', socketId);
        createPeerConnection(socketId, true); // true = create offer
    }
});

socket.on('user-left', (socketId) => {
    console.log('User left:', socketId);
    if (peerConnections[socketId]) {
        peerConnections[socketId].close();
        delete peerConnections[socketId];
    }
    removeVideoElement(socketId);
    updateParticipantCount(Object.keys(peerConnections).length + 1);
});

socket.on('signal', async (fromId, message) => {
    console.log('Received signal from:', fromId, 'Type:', message.type || 'candidate');

    if (message.type === 'offer') {
        // Received an offer, create peer connection and send answer
        const pc = createPeerConnection(fromId, false); // false = don't create offer
        await pc.setRemoteDescription(new RTCSessionDescription(message));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('signal', fromId, pc.localDescription);
        console.log('Sent answer to:', fromId);
    } else if (message.type === 'answer') {
        // Received an answer to our offer
        const pc = peerConnections[fromId];
        if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(message));
            console.log('Set remote description (answer) from:', fromId);
        }
    } else if (message.candidate) {
        // Received an ICE candidate
        const pc = peerConnections[fromId];
        if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(message));
            console.log('Added ICE candidate from:', fromId);
        }
    }
});

socket.on('chat-message', (data, sender, socketIdSender) => {
    console.log('Chat message:', data, 'from:', sender);
    addChatMessage(data, sender);
});

// Create peer connection
function createPeerConnection(userId, shouldCreateOffer) {
    if (peerConnections[userId]) {
        console.log('Peer connection already exists for:', userId);
        return peerConnections[userId];
    }

    console.log('Creating peer connection for:', userId, 'shouldCreateOffer:', shouldCreateOffer);
    const pc = new RTCPeerConnection(configuration);
    peerConnections[userId] = pc;

    // Add local stream tracks
    if (localStream) {
        const tracks = localStream.getTracks();
        console.log('📹 Adding', tracks.length, 'tracks to peer connection for:', userId);
        tracks.forEach(track => {
            pc.addTrack(track, localStream);
            console.log('   ✅ Added track:', track.kind, '| Enabled:', track.enabled, '| ID:', track.id);
        });
    } else {
        console.error('❌ No local stream available when creating peer connection!');
    }

    // Handle remote stream
    pc.ontrack = (event) => {
        console.log('✅ Received remote track from:', userId);
        console.log('   Track kind:', event.track.kind);
        console.log('   Track enabled:', event.track.enabled);
        console.log('   Stream ID:', event.streams[0].id);
        console.log('   Stream tracks:', event.streams[0].getTracks().length);
        addVideoElement(userId, event.streams[0]);
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('signal', userId, event.candidate);
            console.log('Sent ICE candidate to:', userId);
        }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
        console.log('Connection state with', userId, ':', pc.connectionState);
        if (pc.connectionState === 'failed') {
            console.error('❌ Connection failed with:', userId);
        }
    };

    // Handle ICE connection state changes
    pc.oniceconnectionstatechange = () => {
        console.log('ICE connection state with', userId, ':', pc.iceConnectionState);
        if (pc.iceConnectionState === 'failed') {
            console.error('❌ ICE connection failed with:', userId);
        } else if (pc.iceConnectionState === 'connected') {
            console.log('✅ ICE connection established with:', userId);
        }
    };

    // Create and send offer only if we should
    if (shouldCreateOffer) {
        pc.createOffer()
            .then(offer => {
                return pc.setLocalDescription(offer);
            })
            .then(() => {
                socket.emit('signal', userId, pc.localDescription);
                console.log('Sent offer to:', userId);
            })
            .catch(error => {
                console.error('Error creating offer:', error);
            });
    }

    return pc;
}

// Add video element for remote user
function addVideoElement(userId, stream) {
    // Remove existing video if any
    removeVideoElement(userId);

    const videoGrid = document.getElementById('videoGrid');

    // Remove placeholder if exists
    const placeholder = videoGrid.querySelector('.no-video-placeholder');
    if (placeholder && placeholder.parentElement) {
        placeholder.parentElement.remove();
    }

    const videoContainer = document.createElement('div');
    videoContainer.className = 'video-container';
    videoContainer.id = `video-${userId}`;
    videoContainer.style.cursor = 'pointer';
    videoContainer.title = 'Click to view fullscreen';

    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsinline = true;
    video.style.cursor = 'pointer';
    video.title = 'Click to view fullscreen';

    // Add click handler directly to video element
    video.addEventListener('click', (e) => {
        console.log('Participant video clicked!', userId);
        e.stopPropagation();
        e.preventDefault();
        openFullscreenVideo(stream, 'Participant');
    });

    const overlay = document.createElement('div');
    overlay.className = 'video-overlay';

    const label = document.createElement('div');
    label.className = 'video-label';
    label.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
        </svg>
        Participant
    `;

    overlay.appendChild(label);
    videoContainer.appendChild(video);
    videoContainer.appendChild(overlay);



    videoGrid.appendChild(videoContainer);
}

// Remove video element
function removeVideoElement(userId) {
    const videoElement = document.getElementById(`video-${userId}`);
    if (videoElement) {
        videoElement.remove();
    }
}

// Update participant count
function updateParticipantCount(count) {
    if (!count) {
        count = Object.keys(peerConnections).length + 1;
    }
    const text = count === 1 ? '1 participant' : `${count} participants`;
    document.getElementById('participantCount').textContent = text;
}

// Control button handlers
function setupControls() {
    // Toggle Video
    document.getElementById('toggleVideo').addEventListener('click', () => {
        if (!localStream) {
            alert('Camera not initialized');
            return;
        }

        isVideoEnabled = !isVideoEnabled;
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = isVideoEnabled;
        }

        const btn = document.getElementById('toggleVideo');
        const iconOn = btn.querySelector('.icon-on');
        const iconOff = btn.querySelector('.icon-off');
        const localVideoContainer = document.getElementById('localVideo').parentElement;

        if (isVideoEnabled) {
            // Camera ON
            btn.classList.add('active');
            iconOn.style.display = 'block';
            iconOff.style.display = 'none';
            btn.setAttribute('data-tooltip', 'Turn off camera');
            localVideoContainer.classList.remove('camera-off');

            // Remove camera-off overlay if it exists
            const overlay = localVideoContainer.querySelector('.camera-off-overlay');
            if (overlay) {
                overlay.remove();
            }
        } else {
            // Camera OFF
            btn.classList.remove('active');
            iconOn.style.display = 'none';
            iconOff.style.display = 'block';
            btn.setAttribute('data-tooltip', 'Turn on camera');
            localVideoContainer.classList.add('camera-off');

            // Add camera-off overlay if it doesn't exist
            if (!localVideoContainer.querySelector('.camera-off-overlay')) {
                const overlay = document.createElement('div');
                overlay.className = 'camera-off-overlay';
                overlay.innerHTML = `
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                    <p>Camera Off</p>
                `;
                localVideoContainer.appendChild(overlay);
            }
        }

        console.log('Video toggled:', isVideoEnabled, '| Track enabled:', videoTrack?.enabled);
    });

    // Toggle Audio
    document.getElementById('toggleAudio').addEventListener('click', () => {
        if (!localStream) {
            alert('Microphone not initialized');
            return;
        }

        isAudioEnabled = !isAudioEnabled;
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = isAudioEnabled;
        }

        const btn = document.getElementById('toggleAudio');
        const iconOn = btn.querySelector('.icon-on');
        const iconOff = btn.querySelector('.icon-off');

        if (isAudioEnabled) {
            btn.classList.add('active');
            iconOn.style.display = 'block';
            iconOff.style.display = 'none';
            btn.setAttribute('data-tooltip', 'Mute microphone');
        } else {
            btn.classList.remove('active');
            iconOn.style.display = 'none';
            iconOff.style.display = 'block';
            btn.setAttribute('data-tooltip', 'Unmute microphone');
        }

        console.log('Audio toggled:', isAudioEnabled);
    });

    // Share Screen
    document.getElementById('shareScreen').addEventListener('click', async () => {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true
            });

            const screenTrack = screenStream.getVideoTracks()[0];

            // Replace video track in all peer connections
            Object.values(peerConnections).forEach(pc => {
                const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) {
                    sender.replaceTrack(screenTrack);
                }
            });

            // Replace local video
            const videoTrack = localStream.getVideoTracks()[0];
            localStream.removeTrack(videoTrack);
            localStream.addTrack(screenTrack);

            screenTrack.onended = () => {
                // Restore camera when screen sharing ends
                navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
                    const newVideoTrack = stream.getVideoTracks()[0];
                    localStream.addTrack(newVideoTrack);

                    Object.values(peerConnections).forEach(pc => {
                        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
                        if (sender) {
                            sender.replaceTrack(newVideoTrack);
                        }
                    });
                });
            };
        } catch (error) {
            console.error('Error sharing screen:', error);
            alert('Could not share screen. Please try again.');
        }
    });

    // Chat functionality
    document.getElementById('toggleChat').addEventListener('click', () => {
        document.getElementById('chatPanel').classList.add('show');
        // Clear notification badge
        const badge = document.querySelector('.notification-badge');
        badge.style.display = 'none';
        badge.textContent = '0';
    });

    document.getElementById('closeChat').addEventListener('click', () => {
        document.getElementById('chatPanel').classList.remove('show');
    });

    document.getElementById('sendBtn').addEventListener('click', sendMessage);
    document.getElementById('chatInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Leave call
    document.getElementById('leaveBtn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Leave button clicked');

        const confirmed = confirm('Are you sure you want to leave this call?');
        console.log('User confirmed:', confirmed);

        if (confirmed) {
            leaveCall();
        }
    });

    // Share meeting code
    document.getElementById('shareCode').addEventListener('click', async () => {
        const code = roomCode;
        const shareText = `Join my BaatLink meeting!\nRoom Code: ${code}\nLink: ${window.location.origin}/room.html?code=${code}`;

        console.log('Share button clicked, code:', code);

        // Try to copy to clipboard
        try {
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(shareText);
                showToast(`✅ Meeting code copied!\n\nRoom Code: ${code}\n\nShare this with others to join.`);
            } else {
                // Fallback for browsers without clipboard API
                prompt('Share this meeting code:', shareText);
            }
        } catch (error) {
            console.error('Clipboard error:', error);
            // Fallback if clipboard fails
            prompt('Share this meeting code:', shareText);
        }
    });

    console.log('All controls initialized');
}

// Toast notification function
function showToast(message) {
    // Remove existing toast if any
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 24px 32px;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        z-index: 10000;
        font-size: 16px;
        white-space: pre-line;
        text-align: center;
        max-width: 400px;
        animation: slideIn 0.3s ease-out;
    `;

    toast.textContent = message;
    document.body.appendChild(toast);

    // Add animation keyframes
    if (!document.querySelector('#toast-animation')) {
        const style = document.createElement('style');
        style.id = 'toast-animation';
        style.textContent = `
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translate(-50%, -60%);
                }
                to {
                    opacity: 1;
                    transform: translate(-50%, -50%);
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Auto-remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translate(-50%, -40%)';
        toast.style.transition = 'all 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();

    if (message) {
        socket.emit('chat-message', message, username);
        input.value = '';
    }
}

function addChatMessage(message, sender) {
    const chatMessages = document.getElementById('chatMessages');
    const chatEmpty = chatMessages.querySelector('.chat-empty');

    if (chatEmpty) {
        chatEmpty.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';

    const senderDiv = document.createElement('div');
    senderDiv.className = 'message-sender';
    senderDiv.textContent = sender === username ? 'You' : sender;

    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.textContent = message;

    messageDiv.appendChild(senderDiv);
    messageDiv.appendChild(textDiv);
    chatMessages.appendChild(messageDiv);

    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Show notification badge if chat is closed
    if (!document.getElementById('chatPanel').classList.contains('show')) {
        const badge = document.querySelector('.notification-badge');
        badge.style.display = 'block';
        const currentCount = parseInt(badge.textContent) || 0;
        badge.textContent = currentCount + 1;
    }
}

function leaveCall() {
    console.log('Leaving call...');

    try {
        // Stop all tracks
        if (localStream) {
            localStream.getTracks().forEach(track => {
                track.stop();
                console.log('Stopped track:', track.kind);
            });
        }

        // Close all peer connections
        Object.values(peerConnections).forEach(pc => {
            try {
                pc.close();
            } catch (e) {
                console.error('Error closing peer connection:', e);
            }
        });

        // Disconnect socket
        if (socket && socket.connected) {
            socket.disconnect();
        }

        console.log('Redirecting to home...');
    } catch (error) {
        console.error('Error during cleanup:', error);
    } finally {
        // Always redirect, even if there's an error
        setTimeout(() => {
            window.location.href = 'home.html';
        }, 100);
    }
}

// Fullscreen video modal functionality
function openFullscreenVideo(stream, label) {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'fullscreen-video-modal';
    modal.id = 'fullscreenModal';

    // Create video element
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsinline = true;
    video.muted = label === 'You'; // Mute local video to avoid feedback

    // Create close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'fullscreen-close-btn';
    closeBtn.innerHTML = `
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
    `;
    closeBtn.onclick = closeFullscreenVideo;

    // Create label
    const videoLabel = document.createElement('div');
    videoLabel.className = 'fullscreen-video-label';
    videoLabel.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
        </svg>
        ${label}
    `;

    modal.appendChild(video);
    modal.appendChild(closeBtn);
    modal.appendChild(videoLabel);
    document.body.appendChild(modal);

    // Fade in animation
    setTimeout(() => modal.classList.add('show'), 10);

    console.log('Opened fullscreen video for:', label);
}

function closeFullscreenVideo() {
    const modal = document.getElementById('fullscreenModal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
        console.log('Closed fullscreen video');
    }
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing room...');

    // Setup all control buttons
    setupControls();

    // Initialize media
    initMedia();

    // Add click handler to local video
    const localVideoContainer = document.querySelector('.video-container');
    if (localVideoContainer) {
        localVideoContainer.style.cursor = 'pointer';
        localVideoContainer.title = 'Click to view fullscreen';
        localVideoContainer.addEventListener('click', (e) => {
            console.log('Local video clicked!');
            e.stopPropagation();
            if (localStream) {
                openFullscreenVideo(localStream, 'You');
            }
        });
    }

    // ESC key to close fullscreen
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeFullscreenVideo();
        }
    });
});