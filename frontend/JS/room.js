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

// Socket.io connection - Updated to port 8000
const socket = io('http://localhost:8000');

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

    // Create peer connection for new user
    if (socketId !== socket.id) {
        createPeerConnection(socketId);
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
    console.log('Received signal from:', fromId);

    if (message.type === 'offer') {
        const pc = createPeerConnection(fromId);
        await pc.setRemoteDescription(new RTCSessionDescription(message));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('signal', fromId, pc.localDescription);
    } else if (message.type === 'answer') {
        const pc = peerConnections[fromId];
        if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(message));
        }
    } else if (message.candidate) {
        const pc = peerConnections[fromId];
        if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(message));
        }
    }
});

socket.on('chat-message', (data, sender, socketIdSender) => {
    console.log('Chat message:', data, 'from:', sender);
    addChatMessage(data, sender);
});

// Create peer connection
function createPeerConnection(userId) {
    if (peerConnections[userId]) {
        return peerConnections[userId];
    }

    console.log('Creating peer connection for:', userId);
    const pc = new RTCPeerConnection(configuration);
    peerConnections[userId] = pc;

    // Add local stream tracks
    localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
    });

    // Handle remote stream
    pc.ontrack = (event) => {
        console.log('Received remote track from:', userId);
        addVideoElement(userId, event.streams[0]);
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('signal', userId, event.candidate);
        }
    };

    // Create and send offer
    pc.createOffer().then(offer => {
        return pc.setLocalDescription(offer);
    }).then(() => {
        socket.emit('signal', userId, pc.localDescription);
    }).catch(error => {
        console.error('Error creating offer:', error);
    });

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

    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsinline = true;

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

        if (isVideoEnabled) {
            btn.classList.add('active');
            iconOn.style.display = 'block';
            iconOff.style.display = 'none';
            btn.setAttribute('data-tooltip', 'Turn off camera');
        } else {
            btn.classList.remove('active');
            iconOn.style.display = 'none';
            iconOff.style.display = 'block';
            btn.setAttribute('data-tooltip', 'Turn on camera');
        }

        console.log('Video toggled:', isVideoEnabled);
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

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing room...');

    // Setup all control buttons
    setupControls();

    // Initialize media
    initMedia();
});