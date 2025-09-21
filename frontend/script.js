let currentPage = 1;
const rowsPerPage = 10;
let leaderboardData = [];
let sortColumn = 'points';
let sortDirection = -1; // -1 for desc, 1 for asc

function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            document.getElementById('lat').value = position.coords.latitude;
            document.getElementById('lng').value = position.coords.longitude;
        }, (error) => {
            alert('Error getting location: ' + error.message);
        });
    } else {
        alert('Geolocation not supported.');
    }
}

function validateDarpanId(id) {
    return /^[a-zA-Z0-9]{6,}$/.test(id); // Simple alphanumeric check, min 6 chars
}

function getDarpanUser(isNgo) {
    const darpanId = document.getElementById('darpanId').value.trim();
    return isNgo ? 'NGO_' + darpanId : darpanId;
}

function initUser(darpanId) {
    let users = JSON.parse(localStorage.getItem('users')) || {};
    if (!users[darpanId]) {
        users[darpanId] = { points: 0, level: 1 };
        localStorage.setItem('users', JSON.stringify(users));
    }
    return users;
}

function updateUserPoints(darpanId, addPoints) {
    let users = JSON.parse(localStorage.getItem('users')) || {};
    if (users[darpanId]) {
        users[darpanId].points += addPoints;
        users[darpanId].level = Math.floor(users[darpanId].points / 10) + 1;
        localStorage.setItem('users', JSON.stringify(users));
    }
}

function getCurrentUser() {
    return localStorage.getItem('currentUser');
}

function saveCurrentUser(darpanId) {
    localStorage.setItem('currentUser', darpanId);
}

function loadDarpanForForm(formType) {
    const currentUser = getCurrentUser();
    if (currentUser) {
        const section = document.getElementById('darpanSection');
        const input = document.getElementById('darpanId');
        section.style.display = 'block';
        input.value = currentUser;
    } else {
        alert('Please login with your Darpan ID first.');
        window.location.href = 'login.html';
    }
}

function toggleLoginHelp(event) {
    const checkbox = event.target;
    const help = document.getElementById('loginHelp');
    if (checkbox.checked) {
        help.textContent = 'NGO mode enabled. Verify your Darpan ID at ngodarpan.gov.in.';
    } else {
        help.textContent = 'Alphanumeric, min 6 chars. NGOs: Check box for prefix.';
    }
}

function login(event) {
    event.preventDefault();
    const darpanId = document.getElementById('darpanId').value.trim();
    const isNgo = document.getElementById('isNgo').checked;

    if (!validateDarpanId(darpanId)) {
        document.getElementById('loginStatus').textContent = 'Invalid Darpan ID: Must be alphanumeric and at least 6 characters.';
        return;
    }

    const userId = getDarpanUser(isNgo);
    initUser(userId);
    saveCurrentUser(userId);
    document.getElementById('loginStatus').textContent = 'Login successful! Redirecting...';
    setTimeout(() => window.location.href = 'index.html', 1000);
}

function logout() {
    localStorage.removeItem('currentUser');
    document.getElementById('loginStatus').textContent = 'Logged out successfully!';
    document.getElementById('loginForm').reset();
    document.getElementById('isNgo').checked = false;
}

