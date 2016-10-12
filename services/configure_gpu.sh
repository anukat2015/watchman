#!/bin/bash

for TESTFOR in "cuda-repo-ubuntu1404-8-0-local_8.0.44-1_amd64.deb" "libcudnn5_5.1.5-1+cuda8.0_amd64.deb" "libcudnn5-dev_5.1.5-1+cuda8.0_amd64.deb"
do
    if [ ! -e $TESTFOR ]
    then
        echo File '"'$TESTFOR'"' must be present in this directory
        exit 5
    fi
done

# Reference:
#   https://github.com/NVIDIA/nvidia-docker/wiki/Deploy-on-Amazon-EC2

# Install NVIDIA drivers 361.42
sudo apt-get install --no-install-recommends -y gcc make libc-dev
wget -P http://us.download.nvidia.com/XFree86/Linux-x86_64/361.42/NVIDIA-Linux-x86_64-361.42.run
sudo sh NVIDIA-Linux-x86_64-361.42.run --silent

# Install nvidia-docker and nvidia-docker-plugin
wget -P /tmp https://github.com/NVIDIA/nvidia-docker/releases/download/v1.0.0-rc.3/nvidia-docker_1.0.0.rc.3-1_amd64.deb
sudo dpkg -i /tmp/nvidia-docker*.deb && rm /tmp/nvidia-docker*.deb

# Install cuda
# Reference:
#    https://developer.nvidia.com/cuda-downloads
sudo dpkg -i cuda-repo-ubuntu1404-8-0-local_8.0.44-1_amd64.deb
sudo apt-get update
sudo apt-get install cuda

# Install CudNN
sudo dpkg -i libcudnn5_5.1.5-1+cuda8.0_amd64.deb
sudo dpkg -i libcudnn5-dev_5.1.5-1+cuda8.0_amd64.deb

