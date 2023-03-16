from urllib.request import urlopen

REPOSITORY = "neurodesk.github.io"
ORGANIZATION = "NeuroDesk"


def find_latest_stable(owner, repository):
    """Find latest stable release on GitHub for given repository."""
    endpoint = f"https://raw.githubusercontent.com/{owner}/{repository}/main/data/neurodesktop.toml"
    releases = urlopen(endpoint)
    for release in releases:
        version = str(release).split('=')[1].split('"')[1]
        return version

if __name__ == '__main__':   
    print(find_latest_stable(owner=ORGANIZATION, repository=REPOSITORY))