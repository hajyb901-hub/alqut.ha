// =========================================================
// لقطتها 📸 — محرك اللعبة
// شاشة اللعب + لوحة الحكم عبر Supabase Realtime
// =========================================================

const AVATAR_POOL = ['🦁', '🐯', '🐼', '🦊', '🐸', '🦉', '🐺', '🐨'];
const LOCAL_RESUME_KEY = 'laqtaha_local_resume_v2';

let roomSync = null;
let duelTimer = null;
let duelUiTimer = null;
let nextQuestionTimer = null;
let gameState = {
    roomCode: null,
    selectedCatalogs: [],
    questionCount: 15,
    playerCount: 4,
    difficulty: 'medium',
    players: [],
    deck: [],
    currentIndex: 0,
    activePlayerId: null,
    optionsShown: false,
    revealedCorrect: false,
    result: null, // correct | wrong | null
    status: 'setup',
    duel: null, // { playerIds:[id,id], phase, introEndsAt, countdownEndsAt, endsAt, questionIndex }
    duelPresentation: null,
    duelSchedule: [],
    nextDuelAt: null
};

let lastScores = {};
let lastQuestionKey = null;

function replayAnimation(el) {
    if (!el) return;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
}

function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
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

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

function goHome() {
    if (nextQuestionTimer) { clearTimeout(nextQuestionTimer); nextQuestionTimer = null; }
    if (duelTimer) { clearTimeout(duelTimer); duelTimer = null; }
    if (duelUiTimer) { clearTimeout(duelUiTimer); duelUiTimer = null; }
    if (roomSync) { roomSync.disconnect(); roomSync = null; }
    clearLocalResume();
    gameState = {
        roomCode: null, selectedCatalogs: [], questionCount: 15, playerCount: 4, difficulty: 'medium', players: [],
        deck: [], currentIndex: 0, activePlayerId: null, optionsShown: false, revealedCorrect: false,
        result: null, status: 'setup', duel: null, duelPresentation: null, duelSchedule: [], nextDuelAt: null
    };
    showScreen('startScreen');
}
function showAbout() {
    const modal = document.getElementById('aboutModal');
    if (modal) modal.style.display = 'flex';
}
function closeAbout() {
    const modal = document.getElementById('aboutModal');
    if (modal) modal.style.display = 'none';
}

// ========================================================= إعداد الجولة
function renderCatalogGrid() {
    const grid = document.getElementById('catalogGrid');
    if (!grid) return;
    grid.innerHTML = '';
    Object.keys(CATALOGS).forEach(id => {
        const cat = CATALOGS[id];
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'catalog-chip' + (gameState.selectedCatalogs.includes(id) ? ' selected' : '');
        chip.innerHTML = `<span class="cat-emoji">${cat.emoji}</span><span class="cat-name">${cat.name}</span><span class="cat-count">${cat.questions.length} سؤال</span>`;
        chip.onclick = () => toggleCatalog(id);
        grid.appendChild(chip);
    });
    const btn = document.getElementById('toStep2Btn');
    if (btn) btn.disabled = gameState.selectedCatalogs.length === 0;
}

function toggleCatalog(id) {
    const i = gameState.selectedCatalogs.indexOf(id);
    if (i === -1) gameState.selectedCatalogs.push(id);
    else gameState.selectedCatalogs.splice(i, 1);
    renderCatalogGrid();
}

function goToSetupStep(step) {
    showScreen('setupScreen');
    ['stepCatalogs', 'stepCount', 'stepNames'].forEach((id, idx) => {
        const el = document.getElementById(id);
        if (el) el.style.display = step === idx + 1 ? 'block' : 'none';
    });
    ['dot1', 'dot2', 'dot3'].forEach((id, idx) => {
        const dot = document.getElementById(id);
        if (!dot) return;
        dot.classList.remove('done', 'current');
        if (idx + 1 < step) dot.classList.add('done');
        else if (idx + 1 === step) dot.classList.add('current');
    });
    if (step === 1) renderCatalogGrid();
    const pc = document.getElementById('playerCountVal');
    const qc = document.getElementById('questionCountVal');
    if (pc) pc.textContent = gameState.playerCount;
    if (qc) qc.textContent = gameState.questionCount;
    updateDifficultyButtons();
}

