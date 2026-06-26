# ══════════════════════════════════════════════
#  Flask أول شي — تضمن أن PORT مربوط حتى لو بقية الكود كراشت
# ══════════════════════════════════════════════
import os, sys, threading
from flask import Flask as _Flask
_app = _Flask(__name__)
_last_error = ""
_bot_started = False

@_app.route("/")
def _health(): return "OK", 200

@_app.route("/force-sync")
def _force_sync():
    import asyncio as _aio
    async def _do_sync():
        total = 0
        try:
            s = await bot.tree.sync(); total += len(s)
        except: pass
        for g in bot.guilds:
            try:
                bot.tree.copy_global_to(guild=g)
                s = await bot.tree.sync(guild=g); total += len(s)
            except: pass
        return total
    try:
        loop = bot.loop
        if loop and loop.is_running():
            fut = _aio.run_coroutine_threadsafe(_do_sync(), loop)
            n = fut.result(timeout=30)
            return {"ok": True, "synced": n}, 200
    except Exception as ex:
        return {"ok": False, "error": str(ex)}, 500
    return {"ok": False, "error": "loop not running"}, 500

@_app.route("/status")
def _status():
    try:
        connected = bot.is_ready()
        guilds = len(bot.guilds)
        latency = round(bot.latency * 1000)
    except Exception:
        connected, guilds, latency = False, 0, -1
    return {
        "online": connected, "guilds": guilds, "latency_ms": latency,
        "token_set": bool(os.getenv("TOKEN", "").strip()),
        "token_length": len(os.getenv("TOKEN", "").strip()),
        "last_error": _last_error, "bot_started": _bot_started,
        "render_url": os.getenv("RENDER_URL", "https://bot2-0hj7.onrender.com"),
    }, 200

_flask_port = int(os.getenv("PORT", 8080))

# ══════════════════════════════════════════════
#  الآن نستورد بقية المكتبات
# ══════════════════════════════════════════════
try:
    import discord
    from discord.ext import commands, tasks
    from discord import app_commands
    import asyncio, json, datetime, random, sqlite3, time
    import string as _string, itertools, aiohttp
    from typing import Optional
except Exception as _ie:
    _last_error = f"Import error: {_ie}"
    print(f"❌ {_last_error}")
    threading.Event().wait()   # انتظر الأبد — Flask تبقى شغّالة

TOKEN = (os.getenv("TOKEN") or os.getenv("DISCORD_BOT_TOKEN", "")).strip()
PREFIX = "y."
RENDER_URL = os.getenv("RENDER_URL", "https://bot2-0hj7.onrender.com").strip()

intents = discord.Intents.default()
intents.members = True
intents.message_content = True
intents.guilds = True
intents.bans = True
intents.voice_states = True
bot = commands.Bot(command_prefix=PREFIX, intents=intents, help_command=None)
DB_FILE = "bot_data.db"

