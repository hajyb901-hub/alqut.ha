// =========================================================
// لقطتها 📸 — محرك اللعبة
// المزامنة بين شاشة اللعب ولوحة الحكم عبر نظام الغرف (Supabase Realtime)
// كل لعبة تاخذ كود غرفة عشوائي — تشتغل بين أي جهازين على أي شبكة
// =========================================================

const AVATAR_POOL = ['🦁', '🐯', '🐼', '🦊', '🐸', '🦉', '🐺', '🐨'];
const LOCAL_RESUME_KEY = 'laqtaha_local_resume_v1'; // نسخة محلية فقط لاسترجاع نفس الجهاز بعد تحديث الصفحة

let roomSync = null; // كائن مزامنة الغرفة (يُنشأ عند بدء اللعبة)

let gameState = {
    roomCode: null,
    selectedCatalogs: [],
    playerCount: 4,
    players: [],       // {id, name, avatar, score}
    deck: [],          // {catalogId, q, options, a}
    currentIndex: 0,
    activePlayerId: null,
    optionsShown: false,
    revealedCorrect: false,
    status: 'setup'    // setup | playing | over
};

let lastScores = {};       // لتتبّع تغيّر النقاط وتشغيل حركة "القفزة" عليها فقط
let lastQuestionKey = null; // لإعادة تشغيل حركة دخول بطاقة السؤال عند تغيّرها فعلياً

// إعادة تشغيل حركة CSS على عنصر معيّن (يفيد لما يتغيّر محتوى نفس العنصر دون إعادة إنشائه)
function replayAnimation(el) {
    if (!el) return;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
}

// ---------- أدوات عامة ----------
function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function saveLocalResume() {
    try { localStorage.setItem(LOCAL_RESUME_KEY, JSON.stringify(gameState)); } catch (e) {}
}

function clearLocalResume() {
    try { localStorage.removeItem(LOCAL_RESUME_KEY); } catch (e) {}
}

function pushFullState() {
    saveLocalResume();
    if (roomSync) roomSync.pushState(gameState);
}

// ========================================================= شاشة البداية والانتقال بين الشاشات =========================================================
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function showAbout() { document.getElementById('aboutModal').style.display = 'flex'; }

// ========================================================= خطوات الإعداد =========================================================
function renderCatalogGrid() {
    const grid = document.getElementById('catalogGrid');
    grid.innerHTML = '';
    Object.keys(CATALOGS).forEach(id => {
        const cat = CATALOGS[id];
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'catalog-chip' + (gameState.selectedCatalogs.includes(id) ? ' selected' : '');
        chip.innerHTML = `<span class="cat-emoji">${cat.emoji}</span><span class="cat-name">${cat.name}</span>`;
        chip.onclick = () => toggleCatalog(id);
        grid.appendChild(chip);
    });
}

function toggleCatalog(id) {
    const i = gameState.selectedCatalogs.indexOf(id);
    if (i === -1) gameState.selectedCatalogs.push(id); else gameState.selectedCatalogs.splice(i, 1);
    renderCatalogGrid();
    document.getElementById('toStep2Btn').disabled = gameState.selectedCatalogs.length === 0;
}

function goToSetupStep(step) {
    showScreen('setupScreen');
    document.getElementById('stepCatalogs').style.display = step === 1 ? 'block' : 'none';
    document.getElementById('stepCount').style.display = step === 2 ? 'block' : 'none';
    document.getElementById('stepNames').style.display = step === 3 ? 'block' : 'none';

    ['dot1', 'dot2', 'dot3'].forEach((id, idx) => {
        const dot = document.getElementById(id);
        dot.classList.remove('done', 'current');
        if (idx + 1 < step) dot.classList.add('done');
        else if (idx + 1 === step) dot.classList.add('current');
    });

    if (step === 1) renderCatalogGrid();
    document.getElementById('playerCountVal').textContent = gameState.playerCount;
}

function changePlayerCount(delta) {
    gameState.playerCount = Math.min(8, Math.max(2, gameState.playerCount + delta));
    const val = document.getElementById('playerCountVal');
    val.textContent = gameState.playerCount;
    replayAnimation(val);
}

