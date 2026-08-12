#!/bin/bash

apt update
apt install -y unzip

curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs



LATEST_RELEASE_INFO=$(curl -s "https://api.github.com/repos/ruiku-tech/deployer/releases/latest")

DOWNLOAD_URL=$(echo "$LATEST_RELEASE_INFO" | grep "browser_download_url" | grep "release.zip" | head -n 1 | cut -d '"' -f 4)

wget -O /usr/release.zip "$DOWNLOAD_URL"

mkdir -p /usr/egg-server
unzip -o /usr/release.zip -d /usr/egg-server

cd /usr/egg-server

npm install

npm run mk-key

source ~/.bashrc

npm run start