初始化服务器

## ubuntu:

sudo apt update
sudo apt install apt-transport-https ca-certificates curl software-properties-common -y
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" -y

apt-cache policy docker-ce
sudo apt install docker-ce -y
sudo systemctl start docker
sudo systemctl enable docker

## centos:

sudo yum install -y yum-utils device-mapper-persistent-data lvm2
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io
sudo systemctl start docker
sudo systemctl enable docker


## 亚马逊
sudo dnf update -y
sudo dnf install -y yum-utils
sudo dnf install docker -y
sudo systemctl start docker
sudo systemctl enable docker
