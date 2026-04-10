FROM node:alpine

WORKDIR /usr/src/app
ENV CI=true

COPY . .

RUN npm install -g pnpm 

RUN pnpm install

CMD [ "pnpm", "test" ]