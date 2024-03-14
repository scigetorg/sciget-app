systemctl --user --now enable podman.socket
sudo loginctl enable-linger $USER

ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519
# chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys
# ssh-copy-id -i ~/.ssh/id_ed25519.pub $HOSTNAME
cat  ~/.ssh/id_ed25519.pub | cat >> ~/.ssh/authorized_keys
podman system connection add development --identity ~/.ssh/id_ed25519 ssh://$USER@$HOSTNAME/run/user/$UID/podman/podman.sock