FROM node:0.12.7

# install build essentials (allows for native node modules)
RUN apt-get update && apt-get install -y build-essential && apt-get install -y mongodb-server

# use HTTPS instead of GIT protocol (avoid firewall issues)
RUN git config --global url."https://".insteadOf git://

# create application directory and use it as the working directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# install node (server-side) dependencies
COPY package.json /usr/src/app/
RUN npm install

# install bower (client-side) dependencies
COPY bower.json /usr/src/app/
RUN bower install --allow-root

# copy the rest of the application over
COPY . /usr/src/app

# build the server
RUN ember build

# binary to execute
ENTRYPOINT ["/usr/local/bin/node"]

# default command: start the server
CMD ["app"]