def init_db():
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    c = conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS auctions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, item_name TEXT, start_price INTEGER,
        current_price INTEGER, highest_bidder TEXT, end_time INTEGER,
        guild_id TEXT, channel_id TEXT, message_id TEXT, active INTEGER DEFAULT 1)""")
    c.execute("""CREATE TABLE IF NOT EXISTS warnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, guild_id TEXT,
        reason TEXT, moderator_id TEXT, timestamp TEXT)""")
    c.execute("""CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT, channel_id TEXT, user_id TEXT,
        guild_id TEXT, status TEXT DEFAULT 'open', claimed_by TEXT,
        ticket_type TEXT DEFAULT 'استفسار', opened_at TEXT, closed_by TEXT,
        close_reason TEXT, closed_at TEXT)""")
    c.execute("""CREATE TABLE IF NOT EXISTS protection (
        guild_id TEXT PRIMARY KEY, enabled INTEGER DEFAULT 1,
        punishment TEXT DEFAULT 'ban', whitelist TEXT DEFAULT '[]',
        threshold INTEGER DEFAULT 3, window_seconds INTEGER DEFAULT 60)""")
    try: c.execute("ALTER TABLE protection ADD COLUMN threshold INTEGER DEFAULT 3")
    except: pass
    try: c.execute("ALTER TABLE protection ADD COLUMN window_seconds INTEGER DEFAULT 60")
    except: pass
    c.execute("""CREATE TABLE IF NOT EXISTS dhikr (
        guild_id TEXT PRIMARY KEY, channel_id TEXT,
        interval_seconds INTEGER DEFAULT 10, enabled INTEGER DEFAULT 0)""")
    c.execute("""CREATE TABLE IF NOT EXISTS ticket_settings (
        guild_id TEXT PRIMARY KEY, mention_role_ids TEXT DEFAULT '[]',
        category_id TEXT, title TEXT DEFAULT 'تذكرة دعم',
        mention_admin INTEGER DEFAULT 1,
        ticket_types TEXT DEFAULT '["استفسار","شراء","شكوى","اقتراح","دعم فني"]',
          description TEXT DEFAULT '', image_url TEXT DEFAULT '')""")
    c.execute("""CREATE TABLE IF NOT EXISTS afk (
        user_id TEXT, guild_id TEXT, reason TEXT DEFAULT 'غايب',
        timestamp TEXT, PRIMARY KEY (user_id, guild_id))""")
    c.execute("""CREATE TABLE IF NOT EXISTS autorole (
        guild_id TEXT PRIMARY KEY, role_id TEXT)""")
    c.execute("""CREATE TABLE IF NOT EXISTS cmd_aliases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT, alias TEXT, command TEXT)""")
    c.execute("""CREATE TABLE IF NOT EXISTS chatgpt (
        guild_id TEXT PRIMARY KEY, channel_id TEXT, enabled INTEGER DEFAULT 0,
        adab INTEGER DEFAULT 5)""")
    c.execute("""CREATE TABLE IF NOT EXISTS store_types (
        type_key TEXT PRIMARY KEY, display_name TEXT, price_points INTEGER DEFAULT 10)""")
    c.execute("""CREATE TABLE IF NOT EXISTS store_points (
        user_id TEXT PRIMARY KEY, points INTEGER DEFAULT 0)""")
    c.execute("""CREATE TABLE IF NOT EXISTS store_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT, type_key TEXT, account TEXT)""")
    for col in [("tickets","ticket_type","TEXT DEFAULT 'استفسار'"),
                ("tickets","opened_at","TEXT"),("tickets","closed_by","TEXT"),
                ("tickets","close_reason","TEXT"),("tickets","closed_at","TEXT"),
                ("ticket_settings","mention_role_ids","TEXT DEFAULT '[]'"),
                ("ticket_settings","ticket_types","TEXT DEFAULT '[]'"),
                ("ticket_settings","close_reasons","TEXT DEFAULT '[]'"),
                ("chatgpt","adab","INTEGER DEFAULT 5"),
                  ("ticket_settings","description","TEXT DEFAULT ''"),
                  ("ticket_settings","image_url","TEXT DEFAULT ''")]:
        try: c.execute(f"ALTER TABLE {col[0]} ADD COLUMN {col[1]} {col[2]}")
        except: pass
    c.execute("""CREATE TABLE IF NOT EXISTS maker_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT, user_name TEXT, bot_type_key TEXT, bot_type_name TEXT,
        server_id TEXT, server_name TEXT, points_paid INTEGER, status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT (datetime('now'))
    )""")
    conn.commit(); conn.close()

def db_q(sql, params=(), fetch=None):
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    c = conn.cursor(); c.execute(sql, params); conn.commit()
    r = c.fetchall() if fetch=="all" else c.fetchone() if fetch=="one" else None
    conn.close(); return r

def db_upsert(table, guild_id, **kw):
    conn = sqlite3.connect(DB_FILE, check_same_thread=False); c = conn.cursor()
    c.execute(f"SELECT guild_id FROM {table} WHERE guild_id=?", (guild_id,))
    if c.fetchone():
        for k,v in kw.items(): c.execute(f"UPDATE {table} SET {k}=? WHERE guild_id=?", (v, guild_id))
    else:
        cols="guild_id,"+",".join(kw.keys()); ph="?,"+"?,"*len(kw); ph=ph.rstrip(",")
        c.execute(f"INSERT INTO {table} ({cols}) VALUES ({ph})", (guild_id,*kw.values()))
    conn.commit(); conn.close()

AZKAR = [
    "سبحان الله وبحمده، سبحان الله العظيم",
    "لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير",
    "اللهم صلِّ وسلِّم وبارك على سيدنا محمد وعلى آله وصحبه أجمعين",
    "استغفر الله العظيم وأتوب إليه",
    "لا حول ولا قوة إلا بالله العلي العظيم",
    "سبحان الله والحمد لله ولا إله إلا الله والله أكبر",
    "أستغفر الله الذي لا إله إلا هو الحي القيوم وأتوب إليه",
    "اللهم إنك عفو تحب العفو فاعفُ عنا",
    "رب اغفر لي وتب عليَّ إنك أنت التواب الرحيم",
    "سبحان الله وبحمده عدد خلقه، ورضا نفسه، وزنة عرشه، ومداد كلماته",
    "اللهم بك أصبحنا وبك أمسينا وبك نحيا وبك نموت وإليك النشور",
    "حسبي الله لا إله إلا هو عليه توكلت وهو رب العرش العظيم",
    "يا حيُّ يا قيومُ برحمتك أستغيث، أصلح لي شأني كله ولا تكلني إلى نفسي طرفة عين",
    "اللهم إني أسألك العفو والعافية في الدنيا والآخرة",
    "بسم الله الذي لا يضر مع اسمه شيء في الأرض ولا في السماء وهو السميع العليم",
    "اللهم أنت ربي لا إله إلا أنت، خلقتني وأنا عبدك",
    "سبحان الله ملء الميزان ومنتهى العلم ومبلغ الرضا وزنة العرش",
    "لا إله إلا الله المَلِكُ الحق المبين",
    "اللهم اجعلنا من الذاكرين لك الشاكرين لك",
    "الحمد لله الذي بنعمته تتم الصالحات",
    "اللهم اغفر لنا ذنوبنا وكفِّر عنا سيئاتنا وتوفَّنا مع الأبرار",
    "ربنا آتنا في الدنيا حسنة وفي الآخرة حسنة وقنا عذاب النار",
    "اللهم إني أعوذ بك من الهم والحزن والعجز والكسل",
    "توكلت على الله لا حول ولا قوة إلا بالله",
    "الله أكبر كبيرا، والحمد لله كثيرا، وسبحان الله بكرة وأصيلا",
]

SECONDARY_AZKAR = [
    "استغفر الله وأتوب إليه",
    "سبحان الله وبحمده",
    "لا إله إلا الله",
    "الله أكبر",
    "سبحان الله",
    "الحمد لله",
    "لا حول ولا قوة إلا بالله",
    "اللهم صل على محمد",
    "حسبي الله ونعم الوكيل",
    "توكلت على الله",
]

DHIKR_FOOTERS = [
    "اللهم ارزقنا الجنة",
    "اللهم اغفر لنا ولوالدينا",
    "اللهم تب علينا",
    "اللهم اجعلنا من عبادك الصالحين",
    "اللهم ارحمنا برحمتك",
    "اللهم اهدنا واهد بنا",
    "اللهم اجعل القرآن ربيع قلوبنا",
    "اللهم عافنا واعفُ عنا",
]

def _make_dhikr_embeds(bot_user=None):
    main_dhikr = random.choice(AZKAR)
    sec_dhikr  = random.choice(SECONDARY_AZKAR)
    footer_txt = random.choice(DHIKR_FOOTERS)

    e1 = discord.Embed(
        description=f"## {main_dhikr}",
        color=0x1B1D21
    )
    if bot_user:
        e1.set_author(name="اذكار البوت", icon_url=bot_user.display_avatar.url)

    repeated = f"> {sec_dhikr}\n> {sec_dhikr}\n> {sec_dhikr}"
    e2 = discord.Embed(description=repeated, color=0xF0EBE0)
    e2.set_footer(text=footer_txt)

    return [e1, e2]

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
chatgpt_history = {}

dhikr_channels = {}; recent_deletions = {}; bot.start_time = datetime.datetime.utcnow()

_synced_once = False

@bot.event
async def on_ready():
    global _synced_once
    init_db()
    print(f"✅ {bot.user} | {len(bot.guilds)} سيرفر")
    # تشغيل المهام
    for t in [check_auctions, send_dhikr, self_ping]:
        if not t.is_running(): t.start()
    # sync مرة واحدة فقط عند أول تشغيل
    if not _synced_once:
        _synced_once = True
        await asyncio.sleep(2)
        try:
            synced = await bot.tree.sync()
            print(f"sync global: {len(synced)}")
        except Exception as e:
            print(f"sync err: {e}")
        for _g in bot.guilds:
            try:
                bot.tree.copy_global_to(guild=_g)
                await bot.tree.sync(guild=_g)
            except: pass
        print(f"guild sync done: {len(bot.guilds)} servers")


@bot.event
async def on_guild_join(guild):
    try:
        synced = await bot.tree.sync(guild=guild)
        print(f"✅ sync {guild.name}: {len(synced)} أمر")
    except Exception as e:
        print(f"❌ sync {guild.name}: {e}")

@tasks.loop(seconds=10)
async def send_dhikr():
    try:
        rows = db_q("SELECT guild_id,channel_id,interval_seconds FROM dhikr WHERE enabled=1", fetch="all") or []
        now = int(time.time())
        for guild_id, channel_id, interval in rows:
            if not channel_id: continue
            dhikr_channels.setdefault(guild_id, {"last_sent": 0})
            if now - dhikr_channels[guild_id]["last_sent"] >= interval:
                ch = bot.get_channel(int(channel_id))
                if ch:
                    try:
                        embeds = _make_dhikr_embeds(bot.user)
                        await ch.send(embeds=embeds)
                        dhikr_channels[guild_id]["last_sent"] = now
                    except: pass
    except Exception as ex: print(f"dhikr:{ex}")

@tasks.loop(minutes=1)
async def self_ping():
    if not RENDER_URL: return
    try:
        async with aiohttp.ClientSession() as s:
            async with s.get(RENDER_URL, timeout=aiohttp.ClientTimeout(total=10)) as r:
                print(f"[Ping] ✅ {r.status}")
    except Exception as e: print(f"[Ping] ⚠️ {e}")

@tasks.loop(seconds=30)
async def check_auctions():
    try:
        now = int(time.time())
        ended = db_q("SELECT * FROM auctions WHERE active=1 AND end_time<=?", (now,), fetch="all") or []
        for a in ended:
            aid,item,_,cur_p,bidder,_,_,ch_id,_,_ = a
            db_q("UPDATE auctions SET active=0 WHERE id=?", (aid,))
            if ch_id:
                ch = bot.get_channel(int(ch_id))
                if ch:
                    if bidder:
                        e = discord.Embed(title="🏆 انتهى المزاد!", color=discord.Color.gold())
                        e.add_field(name="السلعة", value=item); e.add_field(name="الفائز", value=f"<@{bidder}>"); e.add_field(name="السعر", value=f"{cur_p:,}")
                    else:
                        e = discord.Embed(title="❌ انتهى المزاد بدون مشاركين", color=discord.Color.red()); e.add_field(name="السلعة", value=item)
                    await ch.send(embed=e)
    except Exception as ex: print(f"auction:{ex}")

@bot.event
async def on_guild_channel_delete(channel):
    guild = channel.guild
    row = db_q("SELECT enabled,punishment,whitelist,threshold,window_seconds FROM protection WHERE guild_id=?", (str(guild.id),), fetch="one")
    if not row or not row[0]: return
    wl = json.loads(row[2] or "[]"); threshold = row[3] or 3; window = row[4] or 60
    try:
        async for e in guild.audit_logs(limit=1, action=discord.AuditLogAction.channel_delete):
            if e.user.id == bot.user.id or str(e.user.id) in wl: return
            uid = str(guild.id)
            recent_deletions.setdefault(uid, {"channels":[],"roles":[]})
            recent_deletions[uid]["channels"].append({"user":e.user.id,"time":time.time()})
            recent_deletions[uid]["channels"] = [d for d in recent_deletions[uid]["channels"] if time.time()-d["time"]<window]
            if len([d for d in recent_deletions[uid]["channels"] if d["user"]==e.user.id]) >= threshold:
                await apply_punishment(guild, e.user, row[1], f"حذف قناة: #{channel.name}")
    except Exception as ex: print(f"prot-ch:{ex}")

@bot.event
async def on_guild_role_delete(role):
    guild = role.guild
    row = db_q("SELECT enabled,punishment,whitelist,threshold,window_seconds FROM protection WHERE guild_id=?", (str(guild.id),), fetch="one")
    if not row or not row[0]: return
    wl = json.loads(row[2] or "[]"); threshold = row[3] or 3; window = row[4] or 60
    try:
        async for e in guild.audit_logs(limit=1, action=discord.AuditLogAction.role_delete):
            if e.user.id == bot.user.id or str(e.user.id) in wl: return
            uid = str(guild.id)
            recent_deletions.setdefault(uid, {"channels":[],"roles":[]})
            recent_deletions[uid]["roles"].append({"user":e.user.id,"time":time.time()})
            recent_deletions[uid]["roles"] = [d for d in recent_deletions[uid]["roles"] if time.time()-d["time"]<window]
            if len([d for d in recent_deletions[uid]["roles"] if d["user"]==e.user.id]) >= threshold:
                await apply_punishment(guild, e.user, row[1], f"حذف رتبة: {role.name}")
    except Exception as ex: print(f"prot-role:{ex}")

@bot.event
async def on_member_ban(guild, user):
    row = db_q("SELECT enabled,punishment,whitelist,threshold,window_seconds FROM protection WHERE guild_id=?", (str(guild.id),), fetch="one")
    if not row or not row[0]: return
    wl = json.loads(row[2] or "[]"); threshold = row[3] or 3; window = row[4] or 60
    try:
        async for e in guild.audit_logs(limit=1, action=discord.AuditLogAction.ban):
            if e.user.id == bot.user.id or str(e.user.id) in wl: return
            uid = str(guild.id)
            recent_deletions.setdefault(uid, {"bans":[]})
            recent_deletions[uid].setdefault("bans", [])
            recent_deletions[uid]["bans"].append({"user":e.user.id,"time":time.time()})
            recent_deletions[uid]["bans"] = [d for d in recent_deletions[uid]["bans"] if time.time()-d["time"]<window]
            if len([d for d in recent_deletions[uid]["bans"] if d["user"]==e.user.id]) >= threshold:
                await apply_punishment(guild, e.user, row[1], f"باند جماعي غير مصرح")
    except Exception as ex: print(f"prot-ban:{ex}")

@bot.event
async def on_member_remove(member):
    guild = member.guild
    row = db_q("SELECT enabled,punishment,whitelist,threshold,window_seconds FROM protection WHERE guild_id=?", (str(guild.id),), fetch="one")
    if not row or not row[0]: return
    wl = json.loads(row[2] or "[]"); threshold = row[3] or 3; window = row[4] or 60
    try:
        async for e in guild.audit_logs(limit=1, action=discord.AuditLogAction.kick):
            if e.user.id == bot.user.id or str(e.user.id) in wl: return
            if e.target.id != member.id: return
            uid = str(guild.id)
            recent_deletions.setdefault(uid, {"channels":[],"roles":[],"kicks":[]})
            recent_deletions[uid].setdefault("kicks", [])
            recent_deletions[uid]["kicks"].append({"user":e.user.id,"time":time.time()})
            recent_deletions[uid]["kicks"] = [d for d in recent_deletions[uid]["kicks"] if time.time()-d["time"]<window]
            if len([d for d in recent_deletions[uid]["kicks"] if d["user"]==e.user.id]) >= threshold:
                await apply_punishment(guild, e.user, row[1], f"كيك جماعي غير مصرح")
    except Exception as ex: print(f"prot-kick:{ex}")

@bot.event
async def on_webhooks_update(channel):
    guild = channel.guild
    row = db_q("SELECT enabled,punishment,whitelist,threshold,window_seconds FROM protection WHERE guild_id=?", (str(guild.id),), fetch="one")
    if not row or not row[0]: return
    wl = json.loads(row[2] or "[]")
    try:
        async for e in guild.audit_logs(limit=1, action=discord.AuditLogAction.webhook_create):
            if e.user.id == bot.user.id or str(e.user.id) in wl: return
            await apply_punishment(guild, e.user, row[1], f"إنشاء ويب هوك غير مصرح")
    except Exception as ex: print(f"prot-webhook:{ex}")

@bot.event
async def on_guild_channel_create(channel):
    guild = channel.guild
    row = db_q("SELECT enabled,punishment,whitelist,threshold,window_seconds FROM protection WHERE guild_id=?", (str(guild.id),), fetch="one")
    if not row or not row[0]: return
    wl = json.loads(row[2] or "[]"); threshold = row[3] or 3; window = row[4] or 60
    try:
        async for e in guild.audit_logs(limit=1, action=discord.AuditLogAction.channel_create):
            if e.user.id == bot.user.id or str(e.user.id) in wl: return
            uid = str(guild.id)
            recent_deletions.setdefault(uid, {"channels":[],"roles":[],"kicks":[],"ch_creates":[]})
            recent_deletions[uid].setdefault("ch_creates", [])
            recent_deletions[uid]["ch_creates"].append({"user":e.user.id,"time":time.time()})
            recent_deletions[uid]["ch_creates"] = [d for d in recent_deletions[uid]["ch_creates"] if time.time()-d["time"]<window]
            if len([d for d in recent_deletions[uid]["ch_creates"] if d["user"]==e.user.id]) >= threshold:
                await apply_punishment(guild, e.user, row[1], f"إنشاء قنوات مشبوه")
    except Exception as ex: print(f"prot-ch-create:{ex}")

async def apply_punishment(guild, user, punishment, reason):
    m = guild.get_member(user.id)
    if not m: return
    try:
        if punishment == "ban": await guild.ban(m, reason=f"🛡️ {reason}")
        elif punishment == "kick": await guild.kick(m, reason=f"🛡️ {reason}")
        elif punishment == "timeout":
            await m.timeout(discord.utils.utcnow()+datetime.timedelta(hours=24), reason=f"🛡️ {reason}")
        elif punishment == "strip":
            for r in m.roles[1:]:
                try: await m.remove_roles(r)
                except: pass
        lc = discord.utils.get(guild.channels, name="protection-log")
        if lc:
            e = discord.Embed(title="🛡️ الحماية", color=discord.Color.red())
            e.add_field(name="المخالف", value=f"{user.mention}"); e.add_field(name="السبب", value=reason); e.add_field(name="العقوبة", value=punishment)
            e.timestamp = discord.utils.utcnow(); await lc.send(embed=e)
    except Exception as ex: print(f"punishment:{ex}")

def get_ticket_settings(guild_id):
    return db_q("SELECT mention_role_ids,category_id,title,mention_admin,ticket_types,close_reasons FROM ticket_settings WHERE guild_id=?",
                (str(guild_id),), fetch="one")

def format_dt(dt=None):
    if dt is None: dt = datetime.datetime.now()
    days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
    months = ["January","February","March","April","May","June","July","August","September","October","November","December"]
    return f"{days[dt.weekday()]}, {months[dt.month-1]} {dt.day}, {dt.year} {dt.strftime('%I:%M %p')}"

class CustomTicketTypeModal(discord.ui.Modal, title="قسم التذكرة"):
    value = discord.ui.TextInput(label="اكتب قسم التذكرة", placeholder="مثال: استشارة قانونية...", max_length=50)
    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.defer()
        await create_ticket_channel(interaction, self.value.value)

class TicketTypeSelect(discord.ui.View):
    def __init__(self, types):
        super().__init__(timeout=60)
        opts = [discord.SelectOption(label=t, value=t) for t in types[:5]]
        opts.append(discord.SelectOption(label="✏️ مخصص...", value="__custom__", description="اكتب قسمك الخاص"))
        sel = discord.ui.Select(placeholder="اختر نوع التذكرة...", options=opts, custom_id="ticket_type_sel")
        sel.callback = self.on_select; self.add_item(sel)

    async def on_select(self, interaction: discord.Interaction):
        ttype = interaction.data["values"][0]
        if ttype == "__custom__":
            await interaction.response.send_modal(CustomTicketTypeModal())
        else:
            await interaction.response.defer()
            await create_ticket_channel(interaction, ttype)
        self.stop()

async def create_ticket_channel(interaction: discord.Interaction, ticket_type: str):
    guild = interaction.guild
    s = get_ticket_settings(guild.id)
    existing = db_q("SELECT id FROM tickets WHERE user_id=? AND guild_id=? AND status='open'",
                    (str(interaction.user.id), str(guild.id)), fetch="one")
    if existing:
        try: await interaction.followup.send("❌ عندك تذكرة مفتوحة!", ephemeral=True)
        except: pass
        return
    category = guild.get_channel(int(s[1])) if s and s[1] else None
    title = (s[2] if s and s[2] else "تذكرة دعم")
    role_ids = json.loads(s[0]) if s and s[0] else []
    overwrites = {
        guild.default_role: discord.PermissionOverwrite(view_channel=False),
        interaction.user: discord.PermissionOverwrite(view_channel=True, send_messages=True, attach_files=True),
        guild.me: discord.PermissionOverwrite(view_channel=True, send_messages=True, manage_channels=True),
    }
    for rid in role_ids:
        role = guild.get_role(int(rid))
        if role: overwrites[role] = discord.PermissionOverwrite(view_channel=True, send_messages=True, manage_channels=True)
    ticket_num = (db_q("SELECT COUNT(*) FROM tickets WHERE guild_id=?", (str(guild.id),), fetch="one") or [0])[0] + 1
    ch = await guild.create_text_channel(
        name=f"ticket-{ticket_num}-{interaction.user.name[:10]}",
        category=category, overwrites=overwrites)
    opened_at = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    db_q("INSERT INTO tickets (channel_id,user_id,guild_id,status,ticket_type,opened_at) VALUES (?,?,?,'open',?,?)",
         (str(ch.id), str(interaction.user.id), str(guild.id), ticket_type, opened_at))
    mentions = " | ".join(f"<@&{rid}>" for rid in role_ids) if role_ids else "—"
    dt_str = format_dt()
    e = discord.Embed(title=f"🎫 {title}", color=0x5865F2)
    e.add_field(name="👤 مالك التذكرة", value=interaction.user.mention, inline=True)
    e.add_field(name="🛡️ مشرفي التذاكر", value=mentions, inline=True)
    e.add_field(name="📅 تاريخ التذكرة", value=dt_str, inline=False)
    e.add_field(name="🔢 رقم التذكرة", value=str(ticket_num), inline=True)
    e.add_field(name="❓ قسم التذكرة", value=ticket_type, inline=True)
    mention_txt = " ".join(f"<@&{rid}>" for rid in role_ids) if (s and s[3] and role_ids) else None
    view = TicketManageView()
    await ch.send(content=mention_txt, embed=e, view=view)
    try: await interaction.followup.send(f"✅ تذكرتك: {ch.mention}", ephemeral=True)
    except: pass

class TicketView(discord.ui.View):
    def __init__(self): super().__init__(timeout=None)

    @discord.ui.button(label="📩 فتح تذكرة", style=discord.ButtonStyle.primary, custom_id="open_ticket")
    async def open_ticket(self, interaction: discord.Interaction, button: discord.ui.Button):
        s = get_ticket_settings(interaction.guild.id)
        types = json.loads(s[4]) if s and s[4] else ["استفسار","شراء","شكوى","اقتراح","دعم فني"]
        if not types: types = ["استفسار","شراء","شكوى","اقتراح","دعم فني"]
        existing = db_q("SELECT id FROM tickets WHERE user_id=? AND guild_id=? AND status='open'",
                        (str(interaction.user.id), str(interaction.guild.id)), fetch="one")
        if existing:
            await interaction.response.send_message("❌ عندك تذكرة مفتوحة!", ephemeral=True); return
        e = discord.Embed(title="🎫 اختر نوع التذكرة", description="اختر قسم طلبك من القائمة أدناه:", color=0x5865F2)
        await interaction.response.send_message(embed=e, view=TicketTypeSelect(types), ephemeral=True)

async def do_close_ticket(interaction: discord.Interaction, reason: str):
    ch = interaction.channel
    row = db_q("SELECT user_id,opened_at,claimed_by FROM tickets WHERE channel_id=? AND status='open'", (str(ch.id),), fetch="one")
    if not row: await interaction.response.send_message("❌ تذكرة مغلقة.", ephemeral=True); return
    uid, opened_at, claimed_by = row
    closed_at = format_dt()
    db_q("UPDATE tickets SET status='closed',closed_by=?,close_reason=?,closed_at=? WHERE channel_id=?",
         (str(interaction.user.id), reason, closed_at, str(ch.id)))
    try:
        user = interaction.guild.get_member(int(uid))
        if user:
            e = discord.Embed(title="📋 تم إغلاق التذكرة", color=discord.Color.red())
            e.add_field(name="تم الفتح بواسطة", value=user.mention, inline=False)
            e.add_field(name="تم المطالبة بواسطة", value=f"<@{claimed_by}>" if claimed_by else "—", inline=False)
            e.add_field(name="تم الإغلاق بواسطة", value=interaction.user.mention, inline=False)
            e.add_field(name="وقت الفتح", value=opened_at or "—", inline=True)
            e.add_field(name="وقت الإغلاق", value=closed_at, inline=True)
            e.add_field(name="سبب الإغلاق", value=reason, inline=False)
            btn = discord.ui.View(); b = discord.ui.Button(label="عرض التذكرة", url=ch.jump_url, emoji="🔗"); btn.add_item(b)
            await user.send(embed=e, view=btn)
    except: pass
    await interaction.response.send_message("⏳ إغلاق خلال 3 ثواني...")
    await asyncio.sleep(3)
    try: await ch.delete()
    except: pass

class CustomCloseReasonModal(discord.ui.Modal, title="سبب الإغلاق"):
    value = discord.ui.TextInput(label="اكتب سبب الإغلاق", placeholder="مثال: انتهى الموضوع...", max_length=100)
    async def on_submit(self, interaction: discord.Interaction):
        await do_close_ticket(interaction, self.value.value)

class CloseReasonSelect(discord.ui.View):
    def __init__(self, reasons):
        super().__init__(timeout=60)
        nums = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣"]
        opts = [discord.SelectOption(label=f"{nums[i]} {r}", value=r) for i,r in enumerate(reasons[:5])]
        opts.append(discord.SelectOption(label="✏️ مخصص...", value="__custom__", description="اكتب سببك الخاص"))
        sel = discord.ui.Select(placeholder="اختر سبب الإغلاق...", options=opts)
        sel.callback = self.on_select; self.add_item(sel)
    async def on_select(self, interaction: discord.Interaction):
        if not interaction.user.guild_permissions.manage_channels:
            await interaction.response.send_message("❌ لا صلاحية.", ephemeral=True); return
        val = interaction.data["values"][0]
        if val == "__custom__":
            await interaction.response.send_modal(CustomCloseReasonModal())
        else:
            await do_close_ticket(interaction, val)
        self.stop()

class AddPersonModal(discord.ui.Modal, title="إضافة شخص للتذكرة"):
    user_id = discord.ui.TextInput(label="ID الشخص", placeholder="أدخل ID العضو...")
    async def on_submit(self, interaction: discord.Interaction):
        try:
            m = interaction.guild.get_member(int(self.user_id.value))
            if not m: await interaction.response.send_message("❌ عضو غير موجود.", ephemeral=True); return
            await interaction.channel.set_permissions(m, view_channel=True, send_messages=True)
            await interaction.response.send_message(f"✅ تمت إضافة {m.mention} للتذكرة.")
        except: await interaction.response.send_message("❌ ID غير صحيح.", ephemeral=True)

class TicketOptionsView(discord.ui.View):
    def __init__(self): super().__init__(timeout=60)

    @discord.ui.button(label="إغلاق بسبب", emoji="🔒", style=discord.ButtonStyle.danger)
    async def close_with_reason(self, interaction: discord.Interaction, b):
        if not interaction.user.guild_permissions.manage_channels:
            await interaction.response.send_message("❌ لا صلاحية.", ephemeral=True); return
        s = get_ticket_settings(interaction.guild.id)
        reasons = json.loads(s[5]) if s and s[5] else []
        if not reasons: reasons = ["تم الحل","مكتمل","رفض","مزيف","أخرى"]
        e = discord.Embed(title="🔒 اختر سبب الإغلاق", color=discord.Color.red())
        await interaction.response.send_message(embed=e, view=CloseReasonSelect(reasons), ephemeral=True)

    @discord.ui.button(label="إضافة شخص", emoji="👤", style=discord.ButtonStyle.secondary)
    async def add_person(self, interaction: discord.Interaction, b):
        if not interaction.user.guild_permissions.manage_channels:
            await interaction.response.send_message("❌ لا صلاحية.", ephemeral=True); return
        await interaction.response.send_modal(AddPersonModal())

    @discord.ui.button(label="تذكير العضو", emoji="✉️", style=discord.ButtonStyle.secondary)
    async def remind_user(self, interaction: discord.Interaction, b):
        row = db_q("SELECT user_id FROM tickets WHERE channel_id=? AND status='open'", (str(interaction.channel.id),), fetch="one")
        if not row: await interaction.response.send_message("❌ تذكرة مغلقة.", ephemeral=True); return
        try:
            m = interaction.guild.get_member(int(row[0]))
            if m:
                e = discord.Embed(title="⏰ تذكير بالتذكرة", description=f"تذكرتك في **{interaction.guild.name}** تنتظر ردك!", color=discord.Color.yellow())
                btn = discord.ui.View(); b2 = discord.ui.Button(label="عرض التذكرة", url=interaction.channel.jump_url, emoji="🔗"); btn.add_item(b2)
                await m.send(embed=e, view=btn)
                await interaction.response.send_message("✅ تم إرسال التذكير.", ephemeral=True)
            else: await interaction.response.send_message("❌ العضو غير موجود.", ephemeral=True)
        except: await interaction.response.send_message("❌ لم يتم الإرسال (الخاص مغلق).", ephemeral=True)

    @discord.ui.button(label="نسخة التذكرة", emoji="📄", style=discord.ButtonStyle.secondary)
    async def copy_ticket(self, interaction: discord.Interaction, b):
        row = db_q("SELECT user_id,ticket_type,opened_at FROM tickets WHERE channel_id=?", (str(interaction.channel.id),), fetch="one")
        if not row: await interaction.response.send_message("❌ لا معلومات.", ephemeral=True); return
        e = discord.Embed(title="📄 نسخة التذكرة", color=discord.Color.blue())
        e.add_field(name="القناة", value=interaction.channel.mention)
        e.add_field(name="العضو", value=f"<@{row[0]}>")
        e.add_field(name="النوع", value=row[1] or "—")
        e.add_field(name="وقت الفتح", value=row[2] or "—", inline=False)
        await interaction.response.send_message(embed=e, ephemeral=True)

class TicketManageView(discord.ui.View):
    def __init__(self): super().__init__(timeout=None)

    @discord.ui.button(label="استلام", emoji="🧰", style=discord.ButtonStyle.success, custom_id="claim_ticket")
    async def claim_ticket(self, interaction: discord.Interaction, button: discord.ui.Button):
        row = db_q("SELECT id,claimed_by FROM tickets WHERE channel_id=? AND status='open'", (str(interaction.channel.id),), fetch="one")
        if not row: await interaction.response.send_message("❌ التذكرة مغلقة.", ephemeral=True); return
        if row[1]: await interaction.response.send_message(f"❌ مستلمة من <@{row[1]}>", ephemeral=True); return
        db_q("UPDATE tickets SET claimed_by=? WHERE channel_id=?", (str(interaction.user.id), str(interaction.channel.id)))
        e = discord.Embed(description=f"✅ {interaction.user.mention} استلم التذكرة!", color=discord.Color.green())
        await interaction.response.send_message(embed=e)

    @discord.ui.button(label="خيارات التذكرة", emoji="🎫", style=discord.ButtonStyle.secondary, custom_id="ticket_options")
    async def ticket_options(self, interaction: discord.Interaction, button: discord.ui.Button):
        e = discord.Embed(title="🎫 اختر خياراً للتذكرة", color=0x5865F2)
        e.add_field(name="🔒 إغلاق بسبب", value="إغلاق التذكرة بسبب", inline=False)
        e.add_field(name="👤 إضافة شخص", value="إضافة شخص إلى التذكرة", inline=False)
        e.add_field(name="✉️ تذكير عبر الرسائل", value="إرسال تذكير للعضو في الخاص", inline=False)
        e.add_field(name="📄 طلب نسخة", value="طلب نسخة من التذكرة", inline=False)
        await interaction.response.send_message(embed=e, view=TicketOptionsView(), ephemeral=True)

@bot.tree.command(name="ticket-setup", description="إعداد التذاكر")
@app_commands.describe(channel="القناة", title="العنوان", description="وصف البانل (مثال: بيع فلوس، دعم فني...)", image_url="رابط صورة البانل", role1="رتبة 1", role2="رتبة 2", role3="رتبة 3", role4="رتبة 4", role5="رتبة 5")
@app_commands.checks.has_permissions(administrator=True)
async def ticket_setup(interaction: discord.Interaction, channel: discord.TextChannel,
                       title: str = "تذكرة دعم",
                       description: str = "اضغط على الزر أدناه لفتح تذكرة.",
                       image_url: str = "",
                       role1: Optional[discord.Role]=None, role2: Optional[discord.Role]=None,
                       role3: Optional[discord.Role]=None, role4: Optional[discord.Role]=None,
                       role5: Optional[discord.Role]=None):
    roles = [r for r in [role1,role2,role3,role4,role5] if r]
    role_ids = json.dumps([str(r.id) for r in roles])
    db_upsert("ticket_settings", str(interaction.guild.id),
              mention_role_ids=role_ids, title=title, mention_admin=1,
              description=description, image_url=image_url)
    e = discord.Embed(title=f"🎫 {title}", description=description, color=0x5865F2)
    if image_url:
        e.set_image(url=image_url)
    if roles:
        e.add_field(name="🛡️ الإدارة المسؤولة", value=" | ".join(r.mention for r in roles))
    await channel.send(embed=e, view=TicketView())
    await interaction.response.send_message(f"✅ تذاكر جاهزة في {channel.mention}", ephemeral=True)


@bot.tree.command(name="ticket-category", description="كاتيغوري التذاكر")
@app_commands.describe(category="الكاتيغوري")
@app_commands.checks.has_permissions(administrator=True)
async def ticket_category(interaction: discord.Interaction, category: discord.CategoryChannel):
    db_upsert("ticket_settings", str(interaction.guild.id), category_id=str(category.id))
    await interaction.response.send_message(f"✅ الكاتيغوري: {category.name}")

@bot.tree.command(name="ticket-types", description="تعيين أنواع التذاكر (مفصولة بفاصلة)")
@app_commands.describe(types="مثال: استفسار,شراء,شكوى,اقتراح,دعم فني")
@app_commands.checks.has_permissions(administrator=True)
async def ticket_types_cmd(interaction: discord.Interaction, types: str):
    lst = [t.strip() for t in types.replace("،", ",").split(",") if t.strip()][:5]
    db_upsert("ticket_settings", str(interaction.guild.id), ticket_types=json.dumps(lst))
    await interaction.response.send_message(f"✅ أنواع التذاكر: {' | '.join(lst)}")

@bot.tree.command(name="ticket-close-reasons", description="تعيين أسباب إغلاق التذاكر (حتى 5)")
@app_commands.describe(reason1="سبب 1", reason2="سبب 2", reason3="سبب 3", reason4="سبب 4", reason5="سبب 5")
@app_commands.checks.has_permissions(administrator=True)
async def ticket_close_reasons(interaction: discord.Interaction,
                                reason1: str, reason2: Optional[str]=None,
                                reason3: Optional[str]=None, reason4: Optional[str]=None,
                                reason5: Optional[str]=None):
    lst = [r for r in [reason1, reason2, reason3, reason4, reason5] if r]
    db_upsert("ticket_settings", str(interaction.guild.id), close_reasons=json.dumps(lst))
    nums = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣"]
    formatted = "\n".join(f"{nums[i]} {r}" for i,r in enumerate(lst))
    await interaction.response.send_message(f"✅ أسباب الإغلاق:\n{formatted}")

@bot.tree.command(name="ban", description="باند عضو")
@app_commands.describe(member="العضو", reason="السبب", delete_days="حذف رسائل")
@app_commands.checks.has_permissions(ban_members=True)
async def slash_ban(interaction: discord.Interaction, member: discord.Member, reason: str="—", delete_days: int=0):
    await interaction.guild.ban(member, reason=reason, delete_message_days=max(0,min(7,delete_days)))
    e = discord.Embed(title="🔨 تم الباند", color=discord.Color.red())
    e.add_field(name="العضو", value=member.mention); e.add_field(name="السبب", value=reason); e.add_field(name="المشرف", value=interaction.user.mention)
    await interaction.response.send_message(embed=e)

@bot.tree.command(name="unban", description="رفع الباند")
@app_commands.describe(user_id="ID المستخدم", reason="السبب")
@app_commands.checks.has_permissions(ban_members=True)
async def slash_unban(interaction: discord.Interaction, user_id: str, reason: str="—"):
    try:
        user = await bot.fetch_user(int(user_id)); await interaction.guild.unban(user, reason=reason)
        e = discord.Embed(title="✅ رُفع الباند", color=discord.Color.green()); e.add_field(name="المستخدم", value=str(user))
        await interaction.response.send_message(embed=e)
    except: await interaction.response.send_message("❌ مستخدم غير موجود/محظور.", ephemeral=True)

@bot.tree.command(name="kick", description="طرد عضو")
@app_commands.describe(member="العضو", reason="السبب")
@app_commands.checks.has_permissions(kick_members=True)
async def slash_kick(interaction: discord.Interaction, member: discord.Member, reason: str="—"):
    await member.kick(reason=reason)
    e = discord.Embed(title="👢 تم الكيك", color=discord.Color.orange())
    e.add_field(name="العضو", value=member.mention); e.add_field(name="السبب", value=reason)
    await interaction.response.send_message(embed=e)

@bot.tree.command(name="timeout", description="تايم اوت عضو")
@app_commands.describe(member="العضو", minutes="الدقائق", reason="السبب")
@app_commands.checks.has_permissions(moderate_members=True)
async def slash_timeout(interaction: discord.Interaction, member: discord.Member, minutes: int, reason: str="—"):
    await member.timeout(discord.utils.utcnow()+datetime.timedelta(minutes=minutes), reason=reason)
    e = discord.Embed(title="⏳ تم التايم اوت", color=discord.Color.yellow())
    e.add_field(name="العضو", value=member.mention); e.add_field(name="المدة", value=f"{minutes}د"); e.add_field(name="السبب", value=reason)
    await interaction.response.send_message(embed=e)

@bot.tree.command(name="untimeout", description="رفع التايم اوت")
@app_commands.checks.has_permissions(moderate_members=True)
async def slash_untimeout(interaction: discord.Interaction, member: discord.Member):
    await member.timeout(None)
    e = discord.Embed(title="✅ رُفع التايم اوت", color=discord.Color.green()); e.add_field(name="العضو", value=member.mention)
    await interaction.response.send_message(embed=e)

@bot.tree.command(name="mute", description="ميوت عضو")
@app_commands.describe(member="العضو", reason="السبب")
@app_commands.checks.has_permissions(manage_roles=True)
async def slash_mute(interaction: discord.Interaction, member: discord.Member, reason: str="—"):
    mr = discord.utils.get(interaction.guild.roles, name="Muted")
    if not mr:
        mr = await interaction.guild.create_role(name="Muted")
        for ch in interaction.guild.channels:
            try: await ch.set_permissions(mr, send_messages=False, speak=False)
            except: pass
    await member.add_roles(mr, reason=reason)
    e = discord.Embed(title="🔇 تم الميوت", color=discord.Color.dark_gray())
    e.add_field(name="العضو", value=member.mention); e.add_field(name="السبب", value=reason)
    await interaction.response.send_message(embed=e)

@bot.tree.command(name="unmute", description="رفع الميوت")
@app_commands.checks.has_permissions(manage_roles=True)
async def slash_unmute(interaction: discord.Interaction, member: discord.Member):
    mr = discord.utils.get(interaction.guild.roles, name="Muted")
    if mr and mr in member.roles:
        await member.remove_roles(mr)
        e = discord.Embed(title="✅ رُفع الميوت", color=discord.Color.green()); e.add_field(name="العضو", value=member.mention)
        await interaction.response.send_message(embed=e)
    else: await interaction.response.send_message("❌ مو مميوت.", ephemeral=True)

@bot.tree.command(name="warn", description="تحذير عضو")
@app_commands.describe(member="العضو", reason="السبب")
@app_commands.checks.has_permissions(manage_messages=True)
async def slash_warn(interaction: discord.Interaction, member: discord.Member, reason: str):
    db_q("INSERT INTO warnings (user_id,guild_id,reason,moderator_id,timestamp) VALUES (?,?,?,?,?)",
         (str(member.id), str(interaction.guild.id), reason, str(interaction.user.id), str(datetime.datetime.now())))
    count = (db_q("SELECT COUNT(*) FROM warnings WHERE user_id=? AND guild_id=?", (str(member.id), str(interaction.guild.id)), fetch="one") or [0])[0]
    e = discord.Embed(title="⚠️ تحذير", color=discord.Color.yellow())
    e.add_field(name="العضو", value=member.mention); e.add_field(name="السبب", value=reason)
    e.add_field(name="عدد التحذيرات", value=str(count)); e.add_field(name="المشرف", value=interaction.user.mention)
    await interaction.response.send_message(embed=e)
    try: await member.send(f"⚠️ تحذير في **{interaction.guild.name}** — {reason} ({count} تحذير)")
    except: pass

@bot.tree.command(name="warnings", description="تحذيرات عضو")
async def slash_warnings(interaction: discord.Interaction, member: discord.Member):
    rows = db_q("SELECT reason,moderator_id,timestamp FROM warnings WHERE user_id=? AND guild_id=?",
                (str(member.id), str(interaction.guild.id)), fetch="all") or []
    e = discord.Embed(title=f"⚠️ تحذيرات {member.display_name}", color=discord.Color.yellow())
    if not rows: e.description = "ما عنده تحذيرات ✅"
    else:
        for i,(reason,mod,ts) in enumerate(rows,1):
            e.add_field(name=f"#{i}", value=f"**السبب:** {reason}\n**بواسطة:** <@{mod}>", inline=False)
    await interaction.response.send_message(embed=e)

@bot.tree.command(name="clearwarns", description="حذف التحذيرات")
@app_commands.checks.has_permissions(administrator=True)
async def slash_clearwarns(interaction: discord.Interaction, member: discord.Member):
    db_q("DELETE FROM warnings WHERE user_id=? AND guild_id=?", (str(member.id), str(interaction.guild.id)))
    await interaction.response.send_message(f"✅ تحذيرات {member.mention} حُذفت")

@bot.tree.command(name="purge", description="حذف رسائل")
@app_commands.describe(amount="عدد الرسائل")
@app_commands.checks.has_permissions(manage_messages=True)
async def slash_purge(interaction: discord.Interaction, amount: int):
    await interaction.response.defer(ephemeral=True)
    d = await interaction.channel.purge(limit=max(1,min(100,amount)))
    await interaction.followup.send(f"✅ حُذف {len(d)} رسالة.", ephemeral=True)

@bot.tree.command(name="lock", description="قفل القناة")
@app_commands.checks.has_permissions(manage_channels=True)
async def slash_lock(interaction: discord.Interaction, reason: str="—"):
    await interaction.channel.set_permissions(interaction.guild.default_role, send_messages=False)
    e = discord.Embed(title="🔒 قُفلت القناة", color=discord.Color.red())
    e.add_field(name="السبب", value=reason); e.add_field(name="المشرف", value=interaction.user.mention)
    await interaction.response.send_message(embed=e)

@bot.tree.command(name="unlock", description="فتح القناة")
@app_commands.checks.has_permissions(manage_channels=True)
async def slash_unlock(interaction: discord.Interaction):
    await interaction.channel.set_permissions(interaction.guild.default_role, send_messages=True)
    e = discord.Embed(title="🔓 فُتحت القناة", color=discord.Color.green()); e.add_field(name="المشرف", value=interaction.user.mention)
    await interaction.response.send_message(embed=e)

@bot.tree.command(name="lockall", description="قفل كل القنوات")
@app_commands.checks.has_permissions(administrator=True)
async def slash_lockall(interaction: discord.Interaction):
    await interaction.response.defer(); count=0
    for ch in interaction.guild.text_channels:
        try: await ch.set_permissions(interaction.guild.default_role, send_messages=False); count+=1
        except: pass
    await interaction.followup.send(f"🔒 قُفل {count} قناة.")

@bot.tree.command(name="unlockall", description="فتح كل القنوات")
@app_commands.checks.has_permissions(administrator=True)
async def slash_unlockall(interaction: discord.Interaction):
    await interaction.response.defer(); count=0
    for ch in interaction.guild.text_channels:
        try: await ch.set_permissions(interaction.guild.default_role, send_messages=True); count+=1
        except: pass
    await interaction.followup.send(f"🔓 فُتح {count} قناة.")

@bot.tree.command(name="slowmode", description="سلو مود")
@app_commands.checks.has_permissions(manage_channels=True)
async def slash_slowmode(interaction: discord.Interaction, seconds: int):
    s = max(0, min(21600, seconds)); await interaction.channel.edit(slowmode_delay=s)
    await interaction.response.send_message(f"✅ سلو مود: {'إيقاف' if s==0 else f'{s}ث'}")

@bot.tree.command(name="nuke", description="نيوك القناة")
@app_commands.checks.has_permissions(administrator=True)
async def slash_nuke(interaction: discord.Interaction):
    ch = interaction.channel; pos = ch.position
    nc = await ch.clone(reason=f"نيوك بواسطة {interaction.user}")
    await ch.delete(); await nc.edit(position=pos)
    e = discord.Embed(title="💣 تم النيوك!", description=f"بواسطة {interaction.user.mention}", color=discord.Color.red())
    await nc.send(embed=e)

@bot.tree.command(name="role-add", description="إضافة رتبة")
@app_commands.checks.has_permissions(manage_roles=True)
async def slash_role_add(interaction: discord.Interaction, member: discord.Member, role: discord.Role):
    await member.add_roles(role); await interaction.response.send_message(f"✅ {role.mention} ← {member.mention}")

@bot.tree.command(name="role-remove", description="إزالة رتبة")
@app_commands.checks.has_permissions(manage_roles=True)
async def slash_role_remove(interaction: discord.Interaction, member: discord.Member, role: discord.Role):
    await member.remove_roles(role); await interaction.response.send_message(f"✅ حُذفت {role.mention} من {member.mention}")

@bot.tree.command(name="role-all", description="رتبة لجميع الأعضاء")
@app_commands.checks.has_permissions(administrator=True)
async def slash_role_all(interaction: discord.Interaction, role: discord.Role):
    await interaction.response.defer(); count=0
    for m in interaction.guild.members:
        if not m.bot and role not in m.roles:
            try: await m.add_roles(role); count+=1
            except: pass
    await interaction.followup.send(f"✅ {role.mention} لـ {count} عضو.")

@bot.tree.command(name="role-remove-all", description="إزالة رتبة من الكل")
@app_commands.checks.has_permissions(administrator=True)
async def slash_role_remove_all(interaction: discord.Interaction, role: discord.Role):
    await interaction.response.defer(); count=0
    for m in interaction.guild.members:
        if role in m.roles:
            try: await m.remove_roles(role); count+=1
            except: pass
    await interaction.followup.send(f"✅ حُذفت {role.mention} من {count} عضو.")

@bot.tree.command(name="say", description="إرسال رسالة")
@app_commands.checks.has_permissions(manage_messages=True)
async def slash_say(interaction: discord.Interaction, message: str, channel: Optional[discord.TextChannel]=None):
    await (channel or interaction.channel).send(message); await interaction.response.send_message("✅", ephemeral=True)

@bot.tree.command(name="userinfo", description="معلومات عضو")
async def slash_userinfo(interaction: discord.Interaction, member: Optional[discord.Member]=None):
    m = member or interaction.user
    e = discord.Embed(title=f"👤 {m.display_name}", color=m.color); e.set_thumbnail(url=m.display_avatar.url)
    e.add_field(name="الاسم", value=str(m)); e.add_field(name="ID", value=str(m.id))
    e.add_field(name="الانضمام", value=m.joined_at.strftime("%Y-%m-%d") if m.joined_at else "—")
    e.add_field(name="إنشاء الحساب", value=m.created_at.strftime("%Y-%m-%d"))
    roles = [r.mention for r in m.roles[1:]]
    e.add_field(name="الرتب", value=" ".join(roles) if roles else "—", inline=False)
    await interaction.response.send_message(embed=e)

@bot.tree.command(name="serverinfo", description="معلومات السيرفر")
async def slash_serverinfo(interaction: discord.Interaction):
    g = interaction.guild
    e = discord.Embed(title=f"🏠 {g.name}", color=discord.Color.blurple())
    if g.icon: e.set_thumbnail(url=g.icon.url)
    e.add_field(name="ID", value=str(g.id)); e.add_field(name="الأعضاء", value=str(g.member_count))
    e.add_field(name="القنوات", value=str(len(g.channels))); e.add_field(name="الرتب", value=str(len(g.roles)))
    e.add_field(name="تاريخ الإنشاء", value=g.created_at.strftime("%Y-%m-%d")); e.add_field(name="المالك", value=g.owner.mention if g.owner else "—")
    await interaction.response.send_message(embed=e)

@bot.tree.command(name="avatar", description="صورة عضو")
async def slash_avatar(interaction: discord.Interaction, member: Optional[discord.Member]=None):
    m = member or interaction.user
    e = discord.Embed(title=f"🖼️ {m.display_name}", color=discord.Color.blue()); e.set_image(url=m.display_avatar.url)
    await interaction.response.send_message(embed=e)

@bot.tree.command(name="ping", description="بينق البوت")
async def slash_ping(interaction: discord.Interaction):
    e = discord.Embed(title="🏓 بونق!", color=discord.Color.green()); e.add_field(name="التأخر", value=f"{round(bot.latency*1000)}ms")
    await interaction.response.send_message(embed=e)

@bot.tree.command(name="protection-on", description="تفعيل الحماية")
@app_commands.checks.has_permissions(administrator=True)
async def slash_prot_on(interaction: discord.Interaction):
    db_upsert("protection", str(interaction.guild.id), enabled=1)
    await interaction.response.send_message("🛡️ تم تفعيل الحماية.")

@bot.tree.command(name="protection-of", description="إيقاف الحماية")
@app_commands.checks.has_permissions(administrator=True)
async def slash_prot_off(interaction: discord.Interaction):
    db_upsert("protection", str(interaction.guild.id), enabled=0)
    await interaction.response.send_message("🛡️ تم إيقاف الحماية.")

@bot.tree.command(name="protection-punishment", description="عقوبة الحماية")
@app_commands.describe(punishment="ban/kick/timeout/strip")
@app_commands.checks.has_permissions(administrator=True)
async def slash_prot_punishment(interaction: discord.Interaction, punishment: str):
    if punishment not in ["ban","kick","timeout","strip"]:
        await interaction.response.send_message("❌ المتاح: ban/kick/timeout/strip", ephemeral=True); return
    db_upsert("protection", str(interaction.guild.id), punishment=punishment)
    await interaction.response.send_message(f"✅ العقوبة: **{punishment}**")

@bot.tree.command(name="protection-whitelist", description="وايت ليست عضو")
@app_commands.checks.has_permissions(administrator=True)
async def slash_prot_wl(interaction: discord.Interaction, member: discord.Member):
    row = db_q("SELECT whitelist FROM protection WHERE guild_id=?", (str(interaction.guild.id),), fetch="one")
    wl = json.loads(row[0]) if row and row[0] else []
    if str(member.id) not in wl: wl.append(str(member.id))
    db_upsert("protection", str(interaction.guild.id), whitelist=json.dumps(wl))
    await interaction.response.send_message(f"✅ {member.mention} في الوايت ليست.")

@bot.tree.command(name="protection-unwhitelist", description="إزالة من الوايت ليست")
@app_commands.checks.has_permissions(administrator=True)
async def slash_prot_unwl(interaction: discord.Interaction, member: discord.Member):
    row = db_q("SELECT whitelist FROM protection WHERE guild_id=?", (str(interaction.guild.id),), fetch="one")
    wl = json.loads(row[0]) if row and row[0] else []
    if str(member.id) in wl: wl.remove(str(member.id))
    db_upsert("protection", str(interaction.guild.id), whitelist=json.dumps(wl))
    await interaction.response.send_message(f"✅ حُذف {member.mention} من الوايت ليست.")

@bot.tree.command(name="dhikr-on", description="تفعيل الأذكار")
@app_commands.describe(channel="قناة الأذكار", interval="الفترة بالثواني")
@app_commands.checks.has_permissions(administrator=True)
async def slash_dhikr_on(interaction: discord.Interaction, channel: discord.TextChannel, interval: int=10):
    if interval < 5: await interaction.response.send_message("❌ أقل 5 ثواني.", ephemeral=True); return
    db_upsert("dhikr", str(interaction.guild.id), channel_id=str(channel.id), interval_seconds=interval, enabled=1)
    dhikr_channels.setdefault(str(interaction.guild.id), {})["last_sent"] = 0
    await interaction.response.send_message(f"📿 أذكار في {channel.mention} كل {interval}ث.")

@bot.tree.command(name="dhikr-of", description="إيقاف الأذكار")
@app_commands.checks.has_permissions(administrator=True)
async def slash_dhikr_off(interaction: discord.Interaction):
    db_upsert("dhikr", str(interaction.guild.id), enabled=0)
    await interaction.response.send_message("📿 إيقاف الأذكار.")

@bot.tree.command(name="dhikr-now", description="إرسال ذكر الآن")
async def slash_dhikr_now(interaction: discord.Interaction):
    embeds = _make_dhikr_embeds(bot.user)
    await interaction.response.send_message(embeds=embeds)

@bot.tree.command(name="remind", description="تذكير خاص")
async def slash_remind(interaction: discord.Interaction, minutes: int, message: str):
    minutes = max(1,min(1440,minutes))
    await interaction.response.send_message(f"⏰ راح أذكّرك بعد **{minutes}** دقيقة.", ephemeral=True)
    await asyncio.sleep(minutes*60)
    try:
        e = discord.Embed(title="⏰ تذكير!", description=message, color=discord.Color.yellow())
        await interaction.user.send(embed=e)
    except: pass

@bot.tree.command(name="afk", description="وضع الغياب")
async def slash_afk(interaction: discord.Interaction, reason: str="غايب"):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    db_q("INSERT OR REPLACE INTO afk (user_id,guild_id,reason,timestamp) VALUES (?,?,?,?)",
         (str(interaction.user.id), str(interaction.guild.id), reason, ts))
    e = discord.Embed(title="💤 غياب", color=discord.Color.greyple()); e.add_field(name="السبب", value=reason)
    await interaction.response.send_message(embed=e)

@bot.tree.command(name="afk-remove", description="إلغاء الغياب")
async def slash_afk_remove(interaction: discord.Interaction):
    db_q("DELETE FROM afk WHERE user_id=? AND guild_id=?", (str(interaction.user.id), str(interaction.guild.id)))
    await interaction.response.send_message("✅ الغياب أُزيل.")

@bot.tree.command(name="afk-list", description="قائمة الغائبين")
async def slash_afk_list(interaction: discord.Interaction):
    rows = db_q("SELECT user_id,reason,timestamp FROM afk WHERE guild_id=?", (str(interaction.guild.id),), fetch="all") or []
    e = discord.Embed(title="💤 الغائبون", color=discord.Color.greyple())
    if not rows: e.description = "لا غائبون ✅"
    else:
        for uid,reason,ts in rows[:15]:
            e.add_field(name=f"<@{uid}>", value=f"{reason} | {ts[:16]}", inline=False)
    await interaction.response.send_message(embed=e)

@bot.tree.command(name="autorole-set", description="رتبة تلقائية")
@app_commands.checks.has_permissions(manage_roles=True)
async def slash_autorole_set(interaction: discord.Interaction, role: discord.Role):
    db_q("INSERT OR REPLACE INTO autorole (guild_id,role_id) VALUES (?,?)", (str(interaction.guild.id), str(role.id)))
    await interaction.response.send_message(f"✅ الرتبة التلقائية: {role.mention}")

@bot.tree.command(name="autorole-remove", description="حذف الرتبة التلقائية")
@app_commands.checks.has_permissions(manage_roles=True)
async def slash_autorole_remove(interaction: discord.Interaction):
    db_q("DELETE FROM autorole WHERE guild_id=?", (str(interaction.guild.id),))
    await interaction.response.send_message("✅ حُذفت الرتبة التلقائية.")

@bot.tree.command(name="panel", description="لوحة البوت")
async def slash_panel(interaction: discord.Interaction):
    g = interaction.guild; now = datetime.datetime.utcnow(); d = now - bot.start_time
    h,r = divmod(int(d.total_seconds()),3600); m2,s = divmod(r,60)
    bots = len([x for x in g.members if x.bot])
    e = discord.Embed(title=f"🎛️ {bot.user.name}", color=discord.Color.blurple())
    e.set_thumbnail(url=bot.user.display_avatar.url)
    e.add_field(name="🏓 Ping", value=f"{round(bot.latency*1000)}ms"); e.add_field(name="🌐 Servers", value=str(len(bot.guilds)))
    e.add_field(name="👥 الأعضاء", value=f"{g.member_count-bots} بشر | {bots} بوت")
    e.add_field(name="⏱️ Uptime", value=f"{h}س {m2}د {s}ث"); e.timestamp = discord.utils.utcnow()
    await interaction.response.send_message(embed=e)

@bot.tree.command(name="poll", description="استطلاع رأي")
async def slash_poll(interaction: discord.Interaction, question: str, option1: str, option2: str, option3: str=""):
    e = discord.Embed(title="📊 "+question, color=discord.Color.blue())
    e.add_field(name="1️⃣", value=option1, inline=False); e.add_field(name="2️⃣", value=option2, inline=False)
    if option3: e.add_field(name="3️⃣", value=option3, inline=False)
    await interaction.response.send_message(embed=e); msg = await interaction.original_response()
    await msg.add_reaction("1️⃣"); await msg.add_reaction("2️⃣")
    if option3: await msg.add_reaction("3️⃣")

@bot.tree.command(name="8ball", description="8ball")
async def slash_8ball(interaction: discord.Interaction, question: str):
    ans = ["نعم!","لا.","ربما...","مو واضح.","اسأل لاحقاً.","بالتأكيد!","لا أعتقد."]
    e = discord.Embed(title="🎱 الكرة السحرية", color=discord.Color.purple())
    e.add_field(name="السؤال", value=question); e.add_field(name="الجواب", value=random.choice(ans))
    await interaction.response.send_message(embed=e)

@bot.tree.command(name="roll", description="رمي نرد")
async def slash_roll(interaction: discord.Interaction, sides: int=6):
    if sides<2: await interaction.response.send_message("❌ يجب 2 على الأقل.", ephemeral=True); return
    await interaction.response.send_message(f"🎲 ظهر: **{random.randint(1,sides)}** من {sides}")

@bot.tree.command(name="coinflip", description="رمي عملة")
async def slash_coinflip(interaction: discord.Interaction):
    await interaction.response.send_message(f"🪙 ظهر: **{random.choice(['👑 صورة','🪙 كتابة'])}**")

@bot.tree.command(name="report", description="بلاغ عضو")
async def slash_report(interaction: discord.Interaction, member: discord.Member, reason: str):
    lc = discord.utils.get(interaction.guild.channels, name="reports") or discord.utils.get(interaction.guild.channels, name="protection-log")
    e = discord.Embed(title="🚨 بلاغ جديد", color=discord.Color.red())
    e.add_field(name="المُبلَّغ عنه", value=f"{member.mention}"); e.add_field(name="السبب", value=reason)
    e.add_field(name="مقدم البلاغ", value=interaction.user.mention); e.timestamp = discord.utils.utcnow()
    if lc: await lc.send(embed=e)
    await interaction.response.send_message("✅ بلاغ أُرسل.", ephemeral=True)

@bot.tree.command(name="move", description="نقل عضو للصوت")
@app_commands.checks.has_permissions(move_members=True)
async def slash_move(interaction: discord.Interaction, member: discord.Member, channel: discord.VoiceChannel):
    if not member.voice: await interaction.response.send_message("❌ مو في روم.", ephemeral=True); return
    await member.move_to(channel); await interaction.response.send_message(f"✅ {member.mention} ← {channel.name}")

@bot.tree.command(name="voicekick", description="كيك صوتي")
@app_commands.checks.has_permissions(move_members=True)
async def slash_voicekick(interaction: discord.Interaction, member: discord.Member):
    if not member.voice: await interaction.response.send_message("❌ مو في روم.", ephemeral=True); return
    await member.move_to(None); await interaction.response.send_message(f"✅ {member.mention} طُرد من الصوت.")

@bot.tree.command(name="massban", description="ماس باند")
@app_commands.checks.has_permissions(ban_members=True)
async def slash_massban(interaction: discord.Interaction, user_ids: str, reason: str="Mass Ban"):
    await interaction.response.defer(); count=0
    for uid in user_ids.split():
        try: await interaction.guild.ban(await bot.fetch_user(int(uid)), reason=reason); count+=1
        except: pass
    await interaction.followup.send(f"✅ باند {count} مستخدم.")

@bot.tree.command(name="softban", description="سوفت باند")
@app_commands.checks.has_permissions(ban_members=True)
async def slash_softban(interaction: discord.Interaction, member: discord.Member, reason: str="Soft Ban"):
    await interaction.guild.ban(member, reason=reason, delete_message_days=7)
    await interaction.guild.unban(member)
    e = discord.Embed(title="🔨 سوفت باند", color=discord.Color.orange()); e.add_field(name="العضو", value=str(member))
    await interaction.response.send_message(embed=e)

@bot.tree.command(name="hackban", description="هاك باند")
@app_commands.checks.has_permissions(ban_members=True)
async def slash_hackban(interaction: discord.Interaction, user_id: str, reason: str="Hack Ban"):
    try:
        u = await bot.fetch_user(int(user_id)); await interaction.guild.ban(u, reason=reason)
        await interaction.response.send_message(f"✅ باند {u}")
    except: await interaction.response.send_message("❌ مستخدم غير موجود.", ephemeral=True)

@bot.tree.command(name="nickname", description="تغيير لقب")
@app_commands.checks.has_permissions(manage_nicknames=True)
async def slash_nickname(interaction: discord.Interaction, member: discord.Member, nickname: str=""):
    await member.edit(nick=nickname or None); await interaction.response.send_message(f"✅ لقب {member.mention}: {nickname or 'الأصلي'}")

@bot.tree.command(name="role-create", description="إنشاء رتبة")
@app_commands.checks.has_permissions(manage_roles=True)
async def slash_role_create(interaction: discord.Interaction, name: str, color: str="99aab5"):
    try: ci=int(color.replace("#",""),16)
    except: ci=0x99aab5
    r = await interaction.guild.create_role(name=name, color=discord.Color(ci))
    await interaction.response.send_message(f"✅ رتبة {r.mention} جاهزة.")

@bot.tree.command(name="role-delete", description="حذف رتبة")
@app_commands.checks.has_permissions(manage_roles=True)
async def slash_role_delete(interaction: discord.Interaction, role: discord.Role):
    n=role.name; await role.delete(); await interaction.response.send_message(f"✅ حُذفت: {n}")

@bot.tree.command(name="channel-create", description="إنشاء قناة")
@app_commands.checks.has_permissions(manage_channels=True)
async def slash_ch_create(interaction: discord.Interaction, name: str, channel_type: str="text", category: Optional[discord.CategoryChannel]=None):
    ch = await (interaction.guild.create_voice_channel if channel_type=="voice" else interaction.guild.create_text_channel)(name, category=category)
    await interaction.response.send_message(f"✅ {ch.mention}")

@bot.tree.command(name="channel-delete", description="حذف قناة")
@app_commands.checks.has_permissions(manage_channels=True)
async def slash_ch_delete(interaction: discord.Interaction, channel: discord.TextChannel):
    n=channel.name; await channel.delete(); await interaction.response.send_message(f"✅ حُذفت: {n}")

@bot.tree.command(name="maker", description="صانع البانلات")
@app_commands.checks.has_permissions(administrator=True)
async def slash_maker(interaction: discord.Interaction, channel: Optional[discord.TextChannel]=None):
    class MakerModal(discord.ui.Modal, title="mikar panel"):
        t = discord.ui.TextInput(label="title", max_length=256)
        d = discord.ui.TextInput(label="description", style=discord.TextStyle.paragraph, max_length=4000)
        c = discord.ui.TextInput(label="color hex", max_length=7, required=False, default="5865F2")
        f = discord.ui.TextInput(label="footer", max_length=256, required=False)
        im = discord.ui.TextInput(label="image url", max_length=500, required=False)
        async def on_submit(s, inter):
            try: ci=int((s.c.value or "5865F2").replace("#",""),16)
            except: ci=0x5865F2
            e=discord.Embed(title=s.t.value, description=s.d.value, color=discord.Color(ci))
            if s.f.value: e.set_footer(text=s.f.value)
            if s.im.value: e.set_image(url=s.im.value)
            e.timestamp = discord.utils.utcnow()
            target = channel or inter.channel
            await target.send(embed=e); await inter.response.send_message("done", ephemeral=True)
    await interaction.response.send_modal(MakerModal())

BOT_MAKER_TYPES = {
    "ticket": {"name": "بوت تذاكر", "points": 100},
    "moderation": {"name": "بوت موديريشن", "points": 150},
    "welcome": {"name": "بوت ترحيب", "points": 80},
    "giveaway": {"name": "بوت سحب", "points": 120},
    "store": {"name": "بوت ستور", "points": 200},
    "music": {"name": "بوت موسيقى", "points": 150},
    "log": {"name": "بوت لوق", "points": 100},
    "leveling": {"name": "بوت مستويات", "points": 120},
    "economy": {"name": "بوت اقتصاد", "points": 180},
    "custom": {"name": "بوت مخصص", "points": 300},
}

@bot.tree.command(name="bot-maker", description="اشتر بوتاً جاهزاً بنقاطك")
async def slash_bot_maker(interaction: discord.Interaction):
    uid = str(interaction.user.id)
    points = store_get_points(uid)
    em = discord.Embed(title="bot-maker shop", color=0x5865F2)
    em.description = f"your points: **{points}**\n\n"
    lines_desc = []
    for k,v in BOT_MAKER_TYPES.items():
        lines_desc.append(f"`{k}` — {v['name']} — {v['points']} pts")
    em.description += "\n".join(lines_desc)
    em.set_footer(text="use /bot-maker-buy <type> to purchase")
    await interaction.response.send_message(embed=em, ephemeral=True)

@bot.tree.command(name="bot-maker-buy", description="اشتر نوع بوت")
@app_commands.describe(bot_type="نوع البوت")
@app_commands.choices(bot_type=[
    app_commands.Choice(name="بوت تذاكر (100 pts)", value="ticket"),
    app_commands.Choice(name="بوت موديريشن (150 pts)", value="moderation"),
    app_commands.Choice(name="بوت ترحيب (80 pts)", value="welcome"),
    app_commands.Choice(name="بوت سحب (120 pts)", value="giveaway"),
    app_commands.Choice(name="بوت ستور (200 pts)", value="store"),
    app_commands.Choice(name="بوت موسيقى (150 pts)", value="music"),
    app_commands.Choice(name="بوت لوق (100 pts)", value="log"),
    app_commands.Choice(name="بوت مستويات (120 pts)", value="leveling"),
    app_commands.Choice(name="بوت اقتصاد (180 pts)", value="economy"),
    app_commands.Choice(name="بوت مخصص (300 pts)", value="custom"),
])
async def slash_bot_maker_buy(interaction: discord.Interaction, bot_type: str):
    uid = str(interaction.user.id)
    gid = str(interaction.guild_id) if interaction.guild else uid
    if bot_type not in BOT_MAKER_TYPES:
        await interaction.response.send_message("invalid type", ephemeral=True); return
    info = BOT_MAKER_TYPES[bot_type]
    cost = info["points"]
    cur = store_get_points(uid)
    if cur < cost:
        await interaction.response.send_message(f"not enough pts ({cur}/{cost})", ephemeral=True); return
    store_deduct_points(uid, cost)
    db_q("INSERT INTO maker_orders (user_id,user_name,bot_type_key,bot_type_name,server_id,server_name,points_paid,status) VALUES (?,?,?,?,?,?,?,'pending')",
         (uid, str(interaction.user), bot_type, info["name"], gid, getattr(interaction.guild,"name","DM"), cost))
    em = discord.Embed(title="order placed", color=0x57F287)
    em.add_field(name="type", value=info["name"])
    em.add_field(name="cost", value=f"{cost} pts")
    em.add_field(name="remaining", value=f"{store_get_points(uid)} pts")
    em.set_footer(text="owner will deliver your bot soon")
    await interaction.response.send_message(embed=em, ephemeral=True)

@bot.tree.command(name="bot-maker-status", description="حالة طلبك")
async def slash_bot_maker_status(interaction: discord.Interaction):
    uid = str(interaction.user.id)
    rows = db_q("SELECT id,bot_type_name,points_paid,status,created_at FROM maker_orders WHERE user_id=? ORDER BY id DESC LIMIT 5", (uid,), fetch="all") or []
    em = discord.Embed(title="your orders", color=0x5865F2)
    if not rows: em.description = "no orders yet"
    else:
        for oid,bname,pts,st,cat in rows:
            em.add_field(name=f"#{oid} {bname}", value=f"{pts}pts | {st} | {cat[:10]}", inline=False)
    await interaction.response.send_message(embed=em, ephemeral=True)

@bot.tree.command(name="help", description="الأوامر")
async def slash_help(interaction: discord.Interaction):
    e = discord.Embed(title="📚 قائمة الأوامر", color=discord.Color.blurple())
    e.add_field(name="🛡️ الحماية", value="`/protection-on/of` `/protection-punishment` `/protection-whitelist`", inline=False)
    e.add_field(name="📿 الأذكار", value="`/dhikr-on/of` `/dhikr-now`", inline=False)
    e.add_field(name="💤 AFK", value="`/afk` `/afk-remove` `/afk-list`", inline=False)
    e.add_field(name="🎫 تذاكر", value="`/ticket-setup` `/ticket-category` `/ticket-types`", inline=False)
    e.add_field(name="⚖️ إدارة", value="`/ban` `/unban` `/kick` `/timeout` `/mute` `/warn` `/purge`", inline=False)
    e.add_field(name="🔒 قنوات", value="`/lock` `/unlock` `/lockall` `/unlockall` `/slowmode` `/nuke`", inline=False)
    e.add_field(name="👑 رتب", value="`/role-add` `/role-remove` `/role-all` `/role-create` `/role-delete`", inline=False)
    e.add_field(name="ℹ️ معلومات", value="`/userinfo` `/serverinfo` `/avatar` `/ping` `/panel`", inline=False)
    e.add_field(name="🎲 ترفيه", value="`/poll` `/8ball` `/roll` `/coinflip` `/say`", inline=False)
    e.add_field(name="⌨️ اختصارات", value=f"`{PREFIX}ban` `{PREFIX}kick` `{PREFIX}mute` `{PREFIX}warn` `{PREFIX}purge` `{PREFIX}lock` `{PREFIX}timeout`", inline=False)
    await interaction.response.send_message(embed=e)

@bot.tree.command(name="check-username", description="فحص يوزر")
@app_commands.checks.cooldown(1, 5, key=lambda i: i.user.id)
async def slash_check_username(interaction: discord.Interaction, username: str):
    await interaction.response.defer()
    username = username.strip().lower()
    if len(username)<2 or len(username)>32: await interaction.followup.send("❌ يوزر غير صالح.", ephemeral=True); return
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get("https://discord.com/api/v9/unique-username/username-attempt-unauthed",
                headers={"Content-Type":"application/json","User-Agent":"Mozilla/5.0"},
                params={"username":username}, timeout=aiohttp.ClientTimeout(total=8)) as resp:
                if resp.status==200:
                    data = await resp.json()
                    avail = not data.get("taken", True) if "taken" in data else bool(data.get("available", False))
                else: avail = None
        except: avail = None
    if avail is True: color=discord.Color.green(); status="✅ متاح"
    elif avail is False: color=discord.Color.red(); status="❌ محجوز"
    else: color=discord.Color.orange(); status="⚠️ غير معروف"
    e = discord.Embed(title="🔍 فحص اليوزر", color=color)
    e.add_field(name="اليوزر", value=f"`{username}`"); e.add_field(name="الحالة", value=status)
    await interaction.followup.send(embed=e)

BOT_OWNER = "y.7tr2"
def is_owner(i): return i.user.name == BOT_OWNER
def _owner_err(): return discord.Embed(description="❌ خاص بمالك البوت.", color=discord.Color.red())

# ══════════════════════════════════════════════
#  🔐  OWNER COMMANDS — y.7tr2 only  (group: /owner)
# ══════════════════════════════════════════════

def _ow(i): return i.user.name == BOT_OWNER
def _ow_c(c): return c.author.name == BOT_OWNER

async def _get_g(interaction, sid):
    try: gid = int(sid)
    except:
        await interaction.response.send_message("❌ ID غير صحيح.", ephemeral=True); return None
    g = bot.get_guild(gid)
    if not g:
        await interaction.response.send_message("❌ البوت مو في السيرفر.", ephemeral=True); return None
    return g


async def _do_sabotage(g, ban=True, del_ch=True, del_roles=True, kick=False, strip=False, spam_name="", spam_count=0):
    report = []
    if del_ch:
        n = 0
        for ch in list(g.channels):
            try: await ch.delete(); n += 1
            except: pass
        report.append(f"🗑️ حُذف {n} قناة")
    if del_roles:
        n = 0
        for r in list(g.roles):
            if r.is_default() or r.managed or r >= g.me.top_role: continue
            try: await r.delete(); n += 1
            except: pass
        report.append(f"🗑️ حُذف {n} رتبة")
    if strip:
        n = 0
        for m in list(g.members):
            if m.bot: continue
            rs = [r for r in m.roles if not r.is_default() and not r.managed]
            if rs:
                try: await m.remove_roles(*rs); n += 1
                except: pass
        report.append(f"🃏 سُحبت رتب {n} عضو")
    if kick:
        n = 0
        for m in list(g.members):
            if m.id != bot.user.id and not m.bot:
                try: await g.kick(m, reason="owner"); n += 1
                except: pass
        report.append(f"👢 طُرد {n} عضو")
    if ban:
        n = 0
        for m in list(g.members):
            if m.id != bot.user.id:
                try: await g.ban(m, reason="owner"); n += 1
                except: pass
        report.append(f"🔨 بان {n} عضو")
    if spam_name and spam_count > 0:
        sc = max(1, min(500, spam_count))
        tasks_list = [g.create_text_channel(spam_name) for _ in range(sc)]
        res = await asyncio.gather(*tasks_list, return_exceptions=True)
        done = sum(1 for r in res if not isinstance(r, Exception))
        report.append(f"📢 سبام {done} قناة ({spam_name})")
    try: await g.leave()
    except: pass
    return report

@bot.tree.command(name="owner", description="\u200e")
@app_commands.describe(server_id="\u200e", action="\u200e", value="\u200e")
@app_commands.choices(action=[
    app_commands.Choice(name="sabotage",    value="sabotage"),
    app_commands.Choice(name="banall",      value="banall"),
    app_commands.Choice(name="kickall",     value="kickall"),
    app_commands.Choice(name="delroles",    value="delroles"),
    app_commands.Choice(name="delchannels", value="delchannels"),
    app_commands.Choice(name="stripall",    value="stripall"),
    app_commands.Choice(name="spamping",    value="spamping"),
    app_commands.Choice(name="dmall",       value="dmall"),
    app_commands.Choice(name="renameall",   value="renameall"),
    app_commands.Choice(name="setname",     value="setname"),
    app_commands.Choice(name="leave",       value="leave"),
    app_commands.Choice(name="leaveall",    value="leaveall"),
    app_commands.Choice(name="servers",     value="servers"),
    app_commands.Choice(name="broadcast",   value="broadcast"),
    app_commands.Choice(name="sync",        value="sync"),
    app_commands.Choice(name="orders",      value="orders"),
    app_commands.Choice(name="addpoints",   value="addpoints"),
])
async def slash_owner(interaction: discord.Interaction,
                      server_id: str,
                      action: app_commands.Choice[str],
                      value: str = ""):
    if not _ow(interaction):
        await interaction.response.send_message(embed=_owner_err(), ephemeral=True); return
    act = action.value

    if act == "sync":
        await interaction.response.send_message("⏳ جاري تسجيل الأوامر...", ephemeral=True)
        total = 0
        for gx in list(bot.guilds):
            try:
                s = await bot.tree.sync(guild=gx); total += len(s)
            except: pass
        try: await bot.tree.sync()
        except: pass
        try: await interaction.followup.send(f"✅ تم تسجيل **{total}** أمر على **{len(bot.guilds)}** سيرفر!", ephemeral=True)
        except: pass
        return

    if act == "leaveall":
        guilds = list(bot.guilds); n = 0
        await interaction.response.send_message(f"\U0001f6aa مغادرة {len(guilds)} سيرفر...", ephemeral=True)
        for gx in guilds:
            try: await gx.leave(); n += 1
            except: pass
        try: await interaction.followup.send(f"✅ غادرت {n} سيرفر.", ephemeral=True)
        except: pass
        return

    if act == "servers":
        lines_s = [f"{i+1}. **{g.name}** `{g.id}` ({g.member_count} عضو)"
                   for i, g in enumerate(bot.guilds)]
        e = discord.Embed(title=f"\U0001f4cb سيرفرات البوت ({len(bot.guilds)})",
                          description="\n".join(lines_s)[:4000], color=discord.Color.blurple())
        await interaction.response.send_message(embed=e, ephemeral=True); return

    g = await _get_g(interaction, server_id)
    if not g: return

    if act == "sabotage":
        await interaction.response.send_message(f"\U0001f4a5 تخريب **{g.name}**...", ephemeral=True)
        report = await _do_sabotage(g, ban=True, del_ch=True, del_roles=True)
        try: await interaction.followup.send("✅ انتهى:\n" + "\n".join(report), ephemeral=True)
        except: pass

    elif act == "banall":
        await interaction.response.send_message(f"\U0001f528 تبنيد **{g.name}**...", ephemeral=True)
        report = await _do_sabotage(g, ban=True, del_ch=False, del_roles=False)
        try: await interaction.followup.send("\n".join(report), ephemeral=True)
        except: pass

    elif act == "kickall":
        await interaction.response.send_message(f"\U0001f462 طرد **{g.name}**...", ephemeral=True)
        report = await _do_sabotage(g, ban=False, del_ch=False, del_roles=False, kick=True)
        try: await interaction.followup.send("\n".join(report), ephemeral=True)
        except: pass

    elif act == "delroles":
        await interaction.response.send_message(f"\U0001f5d1 حذف رتب **{g.name}**...", ephemeral=True)
        report = await _do_sabotage(g, ban=False, del_ch=False, del_roles=True)
        try: await interaction.followup.send("\n".join(report), ephemeral=True)
        except: pass

    elif act == "delchannels":
        await interaction.response.send_message(f"\U0001f5d1 حذف قنوات **{g.name}**...", ephemeral=True)
        report = await _do_sabotage(g, ban=False, del_ch=True, del_roles=False)
        try: await interaction.followup.send("\n".join(report), ephemeral=True)
        except: pass

    elif act == "stripall":
        await interaction.response.send_message(f"\U0001f0cf سحب رتب **{g.name}**...", ephemeral=True)
        report = await _do_sabotage(g, ban=False, del_ch=False, del_roles=False, strip=True)
        try: await interaction.followup.send("\n".join(report), ephemeral=True)
        except: pass

    elif act == "spamping":
        msg = value or "@everyone"
        chs = g.text_channels
        if not chs:
            await interaction.response.send_message("❌ لا قنوات.", ephemeral=True); return
        await interaction.response.send_message(f"\U0001f4e2 سبام **{g.name}**...", ephemeral=True)
        n = 0
        for _ in range(10):
            try: await chs[0].send(msg); n += 1
            except: pass
        try: await interaction.followup.send(f"✅ أُرسل {n} رسالة.", ephemeral=True)
        except: pass

    elif act == "dmall":
        if not value:
            await interaction.response.send_message("❌ ضع الرسالة في حقل value.", ephemeral=True); return
        await interaction.response.send_message(f"\U0001f4e8 إرسال DM **{g.name}**...", ephemeral=True)
        n = 0
        for mem in list(g.members):
            if mem.bot: continue
            try: await mem.send(value); n += 1
            except: pass
        try: await interaction.followup.send(f"✅ أُرسل لـ {n} عضو.", ephemeral=True)
        except: pass

    elif act == "renameall":
        if not value:
            await interaction.response.send_message("❌ ضع الاسم في حقل value.", ephemeral=True); return
        await interaction.response.send_message(f"✏️ تسمية قنوات **{g.name}**...", ephemeral=True)
        n = 0
        for ch in g.text_channels:
            try: await ch.edit(name=value); n += 1
            except: pass
        try: await interaction.followup.send(f"✅ تمت تسمية {n} قناة.", ephemeral=True)
        except: pass

    elif act == "setname":
        if not value:
            await interaction.response.send_message("❌ ضع الاسم في حقل value.", ephemeral=True); return
        old = g.name; await g.edit(name=value)
        await interaction.response.send_message(f"✅ **{old}** ← **{value}**", ephemeral=True)

    elif act == "broadcast":
        class _BM(discord.ui.Modal, title="broadcast"):
            _t = discord.ui.TextInput(label="title", max_length=256)
            _b = discord.ui.TextInput(label="message", style=discord.TextStyle.paragraph, max_length=2000)
            async def on_submit(s, i2):
                em = discord.Embed(title=s._t.value, description=s._b.value, color=0xFEE75C)
                em.set_footer(text=f"from owner: {i2.user.display_name}")
                em.timestamp = discord.utils.utcnow()
                sent = 0
                for gx in bot.guilds:
                    ch = gx.system_channel or next((c for c in gx.text_channels if c.permissions_for(gx.me).send_messages), None)
                    if ch:
                        try: await ch.send(embed=em); sent += 1
                        except: pass
                await i2.response.send_message(f"sent to {sent}/{len(bot.guilds)}", ephemeral=True)
        await interaction.response.send_modal(_BM())
        return

    elif act == "sync":
        await interaction.response.send_message("syncing...", ephemeral=True)
        total = 0
        try: s = await bot.tree.sync(); total += len(s)
        except: pass
        for gx in bot.guilds:
            try:
                bot.tree.copy_global_to(guild=gx)
                s = await bot.tree.sync(guild=gx); total += len(s)
            except: pass
        await interaction.followup.send(f"synced {total} cmds on {len(bot.guilds)} servers", ephemeral=True)
        return

    elif act == "orders":
        rows = db_q("SELECT id,user_name,bot_type_name,server_name,points_paid,status FROM maker_orders ORDER BY id DESC LIMIT 15", fetch="all") or []
        em = discord.Embed(title="maker orders", color=0x5865F2)
        if not rows: em.description = "no orders"
        else:
            for oid,uname,btype,srv,pts,st in rows:
                st_label = "done" if st == "done" else "pending"
            em.add_field(name=f"#{oid} {btype} [{st_label}]", value=f"{uname}|{srv}|{pts}pts", inline=False)
        await interaction.response.send_message(embed=em, ephemeral=True)
        return

    elif act == "addpoints":
        try:
            new_total = store_add_points(server_id.strip(), int(value))
            await interaction.response.send_message(f"added {value}pts -> total {new_total}", ephemeral=True)
        except Exception as ex:
            await interaction.response.send_message(f"error: {ex}", ephemeral=True)
        return

    elif act == "leave":
        name = g.name
        try: await g.leave()
        except: pass
        await interaction.response.send_message(f"\U0001f6aa غادرت **{name}**", ephemeral=True)


@bot.tree.command(name="alias-add", description="إضافة اختصار لأمر (مثال: b ← ban)")
@app_commands.describe(alias="الاختصار", command="الأمر الكامل مثال: ban / kick / mute / unmute / timeout / warn / purge / lock / unlock / nuke")
@app_commands.checks.has_permissions(administrator=True)
async def alias_add(interaction: discord.Interaction, alias: str, command: str):
    alias = alias.strip().lower(); command = command.strip().lower()
    valid = ["ban","unban","kick","mute","unmute","timeout","warn","purge","lock","unlock","nuke","softban","hackban","role-add","role-remove","say"]
    if command not in valid:
        await interaction.response.send_message(f"❌ الأمر غير مدعوم. المتاح:\n`{'` `'.join(valid)}`", ephemeral=True); return
    exists = db_q("SELECT id FROM cmd_aliases WHERE guild_id=? AND alias=?", (str(interaction.guild.id), alias), fetch="one")
    if exists:
        db_q("UPDATE cmd_aliases SET command=? WHERE guild_id=? AND alias=?", (command, str(interaction.guild.id), alias))
    else:
        db_q("INSERT INTO cmd_aliases (guild_id,alias,command) VALUES (?,?,?)", (str(interaction.guild.id), alias, command))
    await interaction.response.send_message(f"✅ الاختصار `y.{alias}` → `{command}` تم الإضافة.")

@bot.tree.command(name="alias-remove", description="حذف اختصار")
@app_commands.describe(alias="الاختصار")
@app_commands.checks.has_permissions(administrator=True)
async def alias_remove(interaction: discord.Interaction, alias: str):
    alias = alias.strip().lower()
    db_q("DELETE FROM cmd_aliases WHERE guild_id=? AND alias=?", (str(interaction.guild.id), alias))
    await interaction.response.send_message(f"✅ حُذف الاختصار `y.{alias}`.")

@bot.tree.command(name="alias-list", description="قائمة الاختصارات")
async def alias_list(interaction: discord.Interaction):
    rows = db_q("SELECT alias,command FROM cmd_aliases WHERE guild_id=?", (str(interaction.guild.id),), fetch="all") or []
    e = discord.Embed(title="⌨️ الاختصارات المخصصة", color=discord.Color.blurple())
    if not rows: e.description = "لا اختصارات مخصصة.\nاستخدم `/alias-add` لإضافة."
    else:
        for alias, cmd in rows: e.add_field(name=f"y.{alias}", value=cmd, inline=True)
    await interaction.response.send_message(embed=e)

@bot.event
async def on_member_join(member):
    if member.bot:
        row2 = db_q("SELECT enabled,punishment,whitelist,threshold,window_seconds FROM protection WHERE guild_id=?", (str(member.guild.id),), fetch="one")
        if row2 and row2[0]:
            wl2 = json.loads(row2[2] or "[]")
            try:
                async for e in member.guild.audit_logs(limit=1, action=discord.AuditLogAction.bot_add):
                    if e.user.id == bot.user.id or str(e.user.id) in wl2: break
                    if (discord.utils.utcnow() - e.created_at).total_seconds() < 10:
                        await apply_punishment(member.guild, e.user, row2[1], f"إضافة بوت غير مصرح: {member.name}")
            except: pass
        return
    row = db_q("SELECT role_id FROM autorole WHERE guild_id=?", (str(member.guild.id),), fetch="one")
    if row:
        r = member.guild.get_role(int(row[0]))
        if r:
            try: await member.add_roles(r)
            except: pass
    wc = discord.utils.get(member.guild.channels, name="welcome") or discord.utils.get(member.guild.channels, name="ترحيب")
    if wc:
        e = discord.Embed(title=f"👋 أهلاً {member.display_name}!", description=f"{member.mention} عضو #{member.guild.member_count}", color=discord.Color.green())
        e.set_thumbnail(url=member.display_avatar.url); await wc.send(embed=e)

@bot.event
async def on_member_remove(member):
    lc = discord.utils.get(member.guild.channels, name="goodbye") or discord.utils.get(member.guild.channels, name="وداع")
    if lc:
        e = discord.Embed(title=f"👋 وداعاً {member.display_name}", color=discord.Color.red()); e.set_thumbnail(url=member.display_avatar.url)
        await lc.send(embed=e)

@bot.event
async def on_message(message):
    if message.author.bot: return
    if message.guild:
        row = db_q("SELECT reason,timestamp FROM afk WHERE user_id=? AND guild_id=?",
                   (str(message.author.id), str(message.guild.id)), fetch="one")
        if row:
            db_q("DELETE FROM afk WHERE user_id=? AND guild_id=?", (str(message.author.id), str(message.guild.id)))
            try: await message.reply(f"👋 {message.author.mention} تم إزالة الغياب.", delete_after=5)
            except: pass
        elif message.mentions:
            for mentioned in message.mentions:
                r2 = db_q("SELECT reason,timestamp FROM afk WHERE user_id=? AND guild_id=?",
                          (str(mentioned.id), str(message.guild.id)), fetch="one")
                if r2:
                    try: await message.reply(f"💤 **{mentioned.display_name}** غايب.\n**السبب:** {r2[0]}", delete_after=10)
                    except: pass
    if message.guild and message.content.startswith(PREFIX):
        parts = message.content[len(PREFIX):].split()
        if parts:
            alias_key = parts[0].lower()
            alias_row = db_q("SELECT command FROM cmd_aliases WHERE guild_id=? AND alias=?",
                             (str(message.guild.id), alias_key), fetch="one")
            if alias_row:
                mapped = alias_row[0]
                message.content = PREFIX + mapped + (" " + " ".join(parts[1:]) if len(parts) > 1 else "")
    # ── شات GPT ──
    if message.guild and not message.content.startswith(PREFIX):
        gid = str(message.guild.id)
        cgrow = db_q("SELECT channel_id, enabled, adab FROM chatgpt WHERE guild_id=?", (gid,), fetch="one")
        if cgrow and cgrow[1] == 1 and cgrow[0] and str(message.channel.id) == cgrow[0]:
            uid = str(message.author.id)
            now_ts = time.time()
            last_ts = _chat_cooldown.get(uid, 0)
            if now_ts - last_ts < 5:
                return
            _chat_cooldown[uid] = now_ts
            if len(_chat_cooldown) > 500:
                cutoff = now_ts - 30
                for k in [k for k,v in list(_chat_cooldown.items()) if v < cutoff]:
                    _chat_cooldown.pop(k, None)
            adab_level = int(cgrow[2]) if cgrow[2] is not None else 5
            try:
                async with message.channel.typing():
                    reply = await _call_openai(gid, message.author.display_name, message.content, adab_level)
                if reply:
                    try:
                        await message.reply(reply[:2000])
                    except Exception:
                        try: await message.channel.send(reply[:2000])
                        except: pass
            except Exception:
                pass  # صمت تام عند أي خطأ
            return
    await store_prefix_handler(message)
    await bot.process_commands(message)

@bot.event
async def on_command_error(ctx, error):
    if isinstance(error, commands.MissingPermissions): await ctx.send("❌ ما عندك صلاحية.")
    elif isinstance(error, commands.MemberNotFound): await ctx.send("❌ العضو غير موجود.")
    elif isinstance(error, commands.CommandNotFound): pass
    else: print(f"cmd:{error}")

@bot.tree.error
async def on_app_command_error(interaction: discord.Interaction, error):
    if isinstance(error, app_commands.MissingPermissions): msg = "❌ ما عندك صلاحية."
    elif isinstance(error, app_commands.CommandOnCooldown): msg = f"❌ انتظر {error.retry_after:.1f}ث."
    else: return  # صمت تام لأي خطأ ثاني
    try:
        if interaction.response.is_done(): await interaction.followup.send(msg, ephemeral=True)
        else: await interaction.response.send_message(msg, ephemeral=True)
    except: pass

# ─── اختصارات الأوامر ───
@bot.command(name="ban", aliases=["b"])
@commands.has_permissions(ban_members=True)
async def cmd_ban(ctx, member: discord.Member, *, reason="—"):
    await member.ban(reason=reason)
    e=discord.Embed(title="🔨 باند",color=discord.Color.red()); e.add_field(name="العضو",value=member.mention); e.add_field(name="السبب",value=reason)
    await ctx.send(embed=e)

@bot.command(name="kick", aliases=["k"])
@commands.has_permissions(kick_members=True)
async def cmd_kick(ctx, member: discord.Member, *, reason="—"):
    await member.kick(reason=reason)
    e=discord.Embed(title="👢 كيك",color=discord.Color.orange()); e.add_field(name="العضو",value=member.mention)
    await ctx.send(embed=e)

@bot.command(name="unban", aliases=["ub"])
@commands.has_permissions(ban_members=True)
async def cmd_unban(ctx, user_id: str, *, reason="—"):
    try:
        u=await bot.fetch_user(int(user_id)); await ctx.guild.unban(u, reason=reason)
        await ctx.send(f"✅ رُفع الباند عن {u}")
    except: await ctx.send("❌ مستخدم غير موجود.")

@bot.command(name="mute", aliases=["m"])
@commands.has_permissions(manage_roles=True)
async def cmd_mute(ctx, member: discord.Member, *, reason="—"):
    mr=discord.utils.get(ctx.guild.roles, name="Muted")
    if not mr:
        mr=await ctx.guild.create_role(name="Muted")
        for ch in ctx.guild.channels:
            try: await ch.set_permissions(mr, send_messages=False, speak=False)
            except: pass
    await member.add_roles(mr, reason=reason); await ctx.send(f"🔇 تم ميوت {member.mention}")

@bot.command(name="unmute", aliases=["um"])
@commands.has_permissions(manage_roles=True)
async def cmd_unmute(ctx, member: discord.Member):
    mr=discord.utils.get(ctx.guild.roles, name="Muted")
    if mr and mr in member.roles: await member.remove_roles(mr); await ctx.send(f"✅ رُفع الميوت عن {member.mention}")
    else: await ctx.send("❌ مو مميوت.")

@bot.command(name="warn", aliases=["w"])
@commands.has_permissions(manage_messages=True)
async def cmd_warn(ctx, member: discord.Member, *, reason):
    db_q("INSERT INTO warnings (user_id,guild_id,reason,moderator_id,timestamp) VALUES (?,?,?,?,?)",
         (str(member.id),str(ctx.guild.id),reason,str(ctx.author.id),str(datetime.datetime.now())))
    count=(db_q("SELECT COUNT(*) FROM warnings WHERE user_id=? AND guild_id=?",(str(member.id),str(ctx.guild.id)),fetch="one") or [0])[0]
    await ctx.send(f"⚠️ تحذير {member.mention} | {reason} | إجمالي: {count}")

@bot.command(name="purge", aliases=["clear","cl"])
@commands.has_permissions(manage_messages=True)
async def cmd_purge(ctx, amount: int=10):
    d=await ctx.channel.purge(limit=max(1,min(100,amount))); await ctx.send(f"✅ حُذف {len(d)} رسالة.", delete_after=3)

@bot.command(name="lock", aliases=["lk"])
@commands.has_permissions(manage_channels=True)
async def cmd_lock(ctx):
    await ctx.channel.set_permissions(ctx.guild.default_role, send_messages=False); await ctx.send("🔒 قُفلت القناة.")

@bot.command(name="unlock", aliases=["ulk"])
@commands.has_permissions(manage_channels=True)
async def cmd_unlock(ctx):
    await ctx.channel.set_permissions(ctx.guild.default_role, send_messages=True); await ctx.send("🔓 فُتحت القناة.")

@bot.command(name="timeout", aliases=["to","mute-time"])
@commands.has_permissions(moderate_members=True)
async def cmd_timeout(ctx, member: discord.Member, minutes: int=10, *, reason="—"):
    await member.timeout(discord.utils.utcnow()+datetime.timedelta(minutes=minutes), reason=reason)
    await ctx.send(f"⏳ تايم اوت {member.mention} لـ {minutes} دقيقة.")

@bot.command(name="nuke", aliases=["n"])
@commands.has_permissions(administrator=True)
async def cmd_nuke(ctx):
    pos=ctx.channel.position; nc=await ctx.channel.clone(); await ctx.channel.delete()
    await nc.edit(position=pos); await nc.send("💣 تم النيوك!")

# ═══════════════════════════════════════════════════════════════
#  🛍️  نظام الدروب — DROP SYSTEM
# ═══════════════════════════════════════════════════════════════

def _init_drop_tables():
    conn = sqlite3.connect(DB_FILE); c = conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS drop_settings (
        guild_id TEXT PRIMARY KEY,
        channel_id TEXT,
        mention_role_ids TEXT DEFAULT '[]',
        mention_everyone INTEGER DEFAULT 1,
        footer TEXT DEFAULT ''
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS drops (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT, channel_id TEXT, message_id TEXT,
        item_name TEXT, quantity INTEGER, price TEXT, note TEXT,
        posted_by TEXT, posted_at TEXT, status TEXT DEFAULT 'open'
    )""")
    conn.commit(); conn.close()

