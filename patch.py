from pathlib import Path
import re, json, zipfile, os
base=Path('/mnt/data/fix')

religion=[
# easy 10
("easy","ما السورة التي لا تبدأ بالبسملة؟",["التوبة","الأنفال","يوسف","الملك"],0),
("easy","من هو الصحابي الملقب بذي النورين؟",["عثمان بن عفان","علي بن أبي طالب","عمر بن الخطاب","أبو بكر الصديق"],0),
("easy","من هو الصحابي الذي نام في فراش النبي ﷺ ليلة الهجرة؟",["علي بن أبي طالب","الزبير بن العوام","طلحة بن عبيد الله","سعد بن أبي وقاص"],0),
("easy","ما اسم الغار الذي اختبأ فيه النبي ﷺ وأبو بكر أثناء الهجرة؟",["غار ثور","غار حراء","غار أحد","غار النور"],0),
("easy","أي سورة تُسمى أم الكتاب؟",["الفاتحة","البقرة","الإخلاص","يس"],0),
("easy","من هو أول مؤذن في الإسلام؟",["بلال بن رباح","عبدالله بن أم مكتوم","أبو موسى الأشعري","سعد بن معاذ"],0),
("easy","في أي سنة هجرية فُرض صيام رمضان؟",["2 هـ","1 هـ","3 هـ","5 هـ"],0),
("easy","ما الصلاة التي لا ركوع فيها ولا سجود؟",["صلاة الجنازة","صلاة الوتر","صلاة الاستسقاء","صلاة العيد"],0),
("easy","ما السورة التي تعدل ثلث القرآن في الحديث المشهور؟",["الإخلاص","الفلق","الناس","الكافرون"],0),
("easy","كم عدد أركان الإيمان؟",["ستة","خمسة","سبعة","أربعة"],0),
# medium 10
("medium","ما السورة التي وردت فيها البسملة مرتين؟",["النمل","يس","الرحمن","القصص"],0),
("medium","ما أطول آية في القرآن الكريم؟",["آية الدين في البقرة","آية الكرسي","آخر آية من الحشر","آية النور"],0),
("medium","ما أول مسجد بُني بعد هجرة النبي ﷺ إلى المدينة؟",["مسجد قباء","المسجد النبوي","المسجد الحرام","المسجد الأقصى"],0),
("medium","ما اسم الصحابي الذي أشار بحفر الخندق في غزوة الأحزاب؟",["سلمان الفارسي","حذيفة بن اليمان","المقداد بن عمرو","عمار بن ياسر"],0),
("medium","من الصحابي الذي كان يُعرف بترجمان القرآن؟",["عبدالله بن عباس","عبدالله بن عمر","أبو هريرة","معاذ بن جبل"],0),
("medium","من الصحابي الذي لُقّب بأمين الأمة؟",["أبو عبيدة عامر بن الجراح","معاذ بن جبل","خالد بن الوليد","سعد بن أبي وقاص"],0),
("medium","من الصحابي الذي جمع القرآن في عهد أبي بكر الصديق بأمره؟",["زيد بن ثابت","أبي بن كعب","عبدالله بن مسعود","عثمان بن عفان"],0),
("medium","ما أول قبلة للمسلمين؟",["المسجد الأقصى","الكعبة","مسجد قباء","المسجد النبوي"],0),
("medium","من هو رابع الخلفاء الراشدين؟",["علي بن أبي طالب","عثمان بن عفان","عمر بن الخطاب","أبو بكر الصديق"],0),
("medium","ما الركن الذي يجب على المسلم المستطيع أداؤه مرة في العمر؟",["الحج","الزكاة","الصيام","الصلاة"],0),
# hard 10
("hard","أي مذهب فقهي من المذاهب السنية الأربعة ينتسب إلى الإمام محمد بن إدريس الشافعي؟",["الشافعي","الحنفي","المالكي","الحنبلي"],0),
("hard","من هو الإمام الذي تُنسب إليه المدرسة الفقهية الحنفية؟",["أبو حنيفة النعمان","مالك بن أنس","أحمد بن حنبل","الشافعي"],0),
("hard","أي من الآتي يُعد من أبرز كتب الحديث عند الإمامية الاثني عشرية؟",["الكافي","الموطأ","مسند أحمد","سنن أبي داود"],0),
("hard","أي فرقة إسلامية تاريخية ارتبطت بالإمام زيد بن علي؟",["الزيدية","الإباضية","المعتزلة","المرجئة"],0),
("hard","ما الاسم الذي يطلق على المذهب الفقهي المرتبط بجابر بن زيد تاريخيًا في عُمان وشمال أفريقيا؟",["الإباضية","الظاهرية","الحنفية","الجعفرية"],0),
("hard","أي إمام من أئمة أهل البيت الاثني عشر يُنسب إليه المذهب الجعفري في الفقه؟",["جعفر بن محمد الصادق","علي بن الحسين زين العابدين","محمد الباقر","موسى الكاظم"],0),
("hard","من الصحابي الذي عُرف بكثرة رواية الحديث وكان اسمه عبدالرحمن بن صخر الدوسي؟",["أبو هريرة","أبو الدرداء","أبو موسى الأشعري","سلمان الفارسي"],0),
("hard","من الصحابي الذي أرسله النبي ﷺ إلى اليمن معلّمًا وقاضيًا، واشتهر بسؤاله عن اجتهاد القاضي؟",["معاذ بن جبل","علي بن أبي طالب","زيد بن ثابت","عبدالله بن عباس"],0),
("hard","من الصحابي الذي اشتهر بلقب حبر الأمة، وهو أيضًا ابن عم النبي ﷺ؟",["عبدالله بن عباس","عبدالله بن مسعود","عبدالله بن عمر","أبي بن كعب"],0),
("hard","أي خليفة راشد عُرف بجمع الناس على مصحف واحد وإرسال المصاحف إلى الأمصار؟",["عثمان بن عفان","أبو بكر الصديق","عمر بن الخطاب","علي بن أبي طالب"],0),
]

