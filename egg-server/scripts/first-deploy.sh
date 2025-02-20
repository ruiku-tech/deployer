#!/bin/bash

# centos
sudo yum install -y yum-utils device-mapper-persistent-data lvm2
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io
sudo systemctl start docker
sudo systemctl enable docker

docker run -d -p 33017:27017 --name mongo-deploy --restart always mongo:4.4

yum install -y unzip

#curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo yum install -y nodejs
#sudo yum install -y npm

TOKEN=$GHTOKEN

LATEST_RELEASE_INFO=$(curl -H "Authorization: token $TOKEN" -s "https://api.github.com/repos/ruiku-tech/deployer/releases/latest")

DOWNLOAD_URL=$(echo "$LATEST_RELEASE_INFO" | grep "browser_download_url" | grep "release.zip" | head -n 1 | cut -d '"' -f 4)

wget -O /usr/release.zip "$DOWNLOAD_URL"

mkdir -p /usr/egg-server
unzip -o /usr/release.zip -d /usr/egg-server

cd /usr/egg-server

npm install

npm run mk-key

source ~/.bashrc

npm run start