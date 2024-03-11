sudo apt install -y podman docker-compose podman-compose
systemctl --user --now enable podman.socket
sudo loginctl enable-linger $USER

ssh-keygen -t ed25519
ssh-copy-id -i ~/.ssh/id_ed25519

podman system connection add development --identity ~/.ssh/id_ed25519 ssh://$USER@$HOSTNAME/run/user/$UID/podman/podman.sock