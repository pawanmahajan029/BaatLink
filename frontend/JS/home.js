// Check if user is logged in
const token = localStorage.getItem('token');
const username = localStorage.getItem('username');

if (!token) {
    window.location.href = 'login.html';
}

// Display username
document.getElementById('userName').textContent = `Welcome, ${username}`;

// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        window.location.href = 'login.html';
    }
});

// Modal functionality
const modal = document.getElementById('joinModal');
const joinMeetingBtn = document.getElementById('joinMeetingBtn');
const joinLink = document.getElementById('joinLink');
const closeModal = document.querySelector('.close-modal');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const roomCodeInput = document.getElementById('roomCodeInput');

// Open modal when clicking "Join with Code" button
joinMeetingBtn.addEventListener('click', () => {
    modal.classList.add('show');
    roomCodeInput.focus();
});

// Open modal when clicking "Join" link in navbar
joinLink.addEventListener('click', (e) => {
    e.preventDefault();
    modal.classList.add('show');
    roomCodeInput.focus();
});

// Close modal
closeModal.addEventListener('click', () => {
    modal.classList.remove('show');
    roomCodeInput.value = '';
    hideError();
});

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.remove('show');
        roomCodeInput.value = '';
        hideError();
    }
});

// Join room functionality
joinRoomBtn.addEventListener('click', () => {
    joinRoom();
});

// Allow Enter key to join
roomCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinRoom();
    }
});

function joinRoom() {
    const roomCode = roomCodeInput.value.trim().toUpperCase();
    
    if (!roomCode) {
        showError('Please enter a room code');
        return;
    }
    
    if (roomCode.length < 3) {
        showError('Room code is too short');
        return;
    }
    
    // Redirect to room page
    window.location.href = `room.html?room=${roomCode}`;
}

// New Meeting functionality
document.getElementById('newMeetingBtn').addEventListener('click', () => {
    // Generate a random room code
    const roomCode = generateRoomCode();
    
    // Redirect to room page
    window.location.href = `room.html?room=${roomCode}`;
});

// Generate random room code
function generateRoomCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    
    for (let i = 0; i < 3; i++) {
        if (i > 0) code += '-';
        for (let j = 0; j < 3; j++) {
            code += characters.charAt(Math.floor(Math.random() * characters.length));
        }
    }
    
    return code;
}

// Error handling
function showError(message) {
    const errorDiv = document.getElementById('modalError');
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
    
    setTimeout(() => {
        hideError();
    }, 4000);
}

function hideError() {
    const errorDiv = document.getElementById('modalError');
    errorDiv.classList.remove('show');
}

// Smooth scroll for features link
document.querySelector('a[href="#features"]').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('features').scrollIntoView({
        behavior: 'smooth'
    });
});