function setDifficulty(level) {
    const allowed = ['easy', 'medium', 'hard', 'mixed'];
    if (!allowed.includes(level)) return;
    gameState.difficulty = level;
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.difficulty === level);
    });
}

function updateDifficultyButtons() {
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.difficulty === gameState.difficulty);
    });
}

function changePlayerCount(delta) {
    gameState.playerCount = Math.min(8, Math.max(2, gameState.playerCount + delta));
    const val = document.getElementById('playerCountVal');
    if (val) { val.textContent = gameState.playerCount; replayAnimation(val); }
}

function changeQuestionCount(delta) {
    const allowed = [5, 10, 15, 20, 25, 30, 40];
    let idx = allowed.indexOf(gameState.questionCount);
    idx = Math.min(allowed.length - 1, Math.max(0, idx + delta));
    gameState.questionCount = allowed[idx];
    const val = document.getElementById('questionCountVal');
    if (val) { val.textContent = gameState.questionCount; replayAnimation(val); }
}

function renderPlayerNames() {
    const grid = document.getElementById('playersNameGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const existing = gameState.players || [];
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
        row.innerHTML = `<span class="p-avatar">${player.avatar}</span><input type="text" maxlength="16" value="${escapeHtml(player.name)}" data-idx="${i}">`;
        row.querySelector('input').addEventListener('input', e => {
            gameState.players[i].name = e.target.value.trim() || `لاعب ${i + 1}`;
        });
        grid.appendChild(row);
    }
}

function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function getLocalDifficulty(catalogId, questionIndex, question) {
    if (question?.difficulty) return question.difficulty;
    // احتياطي للبنوك القديمة التي لا تحمل مستوى السؤال.
    return questionIndex >= 12 ? 'easy' : 'medium';
}

function difficultyMatches(questionDifficulty, selectedDifficulty, catalogId) {
    if (catalogId === 'religion' && !questionDifficulty) return true;
    if (selectedDifficulty === 'mixed') return true;
    if (selectedDifficulty === 'easy') return questionDifficulty === 'easy';
    if (selectedDifficulty === 'medium') return questionDifficulty === 'easy' || questionDifficulty === 'medium';
    if (selectedDifficulty === 'hard') return questionDifficulty === 'medium' || questionDifficulty === 'hard';
    return true;
}

function normalizeQuestion(raw, catalogId, cat) {
    if (!raw || !raw.q || !Array.isArray(raw.options) || raw.options.length < 2) return null;
    const correct = Number.isInteger(raw.a) ? raw.a : Number(raw.correct_index);
    if (!Number.isInteger(correct) || correct < 0 || correct >= raw.options.length) return null;
    const indexed = raw.options.map((text, index) => ({ text: String(text), index }));
    const mixed = shuffleArray(indexed);
    return {
        catalogId,
        catName: cat?.name || raw.cat_name || catalogId,
        catEmoji: cat?.emoji || raw.cat_emoji || '🧩',
        q: String(raw.q),
        options: mixed.map(x => x.text),
        a: mixed.findIndex(x => x.index === correct),
        difficulty: raw.difficulty || getLocalDifficulty(catalogId, 0)
    };
}

async function fetchCloudQuestions() {
    if (typeof supabaseClient === 'undefined') return [];
    try {
        const { data, error } = await supabaseClient
            .from('questions_bank')
            .select('id,category,difficulty,question,options,correct_index')
            .in('category', gameState.selectedCatalogs);
        if (error || !Array.isArray(data)) return [];
        const result = [];
        for (const row of data) {
            const cat = CATALOGS[row.category];
            if (!cat) continue;
            const raw = { q: row.question, options: row.options, correct_index: row.correct_index, difficulty: row.difficulty };
            if (!difficultyMatches(row.difficulty, gameState.difficulty, row.category)) continue;
            const normalized = normalizeQuestion(raw, row.category, cat);
            if (normalized) result.push(normalized);
        }
        return result;
    } catch (e) {
        console.warn('[لقطتها] تعذر جلب بنك الأسئلة السحابي، نستخدم البنك المحلي.', e);
        return [];
    }
}

function buildLocalDeck() {
    let pool = [];
    gameState.selectedCatalogs.forEach(id => {
        const cat = CATALOGS[id];
        if (!cat) return;
        cat.questions.forEach((qq, qi) => {
            const difficulty = getLocalDifficulty(id, qi, qq);
            if (!difficultyMatches(difficulty, gameState.difficulty, id)) return;
            const normalized = normalizeQuestion({ ...qq, difficulty }, id, cat);
            if (normalized) pool.push(normalized);
        });
    });
    return shuffleArray(pool);
}