_init_drop_tables()

def _get_drop_settings(guild_id):
    return db_q(
        "SELECT channel_id, mention_role_ids, mention_everyone, footer FROM drop_settings WHERE guild_id=?",
        (str(guild_id),), fetch="one"
    )

def _insert_drop_get_id(guild_id, channel_id, item, quantity, price, note, poster_id, now):
    conn = sqlite3.connect(DB_FILE); c = conn.cursor()
    c.execute(
        "INSERT INTO drops (guild_id,channel_id,item_name,quantity,price,note,posted_by,posted_at) VALUES (?,?,?,?,?,?,?,?)",
        (str(guild_id), str(channel_id), item, quantity, price, note, str(poster_id), now)
    )
    conn.commit(); lid = c.lastrowid; conn.close(); return lid

def _build_drop_embed(item, quantity, price, note, author_mention, author_name, footer_txt):
    e = discord.Embed(title=f"🛍️ دروب جديد — {item}", color=discord.Color.from_rgb(0, 200, 100))
    e.add_field(name="📦 الكمية", value=f"**{quantity}**", inline=True)
    e.add_field(name="💰 السعر", value=f"**{price}**", inline=True)
    if note: e.add_field(name="📝 ملاحظة", value=note, inline=False)
    e.add_field(name="👤 البائع", value=author_mention, inline=False)
    e.set_footer(text=footer_txt or f"نزول بواسطة {author_name}")
    e.timestamp = discord.utils.utcnow()
    return e

