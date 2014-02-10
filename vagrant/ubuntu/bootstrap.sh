#! /usr/bin/env bash

apt-get update

# golang notoriously goes interactive in middle of install, the below is to suppress that
apt-get install debconf-utils
cat /vagrant/golang.seed | debconf-set-selections

# Install dependencies
apt-get install -q -y make g++ golang mercurial couchdb nginx git

# Need a newer version of node than what is available by default to support this particular typescript version
wget http://nodejs.org/dist/v0.10.25/node-v0.10.25.tar.gz && tar -xzf node-v0.10.25.tar.gz && cd node-v0.10.25 && ./configure && make -j$(($(nproc) + 1)) && make install
npm install -g typescript@0.9.0-1

# Fetch code and build
cd ~
git clone https://github.com/plasma-umass/Apply2.git
cd Apply2
make

# Create and run a sample department
./apply2 newdept sample
./apply2 newreviewer scooby redbull64 "Scooby Doo"
./apply2 testserver