async function buildDeck() {
    // نبدأ من السحابي، ثم نكمل من البنك المحلي إذا كان عدد الأسئلة غير كافٍ.
    const cloudPool = await fetchCloudQuestions();
    const localPool = buildLocalDeck();
    const seen = new Set();
    const pool = [];
    shuffleArray(cloudPool).forEach(q => { const key = q.catalogId + '|' + q.q; if (!seen.has(key)) { seen.add(key); pool.push(q); } });
    shuffleArray(localPool).forEach(q => { const key = q.catalogId + '|' + q.q; if (!seen.has(key)) { seen.add(key); pool.push(q); } });
    gameState.deck = pool.slice(0, Math.min(gameState.questionCount, pool.length));
    return gameState.deck;
}

async function startGame() {
    if (!gameState.selectedCatalogs.length) return;
    renderPlayerNames();
    const startBtn = document.querySelector("#stepNames .nav-btn.solid");
    if (startBtn) { startBtn.disabled = true; startBtn.textContent = "جاري تجهيز الأسئلة… ⏳"; }
    await buildDeck();
    if (startBtn) { startBtn.disabled = false; startBtn.textContent = "ابدأ اللقطة! 📸"; }
    if (!gameState.deck.length) return;

    gameState.roomCode = generateRoomCode();
    gameState.currentIndex = 0;
    gameState.activePlayerId = gameState.players[0]?.id || null;
    gameState.optionsShown = true;
    gameState.revealedCorrect = false;
    gameState.result = null;
    gameState.status = 'playing';
    gameState.duel = null;
    gameState.duelPresentation = null;
    gameState.duelSchedule = buildDuelSchedule(gameState.deck.length, gameState.playerCount);
    gameState.nextDuelAt = gameState.duelSchedule[0] || null;

    connectRoom(gameState.roomCode);
    renderRoomBadge();
    pushFullState();
    showScreen('gameScreen');
    renderGameScreen();
    if (gameState.duelSchedule.includes(1)) startDuel();
}

function connectRoom(code) {
    if (roomSync) roomSync.disconnect();
    roomSync = new RoomSync(code);
    roomSync.onJudgeAction = handleJudgeAction;
    roomSync.onStatusChange = updateMainConnectionStatus;
    roomSync.connect();
    roomSync.startPolling(2500);
}

function updateMainConnectionStatus(status) {
    const footer = document.querySelector('.sync-footer');
    if (!footer) return;
    const labels = {
        SUBSCRIBED: 'متصل بالغرفة — المزامنة مباشرة ✓',
        CHANNEL_ERROR: 'تعذر الاتصال اللحظي — نحاول إعادة الاتصال…',
        TIMED_OUT: 'انتهت مهلة الاتصال — نحاول مرة ثانية…',
        CLOSED: 'انقطع الاتصال — نحاول إعادة الاتصال…'
    };
    footer.innerHTML = '<span class="live-dot"></span> ' + (labels[status] || 'يتحقق من اتصال الغرفة…');
    footer.classList.toggle('sync-error', ['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status));
}

function renderRoomBadge() {
    const codeEl = document.getElementById('roomCodeText');
    const linkEl = document.getElementById('judgeLinkBtn');
    if (codeEl) codeEl.textContent = gameState.roomCode || '—';
    if (linkEl && gameState.roomCode) linkEl.href = 'judge.html?room=' + encodeURIComponent(gameState.roomCode);
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

function tryResumeLocalGame() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(LOCAL_RESUME_KEY) || 'null'); } catch (e) {}
    if (!saved || saved.status !== 'playing' || !saved.roomCode || !Array.isArray(saved.deck)) return false;
    gameState = saved;
    connectRoom(gameState.roomCode);
    renderRoomBadge();
    showScreen('gameScreen');
    renderGameScreen();
    if (gameState.duel) scheduleDuelFinish();
    return true;
}

