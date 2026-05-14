FROM node:20-alpine

WORKDIR /frontend_container

# Copy dependency manifests first for Docker layer caching
COPY package.json .
COPY package-lock.json .

# Install frontend dependencies defined in package.json
RUN npm install

# Vite development server port
EXPOSE 5173

COPY . .

# Start the Vite dev server and listen on all container interfaces for Docker networking
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]