# replace religion section in questions.js
p=base/'questions.js'; txt=p.read_text()
start=txt.index('    religion: {')
end=txt.index('\n    variety: {', start)
lines=['    religion: {','        name: "دين",','        emoji: "🕌",','        questions: [']
for i,(d,q,opts,a) in enumerate(religion):
    lines.append('            '+json.dumps({'q':q,'options':opts,'a':a,'difficulty':d},ensure_ascii=False,separators=(', ', ': '))+(',' if i<len(religion)-1 else ''))
lines += ['        ]','    },','']
txt=txt[:start]+'\n'.join(lines)+txt[end:]
p.write_text(txt)

# patch script difficulty and duel system
p=base/'script.js'; s=p.read_text()
s=s.replace("        duel: null, // { playerIds:[id,id], endsAt:number, questionIndex:number }\n    nextDuelAt: null", "        duel: null, // { playerIds:[id,id], phase, introEndsAt, countdownEndsAt, endsAt, questionIndex }\n        duelPresentation: null,\n        duelSchedule: [],\n        nextDuelAt: null")
s=s.replace("        result: null, status: 'setup', duel: null, nextDuelAt: null\n", "        result: null, status: 'setup', duel: null, duelPresentation: null, duelSchedule: [], nextDuelAt: null\n")
s=s.replace("function getLocalDifficulty(catalogId, questionIndex) {\n    if (catalogId === 'religion') return 'hard';\n    // الأسئلة الجديدة في كل كتالوق صيغت كمستوى سهل، والأسئلة الأصلية كمتوسط.\n    return questionIndex >= 12 ? 'easy' : 'medium';\n}", "function getLocalDifficulty(catalogId, questionIndex, question) {\n    if (question?.difficulty) return question.difficulty;\n    // احتياطي للبنوك القديمة التي لا تحمل مستوى السؤال.\n    return questionIndex >= 12 ? 'easy' : 'medium';\n}")
s=s.replace("function difficultyMatches(questionDifficulty, selectedDifficulty, catalogId) {\n    if (catalogId === 'religion') return questionDifficulty === 'hard' || !questionDifficulty;\n", "function difficultyMatches(questionDifficulty, selectedDifficulty, catalogId) {\n    if (catalogId === 'religion' && !questionDifficulty) return true;\n")
s=s.replace("const difficulty = getLocalDifficulty(id, qi);", "const difficulty = getLocalDifficulty(id, qi, qq);")
# add difficulty from qq normalized already
# replace build/start duel scheduling lines
old="""    gameState.duel = null;\n    gameState.nextDuelAt = gameState.playerCount >= 3 && gameState.deck.length >= 3 ? randomInt(3, Math.min(5, gameState.deck.length)) : null;\n\n    connectRoom"""
new="""    gameState.duel = null;\n    gameState.duelPresentation = null;\n    gameState.duelSchedule = buildDuelSchedule(gameState.deck.length, gameState.playerCount);\n    gameState.nextDuelAt = gameState.duelSchedule[0] || null;\n\n    connectRoom"""
s=s.replace(old,new)
# render players bar: filter to current duel/presentation
old="""    bar.innerHTML = '';\n    gameState.players.forEach(p => {\n        const inDuel = gameState.duel?.playerIds?.includes(p.id);"""
new="""    bar.innerHTML = '';\n    const duelIds = gameState.duel?.playerIds || gameState.duelPresentation?.playerIds || null;\n    const visiblePlayers = duelIds ? gameState.players.filter(p => duelIds.includes(p.id)) : gameState.players;\n    bar.classList.toggle('duel-only', !!duelIds);\n    visiblePlayers.forEach(p => {\n        const inDuel = !!duelIds?.includes(p.id);"""
s=s.replace(old,new)
# replace duelInfo render block
old="""    const duelInfo = document.getElementById('duelInfo');\n    if (duelInfo) {\n        if (gameState.duel) {\n            const a = gameState.players.find(p => p.id === gameState.duel.playerIds[0]);\n            const b = gameState.players.find(p => p.id === gameState.duel.playerIds[1]);\n            duelInfo.innerHTML = `⚡ مواجهة: <strong>${escapeHtml(a?.name || '')}</strong> ضد <strong>${escapeHtml(b?.name || '')}</strong>`;\n            duelInfo.style.display = 'block';\n        } else {\n            duelInfo.style.display = 'none';\n        }\n    }"""
new="""    const duelInfo = document.getElementById('duelInfo');\n    const duelPair = gameState.duel?.playerIds || gameState.duelPresentation?.playerIds || null;\n    if (duelInfo) {\n        if (duelPair) {\n            const a = gameState.players.find(p => p.id === duelPair[0]);\n            const b = gameState.players.find(p => p.id === duelPair[1]);\n            duelInfo.innerHTML = `<span class=\"duel-strip-player\">${a?.avatar || '👤'} ${escapeHtml(a?.name || 'لاعب')}</span><span class=\"vs-inline\"><i>V</i><i>S</i></span><span class=\"duel-strip-player\">${b?.avatar || '👤'} ${escapeHtml(b?.name || 'لاعب')}</span>`;\n            duelInfo.style.display = 'flex';\n            duelInfo.classList.toggle('question-duel-strip', !gameState.duel);\n        } else {\n            duelInfo.style.display = 'none';\n            duelInfo.classList.remove('question-duel-strip');\n        }\n    }"""
s=s.replace(old,new)
# replace renderDuelOverlay entirely up to updateResultGlow
start=s.index('function renderDuelOverlay() {')
end=s.index('\nfunction updateResultGlow()',start)
newfunc=r'''function renderDuelOverlay() {
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
'''
s=s[:start]+newfunc+s[end:]
# replace startDuel through finishDuel
start=s.index('function startDuel() {')
end=s.index('\nfunction playFlash(type)',start)
newduel=r'''function buildDuelSchedule(totalQuestions, playerCount) {
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
'''
s=s[:start]+newduel+s[end:]
# moveNextQuestion replace relevant logic
old="""function moveNextQuestion() {\n    gameState.duel = null;\n    gameState.result = null;\n    gameState.optionsShown = false;\n    gameState.revealedCorrect = false;\n    if (gameState.currentIndex >= gameState.deck.length - 1) {"""
new="""function moveNextQuestion() {\n    gameState.duel = null;\n    gameState.duelPresentation = null;\n    gameState.result = null;\n    gameState.optionsShown = false;\n    gameState.revealedCorrect = false;\n    if (gameState.currentIndex >= gameState.deck.length - 1) {"""
s=s.replace(old,new)
old="""    if (gameState.playerCount >= 3 && gameState.currentIndex + 1 >= (gameState.nextDuelAt || Infinity)) {\n        startDuel();\n        return;\n    }"""
new="""    if (gameState.playerCount >= 3 && (gameState.duelSchedule || []).includes(gameState.currentIndex + 1)) {\n        startDuel();\n        return;\n    }"""
s=s.replace(old,new)
# correct action: don't clear duelPresentation; only clear duel and keep pair for question
s=s.replace("            gameState.duel = null;\n            gameState.nextDuelAt = gameState.currentIndex + 1 + randomInt(2, 4);\n            if (gameState.nextDuelAt > gameState.deck.length) gameState.nextDuelAt = null;", "            gameState.duel = null;\n            if (!gameState.duelPresentation) gameState.duelPresentation = null;")
# prev should clear presentation/schedule
s=s.replace("            gameState.duel = null;\n            gameState.nextDuelAt = null;", "            gameState.duel = null;\n            gameState.duelPresentation = null;\n            gameState.nextDuelAt = null;", 1)
# DOM reset add fields
s=s.replace("result: null, status: 'setup', duel: null, nextDuelAt: null", "result: null, status: 'setup', duel: null, duelPresentation: null, duelSchedule: [], nextDuelAt: null")
p.write_text(s)

