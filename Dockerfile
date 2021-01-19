FROM node:12
COPY . /microdraw
WORKDIR /microdraw
RUN npm install
CMD ["npm", "start"]