function renderPlayerNames() {
    const grid = document.getElementById('playersNameGrid');
    grid.innerHTML = '';
    const existing = gameState.players;
    gameState.players = [];
    for (let i = 0; i < gameState.playerCount; i++) {
        const prev = existing[i];
        const player = {
            id: 'p' + (i + 1),
            name: (prev && prev.name) || `لاعب ${i + 1}`,
            avatar: AVATAR_POOL[i % AVATAR_POOL.length],
            score: 0
        };
        gameState.players.push(player);

        const row = document.createElement('div');
        row.className = 'player-name-row';
        row.innerHTML = `
            <span class="p-avatar">${player.avatar}</span>
            <input type="text" maxlength="16" value="${player.name}" data-idx="${i}">
        `;
        row.querySelector('input').addEventListener('input', (e) => {
            gameState.players[i].name = e.target.value.trim() || `لاعب ${i + 1}`;
        });
        grid.appendChild(row);
    }
}

// ========================================================= بناء مجموعة الأسئلة وبدء اللعبة =========================================================
function buildDeck() {
    let pool = [];
    gameState.selectedCatalogs.forEach(id => {
        const cat = CATALOGS[id];
        cat.questions.forEach(qq => pool.push({ catalogId: id, catName: cat.name, catEmoji: cat.emoji, q: qq.q, options: qq.options, a: qq.a }));
    });
    gameState.deck = shuffleArray(pool);
}

function startGame() {
    buildDeck();
    gameState.roomCode = generateRoomCode();
    gameState.currentIndex = 0;
    gameState.activePlayerId = gameState.players[0] ? gameState.players[0].id : null;
    gameState.optionsShown = false;
    gameState.revealedCorrect = false;
    gameState.status = 'playing';

    connectRoom(gameState.roomCode);
    renderRoomBadge();
    pushFullState();
    showScreen('gameScreen');
    renderGameScreen();
}

// يفتح قناة المزامنة مع لوحة الحكم على نفس كود الغرفة
function connectRoom(code) {
    if (roomSync) roomSync.disconnect();
    roomSync = new RoomSync(code);
    roomSync.onJudgeAction = handleJudgeAction;
    roomSync.connect();
}

function renderRoomBadge() {
    const codeEl = document.getElementById('roomCodeText');
    const linkEl = document.getElementById('judgeLinkBtn');
    if (codeEl) codeEl.textContent = gameState.roomCode;
    if (linkEl) linkEl.href = 'judge.html?room=' + encodeURIComponent(gameState.roomCode);
}

function copyRoomCode() {
    if (!gameState.roomCode) return;
    navigator.clipboard?.writeText(gameState.roomCode).catch(() => {});
    const btn = document.getElementById('copyRoomBtn');
    if (!btn) return;
    const original = btn.textContent;
    btn.textContent = 'نُسخ ✓';
    setTimeout(() => { btn.textContent = original; }, 1400);
}

// محاولة استرجاع اللعبة الجارية بعد تحديث الصفحة على نفس الجهاز
function tryResumeLocalGame() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(LOCAL_RESUME_KEY) || 'null'); } catch (e) {}
    if (!saved || saved.status !== 'playing' || !saved.roomCode) return false;

    gameState = saved;
    connectRoom(gameState.roomCode);
    renderRoomBadge();
    showScreen('gameScreen');
    renderGameScreen();
    return true;
}

// ========================================================= عرض شاشة اللعب =========================================================
function renderPlayersBar() {
    const bar = document.getElementById('playersBar');
    bar.innerHTML = '';
    gameState.players.forEach(p => {
        const chip = document.createElement('div');
        chip.className = 'player-chip' + (p.id === gameState.activePlayerId ? ' active-turn' : '');
        const scoreChanged = lastScores[p.id] !== undefined && lastScores[p.id] !== p.score;
        chip.innerHTML = `
            <span class="p-avatar">${p.avatar}</span>
            <span class="p-info">
                <span class="p-name">${p.name}</span>
                <span class="p-score${scoreChanged ? ' bump' : ''}">${p.score}</span>
            </span>`;
        bar.appendChild(chip);
        lastScores[p.id] = p.score;
    });
}

