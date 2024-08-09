#!/bin/bash

# centos
sudo yum install -y yum-utils device-mapper-persistent-data lvm2
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io
sudo systemctl start docker
sudo systemctl enable docker

docker run -d -p 33017:27017 --name mongo-deploy mongo:4.4

apt install -y unzip

curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

TOKEN="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"

LATEST_RELEASE_INFO=$(curl -H "Authorization: token $TOKEN" -s "https://api.github.com/repos/ruiku-tech/deployer/releases/latest")

DOWNLOAD_URL=$(echo "$LATEST_RELEASE_INFO" | grep "browser_download_url" | grep "release.zip" | head -n 1 | cut -d '"' -f 4)

wget --header="Authorization: token $TOKEN" -O /usr/release.zip "$DOWNLOAD_URL"

mkdir /usr/egg-server
unzip -o /usr/release.zip -d /usr/egg-server

cd /usr/egg-server

npm install

npm run start