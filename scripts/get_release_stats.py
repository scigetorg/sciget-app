import requests
import re

# Configuration
OWNER = "NeuroDesk"
REPO = "neurodesk-app"
README_FILE = "README.md"

def fetch_release_stats():
    url = f"https://api.github.com/repos/{OWNER}/{REPO}/releases/latest"
    response = requests.get(url)
    if response.status_code == 200:
        release = response.json()
        stats = []
        downloads = 0
        for asset in release.get("assets", []):
            stats.append(f"{asset['name']}: {asset['download_count']} downloads")
        for stat in stats:
            if stat.split(" ")[0].strip(":") != 'latest.yml':
                downloads += int(stat.split(" ")[1].strip())
        return downloads
    else:
        raise Exception(f"Error: Unable to fetch releases. Status Code: {response.status_code}")

def update_readme(stats):
    with open(README_FILE, "r+") as file:
        content = file.read()
        # Replace stats section in README
        new_content = re.sub(
            r"(?<=<!-- STATS_START -->)(.*?)(?=<!-- STATS_END -->)",
            f"![Static Badge](https://img.shields.io/badge/Downloads-{stats}-white)",
            content,
            flags=re.DOTALL,
        )
        file.seek(0)
        file.write(new_content)
        file.truncate()

if __name__ == "__main__":
    stats = fetch_release_stats()
    update_readme(stats)
    print("README updated with download stats!")