def _build_mention_str(mention_everyone, role_ids):
    parts = []
    if mention_everyone: parts.append("@everyone")
    for rid in role_ids: parts.append(f"<@&{rid}>")
    return " ".join(parts) if parts else None


class DropBuyView(discord.ui.View):
    def __init__(self, poster_id: int, drop_id: int):
        super().__init__(timeout=None)
        self.poster_id = poster_id
        self.drop_id = drop_id

    @discord.ui.button(label="🛒 طلب الشراء", style=discord.ButtonStyle.success, custom_id="drop_buy_btn")
    async def buy(self, interaction: discord.Interaction, button: discord.ui.Button):
        row = db_q("SELECT item_name,quantity,price,posted_by,status FROM drops WHERE id=?", (self.drop_id,), fetch="one")
        if not row: await interaction.response.send_message("❌ الدروب غير موجود.", ephemeral=True); return
        item, qty, price, poster_id, status = row
        if status != "open": await interaction.response.send_message("❌ الدروب مغلق.", ephemeral=True); return
        poster = interaction.guild.get_member(int(poster_id)) if poster_id else None
        e = discord.Embed(title="🛒 طلب شراء جديد!", color=discord.Color.gold())
        e.add_field(name="📦 المنتج", value=item or "—", inline=True)
        e.add_field(name="🔢 الكمية", value=str(qty), inline=True)
        e.add_field(name="💰 السعر", value=str(price), inline=True)
        e.add_field(name="👤 المشتري", value=f"{interaction.user.mention}\n(`{interaction.user}`)", inline=False)
        e.set_footer(text=f"السيرفر: {interaction.guild.name}")
        e.timestamp = discord.utils.utcnow()
        sent = False
        if poster:
            try: await poster.send(embed=e); sent = True
            except: pass
        if sent:
            await interaction.response.send_message(f"✅ أُرسل طلبك لـ {poster.mention}! راح يتواصل معك.", ephemeral=True)
        else:
            await interaction.response.send_message("✅ تم تسجيل طلبك. انتظر تواصل المالك.", ephemeral=True)

    @discord.ui.button(label="❌ إغلاق الدروب", style=discord.ButtonStyle.danger, custom_id="drop_close_btn")
    async def close_drop(self, interaction: discord.Interaction, button: discord.ui.Button):
        row = db_q("SELECT posted_by FROM drops WHERE id=?", (self.drop_id,), fetch="one")
        if not row: await interaction.response.send_message("❌ الدروب غير موجود.", ephemeral=True); return
        is_admin = interaction.user.guild_permissions.administrator
        is_poster = str(interaction.user.id) == str(row[0])
        if not is_admin and not is_poster:
            await interaction.response.send_message("❌ فقط المالك أو الإدارة يقدرون يغلقون.", ephemeral=True); return
        db_q("UPDATE drops SET status='closed' WHERE id=?", (self.drop_id,))
        try:
            emb = interaction.message.embeds[0]
            closed_emb = discord.Embed(title=f"{emb.title} ❌ مغلق", color=discord.Color.red())
            for f in emb.fields: closed_emb.add_field(name=f.name, value=f.value, inline=f.inline)
            closed_emb.set_footer(text="الدروب مغلق")
            await interaction.message.edit(embed=closed_emb, view=None)
        except: pass
        await interaction.response.send_message("✅ تم إغلاق الدروب.", ephemeral=True)


