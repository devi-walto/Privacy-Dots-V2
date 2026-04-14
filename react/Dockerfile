FROM node:20-alpine

WORKDIR /frontend_container

COPY package.json .
COPY package-lock.json .

RUN npm install

EXPOSE 3000

COPY . .

CMD ["npm", "start" ]