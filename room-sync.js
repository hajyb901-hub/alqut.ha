// =========================================================
// نظام الغرف (Room Sync) — لقطتها 📸
// نفس فكرة نظام الغرف المستخدم في «تيت»: جدول rooms بمعرف room_code
// + Supabase Realtime Broadcast للمزامنة الفورية بين أي جهازين
// (شاشة اللعب من جهاز، ولوحة الحكم من جهاز ثاني — بدون سيرفر خاص)
// =========================================================

const SUPABASE_URL = 'https://sqqerebmstshumrtiugv.supabase.co';
// مفتاح anon عام وآمن للاستخدام في المتصفح — كل الحماية عبر RLS على جدول rooms
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxcWVyZWJtc3RzaHVtcnRpdWd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzODI5ODcsImV4cCI6MjEwNDk1ODk4N30.sP9CAF0ZgVeWVCGgpWYtuD0WW9MQK41NO0QwRhSfdpI';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// حروف/أرقام بدون رموز ملتبسة (بدون 0/O و 1/I)
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomCode(len = 5) {
    let code = '';
    for (let i = 0; i < len; i++) {
        code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
    }
    return code;
}

class RoomSync {
    constructor(roomCode) {
        this.roomCode = (roomCode || '').toUpperCase().trim();
        this.channel = null;
        this.onStateUpdate = null;  // (state) => {}
        this.onJudgeAction = null;  // (payload) => {}
        this.onStatusChange = null; // (status) => {}
        this.pollTimer = null;
        this.lastStateJson = null;
    }

    // يفتح قناة البث المباشر لهذي الغرفة ويشترك فيها
    connect() {
        this.channel = supabaseClient.channel('room-' + this.roomCode, {
            config: { broadcast: { self: false } }
        });

        this.channel.on('broadcast', { event: 'state_update' }, (msg) => {
            if (this.onStateUpdate) this.onStateUpdate(msg.payload);
        });

        this.channel.on('broadcast', { event: 'judge_action' }, (msg) => {
            if (this.onJudgeAction) this.onJudgeAction(msg.payload);
        });

        this.channel.subscribe((status) => {
            console.log('[RoomSync] channel status:', status);
            if (this.onStatusChange) this.onStatusChange(status);
        });
        return this.channel;
    }

    // يجيب آخر حالة محفوظة للغرفة من قاعدة البيانات (يفيد عند فتح لوحة الحكم بعد بداية اللعبة)
    async fetchState() {
        try {
            const { data, error } = await supabaseClient
                .from('rooms')
                .select('state')
                .eq('room_code', this.roomCode)
                .maybeSingle();
            if (error) { console.error('[RoomSync] fetchState error:', error); return null; }
            return data ? data.state : null;
        } catch (e) {
            console.error('[RoomSync] fetchState exception:', e);
            return null;
        }
    }


    // مزامنة احتياطية: إذا فات جهازٌ حدث Broadcast بسبب انقطاع لحظي،
    // نقرأ آخر حالة محفوظة من قاعدة البيانات كل بضع ثوانٍ.
    startPolling(interval = 2500) {
        this.stopPolling();
        const poll = async () => {
            const state = await this.fetchState();
            if (!state) return;
            const json = JSON.stringify(state);
            if (json === this.lastStateJson) return;
            this.lastStateJson = json;
            if (this.onStateUpdate) this.onStateUpdate(state);
        };
        poll();
        this.pollTimer = setInterval(poll, interval);
    }

    stopPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    // يرسل الحالة الكاملة مباشرة عبر القناة، وبنفس الوقت يحفظها بقاعدة البيانات
    async pushState(state) {
        this.lastStateJson = JSON.stringify(state);
        if (this.channel) {
            try { await this.channel.send({ type: 'broadcast', event: 'state_update', payload: state }); }
            catch (e) { console.warn('[RoomSync] broadcast state failed:', e); }
        }
        try {
            const { error } = await supabaseClient
                .from('rooms')
                .upsert({ room_code: this.roomCode, state }, { onConflict: 'room_code' });
            if (error) console.error('[RoomSync] pushState upsert error:', error);
        } catch (e) {
            console.error('[RoomSync] pushState exception:', e);
        }
    }

    // ترسلها لوحة الحكم لشاشة اللعب (صحيح/غلط/تالي/إلخ)
    async sendJudgeAction(payload) {
        if (!this.channel) return false;
        try {
            await this.channel.send({ type: 'broadcast', event: 'judge_action', payload });
            return true;
        } catch (e) {
            console.error('[RoomSync] judge action failed:', e);
            return false;
        }
    }

    disconnect() {
        this.stopPolling();
        if (this.channel) {
            supabaseClient.removeChannel(this.channel);
            this.channel = null;
        }
    }
}