// ========================================================= عرض اللعبة
function renderPlayersBar() {
    const bar = document.getElementById('playersBar');
    if (!bar) return;
    bar.innerHTML = '';
    const duelIds = gameState.duel?.playerIds || gameState.duelPresentation?.playerIds || null;
    const visiblePlayers = duelIds ? gameState.players.filter(p => duelIds.includes(p.id)) : gameState.players;
    bar.classList.toggle('duel-only', !!duelIds);
    visiblePlayers.forEach(p => {
        const chip = document.createElement('div');
        const inDuel = !!duelIds?.includes(p.id);
        chip.className = 'player-chip' + (p.id === gameState.activePlayerId ? ' active-turn' : '') + (inDuel ? ' duel-player' : '');
        const scoreChanged = lastScores[p.id] !== undefined && lastScores[p.id] !== p.score;
        chip.innerHTML = `<span class="p-avatar">${p.avatar}</span><span class="p-info"><span class="p-name">${escapeHtml(p.name)}</span><span class="p-score${scoreChanged ? ' bump' : ''}">${p.score}</span></span>${inDuel ? '<span class="duel-dot">VS</span>' : ''}`;
        bar.appendChild(chip);
        lastScores[p.id] = p.score;
    });
}

function renderGameScreen() {
    if (gameState.status === 'over') {
        document.body.classList.remove('duel-question-mode');
        renderPodium();
        showScreen('podiumScreen');
        return;
    }
    renderPlayersBar();
    const currentDuelQuestion = !!gameState.duelPresentation && gameState.duelPresentation.questionIndex === gameState.currentIndex;
    document.body.classList.toggle('duel-question-mode', currentDuelQuestion && !gameState.duel);
    const total = gameState.deck.length;
    const qNum = document.getElementById('qNum');
    const qTotal = document.getElementById('qTotal');
    if (qNum) qNum.textContent = Math.min(gameState.currentIndex + 1, total);
    if (qTotal) qTotal.textContent = total;

    const current = gameState.deck[gameState.currentIndex];
    if (!current) return;
    document.getElementById('qCatEmoji').textContent = current.catEmoji;
    document.getElementById('qCatName').textContent = current.catName;
    document.getElementById('questionText').textContent = current.q;

    const duelInfo = document.getElementById('duelInfo');
    const duelPair = gameState.duel?.playerIds || gameState.duelPresentation?.playerIds || null;
    if (duelInfo) {
        if (duelPair) {
            const a = gameState.players.find(p => p.id === duelPair[0]);
            const b = gameState.players.find(p => p.id === duelPair[1]);
            duelInfo.innerHTML = `<span class="duel-strip-player">${a?.avatar || '👤'} ${escapeHtml(a?.name || 'لاعب')}</span><span class="vs-inline"><i>V</i><i>S</i></span><span class="duel-strip-player">${b?.avatar || '👤'} ${escapeHtml(b?.name || 'لاعب')}</span>`;
            duelInfo.style.display = 'flex';
            duelInfo.classList.toggle('question-duel-strip', !gameState.duel);
        } else {
            duelInfo.style.display = 'none';
            duelInfo.classList.remove('question-duel-strip');
        }
    }

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
            card.innerHTML = `<span class="opt-mark">${letters[idx]}</span><span>${escapeHtml(opt)}</span>`;
            optionsGrid.appendChild(card);
        });
    } else {
        optionsGrid.style.display = 'none';
    }

    updateResultGlow();
    renderDuelOverlay();
    if (gameState.duel) scheduleDuelFinish();
}

function renderPodium() {
    const list = document.getElementById('rankingList');
    if (!list) return;
    list.innerHTML = '';
    const sorted = gameState.players.slice().sort((a, b) => b.score - a.score);
    const medals = ['🥇', '🥈', '🥉'];
    sorted.forEach((p, idx) => {
        const row = document.createElement('div');
        row.className = 'rank-row' + (idx === 0 ? ' gold' : '');
        row.innerHTML = `<span class="medal">${medals[idx] || (idx + 1)}</span><span class="r-avatar">${p.avatar}</span><span class="r-name">${escapeHtml(p.name)}</span><span class="r-score">${p.score}</span>`;
        list.appendChild(row);
    });
}

