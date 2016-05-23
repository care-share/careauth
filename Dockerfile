FROM node:0.12.7

# install build essentials (allows for native node modules)
RUN apt-get update && apt-get install -y build-essential

# use HTTPS instead of GIT protocol (avoid firewall issues)
RUN git config --global url."https://".insteadOf git://

# create application directory and use it as the working directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# install the bower binary
RUN npm -g install bower

# install node (server-side) dependencies
COPY package.json /usr/src/app/
RUN npm install

# install bower (client-side) dependencies
COPY bower.json .bowerrc /usr/src/app/
RUN bower install --allow-root

# copy the rest of the application over
COPY . /usr/src/app

# binary to execute
CMD ["/usr/src/app/start-server.sh"]