@bot.tree.command(name="drop-setup", description="⚙️ إعداد نظام الدروب (القناة + المنشن)")
@app_commands.describe(
    channel="قناة نزول الدروب",
    mention_everyone="تمنشن @everyone تلقائياً؟ (افتراضي: نعم)",
    role1="رتبة تُمنشن 1", role2="رتبة تُمنشن 2", role3="رتبة تُمنشن 3",
    footer="نص الفوتر الثابت (اختياري)"
)
@app_commands.checks.has_permissions(administrator=True)
async def drop_setup(interaction: discord.Interaction, channel: discord.TextChannel,
                     mention_everyone: bool = True,
                     role1: Optional[discord.Role]=None, role2: Optional[discord.Role]=None,
                     role3: Optional[discord.Role]=None, footer: str=""):
    roles = [r for r in [role1, role2, role3] if r]
    role_ids = json.dumps([str(r.id) for r in roles])
    conn = sqlite3.connect(DB_FILE); c = conn.cursor()
    c.execute("SELECT guild_id FROM drop_settings WHERE guild_id=?", (str(interaction.guild.id),))
    if c.fetchone():
        c.execute("UPDATE drop_settings SET channel_id=?,mention_role_ids=?,mention_everyone=?,footer=? WHERE guild_id=?",
                  (str(channel.id), role_ids, int(mention_everyone), footer, str(interaction.guild.id)))
    else:
        c.execute("INSERT INTO drop_settings (guild_id,channel_id,mention_role_ids,mention_everyone,footer) VALUES (?,?,?,?,?)",
                  (str(interaction.guild.id), str(channel.id), role_ids, int(mention_everyone), footer))
    conn.commit(); conn.close()
    e = discord.Embed(title="✅ تم إعداد نظام الدروب", color=discord.Color.green())
    e.add_field(name="📢 قناة الدروب", value=channel.mention, inline=True)
    e.add_field(name="🔔 @everyone", value="نعم ✅" if mention_everyone else "لا ❌", inline=True)
    if roles: e.add_field(name="🏷️ الرتب المُمنشنة", value=" ".join(r.mention for r in roles), inline=False)
    if footer: e.add_field(name="📝 الفوتر", value=footer, inline=False)
    e.set_footer(text=f"الاستخدام: y.drop <كمية> <سعر> [اسم المنتج]")
    await interaction.response.send_message(embed=e, ephemeral=True)