function renderDuelOverlay() {
    const overlay = document.getElementById('duelOverlay');
    if (!overlay) return;
    if (!gameState.duel) {
        overlay.classList.remove('show');
        overlay.removeAttribute('data-phase');
        if (duelUiTimer) { clearInterval(duelUiTimer); duelUiTimer = null; }
        return;
    }
    const a = gameState.players.find(p => p.id === gameState.duel.playerIds[0]);
    const b = gameState.players.find(p => p.id === gameState.duel.playerIds[1]);
    const aEl = document.getElementById('duelPlayerA');
    const bEl = document.getElementById('duelPlayerB');
    const cEl = document.getElementById('duelCountdown');
    if (aEl) aEl.innerHTML = `<span class="duel-avatar">${a?.avatar || '👤'}</span><strong>${escapeHtml(a?.name || 'لاعب')}</strong>`;
    if (bEl) bEl.innerHTML = `<span class="duel-avatar">${b?.avatar || '👤'}</span><strong>${escapeHtml(b?.name || 'لاعب')}</strong>`;
    overlay.dataset.phase = gameState.duel.phase || 'intro';
    overlay.classList.add('show');
    const tick = () => {
        if (!gameState.duel) return;
        const now = Date.now();
        let seconds = 3;
        if (gameState.duel.phase === 'countdown') {
            seconds = Math.max(1, Math.ceil((gameState.duel.endsAt - now) / 1000));
        }
        if (cEl) cEl.textContent = seconds;
    };
    tick();
    if (duelUiTimer) clearInterval(duelUiTimer);
    duelUiTimer = setInterval(tick, 100);
}

function updateResultGlow() {
    document.body.classList.remove('answer-correct', 'answer-wrong');
    if (gameState.result === 'correct') document.body.classList.add('answer-correct');
    if (gameState.result === 'wrong') document.body.classList.add('answer-wrong');
}

function buildDuelSchedule(totalQuestions, playerCount) {
    if (playerCount < 3 || totalQuestions < 3) return [];
    const schedule = [];
    const third = Math.ceil(totalQuestions / 3);
    for (let t = 0; t < 3; t++) {
        const start = t * third + 1;
        const end = Math.min(totalQuestions, (t + 1) * third);
        if (start > end) continue;
        const choices = [];
        for (let n = start; n <= end; n++) choices.push(n);
        // مواجهة واحدة بالضبط داخل كل ثلث، ما دام الثلث يحتوي أسئلة.
        schedule.push(choices[randomInt(0, choices.length - 1)]);
    }
    return schedule.sort((a,b) => a-b);
}

function startDuel() {
    if (gameState.playerCount < 3 || gameState.players.length < 3) return;
    if (gameState.duel) return;
    const questionNumber = gameState.currentIndex + 1;
    const scheduled = gameState.duelSchedule || [];
    if (!scheduled.includes(questionNumber)) return;
    const pair = shuffleArray(gameState.players).slice(0, 2);
    const now = Date.now();
    const introEndsAt = now + 2800;
    const countdownEndsAt = introEndsAt + 3000;
    gameState.duel = {
        playerIds: pair.map(p => p.id),
        phase: 'intro',
        introEndsAt,
        countdownEndsAt,
        endsAt: countdownEndsAt,
        questionIndex: gameState.currentIndex
    };
    gameState.duelPresentation = { playerIds: pair.map(p => p.id), questionIndex: gameState.currentIndex };
    gameState.activePlayerId = pair[0].id;
    gameState.optionsShown = false;
    gameState.revealedCorrect = false;
    gameState.result = null;
    const idx = scheduled.indexOf(questionNumber);
    gameState.nextDuelAt = scheduled[idx + 1] || null;
    pushFullState();
    renderGameScreen();
    scheduleDuelFinish();
}

function scheduleDuelFinish() {
    if (duelTimer) clearTimeout(duelTimer);
    if (!gameState.duel) return;
    const now = Date.now();
    const target = gameState.duel.phase === 'intro' ? gameState.duel.introEndsAt : gameState.duel.endsAt;
    const remaining = Math.max(0, target - now);
    duelTimer = setTimeout(() => {
        if (!gameState.duel) return;
        if (gameState.duel.phase === 'intro') {
            gameState.duel.phase = 'countdown';
            pushFullState();
            renderGameScreen();
            scheduleDuelFinish();
        } else {
            finishDuel();
        }
    }, remaining + 40);
}

function finishDuel() {
    if (!gameState.duel) return;
    gameState.duel = null;
    gameState.optionsShown = true;
    gameState.revealedCorrect = false;
    gameState.result = null;
    pushFullState();
    renderGameScreen();
}