function renderGameScreen() {
    if (gameState.status === 'over') { renderPodium(); showScreen('podiumScreen'); return; }

    renderPlayersBar();
    const total = gameState.deck.length;
    document.getElementById('qNum').textContent = Math.min(gameState.currentIndex + 1, total);
    document.getElementById('qTotal').textContent = total;

    const current = gameState.deck[gameState.currentIndex];
    if (!current) return;

    document.getElementById('qCatEmoji').textContent = current.catEmoji;
    document.getElementById('qCatName').textContent = current.catName;
    document.getElementById('questionText').textContent = current.q;

    const questionKey = gameState.currentIndex + '-' + current.q;
    if (questionKey !== lastQuestionKey) {
        replayAnimation(document.getElementById('questionCardBox'));
        lastQuestionKey = questionKey;
    }

    const optionsGrid = document.getElementById('optionsGrid');
    if (gameState.optionsShown) {
        optionsGrid.style.display = 'grid';
        optionsGrid.innerHTML = '';
        const letters = ['أ', 'ب', 'ج', 'د'];
        current.options.forEach((opt, idx) => {
            const card = document.createElement('div');
            card.className = 'option-card' + (gameState.revealedCorrect && idx === current.a ? ' correct' : '');
            card.innerHTML = `<span class="opt-mark">${letters[idx]}</span><span>${opt}</span>`;
            optionsGrid.appendChild(card);
        });
    } else {
        optionsGrid.style.display = 'none';
    }
}

function renderPodium() {
    const list = document.getElementById('rankingList');
    list.innerHTML = '';
    const sorted = gameState.players.slice().sort((a, b) => b.score - a.score);
    const medals = ['🥇', '🥈', '🥉'];
    sorted.forEach((p, idx) => {
        const row = document.createElement('div');
        row.className = 'rank-row' + (idx === 0 ? ' gold' : '');
        row.innerHTML = `
            <span class="medal">${medals[idx] || (idx + 1)}</span>
            <span class="r-avatar">${p.avatar}</span>
            <span class="r-name">${p.name}</span>
            <span class="r-score">${p.score}</span>`;
        list.appendChild(row);
    });
}

function playFlash() {
    const el = document.getElementById('flashOverlay');
    el.classList.remove('fire'); void el.offsetWidth; el.classList.add('fire');
}

// ========================================================= استقبال أوامر الحكم =========================================================
function handleJudgeAction(msg) {
    if (!msg) return;
    const cur = gameState.deck[gameState.currentIndex];

    switch (msg.type) {
        case 'setActive':
            gameState.activePlayerId = msg.playerId;
            break;
        case 'reveal':
            gameState.optionsShown = true;
            break;
        case 'hideOptions':
            gameState.optionsShown = false;
            gameState.revealedCorrect = false;
            break;
        case 'correct': {
            const player = gameState.players.find(p => p.id === msg.playerId);
            if (player) player.score += 1;
            gameState.optionsShown = true;
            gameState.revealedCorrect = true;
            playFlash();
            break;
        }
        case 'wrong':
            gameState.optionsShown = true;
            gameState.revealedCorrect = true;
            break;
        case 'adjustScore': {
            const player = gameState.players.find(p => p.id === msg.playerId);
            if (player) player.score = Math.max(0, player.score + msg.delta);
            break;
        }
        case 'next':
            if (gameState.currentIndex < gameState.deck.length - 1) {
                gameState.currentIndex += 1;
                gameState.optionsShown = false;
                gameState.revealedCorrect = false;
            } else {
                gameState.status = 'over';
            }
            break;
        case 'prev':
            if (gameState.currentIndex > 0) {
                gameState.currentIndex -= 1;
                gameState.optionsShown = false;
                gameState.revealedCorrect = false;
            }
            break;
        case 'end':
            gameState.status = 'over';
            break;
    }

    renderGameScreen();
    pushFullState();
}

// ========================================================= عند التحميل =========================================================
document.addEventListener('DOMContentLoaded', () => {
    // لو فيه لعبة جارية على نفس الجهاز (تحديث الصفحة بالغلط)، نرجعها بدل ما نبدأ من الصفر
    const resumed = tryResumeLocalGame();
    if (!resumed) renderCatalogGrid();
});