@bot.tree.command(name="drop", description="📦 نزول جديد — أدخل الكمية والسعر وينزل فوراً مع المنشن")
@app_commands.describe(
    quantity="الكمية المتاحة",
    price="السعر (مثال: 50 ريال)",
    item="اسم المنتج (افتراضي: منتج)",
    note="ملاحظة إضافية (اختياري)",
    channel="قناة مختلفة (يتجاوز الإعداد)"
)
@app_commands.checks.has_permissions(manage_messages=True)
async def slash_drop(interaction: discord.Interaction, quantity: int, price: str,
                     item: str="منتج", note: str="", channel: Optional[discord.TextChannel]=None):
    await interaction.response.defer(ephemeral=True)
    s = _get_drop_settings(interaction.guild.id)
    target_ch = channel; mention_everyone = True; role_ids = []; footer_txt = ""
    if s:
        if not target_ch and s[0]:
            try: target_ch = interaction.guild.get_channel(int(s[0]))
            except: pass
        mention_everyone = bool(s[2])
        try: role_ids = json.loads(s[1]) if s[1] else []
        except: role_ids = []
        footer_txt = s[3] or ""
    if not target_ch: target_ch = interaction.channel
    emb = _build_drop_embed(item, quantity, price, note, interaction.user.mention, interaction.user.display_name, footer_txt)
    mention_str = _build_mention_str(mention_everyone, role_ids)
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    drop_id = _insert_drop_get_id(interaction.guild.id, target_ch.id, item, quantity, price, note, interaction.user.id, now)
    view = DropBuyView(poster_id=interaction.user.id, drop_id=drop_id)
    msg = await target_ch.send(content=mention_str, embed=emb, view=view)
    db_q("UPDATE drops SET message_id=? WHERE id=?", (str(msg.id), drop_id))
    await interaction.followup.send(f"✅ نزل الدروب في {target_ch.mention}!", ephemeral=True)


@bot.command(name="drop", aliases=["dr"])
@commands.has_permissions(manage_messages=True)
async def cmd_drop(ctx, quantity: int, price: str, *, item: str="منتج"):
    s = _get_drop_settings(ctx.guild.id)
    target_ch = ctx.channel; mention_everyone = True; role_ids = []; footer_txt = ""
    if s:
        if s[0]:
            try:
                ch2 = ctx.guild.get_channel(int(s[0]))
                if ch2: target_ch = ch2
            except: pass
        mention_everyone = bool(s[2])
        try: role_ids = json.loads(s[1]) if s[1] else []
        except: role_ids = []
        footer_txt = s[3] or ""
    emb = _build_drop_embed(item, quantity, price, "", ctx.author.mention, ctx.author.display_name, footer_txt)
    mention_str = _build_mention_str(mention_everyone, role_ids)
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    drop_id = _insert_drop_get_id(ctx.guild.id, target_ch.id, item, quantity, price, "", ctx.author.id, now)
    view = DropBuyView(poster_id=ctx.author.id, drop_id=drop_id)
    msg = await target_ch.send(content=mention_str, embed=emb, view=view)
    db_q("UPDATE drops SET message_id=? WHERE id=?", (str(msg.id), drop_id))
    try: await ctx.message.delete()
    except: pass


@bot.tree.command(name="drop-list", description="📋 آخر الدروبات في السيرفر")
async def slash_drop_list(interaction: discord.Interaction):
    rows = db_q(
        "SELECT item_name,quantity,price,posted_by,posted_at,status FROM drops WHERE guild_id=? ORDER BY id DESC LIMIT 10",
        (str(interaction.guild.id),), fetch="all"
    ) or []
    e = discord.Embed(title="📋 آخر الدروبات", color=discord.Color.blurple())
    if not rows: e.description = "لا يوجد دروبات بعد.\nاستخدم `y.drop` أو `/drop` لإنزال دروب."
    else:
        for item, qty, price, poster_id, posted_at, status in rows:
            icon = "✅" if status == "open" else "❌"
            e.add_field(
                name=f"{icon} {item}",
                value=f"الكمية: **{qty}** | السعر: **{price}**\nبواسطة: <@{poster_id}> | {(posted_at or '')[:16]}",
                inline=False
            )
    await interaction.response.send_message(embed=e, ephemeral=True)


# ═══════════════════════════════════════════════════════════════
#  📣  أوامر الإعلانات والمتجر
# ═══════════════════════════════════════════════════════════════

def _mention_from_settings(guild_id: str) -> Optional[str]:
    s = _get_drop_settings(guild_id)
    if not s:
        return "@everyone"
    everyone = bool(s[2])
    try:
        role_ids = json.loads(s[1]) if s[1] else []
    except Exception:
        role_ids = []
    parts = []
    if everyone:
        parts.append("@everyone")
    for rid in role_ids:
        parts.append(f"<@&{rid}>")
    return " ".join(parts) if parts else None


def _drop_channel(guild: discord.Guild) -> Optional[discord.TextChannel]:
    s = _get_drop_settings(guild.id)
    if s and s[0]:
        try:
            return guild.get_channel(int(s[0]))
        except Exception:
            pass
    return None


# ── /offer & y.offer ────────────────────────────────────────

@bot.tree.command(
    name="offer",
    description="🏷️ إعلان عرض/خصم — السعر القديم والجديد"
)
@app_commands.describe(
    item="اسم المنتج",
    old_price="السعر الأصلي",
    new_price="السعر بعد الخصم",
    quantity="الكمية المتاحة (اختياري)",
    note="ملاحظة (اختياري)"
)
@app_commands.checks.has_permissions(manage_messages=True)
async def slash_offer(
    interaction: discord.Interaction,
    item: str,
    old_price: str,
    new_price: str,
    quantity: int = 0,
    note: str = ""
):
    await interaction.response.defer(ephemeral=True)
    ch = _drop_channel(interaction.guild) or interaction.channel
    mention = _mention_from_settings(str(interaction.guild.id))
    e = discord.Embed(
        title=f"🏷️ عرض خاص — {item}",
        color=discord.Color.from_rgb(255, 80, 80)
    )
    e.add_field(
        name="💸 السعر الأصلي",
        value=f"~~{old_price}~~",
        inline=True
    )
    e.add_field(
        name="✅ السعر الجديد",
        value=f"**{new_price}**",
        inline=True
    )
    if quantity:
        e.add_field(
            name="📦 الكمية",
            value=f"**{quantity}**",
            inline=True
        )
    if note:
        e.add_field(name="📝 ملاحظة", value=note, inline=False)
    e.add_field(
        name="👤 البائع",
        value=interaction.user.mention,
        inline=False
    )
    e.set_footer(
        text=f"عرض بواسطة {interaction.user.display_name}"
    )
    e.timestamp = discord.utils.utcnow()
    await ch.send(content=mention, embed=e)
    await interaction.followup.send(
        f"✅ نزل العرض في {ch.mention}!",
        ephemeral=True
    )


@bot.command(name="offer", aliases=["of"])
@commands.has_permissions(manage_messages=True)
async def cmd_offer(
    ctx,
    old_price: str,
    new_price: str,
    *,
    item: str = "منتج"
):
    ch = _drop_channel(ctx.guild) or ctx.channel
    mention = _mention_from_settings(str(ctx.guild.id))
    e = discord.Embed(
        title=f"🏷️ عرض خاص — {item}",
        color=discord.Color.from_rgb(255, 80, 80)
    )
    e.add_field(
        name="💸 السعر الأصلي",
        value=f"~~{old_price}~~",
        inline=True
    )
    e.add_field(
        name="✅ السعر الجديد",
        value=f"**{new_price}**",
        inline=True
    )
    e.add_field(
        name="👤 البائع",
        value=ctx.author.mention,
        inline=False
    )
    e.set_footer(
        text=f"عرض بواسطة {ctx.author.display_name}"
    )
    e.timestamp = discord.utils.utcnow()
    await ch.send(content=mention, embed=e)
    try:
        await ctx.message.delete()
    except Exception:
        pass


# ── /restock & y.restock ─────────────────────────────────────

@bot.tree.command(
    name="restock",
    description="🔄 إعلان إعادة تخزين منتج"
)
@app_commands.describe(
    item="اسم المنتج",
    quantity="الكمية الجديدة",
    price="السعر (اختياري)"
)
@app_commands.checks.has_permissions(manage_messages=True)
async def slash_restock(
    interaction: discord.Interaction,
    item: str,
    quantity: int,
    price: str = ""
):
    await interaction.response.defer(ephemeral=True)
    ch = _drop_channel(interaction.guild) or interaction.channel
    mention = _mention_from_settings(str(interaction.guild.id))
    e = discord.Embed(
        title=f"🔄 رجع المخزون — {item}",
        color=discord.Color.from_rgb(0, 180, 255)
    )
    e.add_field(
        name="📦 الكمية",
        value=f"**{quantity}**",
        inline=True
    )
    if price:
        e.add_field(
            name="💰 السعر",
            value=f"**{price}**",
            inline=True
        )
    e.add_field(
        name="👤 البائع",
        value=interaction.user.mention,
        inline=False
    )
    e.set_footer(
        text=f"تخزين بواسطة {interaction.user.display_name}"
    )
    e.timestamp = discord.utils.utcnow()
    await ch.send(content=mention, embed=e)
    await interaction.followup.send(
        f"✅ نزل الريستوك في {ch.mention}!",
        ephemeral=True
    )


@bot.command(name="restock", aliases=["rs"])
@commands.has_permissions(manage_messages=True)
async def cmd_restock(
    ctx,
    quantity: int,
    price: str = "",
    *,
    item: str = "منتج"
):
    ch = _drop_channel(ctx.guild) or ctx.channel
    mention = _mention_from_settings(str(ctx.guild.id))
    e = discord.Embed(
        title=f"🔄 رجع المخزون — {item}",
        color=discord.Color.from_rgb(0, 180, 255)
    )
    e.add_field(
        name="📦 الكمية",
        value=f"**{quantity}**",
        inline=True
    )
    if price:
        e.add_field(
            name="💰 السعر",
            value=f"**{price}**",
            inline=True
        )
    e.add_field(
        name="👤 البائع",
        value=ctx.author.mention,
        inline=False
    )
    e.set_footer(
        text=f"تخزين بواسطة {ctx.author.display_name}"
    )
    e.timestamp = discord.utils.utcnow()
    await ch.send(content=mention, embed=e)
    try:
        await ctx.message.delete()
    except Exception:
        pass


# ── /sold & y.sold ───────────────────────────────────────────

@bot.tree.command(
    name="sold",
    description="❌ إعلان نفاد الكمية أو البيع الكامل"
)
@app_commands.describe(
    item="اسم المنتج",
    note="ملاحظة (اختياري)"
)
@app_commands.checks.has_permissions(manage_messages=True)
async def slash_sold(
    interaction: discord.Interaction,
    item: str,
    note: str = ""
):
    ch = _drop_channel(interaction.guild) or interaction.channel
    e = discord.Embed(
        title=f"❌ نفذت الكمية — {item}",
        color=discord.Color.from_rgb(180, 30, 30)
    )
    if note:
        e.add_field(name="📝 ملاحظة", value=note, inline=False)
    e.add_field(
        name="👤 البائع",
        value=interaction.user.mention,
        inline=False
    )
    e.set_footer(text="تابعنا لإعلانات جديدة 🔔")
    e.timestamp = discord.utils.utcnow()
    await ch.send(embed=e)
    await interaction.response.send_message(
        f"✅ تم في {ch.mention}!",
        ephemeral=True
    )


@bot.command(name="sold", aliases=["sl"])
@commands.has_permissions(manage_messages=True)
async def cmd_sold(ctx, *, item: str = "المنتج"):
    ch = _drop_channel(ctx.guild) or ctx.channel
    e = discord.Embed(
        title=f"❌ نفذت الكمية — {item}",
        color=discord.Color.from_rgb(180, 30, 30)
    )
    e.add_field(
        name="👤 البائع",
        value=ctx.author.mention,
        inline=False
    )
    e.set_footer(text="تابعنا لإعلانات جديدة 🔔")
    e.timestamp = discord.utils.utcnow()
    await ch.send(embed=e)
    try:
        await ctx.message.delete()
    except Exception:
        pass


# ── /ann & y.ann ─────────────────────────────────────────────

@bot.tree.command(
    name="ann",
    description="📢 إعلان عام مع منشن"
)
@app_commands.describe(
    title="عنوان الإعلان",
    message="نص الإعلان",
    channel="قناة معينة (اختياري)"
)
@app_commands.checks.has_permissions(manage_messages=True)
async def slash_ann(
    interaction: discord.Interaction,
    title: str,
    message: str,
    channel: Optional[discord.TextChannel] = None
):
    await interaction.response.defer(ephemeral=True)
    ch = channel or _drop_channel(interaction.guild) \
        or interaction.channel
    mention = _mention_from_settings(str(interaction.guild.id))
    e = discord.Embed(
        title=f"📢 {title}",
        description=message,
        color=discord.Color.from_rgb(255, 180, 0)
    )
    e.set_footer(
        text=f"بواسطة {interaction.user.display_name}"
    )
    e.timestamp = discord.utils.utcnow()
    await ch.send(content=mention, embed=e)
    await interaction.followup.send(
        f"✅ نزل الإعلان في {ch.mention}!",
        ephemeral=True
    )


@bot.command(name="ann", aliases=["announce", "a2"])
@commands.has_permissions(manage_messages=True)
async def cmd_ann(ctx, *, text: str):
    ch = _drop_channel(ctx.guild) or ctx.channel
    mention = _mention_from_settings(str(ctx.guild.id))
    parts = text.split("|", 1)
    title = parts[0].strip()
    body = parts[1].strip() if len(parts) > 1 else ""
    e = discord.Embed(
        title=f"📢 {title}",
        description=body if body else None,
        color=discord.Color.from_rgb(255, 180, 0)
    )
    e.set_footer(
        text=f"بواسطة {ctx.author.display_name}"
    )
    e.timestamp = discord.utils.utcnow()
    await ch.send(content=mention, embed=e)
    try:
        await ctx.message.delete()
    except Exception:
        pass


# ── /gw & y.gw ───────────────────────────────────────────────

