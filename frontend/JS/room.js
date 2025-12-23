const socket = io('http://localhost:8000');
const params = new URLSearchParams(window.location.search);
const roomCode = params.get('room');
const username = localStorage.getItem('username') || 'Anonymous';

let localStream;
let peers = {};
let isVideoEnabled = true;
let isAudioEnabled = true;

// Display room code
document.getElementById('roomCodeDisplay').textContent = roomCode;

// Initialize
async function init() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        
        document.getElementById('localVideo').srcObject = localStream;
        socket.emit('join-call', roomCode);
    } catch (error) {
        console.error('Error accessing media devices:', error);
        alert('Could not access camera/microphone');
    }
}

// Socket events
socket.on('user-joined', (socketId, participants) => {
    console.log('User joined:', socketId);
    updateParticipantCount(participants.length);
    createPeerConnection(socketId);
});

socket.on('user-left', (socketId) => {
    console.log('User left:', socketId);
    if (peers[socketId]) {
        peers[socketId].close();
        delete peers[socketId];
        
        const videoElement = document.getElementById(`video-${socketId}`);
        if (videoElement) {
            videoElement.remove();
        }
    }
    updateParticipantCount(Object.keys(peers).length + 1);
});

socket.on('signal', async (fromId, message) => {
    if (!peers[fromId]) {
        createPeerConnection(fromId);
    }
    
    const peer = peers[fromId];
    
    if (message.type === 'offer') {
        await peer.setRemoteDescription(new RTCSessionDescription(message));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit('signal', fromId, answer);
    } else if (message.type === 'answer') {
        await peer.setRemoteDescription(new RTCSessionDescription(message));
    } else if (message.candidate) {
        await peer.addIceCandidate(new RTCIceCandidate(message));
    }
});

socket.on('chat-message', (data, sender, senderId) => {
    addChatMessage(sender, data);
});

// WebRTC functions
function createPeerConnection(socketId) {
    const peer = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    
    localStream.getTracks().forEach(track => {
        peer.addTrack(track, localStream);
    });
    
    peer.ontrack = (event) => {
        addRemoteVideo(socketId, event.streams[0]);
    };
    
    peer.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('signal', socketId, event.candidate);
        }
    };
    
    peers[socketId] = peer;
    
    peer.createOffer().then(offer => {
        peer.setLocalDescription(offer);
        socket.emit('signal', socketId, offer);
    });
}

function addRemoteVideo(socketId, stream) {
    let videoContainer = document.getElementById(`video-${socketId}`);
    
    if (!videoContainer) {
        videoContainer = document.createElement('div');
        videoContainer.id = `video-${socketId}`;
        videoContainer.className = 'video-container';
        
        const video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        video.srcObject = stream;
        
        const label = document.createElement('div');
        label.className = 'video-label';
        label.textContent = `Participant ${Object.keys(peers).length}`;
        
        videoContainer.appendChild(video);
        videoContainer.appendChild(label);
        document.getElementById('videoGrid').appendChild(videoContainer);
    }
}

// Controls
document.getElementById('toggleVideo').addEventListener('click', () => {
    isVideoEnabled = !isVideoEnabled;
    localStream.getVideoTracks()[0].enabled = isVideoEnabled;
    document.getElementById('toggleVideo').classList.toggle('active');
});

document.getElementById('toggleAudio').addEventListener('click', () => {
    isAudioEnabled = !isAudioEnabled;
    localStream.getAudioTracks()[0].enabled = isAudioEnabled;
    document.getElementById('toggleAudio').classList.toggle('active');
});

document.getElementById('toggleChat').addEventListener('click', () => {
    document.getElementById('chatPanel').classList.toggle('show');
});

document.getElementById('closeChat').addEventListener('click', () => {
    document.getElementById('chatPanel').classList.remove('show');
});

document.getElementById('leaveBtn').addEventListener('click', () => {
    localStream.getTracks().forEach(track => track.stop());
    window.location.href = 'index.html';
});

// Chat
document.getElementById('sendBtn').addEventListener('click', sendMessage);
document.getElementById('chatInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (message) {
        socket.emit('chat-message', message, username);
        addChatMessage(username, message);
        input.value = '';
    }
}

function addChatMessage(sender, message) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    messageDiv.innerHTML = `
        <div class="message-sender">${sender}</div>
        <div class="message-text">${message}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateParticipantCount(count) {
    document.getElementById('participantCount').textContent = `Participants: ${count}`;
}

// Start
init();