function submitReport(event) {
    event.preventDefault();
    const darpanId = getCurrentUser();
    if (!darpanId) {
        alert('Please login with your Darpan ID first.');
        window.location.href = 'login.html';
        return;
    }

    const description = document.getElementById('description').value;
    const type = document.getElementById('type').value;
    const lat = document.getElementById('lat').value;
    const lng = document.getElementById('lng').value;
    const imageFile = document.getElementById('image').files[0];

    if (!description || !type || !lat || !lng) {
        alert('Please fill all fields.');
        return;
    }

    if (description.length < 10) {
        alert('Description too short (mock spam filter).');
        return;
    }

    initUser(darpanId);

    const reader = new FileReader();
    reader.onload = function(e) {
        const imageBase64 = e.target.result;
        const hazard = {
            id: Date.now(),
            reporter: darpanId,
            description,
            type,
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            image: imageBase64,
            status: 'pending',
            validation_status: 'pending',
            votes: { true: 0, false: 0 },
            resolvedBy: null,
            solutions: [],
            validatedBy: {}
        };

        let hazards = JSON.parse(localStorage.getItem('hazards')) || [];
        hazards.push(hazard);
        localStorage.setItem('hazards', JSON.stringify(hazards));

        document.getElementById('status').textContent = 'Report submitted! It will appear in Validate Hazards for review.';
        document.getElementById('reportForm').reset();
    };

    if (imageFile) {
        reader.readAsDataURL(imageFile);
    } else {
        const hazard = {
            id: Date.now(),
            reporter: darpanId,
            description,
            type,
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            image: null,
            status: 'pending',
            validation_status: 'pending',
            votes: { true: 0, false: 0 },
            resolvedBy: null,
            solutions: [],
            validatedBy: {}
        };
        let hazards = JSON.parse(localStorage.getItem('hazards')) || [];
        hazards.push(hazard);
        localStorage.setItem('hazards', JSON.stringify(hazards));
        document.getElementById('status').textContent = 'Report submitted! It will appear in Validate Hazards for review.';
        document.getElementById('reportForm').reset();
    }
}

function loadValidatedHazards() {
    const hazards = JSON.parse(localStorage.getItem('hazards')) || [];
    const urgencyMap = { air: 3, water: 2, waste: 1 };
    const filtered = hazards.filter(h => h.validation_status === 'valid')
        .sort((a, b) => urgencyMap[b.type] - urgencyMap[a.type]);
    const list = document.getElementById('hazardList');
    list.innerHTML = '';

    const map = L.map('map').setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    filtered.forEach(hazard => {
        const li = document.createElement('li');
        li.innerHTML = `
            <strong>Type: ${hazard.type} (Urgency: ${urgencyMap[hazard.type]})</strong><br>
            Description: ${hazard.description}<br>
            Reporter: ${hazard.reporter}<br>
            Location: (${hazard.lat}, ${hazard.lng})<br>
            Status: ${hazard.status} ${hazard.resolvedBy ? `(Resolved by: ${hazard.resolvedBy})` : ''}<br>
            ${hazard.image ? `<img src="${hazard.image}" alt="Hazard Image" style="max-width: 200px;">` : ''}<br>
            ${hazard.solutions.length ? `Solutions: <ul>${hazard.solutions.map(s => `<li>${s.validator}: ${s.solution}</li>`).join('')}</ul>` : 'No solutions yet.'}
            <button onclick="updateStatus(${hazard.id}, 'resolved')">Mark Resolved</button>
        `;
        list.appendChild(li);

        L.marker([hazard.lat, hazard.lng]).addTo(map)
            .bindPopup(`${hazard.type}: ${hazard.description}`);
    });
}

function loadPendingHazards() {
    const hazards = JSON.parse(localStorage.getItem('hazards')) || [];
    const filtered = hazards.filter(h => h.validation_status === 'pending');
    const list = document.getElementById('pendingList');
    list.innerHTML = '';

    filtered.forEach(hazard => {
        const li = document.createElement('li');
        li.innerHTML = `
            <strong>Type: ${hazard.type}</strong><br>
            Description: ${hazard.description}<br>
            Reporter: ${hazard.reporter}<br>
            Location: (${hazard.lat}, ${hazard.lng})<br>
            Votes: Valid (${hazard.votes.true}) / Invalid (${hazard.votes.false})<br>
            ${hazard.image ? `<img src="${hazard.image}" alt="Hazard Image" style="max-width: 200px;">` : ''}<br>
            <label for="solution_${hazard.id}">Suggest a Solution (optional):</label>
            <textarea id="solution_${hazard.id}" placeholder="Enter solution here"></textarea><br>
            <button onclick="vote(${hazard.id}, true)">Valid (True)</button>
            <button onclick="vote(${hazard.id}, false)">Invalid (False)</button>
        `;
        list.appendChild(li);
    });
}