# Update SQL: delete religion rows and replace all religion insert lines with new 30
p=base/'questions-cloud.sql'; sql=p.read_text()
lines=sql.splitlines()
religion_insert=[ln for ln in lines if "values ('religion'" in ln]
lines=[ln for ln in lines if "values ('religion'" not in ln]
# insert delete before first insert
idx=next((i for i,l in enumerate(lines) if l.lower().startswith('insert into public.questions_bank')), len(lines))
lines.insert(idx, "-- تحديث بنك الدين: احذف النسخة القديمة حتى لا تتكرر الأسئلة عند إعادة تشغيل الملف.")
lines.insert(idx+1, "delete from public.questions_bank where category = 'religion';")
newsql=[]
for d,q,opts,a in religion:
    opt=json.dumps(opts,ensure_ascii=False,separators=(',',':')).replace("'", "''")
    q2=q.replace("'", "''")
    newsql.append(f"insert into public.questions_bank (category,difficulty,question,options,correct_index) values ('religion','{d}','{q2}','{opt}'::jsonb,{a});")
# put religion inserts immediately after delete
lines[idx+2:idx+2]=newsql
p.write_text('\n'.join(lines)+'\n')

# CSS enhancements for duel
p=base/'style.css'; css=p.read_text()
css += r'''

/* =========================================================
   مواجهة VS — دخول سينمائي + عد تنازلي + سؤال المواجهة
   ========================================================= */
.duel-overlay{background:radial-gradient(circle at 50% 45%,rgba(18,28,52,.92),rgba(2,5,12,.975) 72%);}
.duel-overlay::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 48%,rgba(255,214,10,.08),transparent 28%),radial-gradient(circle at 50% 48%,rgba(34,211,238,.06),transparent 48%);animation:duelAura 2.8s ease-in-out infinite;pointer-events:none;}
.duel-shell{position:relative;z-index:1;}
.duel-player-card{position:relative;overflow:hidden;box-shadow:0 0 28px rgba(34,211,238,.14),inset 0 0 28px rgba(255,255,255,.02);}
.duel-player-card::after{content:"";position:absolute;inset:-30%;background:radial-gradient(circle,rgba(34,211,238,.11),transparent 58%);animation:duelCardFloat 2.4s ease-in-out infinite;pointer-events:none;}
.duel-overlay[data-phase="countdown"] .duel-player-card:first-child{animation:duelExitA .6s cubic-bezier(.6,0,.8,.2) both;}
.duel-overlay[data-phase="countdown"] .duel-player-card:last-child{animation:duelExitB .6s cubic-bezier(.6,0,.8,.2) both;}
.duel-overlay[data-phase="countdown"] .vs-badge{animation:vsExit .55s ease both;}
.duel-overlay[data-phase="intro"] .duel-countdown{opacity:.25;transform:scale(.7);}
.duel-overlay[data-phase="countdown"] .duel-countdown{opacity:1;animation:countdownPop .9s ease-in-out infinite;}
.duel-countdown{position:relative;z-index:2;}
.duel-countdown::after{content:"";position:absolute;inset:-10px;border-radius:50%;border:1px solid rgba(255,214,10,.35);animation:countdownRing 1s linear infinite;}
.vs-badge{display:flex;gap:2px;}
.vs-badge .vs-v,.vs-inline i:first-child{color:var(--yellow);text-shadow:0 0 16px var(--yellow-glow);font-style:normal;}
.vs-badge .vs-s,.vs-inline i:last-child{color:var(--cyan);text-shadow:0 0 16px var(--cyan-glow);font-style:normal;}
body.duel-question-mode .question-card{animation:duelQuestionFloat 2.2s ease-in-out infinite, duelQuestionPulse 1.35s ease-in-out infinite;}
body.duel-question-mode::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:55;background:rgba(248,113,113,.055);animation:duelRedPulse 1.35s ease-in-out infinite;}
.duel-info.question-duel-strip{width:min(760px,94vw);margin:0 auto 14px;justify-content:center;gap:18px;border-radius:18px;padding:10px 16px;background:rgba(12,18,32,.82);box-shadow:0 0 24px rgba(255,214,10,.1),0 8px 25px rgba(0,0,0,.22);}
.duel-strip-player{display:flex;align-items:center;gap:7px;font-weight:900;animation:duelStripFloat 1.9s ease-in-out infinite;}
.duel-strip-player:last-child{animation-delay:.2s;}
.vs-inline{display:flex;gap:1px;font-family:var(--font-display);font-size:1.15rem;font-weight:1000;animation:vsFloat 1.2s ease-in-out infinite alternate;}
.player-chip.duel-player{animation:duelChipFloat 1.7s ease-in-out infinite;}
.players-bar.duel-only{justify-content:center;grid-template-columns:repeat(2,minmax(150px,260px));}
@keyframes duelAura{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}
@keyframes duelCardFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes duelExitA{to{opacity:0;transform:translateX(120vw) rotate(5deg) scale(.8)}}
@keyframes duelExitB{to{opacity:0;transform:translateX(-120vw) rotate(-5deg) scale(.8)}}
@keyframes vsExit{to{opacity:0;transform:scale(1.7) rotate(12deg)}}
@keyframes countdownPop{0%,100%{transform:scale(.94);box-shadow:0 0 28px var(--yellow-glow)}50%{transform:scale(1.06);box-shadow:0 0 48px var(--yellow-glow)}}
@keyframes countdownRing{to{transform:scale(1.28);opacity:0}}
@keyframes duelQuestionFloat{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-5px) rotate(.15deg)}}
@keyframes duelQuestionPulse{0%,100%{box-shadow:0 0 28px rgba(248,113,113,.15),inset 0 0 20px rgba(248,113,113,.02)}50%{box-shadow:0 0 42px rgba(248,113,113,.28),inset 0 0 28px rgba(248,113,113,.05)}}
@keyframes duelRedPulse{0%,100%{opacity:.35}50%{opacity:1}}
@keyframes duelStripFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes vsFloat{from{transform:translateY(-2px) scale(.98)}to{transform:translateY(2px) scale(1.06)}}
@keyframes duelChipFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
@media (prefers-reduced-motion:reduce){.duel-overlay *,body.duel-question-mode *{animation-duration:.001ms!important;animation-iteration-count:1!important;}}
'''
p.write_text(css)

# Update HTML VS markup and maybe duel tip wording
p=base/'index.html'; h=p.read_text()
h=h.replace('<div class="vs-badge">VS</div>', '<div class="vs-badge"><span class="vs-v">V</span><span class="vs-s">S</span></div>')
h=h.replace('⚡ مواجهة عشوائية','⚡ مواجهة VS — استعد!')
p.write_text(h)

# Update README count wording
p=base/'README.md'; r=p.read_text().replace('330 سؤالًا','330 سؤالًا (منها 30 سؤال دين موزعة على سهل ومتوسط وصعب)')
p.write_text(r)

# sanity checks
