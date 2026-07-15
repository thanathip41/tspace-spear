FROM node:22-bookworm

 WORKDIR /app

 RUN apt-get update && apt-get install -y \
     git \
     python3 \
     make \
     g++ \
     && rm -rf /var/lib/apt/lists/*

 COPY package*.json ./

 RUN npm install   # or npm ci if you have lock file

 COPY . .

 CMD ["node", "index.js"]
