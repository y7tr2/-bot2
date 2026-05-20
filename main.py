import discord
from discord import app_commands
from discord.ext import commands
import os
import random

TOKEN = os.getenv("TOKEN")

intents = discord.Intents.all()
bot = commands.Bot(command_prefix="!", intents=intents)

# ===== Templates =====
TEMPLATES = {
    "shop": {
        "roles": ["Owner", "Admin", "Support", "Member"],
        "channels": ["shop", "orders", "tickets", "balance", "logs"]
    },
    "gaming": {
        "roles": ["Owner", "Admin", "Mod", "Member"],
        "channels": ["chat", "clips", "media", "voice"]
    },
    "support": {
        "roles": ["Owner", "Support", "Member"],
        "channels": ["tickets", "support", "logs"]
    },
    "community": {
        "roles": ["Owner", "Admin", "Member"],
        "channels": ["general", "media", "rules", "announcements"]
    },
    "trade": {
        "roles": ["Owner", "Trader", "Member"],
        "channels": ["offers", "proof", "chat"]
    },
    "dev": {
        "roles": ["Owner", "Dev", "Tester"],
        "channels": ["code", "bugs", "updates"]
    },
    "vip": {
        "roles": ["Owner", "VIP", "Member"],
        "channels": ["vip-chat", "vip-media"]
    },
    "anime": {
        "roles": ["Owner", "Fan", "Member"],
        "channels": ["chat", "images", "news"]
    },
    "study": {
        "roles": ["Owner", "Teacher", "Student"],
        "channels": ["notes", "help", "chat"]
    },
    "clan": {
        "roles": ["Leader", "Co-Leader", "Member"],
        "channels": ["chat", "wars", "announcements"]
    }
}

# ===== Decorations =====
role_styles = [
    "👑 {}",
    "『{}』",
    "✦ {} ✦",
    "⚡ {}",
    "★ {} ★"
]

channel_styles = [
    "💬・{}",
    "🏪・{}",
    "🎫・{}",
    "📢・{}",
    "📊・{}",
    "🔒・{}",
    "🎮・{}"
]

def fancy(name, styles):
    return random.choice(styles).format(name)


# ===== Setup Command =====
@bot.tree.command(name="setup")
@app_commands.describe(template="نوع السيرفر")
async def setup(interaction: discord.Interaction, template: str):

    if not interaction.user.guild_permissions.administrator:
        return await interaction.response.send_message("ما عندك صلاحية")

    if template not in TEMPLATES:
        return await interaction.response.send_message("Template غير موجود")

    await interaction.response.send_message("جاري تجهيز السيرفر...")

    data = TEMPLATES[template]

    # Roles
    for role in data["roles"]:
        await interaction.guild.create_role(name=fancy(role, role_styles))

    # Channels
    for ch in data["channels"]:
        await interaction.guild.create_text_channel(fancy(ch, channel_styles))

    await interaction.followup.send("تم تجهيز السيرفر بنجاح ✅")


# ===== Reset Command =====
@bot.tree.command(name="reset")
async def reset(interaction: discord.Interaction):

    if not interaction.user.guild_permissions.administrator:
        return await interaction.response.send_message("ما عندك صلاحية")

    await interaction.response.send_message("جاري الحذف...")

    for channel in interaction.guild.channels:
        try:
            await channel.delete()
        except:
            pass

    for role in interaction.guild.roles:
        if role.name != "@everyone":
            try:
                await role.delete()
            except:
                pass

    await interaction.followup.send("تم إعادة ضبط السيرفر 🧨")


# ===== Ping =====
@bot.tree.command(name="ping")
async def ping(interaction: discord.Interaction):
    await interaction.response.send_message(f"Pong 🏓 {round(bot.latency * 1000)}ms")


# ===== Ready =====
@bot.event
async def on_ready():
    await bot.tree.sync()
    print(f"Logged in as {bot.user}")


bot.run(TOKEN)