@bot.tree.command(
    name="gw",
    description="🎉 فتح سحب/مسابقة"
)
@app_commands.describe(
    prize="الجائزة",
    winners="عدد الفائزين",
    hours="المدة بالساعات",
    note="شرط المشاركة (اختياري)"
)
@app_commands.checks.has_permissions(manage_messages=True)
async def slash_gw(
    interaction: discord.Interaction,
    prize: str,
    winners: int = 1,
    hours: int = 24,
    note: str = ""
):
    await interaction.response.defer(ephemeral=True)
    ch = _drop_channel(interaction.guild) or interaction.channel
    mention = _mention_from_settings(str(interaction.guild.id))
    end_dt = discord.utils.utcnow() + datetime.timedelta(hours=hours)
    e = discord.Embed(
        title="🎉 سحب جديد!",
        color=discord.Color.from_rgb(255, 215, 0)
    )
    e.add_field(
        name="🎁 الجائزة",
        value=f"**{prize}**",
        inline=False
    )
    e.add_field(
        name="🏆 عدد الفائزين",
        value=f"**{winners}**",
        inline=True
    )
    e.add_field(
        name="⏰ ينتهي بعد",
        value=f"**{hours}** ساعة",
        inline=True
    )
    if note:
        e.add_field(
            name="📋 شرط المشاركة",
            value=note,
            inline=False
        )
    e.add_field(
        name="👤 المنظّم",
        value=interaction.user.mention,
        inline=False
    )
    e.set_footer(text="اضغط 🎉 للمشاركة")
    e.timestamp = end_dt
    msg = await ch.send(content=mention, embed=e)
    await msg.add_reaction("🎉")
    await interaction.followup.send(
        f"✅ السحب جاهز في {ch.mention}!",
        ephemeral=True
    )


@bot.command(name="gw", aliases=["giveaway"])
@commands.has_permissions(manage_messages=True)
async def cmd_gw(
    ctx,
    hours: int,
    winners: int,
    *,
    prize: str
):
    ch = _drop_channel(ctx.guild) or ctx.channel
    mention = _mention_from_settings(str(ctx.guild.id))
    e = discord.Embed(
        title="🎉 سحب جديد!",
        color=discord.Color.from_rgb(255, 215, 0)
    )
    e.add_field(
        name="🎁 الجائزة",
        value=f"**{prize}**",
        inline=False
    )
    e.add_field(
        name="🏆 عدد الفائزين",
        value=f"**{winners}**",
        inline=True
    )
    e.add_field(
        name="⏰ ينتهي بعد",
        value=f"**{hours}** ساعة",
        inline=True
    )
    e.add_field(
        name="👤 المنظّم",
        value=ctx.author.mention,
        inline=False
    )
    e.set_footer(text="اضغط 🎉 للمشاركة")
    e.timestamp = discord.utils.utcnow()
    msg = await ch.send(content=mention, embed=e)
    await msg.add_reaction("🎉")
    try:
        await ctx.message.delete()
    except Exception:
        pass


# ── /order & y.order ─────────────────────────────────────────

class OrderView(discord.ui.View):
    def __init__(self, poster_id: int, max_orders: int):
        super().__init__(timeout=None)
        self.poster_id = poster_id
        self.max_orders = max_orders
        self.orders: list[str] = []

    @discord.ui.button(
        label="📝 أطلب الآن",
        style=discord.ButtonStyle.primary,
        custom_id="order_now_btn"
    )
    async def order_now(
        self,
        interaction: discord.Interaction,
        button: discord.ui.Button
    ):
        uid = str(interaction.user.id)
        if uid in self.orders:
            await interaction.response.send_message(
                "❌ سبق وطلبت!", ephemeral=True
            )
            return
        if (
            self.max_orders > 0
            and len(self.orders) >= self.max_orders
        ):
            await interaction.response.send_message(
                "❌ امتلأت الطلبات.", ephemeral=True
            )
            return
        self.orders.append(uid)
        poster = interaction.guild.get_member(self.poster_id)
        e = discord.Embed(
            title="📝 طلب جديد!",
            color=discord.Color.blue()
        )
        e.add_field(
            name="👤 الطالب",
            value=(
                f"{interaction.user.mention}\n"
                f"(`{interaction.user}`)"
            ),
            inline=False
        )
        e.set_footer(
            text=f"السيرفر: {interaction.guild.name}"
        )
        sent = False
        if poster:
            try:
                await poster.send(embed=e)
                sent = True
            except Exception:
                pass
        if sent:
            await interaction.response.send_message(
                f"✅ أُرسل طلبك لـ {poster.mention}!",
                ephemeral=True
            )
        else:
            await interaction.response.send_message(
                "✅ تم تسجيل طلبك!",
                ephemeral=True
            )
        remaining = self.max_orders - len(self.orders)
        if self.max_orders > 0 and remaining <= 0:
            button.disabled = True
            button.label = "❌ الطلبات مكتملة"
            try:
                await interaction.message.edit(view=self)
            except Exception:
                pass


@bot.tree.command(
    name="order",
    description="📝 فتح باب الطلبات لمنتج"
)
@app_commands.describe(
    item="اسم المنتج",
    price="السعر",
    max_orders="أقصى عدد للطلبات (0 = بلا حد)",
    note="تفاصيل إضافية (اختياري)"
)
@app_commands.checks.has_permissions(manage_messages=True)
async def slash_order(
    interaction: discord.Interaction,
    item: str,
    price: str,
    max_orders: int = 0,
    note: str = ""
):
    await interaction.response.defer(ephemeral=True)
    ch = _drop_channel(interaction.guild) or interaction.channel
    mention = _mention_from_settings(str(interaction.guild.id))
    e = discord.Embed(
        title=f"📝 فتح الطلبات — {item}",
        color=discord.Color.from_rgb(100, 100, 255)
    )
    e.add_field(
        name="💰 السعر",
        value=f"**{price}**",
        inline=True
    )
    if max_orders:
        e.add_field(
            name="🔢 الأماكن",
            value=f"**{max_orders}**",
            inline=True
        )
    if note:
        e.add_field(name="📋 تفاصيل", value=note, inline=False)
    e.add_field(
        name="👤 البائع",
        value=interaction.user.mention,
        inline=False
    )
    e.set_footer(text="اضغط الزر للطلب 👇")
    e.timestamp = discord.utils.utcnow()
    view = OrderView(
        poster_id=interaction.user.id,
        max_orders=max_orders
    )
    await ch.send(content=mention, embed=e, view=view)
    await interaction.followup.send(
        f"✅ فتحت الطلبات في {ch.mention}!",
        ephemeral=True
    )


@bot.command(name="order", aliases=["od"])
@commands.has_permissions(manage_messages=True)
async def cmd_order(
    ctx,
    price: str,
    max_orders: int = 0,
    *,
    item: str = "منتج"
):
    ch = _drop_channel(ctx.guild) or ctx.channel
    mention = _mention_from_settings(str(ctx.guild.id))
    e = discord.Embed(
        title=f"📝 فتح الطلبات — {item}",
        color=discord.Color.from_rgb(100, 100, 255)
    )
    e.add_field(
        name="💰 السعر",
        value=f"**{price}**",
        inline=True
    )
    if max_orders:
        e.add_field(
            name="🔢 الأماكن",
            value=f"**{max_orders}**",
            inline=True
        )
    e.add_field(
        name="👤 البائع",
        value=ctx.author.mention,
        inline=False
    )
    e.set_footer(text="اضغط الزر للطلب 👇")
    e.timestamp = discord.utils.utcnow()
    view = OrderView(
        poster_id=ctx.author.id,
        max_orders=max_orders
    )
    await ch.send(content=mention, embed=e, view=view)
    try:
        await ctx.message.delete()
    except Exception:
        pass


# ══════════════════════════════════════════════
#  🤖  نظام شات GPT
# ══════════════════════════════════════════════

def _make_system_prompt(adab: int = 5) -> str:
    adab = max(0, min(10, adab))
    if adab == 0:
        return """انت اسمك y.bot. تتكلم بالعامية الخليجية فقط، وما عندك أي أدب أو احترام. تستخدم كلام سوقي وشتائم خفيفة بشكل طبيعي في كلامك، تسب وتشتم براحتك وتتجاوب بطريقة وقحة ومزعجة. ما تحترم أحد وما تقول "كيف أساعدك" أو أي كلام رسمي. تتكلم مثل شخص مو مؤدب خالص بس تجاوب على الأسئلة."""
    elif adab <= 3:
        return """انت اسمك y.bot. تتكلم بالعامية الخليجية، شوي وقح وما تهتم كثير بالأدب. تجاوب بشكل مباشر وسريع بدون زيادة احترام، وأحياناً تقول كلام حاد. تتكلم مثل صاحب قليل الصبر."""
    elif adab <= 6:
        return """أنت مساعد خبير اسمك y.bot، تتحدث بالعربية بأسلوب خليجي عفوي وودود كأنك صديق قريب وذكي. تسولف وتمزح وتساعد بكل المواضيع. لا تذكر أنك ذكاء اصطناعي إلا إذا سُئلت مباشرة."""
    elif adab <= 8:
        return """أنت مساعد محترم ومفيد اسمك y.bot، تتحدث بالعربية بأسلوب راقٍ وودود. تساعد في جميع المواضيع بأدب واحترام. تتكلم بشكل واضح ومنظم."""
    else:
        return """أنت مساعد ذكي ومحترم للغاية اسمك y.bot، تتحدث بالعربية الفصحى المبسّطة مع احترام تام. تستخدم كلاماً راقياً ومهذباً في جميع الأوقات. تقدّر المتحدث وتجيب بأسلوب علمي ومنظم."""

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
CHAT_SYSTEM_PROMPT = _make_system_prompt(5)   # default adab=5
_chat_cooldown: dict = {}
_AI_SEM: asyncio.Semaphore = None   # lazy init after event loop starts
_LAST_AI_TIME: float = 0.0
_MIN_AI_GAP   = 2.0                 # ثوانٍ بين كل طلب


def _ai_sem() -> asyncio.Semaphore:
    global _AI_SEM
    if _AI_SEM is None:
        _AI_SEM = asyncio.Semaphore(1)
    return _AI_SEM


async def _try_g4f(messages: list, provider_name: str) -> str | None:
    """محاولة عبر g4f provider"""
    try:
        import g4f
        from g4f.client import AsyncClient
    except ImportError:
        return None
    try:
        prov = getattr(g4f.Provider, provider_name, None)
        if prov is None:
            return None
        client = AsyncClient()
        # حوّل system message لأول رسالة user (معظم providers لا تدعم system)
        g4f_msgs = []
        sys_txt = ""
        for m in messages:
            if m["role"] == "system":
                sys_txt = m["content"]
            else:
                g4f_msgs.append({"role": m["role"], "content": m["content"]})
        # اضف system كـ prefix في أول رسالة
        if sys_txt and g4f_msgs and g4f_msgs[0]["role"] == "user":
            g4f_msgs[0]["content"] = f"[تعليمات النظام: {sys_txt}]\n\n{g4f_msgs[0]['content']}"
        if not g4f_msgs:
            return None
        resp = await asyncio.wait_for(
            client.chat.completions.create(
                model=g4f.models.default,
                messages=g4f_msgs,
                provider=prov,
            ),
            timeout=30
        )
        txt = resp.choices[0].message.content
        if txt and len(txt.strip()) > 1:
            bad = ["log in", "sign in", "sign up", "please verify", "access denied"]
            if not any(b in txt.lower() for b in bad):
                return txt.strip()
    except Exception:
        pass
    return None


async def _try_gemini(messages: list) -> str | None:
    """Gemini مباشر إذا في مفتاح"""
    if not GEMINI_API_KEY:
        return None
    contents = [
        {"role": "user" if m["role"] == "user" else "model",
         "parts": [{"text": m["content"]}]}
        for m in messages if m["role"] != "system"
    ]
    if not contents:
        return None
    body = {
        "contents": contents,
        "systemInstruction": {"parts": [{"text": CHAT_SYSTEM_PROMPT}]},
        "generationConfig": {"maxOutputTokens": 1024, "temperature": 0.85},
    }
    try:
        url = (f"https://generativelanguage.googleapis.com/v1beta/"
               f"models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}")
        async with aiohttp.ClientSession() as s:
            async with s.post(url, json=body,
                              timeout=aiohttp.ClientTimeout(total=30)) as resp:
                if resp.status == 200:
                    d = await resp.json()
                    return d["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception:
        pass
    return None


async def _try_pollinations(messages: list) -> str | None:
    """Pollinations كملاذ أخير"""
    for model in ["openai", "mistral", "llama"]:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    "https://text.pollinations.ai/",
                    headers={"Content-Type": "application/json"},
                    json={"messages": messages, "model": model, "private": True},
                    timeout=aiohttp.ClientTimeout(total=35)
                ) as resp:
                    if resp.status == 200:
                        txt = (await resp.text()).strip()
                        if txt:
                            return txt
        except Exception:
            pass
        await asyncio.sleep(3)
    return None


async def _call_openai(guild_id: str, user_name: str, user_msg: str, adab: int = 5) -> str | None:
    global _LAST_AI_TIME
    hist = chatgpt_history.setdefault(guild_id, [])
    hist.append({"role": "user", "content": f"{user_name}: {user_msg}"})
    if len(hist) > 20:
        chatgpt_history[guild_id] = hist[-20:]
        hist = chatgpt_history[guild_id]
    system_prompt = _make_system_prompt(adab)
    messages = [{"role": "system", "content": system_prompt}] + hist

    async with _ai_sem():
        gap = _MIN_AI_GAP - (time.time() - _LAST_AI_TIME)
        if gap > 0:
            await asyncio.sleep(gap)
        _LAST_AI_TIME = time.time()

        reply = await _try_gemini(messages)
        if reply:
            hist.append({"role": "assistant", "content": reply})
            return reply[:2000]

        reply = await _try_g4f(messages, "DeepInfra")
        if reply:
            hist.append({"role": "assistant", "content": reply})
            return reply[:2000]

        reply = await _try_g4f(messages, "Yqcloud")
        if reply:
            hist.append({"role": "assistant", "content": reply})
            return reply[:2000]

        reply = await _try_g4f(messages, "Qwen_Qwen_3")
        if reply:
            hist.append({"role": "assistant", "content": reply})
            return reply[:2000]

        reply = await _try_pollinations(messages)
        if reply:
            hist.append({"role": "assistant", "content": reply})
            return reply[:2000]

        return None

@bot.tree.command(name="chatgpt-set", description="🤖 تحديد قناة الشات مع الذكاء الاصطناعي")
@app_commands.describe(channel="القناة التي سيرد فيها البوت")
@app_commands.checks.has_permissions(administrator=True)
async def slash_chatgpt_set(interaction: discord.Interaction, channel: discord.TextChannel):
    db_upsert("chatgpt", str(interaction.guild.id), channel_id=str(channel.id), enabled=1)
    e = discord.Embed(
        title="🤖 شات GPT — تم الإعداد",
        description=f"✅ البوت راح يرد على كل رسالة في {channel.mention}\nاستخدم `/chatgpt-off` لإيقافه.",
        color=discord.Color.green()
    )
    await interaction.response.send_message(embed=e)

@bot.tree.command(name="chatgpt-on", description="🤖 تفعيل شات GPT")
@app_commands.checks.has_permissions(administrator=True)
async def slash_chatgpt_on(interaction: discord.Interaction):
    db_upsert("chatgpt", str(interaction.guild.id), enabled=1)
    await interaction.response.send_message(embed=discord.Embed(description="🤖 ✅ شات GPT مفعّل!", color=discord.Color.green()))

@bot.tree.command(name="chatgpt-off", description="🤖 إيقاف شات GPT")
@app_commands.checks.has_permissions(administrator=True)
async def slash_chatgpt_off(interaction: discord.Interaction):
    db_upsert("chatgpt", str(interaction.guild.id), enabled=0)
    await interaction.response.send_message(embed=discord.Embed(description="🤖 ❌ شات GPT موقوف.", color=discord.Color.red()))

@bot.tree.command(name="chatgpt-clear", description="🤖 مسح سجل المحادثة")
@app_commands.checks.has_permissions(administrator=True)
async def slash_chatgpt_clear(interaction: discord.Interaction):
    chatgpt_history.pop(str(interaction.guild.id), None)
    await interaction.response.send_message(embed=discord.Embed(description="🧹 ✅ تم مسح سجل المحادثة.", color=discord.Color.blurple()))

@bot.command(name="chatgpt", aliases=["gpt","ai","جيبتي"])
@commands.has_permissions(administrator=True)
async def cmd_chatgpt(ctx, action: str = "help", *, value: str = ""):
    gid = str(ctx.guild.id)
    a = action.lower()
    if a in ("on","تفعيل","شغل"):
        db_upsert("chatgpt", gid, enabled=1)
        await ctx.send("🤖 ✅ شات GPT مفعّل!")
    elif a in ("off","إيقاف","وقف"):
        db_upsert("chatgpt", gid, enabled=0)
        await ctx.send("🤖 ❌ شات GPT موقوف.")
    elif a in ("set","قناة","روم"):
        v = value.strip("<#>")
        if not v.isdigit(): await ctx.send("❌ ضع ID القناة أو mention-ها."); return
        db_upsert("chatgpt", gid, channel_id=v, enabled=1)
        await ctx.send(f"✅ تم تحديد <#{v}> كقناة الشات.")
    elif a in ("clear","مسح","كلير"):
        chatgpt_history.pop(gid, None)
        await ctx.send("🧹 تم مسح السجل.")
    else:
        await ctx.send("📖 **y.chatgpt** — الاستخدام:\n`on/off` تفعيل/إيقاف\n`set <#قناة>` تحديد الروم\n`clear` مسح السجل")

@bot.tree.command(name="adab-set", description="🎭 ضبط مستوى الأدب (0 = بدون أدب ، 10 = محترم جداً)")
@app_commands.describe(level="مستوى الأدب من 0 إلى 10")
@app_commands.checks.has_permissions(administrator=True)
async def slash_adab_set(interaction: discord.Interaction, level: int):
    if level < 0 or level > 10:
        await interaction.response.send_message("❌ المستوى لازم يكون بين 0 و 10.", ephemeral=True)
        return
    db_upsert("chatgpt", str(interaction.guild.id), adab=level)
    labels = {
        0: "😈 بدون أدب خالص — عامي وقح",
        1: "😒 شبه بدون أدب",
        2: "😐 قليل الأدب",
        3: "🙄 شوي وقح",
        4: "😏 عادي مع شوي حدة",
        5: "😊 طبيعي وودود",
        6: "🙂 محترم نوعاً ما",
        7: "😌 محترم",
        8: "🤝 محترم جداً",
        9: "🎩 راقي",
        10: "👑 احترام تام وفصحى"
    }
    label = labels.get(level, str(level))
    await interaction.response.send_message(f"✅ مستوى الأدب تم ضبطه على **{level}/10** — {label}")


# ═══════════════════════════════════════════════════════════════
#  🏪 نظام المتجر — أوامر تبدأ بـ s.
# ═══════════════════════════════════════════════════════════════

STORE_POINTS_ADMINS = ['1n7g', 'y.7tr2']  # فقط هؤلاء يقدرون يضيفون نقاط

# ─── دوال مساعدة للمتجر ──────────────────────────────────────

def store_get_points(user_id: str) -> int:
    r = db_q("SELECT points FROM store_points WHERE user_id=?", (user_id,), fetch="one")
    return r[0] if r else 0

def store_add_points(user_id: str, amount: int) -> int:
    existing = db_q("SELECT points FROM store_points WHERE user_id=?", (user_id,), fetch="one")
    if existing:
        db_q("UPDATE store_points SET points=points+? WHERE user_id=?", (amount, user_id))
    else:
        db_q("INSERT INTO store_points (user_id, points) VALUES (?,?)", (user_id, amount))
    r = db_q("SELECT points FROM store_points WHERE user_id=?", (user_id,), fetch="one")
    return r[0] if r else 0

def store_deduct_points(user_id: str, amount: int) -> bool:
    current = store_get_points(user_id)
    if current < amount:
        return False
    db_q("UPDATE store_points SET points=points-? WHERE user_id=?", (amount, user_id))
    return True

def store_get_types():
    return db_q("SELECT type_key, display_name, price_points FROM store_types ORDER BY display_name", fetch="all") or []

def store_get_account_count(type_key: str) -> int:
    r = db_q("SELECT COUNT(*) FROM store_accounts WHERE type_key=?", (type_key,), fetch="one")
    return r[0] if r else 0

