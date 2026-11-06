## 平台版本更新

登录超级管理员或管理员账号后，可通过以下方式打开“版本管理”弹窗：

- 点击页面右上角的“版本管理”。
- Windows / Linux：按 **Ctrl + U**。
- macOS：按 **Command + U**，也支持 **Ctrl + U**。

使用快捷键时，请先点击页面空白处；焦点在输入框、代码编辑器或服务器终端中时不触发，以免影响编辑和终端操作。普通成员账号不显示版本管理入口。

弹窗会显示当前版本、可安装版本和更新说明。选择“安装此版本”并确认前，请确保没有正在进行的部署。提交成功表示更新任务已交给独立的 PM2 更新进程，尚不代表安装完成；更新进程完成后会重新启动平台服务，稍后刷新页面即可核对当前版本。可在服务器执行 `pm2 logs deployer-updater` 查看更新日志。

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