function playFlash(type) {
    const el = document.getElementById('flashOverlay');
    if (!el) return;
    el.className = 'flash-overlay';
    void el.offsetWidth;
    el.classList.add(type === 'correct' ? 'fire-green' : 'fire-red');
}

function advanceAfterCorrect() {
    if (nextQuestionTimer) clearTimeout(nextQuestionTimer);
    nextQuestionTimer = setTimeout(() => {
        nextQuestionTimer = null;
        moveNextQuestion();
    }, 850);
}

function moveNextQuestion() {
    gameState.duel = null;
    gameState.duelPresentation = null;
    gameState.result = null;
    gameState.optionsShown = false;
    gameState.revealedCorrect = false;
    if (gameState.currentIndex >= gameState.deck.length - 1) {
        gameState.status = 'over';
        clearLocalResume();
        pushFullState();
        renderGameScreen();
        return;
    }
    gameState.currentIndex += 1;
    gameState.activePlayerId = gameState.players[(gameState.currentIndex) % gameState.players.length]?.id || gameState.activePlayerId;
    if (gameState.playerCount >= 3 && (gameState.duelSchedule || []).includes(gameState.currentIndex + 1)) {
        startDuel();
        return;
    }
    pushFullState();
    renderGameScreen();
}

// ========================================================= استقبال أوامر الحكم
function handleJudgeAction(msg) {
    if (!msg || gameState.status !== 'playing') return;
    const cur = gameState.deck[gameState.currentIndex];
    if (!cur) return;

    switch (msg.type) {
        case 'setActive': {
            if (gameState.duel && !gameState.duel.playerIds.includes(msg.playerId)) return;
            gameState.activePlayerId = msg.playerId;
            break;
        }
        case 'reveal':
            gameState.optionsShown = true;
            break;
        case 'hideOptions':
            gameState.optionsShown = false;
            gameState.revealedCorrect = false;
            break;
        case 'correct': {
            if (gameState.duel && !gameState.duel.playerIds.includes(msg.playerId)) return;
            const player = gameState.players.find(p => p.id === msg.playerId);
            if (player) player.score += 1;
            gameState.activePlayerId = msg.playerId;
            gameState.optionsShown = true;
            gameState.revealedCorrect = true;
            gameState.result = 'correct';
            gameState.duel = null;
            if (!gameState.duelPresentation) gameState.duelPresentation = null;
            playFlash('correct');
            pushFullState();
            renderGameScreen();
            advanceAfterCorrect();
            return;
        }
        case 'wrong':
            gameState.optionsShown = true;
            gameState.revealedCorrect = false;
            gameState.result = 'wrong';
            playFlash('wrong');
            break;
        case 'adjustScore': {
            const player = gameState.players.find(p => p.id === msg.playerId);
            if (player) player.score = Math.max(0, player.score + msg.delta);
            break;
        }
        case 'next':
            if (nextQuestionTimer) clearTimeout(nextQuestionTimer);
            moveNextQuestion();
            return;
        case 'prev':
            if (nextQuestionTimer) clearTimeout(nextQuestionTimer);
            if (gameState.currentIndex > 0) gameState.currentIndex -= 1;
            gameState.duel = null;
            gameState.duelPresentation = null;
            gameState.nextDuelAt = null;
            gameState.optionsShown = false;
            gameState.revealedCorrect = false;
            gameState.result = null;
            break;
        case 'end':
            if (nextQuestionTimer) clearTimeout(nextQuestionTimer);
            gameState.status = 'over';
            clearLocalResume();
            break;
    }

    pushFullState();
    renderGameScreen();
}

// ========================================================= عند التحميل

document.addEventListener('DOMContentLoaded', () => {
    // الصفحة الرئيسية هي نقطة الدخول دائمًا؛ لا نستأنف جولة قديمة تلقائيًا.
    clearLocalResume();
    gameState = {
        roomCode: null, selectedCatalogs: [], questionCount: 15, playerCount: 4, difficulty: 'medium', players: [],
        deck: [], currentIndex: 0, activePlayerId: null, optionsShown: false, revealedCorrect: false,
        result: null, status: 'setup', duel: null, duelPresentation: null, duelSchedule: [], nextDuelAt: null
    };
    showScreen('startScreen');
});
