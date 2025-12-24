// Check authentication
const token = localStorage.getItem('token');
const username = localStorage.getItem('username');

if (!token) {
    alert('Please login to join a meeting');
    window.location.href = 'login.html';
}

// Get room code from URL
const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get('room');

if (!roomCode) {
    alert('Invalid room code');
    window.location.href = 'home.html';
}

// Display room code
document.getElementById('roomCodeDisplay').textContent = roomCode;

// Socket.io connection
const socket = io('http://localhost:3000', {
    auth: {
        token: token
    }
});

// WebRTC Configuration
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
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
        
        // Join room after getting media
        socket.emit('join-room', { roomCode, username });
    } catch (error) {
        console.error('Error accessing media devices:', error);
        alert('Could not access camera/microphone. Please check permissions.');
    }
}

// Socket event handlers
socket.on('user-connected', (userId) => {
    console.log('User connected:', userId);
    updateParticipantCount();
    createPeerConnection(userId);
});

socket.on('user-disconnected', (userId) => {
    console.log('User disconnected:', userId);
    if (peerConnections[userId]) {
        peerConnections[userId].close();
        delete peerConnections[userId];
    }
    removeVideoElement(userId);
    updateParticipantCount();
});

socket.on('offer', async ({ offer, from }) => {
    const pc = createPeerConnection(from);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('answer', { answer, to: from });
});

socket.on('answer', async ({ answer, from }) => {
    const pc = peerConnections[from];
    if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
});

socket.on('ice-candidate', async ({ candidate, from }) => {
    const pc = peerConnections[from];
    if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
});

socket.on('chat-message', ({ message, sender, timestamp }) => {
    addChatMessage(message, sender, timestamp);
});

// Create peer connection
function createPeerConnection(userId) {
    if (peerConnections[userId]) {
        return peerConnections[userId];
    }
    
    const pc = new RTCPeerConnection(configuration);
    peerConnections[userId] = pc;
    
    // Add local stream tracks
    localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
    });
    
    // Handle remote stream
    pc.ontrack = (event) => {
        addVideoElement(userId, event.streams[0]);
    };
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', {
                candidate: event.candidate,
                to: userId
            });
        }
    };
    
    // Create and send offer
    pc.createOffer().then(offer => {
        return pc.setLocalDescription(offer);
    }).then(() => {
        socket.emit('offer', {
            offer: pc.localDescription,
            to: userId
        });
    });
    
    return pc;
}

// Add video element for remote user
function addVideoElement(userId, stream) {
    // Remove existing video if any
    removeVideoElement(userId);
    
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
    
    document.getElementById('videoGrid').appendChild(videoContainer);
}

// Remove video element
function removeVideoElement(userId) {
    const videoElement = document.getElementById(`video-${userId}`);
    if (videoElement) {
        videoElement.remove();
    }
}

// Update participant count
function updateParticipantCount() {
    const count = Object.keys(peerConnections).length + 1;
    const text = count === 1 ? '1 participant' : `${count} participants`;
    document.getElementById('participantCount').textContent = text;
}

// Control button handlers
document.getElementById('toggleVideo').addEventListener('click', () => {
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
    } else {
        btn.classList.remove('active');
        iconOn.style.display = 'none';
        iconOff.style.display = 'block';
    }
});

document.getElementById('toggleAudio').addEventListener('click', () => {
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
    } else {
        btn.classList.remove('active');
        iconOn.style.display = 'none';
        iconOff.style.display = 'block';
    }
});

document.getElementById('shareScreen').addEventListener('click', async () => {
    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true
        });
        
        const screenTrack = screenStream.getVideoTracks()[0];
        
        // Replace video track in all peer connections
        Object.values(peerConnections).forEach(pc => {
            const sender = pc.getSenders().find(s => s.track.kind === 'video');
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
                    const sender = pc.getSenders().find(s => s.track.kind === 'video');
                    if (sender) {
                        sender.replaceTrack(newVideoTrack);
                    }
                });
            });
        };
    } catch (error) {
        console.error('Error sharing screen:', error);
    }
});

// Chat functionality
document.getElementById('toggleChat').addEventListener('click', () => {
    document.getElementById('chatPanel').classList.add('show');
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

function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (message) {
        socket.emit('chat-message', {
            roomCode,
            message,
            sender: username
        });
        input.value = '';
    }
}

function addChatMessage(message, sender, timestamp) {
    const chatMessages = document.getElementById('chatMessages');
    const chatEmpty = chatMessages.querySelector('.chat-empty');
    
    if (chatEmpty) {
        chatEmpty.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
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

// Leave call
document.getElementById('leaveBtn').addEventListener('click', () => {
    if (confirm('Are you sure you want to leave this call?')) {
        leaveCall();
    }
});

function leaveCall() {
    // Stop all tracks
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    
    // Close all peer connections
    Object.values(peerConnections).forEach(pc => pc.close());
    
    // Disconnect socket
    socket.disconnect();
    
    // Redirect to home
    window.location.href = 'home.html';
}

// Initialize on page load
initMedia();