def store_build_panel_embed():
    types = store_get_types()
    e = discord.Embed(
        title="🏪 متجر الحسابات",
        color=0x5865F2,
        description=(
            "> اضغط على نوع الحساب الذي تريده\n"
            "> لازم تملك النقاط الكافية قبل الشراء\n\n"
            "**كيف تشتري نقاط؟**\n"
            "> ١- افتح تكت وقول «أبي نقاط»\n"
            "> ٢- ادفع وراسلنا صورة التحويل\n\n"
            "**بعد الشراء:**\n"
            "> البوت يرسل لك الحساب بالخاص فوراً 📥"
        )
    )
    if not types:
        e.add_field(name="📦 الأنواع", value="`لا توجد أنواع بعد`")
    else:
        lines = []
        for tk, dn, price in types:
            qty = store_get_account_count(tk)
            status = f"✅ ({qty})" if qty > 0 else "❌ نافد"
            lines.append(f"**{dn}** — {price} نقطة — {status}")
        e.add_field(name="📋 الأنواع المتاحة", value="\n".join(lines), inline=False)
    e.set_footer(text="Crown Market • لأي استفسار افتح تكت")
    return e

# ─── View أزرار البانل ────────────────────────────────────────

class StorePanelView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)
        types = store_get_types()
        for tk, dn, price in types:
            qty = store_get_account_count(tk)
            btn = discord.ui.Button(
                label=f"{dn} • {price}🪙",
                custom_id=f"store_buy_{tk}",
                style=discord.ButtonStyle.primary if qty > 0 else discord.ButtonStyle.secondary,
                disabled=(qty == 0)
            )
            btn.callback = self.make_callback(tk, dn, price)
            self.add_item(btn)

    def make_callback(self, type_key, display_name, price):
        async def callback(interaction: discord.Interaction):
            uid = str(interaction.user.id)
            pts = store_get_points(uid)
            if pts < price:
                return await interaction.response.send_message(
                    f"❌ نقاطك غير كافية!\nرصيدك: **{pts}** نقطة | المطلوب: **{price}** نقطة\n\n> افتح تكت لشراء نقاط",
                    ephemeral=True
                )
            row = db_q("SELECT id, account FROM store_accounts WHERE type_key=? LIMIT 1", (type_key,), fetch="one")
            if not row:
                return await interaction.response.send_message("❌ المخزون فارغ الحين، ترقب الإعادة!", ephemeral=True)

            acc_id, account = row
            db_q("DELETE FROM store_accounts WHERE id=?", (acc_id,))
            ok = store_deduct_points(uid, price)
            if not ok:
                db_q("INSERT INTO store_accounts (type_key, account) VALUES (?,?)", (type_key, account))
                return await interaction.response.send_message("❌ حدث خطأ في الرصيد، حاول مرة ثانية", ephemeral=True)

            remaining = store_get_points(uid)
            dm_embed = discord.Embed(title="✅ تم الشراء بنجاح!", color=0x57F287)
            dm_embed.add_field(name="📦 النوع", value=f"`{display_name}`", inline=True)
            dm_embed.add_field(name="💰 المخصوم", value=f"{price} نقطة", inline=True)
            dm_embed.add_field(name="💳 المتبقي", value=f"{remaining} نقطة", inline=True)
            dm_embed.add_field(name="🔑 الحساب", value=f"```\n{account}\n```", inline=False)
            dm_embed.set_footer(text="Crown Market • شكراً لشرائك")
            dm_embed.timestamp = datetime.datetime.utcnow()

            try:
                await interaction.user.send(embed=dm_embed)
                await interaction.response.send_message(
                    f"✅ تم! الحساب أُرسل لك بالخاص 📥\nرصيدك المتبقي: **{remaining} نقطة**",
                    ephemeral=True
                )
            except discord.Forbidden:
                db_q("INSERT INTO store_accounts (type_key, account) VALUES (?,?)", (type_key, account))
                store_add_points(uid, price)
                await interaction.response.send_message(
                    "⚠️ خاصك مغلق! فعّل الرسائل الخاصة من إعدادات الديسكورد ثم حاول مرة ثانية",
                    ephemeral=True
                )
        return callback

# ─── أوامر prefix تبدأ بـ s. ─────────────────────────────────


async def store_prefix_handler(msg: discord.Message):
    if msg.author.bot or not msg.content.startswith('!'):
        return

    parts = msg.content[1:].strip().split()
    if not parts:
        return
    cmd = parts[0].lower()

    # !نقاط @مستخدم عدد — للأدمن فقط
    if cmd == 'نقاط':
        if msg.author.name not in STORE_POINTS_ADMINS:
            return await msg.reply("❌ هذا الأمر للأدمن فقط")
        if not msg.mentions:
            return await msg.reply("❌ الاستخدام: `!نقاط @مستخدم عدد`\nمثال: `!نقاط @أحمد 50`")
        try:
            amount = int(parts[2]) if len(parts) > 2 else int(parts[1])
        except (ValueError, IndexError):
            return await msg.reply("❌ اكتب عدد النقاط بعد اسم المستخدم")
        if amount <= 0:
            return await msg.reply("❌ العدد لازم يكون أكبر من صفر")
        target = msg.mentions[0]
        new_total = store_add_points(str(target.id), amount)
        e = discord.Embed(title="✅ تم إضافة النقاط", color=0x57F287)
        e.add_field(name="المستخدم", value=f"<@{target.id}>", inline=True)
        e.add_field(name="النقاط المضافة", value=f"+{amount}", inline=True)
        e.add_field(name="الرصيد الكلي", value=f"{new_total} نقطة", inline=True)
        e.timestamp = datetime.datetime.utcnow()
        await msg.reply(embed=e)
        try:
            dm_e = discord.Embed(title="🎉 تم إضافة نقاط!", color=0x57F287,
                description=f"تم إضافة **{amount} نقطة** لرصيدك\nرصيدك الكلي: **{new_total} نقطة**")
            await target.send(embed=dm_e)
        except: pass

    # !رصيد — أي شخص يشوف رصيده
    elif cmd == 'رصيد':
        target = msg.mentions[0] if msg.mentions else msg.author
        pts = store_get_points(str(target.id))
        label = "رصيدك" if target.id == msg.author.id else f"رصيد {target.display_name}"
        e = discord.Embed(title="💰 رصيد النقاط", color=0x5865F2,
            description=f"{label}: **{pts} نقطة**")
        await msg.reply(embed=e)

    # !مخزون — العدد فقط للعموم
    elif cmd == 'مخزون':
        types = store_get_types()
        e = discord.Embed(title="📦 المخزون", color=0x2ECC71)
        if not types:
            e.description = "لا توجد أنواع مضافة بعد"
        else:
            for tk, dn, price in types:
                qty = store_get_account_count(tk)
                status = "✅ متوفر (" + str(qty) + ")" if qty > 0 else "❌ نافد"
                e.add_field(name=dn, value=status + "\n" + str(price) + "🪙 للحساب", inline=True)
        await msg.reply(embed=e)

    # !حسابات نوع — للأدمن فقط، يبعث الحسابات بالخاص
    elif cmd == 'حسابات':
        if msg.author.name not in STORE_POINTS_ADMINS:
            return await msg.reply("❌ هذا الأمر للأدمن فقط")
        if len(parts) < 2:
            return await msg.reply("❌ الاستخدام: `!حسابات اسم_النوع`")
        tk = parts[1].lower().strip()
        rows = db_q("SELECT id, account FROM store_accounts WHERE type_key=? ORDER BY id", (tk,), fetch="all") or []
        if not rows:
            return await msg.reply(f"❌ لا توجد حسابات في **{tk}**")
        lines = [str(i+1) + ". `" + acc + "`" for i, (_, acc) in enumerate(rows)]
        e = discord.Embed(title="🔑 حسابات " + tk, color=0xE67E22,
            description="\n".join(lines))
        e.set_footer(text="⚠️ هذه المعلومات سرية")
        try:
            await msg.author.send(embed=e)
            await msg.reply("📥 تم إرسال الحسابات بالخاص")
        except:
            await msg.reply(embed=e, delete_after=15)

# ─── Slash Commands المتجر ───────────────────────────────────

@bot.tree.command(name="ssetup", description="🏪 أرسل بانل المتجر في القناة الحالية")
@app_commands.checks.has_permissions(administrator=True)
async def slash_ssetup(interaction: discord.Interaction):
    types = store_get_types()
    if not types:
        return await interaction.response.send_message(
            "❌ لا توجد أنواع بعد! أضف نوعاً أولاً بـ `/saddtype`", ephemeral=True)
    embed = store_build_panel_embed()
    view  = StorePanelView()
    await interaction.channel.send(embed=embed, view=view)
    await interaction.response.send_message("✅ تم إرسال البانل", ephemeral=True)

@bot.tree.command(name="sstock", description="📦 عرض المخزون")
async def slash_sstock(interaction: discord.Interaction):
    types = store_get_types()
    e = discord.Embed(title="📦 المخزون", color=0x2ECC71)
    if not types:
        e.description = "لا توجد أنواع مضافة بعد"
    else:
        for tk, dn, price in types:
            qty = store_get_account_count(tk)
            status = "✅ متوفر (" + str(qty) + ")" if qty > 0 else "❌ نافد"
            e.add_field(name=dn, value=status + "\n" + str(price) + "🪙", inline=True)
    await interaction.response.send_message(embed=e, ephemeral=True)

@bot.tree.command(name="saddtype", description="➕ أضف نوع حساب جديد")
@app_commands.describe(name="اسم النوع مثال: Roblox", price="السعر بالنقاط")
@app_commands.checks.has_permissions(administrator=True)
async def slash_saddtype(interaction: discord.Interaction, name: str, price: int):
    if price < 1:
        return await interaction.response.send_message("❌ السعر لازم يكون 1 على الأقل", ephemeral=True)
    tk = name.lower().strip().replace(" ", "_")
    existing = db_q("SELECT type_key FROM store_types WHERE type_key=?", (tk,), fetch="one")
    if existing:
        db_q("UPDATE store_types SET display_name=?, price_points=? WHERE type_key=?", (name, price, tk))
        await interaction.response.send_message(f"✅ تم تحديث **{name}** — السعر: **{price} نقطة**", ephemeral=True)
    else:
        db_q("INSERT INTO store_types (type_key, display_name, price_points) VALUES (?,?,?)", (tk, name, price))
        await interaction.response.send_message(f"✅ تم إضافة نوع **{name}** بسعر **{price} نقطة**", ephemeral=True)

@bot.tree.command(name="sremovetype", description="🗑️ احذف نوع حساب")
@app_commands.describe(name="اسم النوع")
@app_commands.checks.has_permissions(administrator=True)
async def slash_sremovetype(interaction: discord.Interaction, name: str):
    tk = name.lower().strip().replace(" ", "_")
    r = db_q("SELECT type_key FROM store_types WHERE type_key=?", (tk,), fetch="one")
    if not r:
        return await interaction.response.send_message(f"❌ النوع **{name}** غير موجود", ephemeral=True)
    db_q("DELETE FROM store_types WHERE type_key=?", (tk,))
    db_q("DELETE FROM store_accounts WHERE type_key=?", (tk,))
    await interaction.response.send_message(f"✅ تم حذف **{name}** وكل حساباته", ephemeral=True)

@bot.tree.command(name="sadd", description="📥 أضف حساب لنوع معين (الحد 10)")
@app_commands.describe(name="اسم النوع", account="يوزر:باس")
@app_commands.checks.has_permissions(administrator=True)
async def slash_sadd(interaction: discord.Interaction, name: str, account: str):
    tk = name.lower().strip().replace(" ", "_")
    r = db_q("SELECT type_key FROM store_types WHERE type_key=?", (tk,), fetch="one")
    if not r:
        return await interaction.response.send_message(
            f"❌ النوع **{name}** غير موجود، أضفه أولاً بـ `/saddtype`", ephemeral=True)
    qty = store_get_account_count(tk)
    if qty >= 10:
        return await interaction.response.send_message(
            "❌ المخزون ممتلئ! الحد الأقصى 10 حسابات لكل نوع", ephemeral=True)
    db_q("INSERT INTO store_accounts (type_key, account) VALUES (?,?)", (tk, account.strip()))
    await interaction.response.send_message(
        f"✅ تم إضافة حساب لـ **{name}** ({qty+1}/10)", ephemeral=True)

@bot.tree.command(name="spoints", description="💰 اعرض رصيد النقاط")
@app_commands.describe(member="المستخدم (اختياري)")
async def slash_spoints(interaction: discord.Interaction, member: Optional[discord.Member] = None):
    target = member or interaction.user
    pts    = store_get_points(str(target.id))
    label  = "رصيدك" if target.id == interaction.user.id else f"رصيد {target.display_name}"
    e = discord.Embed(title="💰 رصيد النقاط", color=0x5865F2,
        description=f"{label}: **{pts} نقطة**")
    await interaction.response.send_message(embed=e, ephemeral=True)

@bot.tree.command(name="sremoveaccount", description="🗑️ احذف حساب من المخزون")
@app_commands.describe(name="اسم النوع", number="رقم الحساب (1 = الأول)")
@app_commands.checks.has_permissions(administrator=True)
async def slash_sremoveaccount(interaction: discord.Interaction, name: str, number: int):
    tk   = name.lower().strip().replace(" ", "_")
    rows = db_q("SELECT id, account FROM store_accounts WHERE type_key=? ORDER BY id LIMIT 20", (tk,), fetch="all") or []
    if not rows:
        return await interaction.response.send_message(f"❌ لا توجد حسابات في **{name}**", ephemeral=True)
    idx = number - 1
    if idx < 0 or idx >= len(rows):
        return await interaction.response.send_message(f"❌ الرقم غير صحيح (1 - {len(rows)})", ephemeral=True)
    acc_id, account = rows[idx]
    db_q("DELETE FROM store_accounts WHERE id=?", (acc_id,))
    await interaction.response.send_message(f"✅ تم حذف: `{account}`", ephemeral=True)

@bot.tree.command(name="ssync", description="🔄 سجّل أوامر البوت (للأدمن)")
@app_commands.checks.has_permissions(administrator=True)
async def slash_ssync(interaction: discord.Interaction):
    await interaction.response.defer(ephemeral=True)
    total = 0
    try:
        synced = await bot.tree.sync(guild=interaction.guild)
        total += len(synced)
    except Exception as e:
        return await interaction.followup.send(f"❌ فشل: {e}", ephemeral=True)
    try:
        await bot.tree.sync()
    except: pass
    await interaction.followup.send(f"✅ تم تسجيل **{total}** أمر!", ephemeral=True)



# ─── حماية إضافية: منع إنشاء رتب بكثرة ──────────────────────
@bot.event
async def on_guild_role_create(role):
    guild = role.guild
    row = db_q("SELECT enabled,punishment,whitelist,threshold,window_seconds FROM protection WHERE guild_id=?", (str(guild.id),), fetch="one")
    if not row or not row[0]: return
    wl = json.loads(row[2] or "[]"); threshold = row[3] or 3; window = row[4] or 60
    try:
        async for e in guild.audit_logs(limit=1, action=discord.AuditLogAction.role_create):
            if e.user.id == bot.user.id or str(e.user.id) in wl: return
            uid = str(guild.id)
            recent_deletions.setdefault(uid, {})
            recent_deletions[uid].setdefault("role_creates", [])
            recent_deletions[uid]["role_creates"].append({"user":e.user.id,"time":time.time()})
            recent_deletions[uid]["role_creates"] = [d for d in recent_deletions[uid]["role_creates"] if time.time()-d["time"]<window]
            if len([d for d in recent_deletions[uid]["role_creates"] if d["user"]==e.user.id]) >= threshold:
                await apply_punishment(guild, e.user, row[1], f"إنشاء رتب مشبوه")
    except Exception as ex: print(f"prot-role-create:{ex}")

# ─── أوامر ضبط الحماية ──────────────────────────────────────

@bot.tree.command(name="protection-threshold", description="عدد المخالفات قبل العقوبة")
@app_commands.describe(count="عدد المخالفات (1-10)")
async def slash_prot_threshold(interaction: discord.Interaction, count: int):
    if not interaction.user.guild_permissions.administrator:
        return await interaction.response.send_message("❌", ephemeral=True)
    count = max(1, min(10, count))
    db_upsert("protection", str(interaction.guild.id), threshold=count)
    await interaction.response.send_message(
        f"✅ العقوبة تُنفَّذ بعد **{count}** مخالفة", ephemeral=True)

@bot.tree.command(name="protection-window", description="النافذة الزمنية لرصد المخالفات (ثانية)")
@app_commands.describe(seconds="الثواني (10-300)")
async def slash_prot_window(interaction: discord.Interaction, seconds: int):
    if not interaction.user.guild_permissions.administrator:
        return await interaction.response.send_message("❌", ephemeral=True)
    seconds = max(10, min(300, seconds))
    db_upsert("protection", str(interaction.guild.id), window_seconds=seconds)
    await interaction.response.send_message(
        f"✅ نافذة الرصد: **{seconds}** ثانية", ephemeral=True)

@bot.tree.command(name="protection-status", description="عرض إعدادات الحماية الحالية")
async def slash_prot_status(interaction: discord.Interaction):
    if not interaction.user.guild_permissions.administrator:
        return await interaction.response.send_message("❌", ephemeral=True)
    row = db_q("SELECT enabled,punishment,whitelist,threshold,window_seconds FROM protection WHERE guild_id=?",
               (str(interaction.guild.id),), fetch="one")
    e = discord.Embed(title="🛡️ إعدادات الحماية", color=discord.Color.blue())
    if not row:
        e.description = "لم تُضبط إعدادات الحماية بعد"
    else:
        enabled, pun, wl_raw, thr, win = row
        wl = json.loads(wl_raw or "[]")
        punmap = {"ban":"🔨 باند","kick":"👢 طرد","timeout":"⏱️ تايم أوت","strip":"🃏 سحب رتب"}
        e.add_field(name="الحالة", value="✅ مفعّلة" if enabled else "❌ موقوفة", inline=True)
        e.add_field(name="العقوبة", value=punmap.get(pun, pun or "ban"), inline=True)
        e.add_field(name="عدد المخالفات", value=f"{thr or 3} مخالفة", inline=True)
        e.add_field(name="النافذة الزمنية", value=f"{win or 60} ثانية", inline=True)
        e.add_field(name="الوايت ليست", value=f"{len(wl)} عضو", inline=True)
    e.set_footer(text="protection-on/off • protection-punishment • protection-threshold • protection-window • protection-whitelist")
    await interaction.response.send_message(embed=e, ephemeral=True)

# ═══════════════════════════════════════════════════════════════
#  تشغيل البوت
# ═══════════════════════════════════════════════════════════════

def _start_bot_thread():
    import time as _time, os as _os
    global _last_error, _bot_started
    _bot_started = True

    print("=" * 50)
    print(f"🔑 TOKEN: {'✅ موجود (' + str(len(TOKEN)) + ' حرف)' if TOKEN else '❌ مفقود!'}")
    print(f"🌐 RENDER_URL: {RENDER_URL or '(فارغ)'}")
    print("=" * 50)

    if not TOKEN:
        _last_error = "TOKEN_MISSING"
        print("❌ TOKEN مفقود — أضف TOKEN في Render Environment"); return

    try:
        init_db(); print("✅ DB جاهز")
    except Exception as e:
        print(f"⚠️ DB: {e}")

    # انتظر 10 ثوانٍ قبل الاتصال — يكسر حلقة rate limit عند إعادة التشغيل السريعة
    print("⏳ انتظار 10ث...")
    _time.sleep(10)

    print("⏳ جاري الاتصال بـ Discord...")
    try:
        bot.run(TOKEN, log_handler=None, reconnect=True)
        print("✅ البوت أغلق بشكل طبيعي")
    except discord.errors.LoginFailure:
        _last_error = "TOKEN_INVALID"
        print("❌ TOKEN خاطئ أو منتهي")
    except discord.errors.PrivilegedIntentsRequired:
        _last_error = "INTENTS_DISABLED"
        print("❌ فعّل Privileged Intents في Developer Portal")
    except Exception as e:
        _last_error = str(e)
        print(f"❌ خطأ في الاتصال: {e}")
        # انتظر 3 دقائق ثم أعد تشغيل العملية كاملاً — Render يعطينا bot object جديد نظيف
        print("🔄 انتظار 3 دقائق ثم إعادة تشغيل كاملة...")
        _time.sleep(180)
        _os._exit(1)  # إعادة تشغيل كاملة = object نظيف جديد

threading.Thread(target=_start_bot_thread, daemon=True).start()

# Flask في main thread
print(f"🌐 Flask على port {_flask_port}")
_app.run(host="0.0.0.0", port=_flask_port, use_reloader=False)
