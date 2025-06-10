FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN chmod +x ./engine/stockfish

CMD ["npm", "start"]
