// =========================================================
// لقطتها 📸 — محرك اللعبة
// شاشة اللعب + لوحة الحكم عبر Supabase Realtime
// =========================================================

const AVATAR_POOL = ['🦁', '🐯', '🐼', '🦊', '🐸', '🦉', '🐺', '🐨'];
const LOCAL_RESUME_KEY = 'laqtaha_local_resume_v2';

let roomSync = null;
let duelTimer = null;
let duelUiTimer = null;
let fibbageUiTimer = null;
let nextQuestionTimer = null;
let gameState = {
    roomCode: null,
    selectedCatalogs: [],
    questionCount: 15,
    playerCount: 4,
    difficulty: 'medium',
    mode: 'classic',
    fibbage: null,
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
    if (fibbageUiTimer) { clearInterval(fibbageUiTimer); fibbageUiTimer = null; }
    if (roomSync) { roomSync.disconnect(); roomSync = null; }
    clearLocalResume();
    gameState = {
        roomCode: null, selectedCatalogs: [], questionCount: 15, playerCount: 4, difficulty: 'medium', mode: 'classic', fibbage: null, players: [],
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

function setGameMode(mode) {
    if (!['classic','fibbage'].includes(mode)) return;
    gameState.mode = mode;
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
    const note = document.querySelector('.difficulty-box + .setup-mini .setup-note');
    if (mode === 'fibbage') gameState.playerCount = Math.min(4, Math.max(2, gameState.playerCount));
    const pc = document.getElementById('playerCountVal');
    if (pc) pc.textContent = gameState.playerCount;
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
    const minPlayers = gameState.mode === 'fibbage' ? 2 : 2;
    const maxPlayers = gameState.mode === 'fibbage' ? 4 : 8;
    gameState.playerCount = Math.min(maxPlayers, Math.max(minPlayers, gameState.playerCount + delta));
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
    gameState.optionsShown = gameState.mode === 'classic';
    gameState.revealedCorrect = false;
    gameState.result = null;
    gameState.status = 'playing';
    gameState.duel = null;
    gameState.duelPresentation = null;
    gameState.duelSchedule = buildDuelSchedule(gameState.deck.length, gameState.playerCount);
    gameState.nextDuelAt = gameState.duelSchedule[0] || null;
    gameState.fibbage = gameState.mode === 'fibbage' ? createFibbageState() : null;

    connectRoom(gameState.roomCode);
    renderRoomBadge();
    pushFullState();
    showScreen('gameScreen');
    renderGameScreen();
    if (gameState.mode === 'fibbage') { startFibbageRound(); }
    else if (gameState.duelSchedule.includes(1)) startDuel();
}

function connectRoom(code) {
    if (roomSync) roomSync.disconnect();
    roomSync = new RoomSync(code);
    roomSync.onJudgeAction = handleJudgeAction;
    roomSync.onPlayerAction = handlePlayerAction;
    roomSync.onStateUpdate = (state) => {
        if (!state || state.roomCode !== code) return;
        gameState = state;
        renderRoomBadge();
        showScreen(gameState.status === 'over' ? 'podiumScreen' : 'gameScreen');
        renderGameScreen();
        if (gameState.duel) scheduleDuelFinish();
        if (gameState.fibbage) scheduleFibbagePhaseTimer();
    };
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

function copyPlayerRoomLink() {
    const url = new URL('player.html', location.href);
    url.search = '';
    url.hash = '';
    navigator.clipboard?.writeText(url.toString()).catch(() => {});
    const btn=document.getElementById('playerLinkBtn');
    if(btn){const old=btn.textContent;btn.textContent='تم نسخ الرابط ✓';setTimeout(()=>btn.textContent=old,1500);}
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

    const fibPanel = document.getElementById('fibbagePanel');
    const classicOptions = document.getElementById('optionsGrid');
    if (gameState.mode === 'fibbage') {
        if (fibPanel) fibPanel.style.display = 'block';
        if (classicOptions) classicOptions.style.display = 'none';
        renderFibbage();
    } else {
        if (fibPanel) fibPanel.style.display = 'none';
    }

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
    gameState.optionsShown = false;
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
    if (gameState.mode === 'fibbage') {
        if (gameState.currentIndex >= gameState.deck.length - 1) {
            gameState.status = 'over';
            clearLocalResume();
            pushFullState();
            renderGameScreen();
            return;
        }
        gameState.currentIndex += 1;
        gameState.activePlayerId = gameState.players[0]?.id || null;
        startFibbageRound();
        return;
    }
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

// ========================================================= نمط التكاذيب 🎭
const FIBBAGE_VOTE_MS = 20000;

function createFibbageState() {
    return {
        round: 0,
        phase: 'writing', // writing | judge_answer | voting | results
        writingEndsAt: 0,
        votingEndsAt: 0,
        submissions: {},
        votes: {},
        options: [],
        results: null,
        locked: false,
        judgeCorrectAnswer: '',
        judgeExtraOptions: [],
        playerClaims: {}
    };
}

function getFibbagePlayerId() {
    const url = new URLSearchParams(location.search);
    const fromUrl = url.get('player');
    if (fromUrl && gameState.players.some(p => p.id === fromUrl)) return fromUrl;
    return localStorage.getItem('laqtaha_fibbage_player_' + gameState.roomCode) || null;
}

function setFibbagePlayerId(id) {
    if (!gameState.roomCode || !gameState.players.some(p => p.id === id)) return;
    localStorage.setItem('laqtaha_fibbage_player_' + gameState.roomCode, id);
    renderFibbage();
}

function startFibbageRound() {
    if (gameState.mode !== 'fibbage') return;
    if (!gameState.fibbage) gameState.fibbage = createFibbageState();
    gameState.fibbage.round = (gameState.fibbage.round || 0) + 1;
    gameState.fibbage.phase = 'writing';
    gameState.fibbage.writingEndsAt = 0;
    gameState.fibbage.votingEndsAt = 0;
    gameState.fibbage.submissions = {};
    gameState.fibbage.votes = {};
    gameState.fibbage.options = [];
    gameState.fibbage.results = null;
    gameState.fibbage.locked = false;
    gameState.fibbage.judgeCorrectAnswer = '';
    gameState.fibbage.judgeExtraOptions = [];
    if (!gameState.fibbage.playerClaims) gameState.fibbage.playerClaims = {};
    gameState.optionsShown = false;
    gameState.result = null;
    pushFullState();
    renderGameScreen();
}

function getFibbageCorrectText() {
    const cur = gameState.deck[gameState.currentIndex];
    return cur?.options?.[cur.a] || '';
}

function claimFibbagePlayer(playerId) {
    if (!gameState.fibbage || !gameState.players.some(p => p.id === playerId)) return false;
    if (!gameState.fibbage.playerClaims) gameState.fibbage.playerClaims = {};
    const claims = gameState.fibbage.playerClaims;
    const owner = Object.entries(claims).find(([id, claimedBy]) => id !== playerId && claimedBy);
    // The browser sends its stable claim token; duplicate claims are rejected server-side.
    const claimToken = arguments[1] || '';
    if (!claimToken) return false;
    if (claims[playerId] && claims[playerId] !== claimToken) return false;
    if (owner && owner[1] === claimToken) return false;
    claims[playerId] = claimToken;
    pushFullState();
    renderGameScreen();
    return true;
}

function submitFibbageAnswerForPlayer(playerId, answer) {
    if (!gameState.fibbage || gameState.fibbage.phase !== 'writing') return false;
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return false;
    answer = String(answer || '').trim().slice(0, 120);
    if (!answer) return false;
    const correct = getFibbageCorrectText();
    gameState.fibbage.submissions[playerId] = {
        playerId,
        text: answer,
        isCorrectMatch: normalizeFibbage(answer) === normalizeFibbage(correct),
        submittedAt: Date.now()
    };
    pushFullState();
    renderGameScreen();
    if (Object.keys(gameState.fibbage.submissions).length >= gameState.players.length) closeFibbageWriting();
    return true;
}

function submitFibbageAnswer() {
    return submitFibbageAnswerForPlayer(getFibbagePlayerId(), document.getElementById('fibbageAnswerInput')?.value || '');
}

function normalizeFibbage(v) {
    return String(v || '').trim().replace(/[\u064B-\u065F\u0670]/g, '').replace(/\s+/g, ' ').toLowerCase();
}

function ensureMinimumFibbageOptions(groups) {
    let n = 1;
    const used = new Set([...groups.keys()].map(String));
    while (groups.size < 4) {
        let text = n === 1 ? 'خيار إضافي' : `خيار إضافي ${n}`;
        while (used.has(normalizeFibbage(text))) { n++; text = `خيار إضافي ${n}`; }
        const key = normalizeFibbage(text);
        groups.set(key, {
            id: 'extra_' + Math.random().toString(36).slice(2),
            text,
            playerIds: [],
            isCorrect: false,
            real: false,
            deceptive: false,
            judgeAdded: true
        });
        used.add(key);
        n++;
    }
}

function buildFibbageOptions() {
    const correctText = gameState.fibbage.judgeCorrectAnswer || getFibbageCorrectText();
    const groups = new Map();
    Object.values(gameState.fibbage.submissions).forEach(sub => {
        const key = normalizeFibbage(sub.text);
        if (!groups.has(key)) groups.set(key, {
            id: 's_' + Math.random().toString(36).slice(2),
            text: sub.text,
            playerIds: [],
            isCorrect: !!sub.isCorrectMatch,
            deceptive: !sub.isCorrectMatch && !sub.missing,
            real: false
        });
        const g = groups.get(key);
        g.playerIds.push(sub.playerId);
        if (sub.isCorrectMatch) { g.isCorrect = true; g.deceptive = false; }
        if (sub.missing) g.deceptive = false;
    });

    const correctKey = normalizeFibbage(correctText);
    const matchingGroup = groups.get(correctKey);
    if (matchingGroup) {
        matchingGroup.real = true;
        matchingGroup.isCorrect = true;
        matchingGroup.deceptive = false;
        matchingGroup.id = 'correct';
    } else {
        groups.set('__correct__', {
            id: 'correct', text: correctText, playerIds: [], isCorrect: true, real: true, deceptive: false
        });
    }

    // خيارات يضيفها الحكم يدويًا: لا مالك لها ولا تمنح نقاط خداع.
    (gameState.fibbage.judgeExtraOptions || []).forEach((text, i) => {
        const key = normalizeFibbage(text);
        if (!key || key === correctKey || groups.has(key)) return;
        groups.set(key, {
            id: 'judge_' + i + '_' + Math.random().toString(36).slice(2),
            text: String(text).slice(0, 120), playerIds: [], isCorrect: false, real: false, deceptive: false, judgeAdded: true
        });
    });

    ensureMinimumFibbageOptions(groups);
    gameState.fibbage.options = shuffleArray([...groups.values()]);
}

function beginFibbageVoting() {
    if (!gameState.fibbage || gameState.fibbage.phase !== 'judge_answer' && gameState.fibbage.phase !== 'writing') return;
    if (!gameState.fibbage.judgeCorrectAnswer) gameState.fibbage.judgeCorrectAnswer = getFibbageCorrectText();
    buildFibbageOptions();
    gameState.fibbage.phase = 'voting';
    gameState.fibbage.votingEndsAt = Date.now() + FIBBAGE_VOTE_MS;
    gameState.optionsShown = false;
    pushFullState(); renderGameScreen(); scheduleFibbagePhaseTimer();
}

function closeFibbageWriting() {
    if (!gameState.fibbage || gameState.fibbage.phase !== 'writing') return;
    for (const p of gameState.players) {
        if (!gameState.fibbage.submissions[p.id]) gameState.fibbage.submissions[p.id] = {
            playerId: p.id, text: 'بدون إجابة', isCorrectMatch: false, missing: true
        };
    }
    const hasCorrect = Object.values(gameState.fibbage.submissions).some(s => s.isCorrectMatch);
    if (!hasCorrect) {
        gameState.fibbage.phase = 'judge_answer';
        gameState.fibbage.writingEndsAt = 0;
        pushFullState(); renderGameScreen();
        return;
    }
    beginFibbageVoting();
}

function submitJudgeFibbageCorrectAnswer(text) {
    if (!gameState.fibbage || gameState.fibbage.phase !== 'judge_answer') return;
    text = String(text || '').trim().slice(0, 120);
    if (!text) return;
    gameState.fibbage.judgeCorrectAnswer = text;
    beginFibbageVoting();
}

function addJudgeFibbageOption(text) {
    if (!gameState.fibbage || !['judge_answer','voting'].includes(gameState.fibbage.phase)) return;
    text = String(text || '').trim().slice(0, 120);
    if (!text) return;
    if (!gameState.fibbage.judgeExtraOptions) gameState.fibbage.judgeExtraOptions = [];
    const key = normalizeFibbage(text);
    const existing = [getFibbageCorrectText(), gameState.fibbage.judgeCorrectAnswer, ...(gameState.fibbage.judgeExtraOptions || []), ...Object.values(gameState.fibbage.submissions).map(s => s.text)].map(normalizeFibbage);
    if (existing.includes(key)) return;
    gameState.fibbage.judgeExtraOptions.push(text);
    if (gameState.fibbage.phase === 'voting') {
        // إضافة خيار أثناء التصويت، مع الحفاظ على الخيارات الموجودة وأصواتها.
        gameState.fibbage.options.push({ id:'judge_live_' + Math.random().toString(36).slice(2), text, playerIds:[], isCorrect:false, real:false, deceptive:false, judgeAdded:true });
    }
    pushFullState(); renderGameScreen();
}

function voteFibbageForPlayer(playerId, optionId) {
    if (!gameState.fibbage || gameState.fibbage.phase !== 'voting') return false;
    if (!gameState.players.some(p => p.id === playerId)) return false;
    if (gameState.fibbage.votes[playerId]) return false;
    const sub = gameState.fibbage.submissions[playerId];
    if (optionId === 'correct' && sub?.isCorrectMatch) return false;
    if (!gameState.fibbage.options.some(o => o.id === optionId)) return false;
    gameState.fibbage.votes[playerId] = optionId;
    pushFullState(); renderGameScreen();
    if (Object.keys(gameState.fibbage.votes).length >= gameState.players.length) finishFibbageVoting();
    return true;
}

function voteFibbage(optionId) { return voteFibbageForPlayer(getFibbagePlayerId(), optionId); }

function finishFibbageVoting() {
    if (!gameState.fibbage || gameState.fibbage.phase !== 'voting') return;
    const f = gameState.fibbage;
    const deltas = {};
    gameState.players.forEach(p => deltas[p.id] = 0);
    const counts = {};
    Object.values(f.votes).forEach(optionId => { counts[optionId] = (counts[optionId] || 0) + 1; });
    Object.entries(f.votes).forEach(([voter, optionId]) => {
        const opt = f.options.find(o => o.id === optionId);
        if (!opt) return;
        if (opt.real || opt.isCorrect) deltas[voter] += 1;
        else if (opt.deceptive) {
            opt.playerIds.forEach(owner => {
                if (owner !== voter && !f.submissions[owner]?.isCorrectMatch && !f.submissions[owner]?.missing) deltas[owner] += 1;
            });
        }
    });
    gameState.players.forEach(p => p.score = Math.max(0, p.score + (deltas[p.id] || 0)));
    f.results = { counts, deltas };
    f.phase = 'results'; f.locked = true;
    pushFullState(); renderGameScreen();
}

function handlePlayerAction(msg) {
    if (!msg || gameState.status !== 'playing' || gameState.mode !== 'fibbage') return;
    if (msg.type === 'fibbageClaimPlayer') claimFibbagePlayer(msg.playerId, msg.claimToken);
    else if (msg.type === 'fibbageSubmit') submitFibbageAnswerForPlayer(msg.playerId, msg.text);
    else if (msg.type === 'fibbageVote') voteFibbageForPlayer(msg.playerId, msg.optionId);
}

function handleFibbageJudgeAction(msg) {
    if (!gameState.fibbage) return;
    if (msg.type === 'fibbageCloseWriting') closeFibbageWriting();
    else if (msg.type === 'fibbageJudgeAnswer') submitJudgeFibbageCorrectAnswer(msg.text);
    else if (msg.type === 'fibbageAddOption') addJudgeFibbageOption(msg.text);
    else if (msg.type === 'fibbageFinishVoting') finishFibbageVoting();
    else if (msg.type === 'fibbageNext') moveNextQuestion();
    else if (msg.type === 'adjustScore') { const p = gameState.players.find(x => x.id === msg.playerId); if (p) p.score = Math.max(0, p.score + msg.delta); pushFullState(); renderGameScreen(); }
    else if (msg.type === 'end') { gameState.status = 'over'; clearLocalResume(); pushFullState(); renderGameScreen(); }
}

function scheduleFibbagePhaseTimer() {
    if (duelTimer) clearTimeout(duelTimer);
    if (!gameState.fibbage) return;
    const target = gameState.fibbage.phase === 'voting' ? gameState.fibbage.votingEndsAt : 0;
    if (!target) return;
    duelTimer = setTimeout(() => {
        if (!gameState.fibbage) return;
        if (gameState.fibbage.phase === 'voting') finishFibbageVoting();
    }, Math.max(0, target - Date.now()) + 60);
}

function renderFibbage() {
    const f = gameState.fibbage; if (!f) return;
    const phase = document.getElementById('fibbagePhaseText');
    const submittedCount = Object.keys(f.submissions || {}).length;
    if (phase) {
        phase.textContent = f.phase === 'writing'
            ? `✍️ بانتظار إجابات اللاعبين — ${submittedCount}/${gameState.players.length}`
            : f.phase === 'judge_answer'
                ? '⚖️ الحكم يجهّز الإجابة الصحيحة'
                : f.phase === 'voting'
                    ? '🗳️ الخيارات ظاهرة — اللاعبون يصوّتون'
                    : '🏆 النتائج';
    }
    const w=document.getElementById('fibbageWriting');
    const v=document.getElementById('fibbageVoting');
    const r=document.getElementById('fibbageResults');
    const picker=document.getElementById('fibbagePlayerPicker');
    const timer=document.getElementById('fibbageTimer');
    if (picker) picker.style.display='none';
    if (timer) timer.style.display='none';
    if(w) w.style.display='none';
    if(v) v.style.display=f.phase==='voting'?'block':'none';
    if(r) r.style.display=f.phase==='results'?'block':'none';
    if(v){
        const wrap=document.getElementById('fibbageOptions');
        if (wrap) {
            wrap.innerHTML='';
            f.options.forEach(o=>{
                const b=document.createElement('div');
                b.className='fibbage-option host-option';
                b.innerHTML=`<span>❔</span>${escapeHtml(o.text)}`;
                wrap.appendChild(b);
            });
        }
    }
    if(r){
        const wrap=document.getElementById('fibbageResultsList');
        if(wrap){
            wrap.innerHTML='';
            f.options.forEach(o=>{
                const owners=o.real?'الإجابة الصحيحة':o.playerIds.map(id=>{const p=gameState.players.find(x=>x.id===id);return p?.name||'لاعب';}).join(' + ')||'خيار أضافه الحكم';
                const row=document.createElement('div'); row.className='fibbage-result-row'+(o.real?' real':'');
                row.innerHTML=`<div><strong>${escapeHtml(o.text)}</strong><small>${escapeHtml(owners)}</small></div><b>${f.results?.counts?.[o.id]||0} صوت</b>`;
                wrap.appendChild(row);
            });
        }
        const d=document.getElementById('fibbageScoreDelta');
        if(d)d.textContent=gameState.players.map(p=>`${p.avatar} ${p.name}: +${f.results?.deltas?.[p.id]||0}`).join('  •  ');
    }
}

// ========================================================= استقبال أوامر الحكم
function handleJudgeAction(msg) {
    if (!msg || gameState.status !== 'playing') return;
    const cur = gameState.deck[gameState.currentIndex];
    if (!cur) return;

    if (gameState.mode === 'fibbage') {
        handleFibbageJudgeAction(msg);
        return;
    }

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
        roomCode: null, selectedCatalogs: [], questionCount: 15, playerCount: 4, difficulty: 'medium', mode: 'classic', fibbage: null, players: [],
        deck: [], currentIndex: 0, activePlayerId: null, optionsShown: false, revealedCorrect: false,
        result: null, status: 'setup', duel: null, duelPresentation: null, duelSchedule: [], nextDuelAt: null
    };
    showScreen('startScreen');
    const roomFromUrl = new URLSearchParams(location.search).get('room');
    if (roomFromUrl) {
        connectRoom(roomFromUrl);
    }
});