function vote(id, isValid) {
    const darpanId = getCurrentUser();
    if (!darpanId) {
        alert('Please login with your Darpan ID first.');
        window.location.href = 'login.html';
        return;
    }

    initUser(darpanId);

    let hazards = JSON.parse(localStorage.getItem('hazards')) || [];
    hazards = hazards.map(h => {
        if (h.id === id) {
            if (h.validatedBy[darpanId]) {
                alert('You have already voted on this hazard.');
                return h;
            }
            h.votes[isValid ? 'true' : 'false']++;
            h.validatedBy[darpanId] = true;
            const solution = document.getElementById(`solution_${id}`).value.trim();
            if (isValid && solution) {
                h.solutions.push({ validator: darpanId, solution });
            }
            if (h.votes.true >= 3) {
                h.validation_status = 'valid';
                updateUserPoints(h.reporter, 10);
            } else if (h.votes.false >= 3) {
                h.validation_status = 'invalid';
            }
            return h;
        }
        return h;
    });
    localStorage.setItem('hazards', JSON.stringify(hazards));

    updateUserPoints(darpanId, 1);

    loadPendingHazards();
}

function updateStatus(id, newStatus) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        alert('Please login with your Darpan ID first.');
        window.location.href = 'login.html';
        return;
    }

    let hazards = JSON.parse(localStorage.getItem('hazards')) || [];
    hazards = hazards.map(h => {
        if (h.id === id) {
            h.status = newStatus;
            h.resolvedBy = currentUser;
            if (newStatus === 'resolved' && currentUser.startsWith('NGO_')) {
                updateUserPoints(currentUser, 5);
            }
            return h;
        }
        return h;
    });
    localStorage.setItem('hazards', JSON.stringify(hazards));
    loadValidatedHazards();
}

let sortKey = 'points';
let sortAsc = false;

function loadLeaderboard() {
    const users = JSON.parse(localStorage.getItem('users')) || {};
    leaderboardData = Object.entries(users).map(([darpanId, { points, level }]) => ({ user: darpanId, points, level }));
    sortLeaderboard();
    displayPage(currentPage);
}

function sortLeaderboard() {
    leaderboardData.sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];
        if (sortKey === 'points' || sortKey === 'level') {
            valA = Number(valA);
            valB = Number(valB);
        }
        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
    });
}

function displayPage(page) {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = leaderboardData.slice(start, end);
    const body = document.getElementById('leaderboardBody');
    body.innerHTML = '';
    pageData.forEach((entry, index) => {
        const rank = start + index + 1;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${rank}</td>
            <td>${entry.user}</td>
            <td>${entry.points}</td>
            <td><span class="badge ${getBadgeClass(entry.level)}">Level ${entry.level}</span></td>
        `;
        body.appendChild(tr);
    });
    document.getElementById('pageInfo').textContent = `Page ${page} of ${Math.ceil(leaderboardData.length / rowsPerPage)}`;
}

function getBadgeClass(level) {
    if (level >= 10) return 'badge-platinum';
    if (level >= 5) return 'badge-gold';
    if (level >= 3) return 'badge-silver';
    return 'badge-bronze';
}

function sortTable(key) {
    if (sortKey === key) {
        sortAsc = !sortAsc;
    } else {
        sortKey = key;
        sortAsc = false;
    }
    sortLeaderboard();
    displayPage(currentPage);
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        displayPage(currentPage);
    }
}

function nextPage() {
    if (currentPage * rowsPerPage < leaderboardData.length) {
        currentPage++;
        displayPage(currentPage);
    }
}