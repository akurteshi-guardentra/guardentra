# Use the official Node.js 20 slim image as the base
FROM node:20-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install both production and development dependencies 
# (necessary for 'tsx' and building the React frontend via Vite)
RUN npm ci

# Copy the rest of the application files
COPY . .

# Build Vite frontend assets into the /dist directory
RUN npm run build

# Expose default port (ignored by Cloud Run, but good metadata)
EXPOSE 8080

# Set environment variables
ENV NODE_ENV=production

# Start the Node/Express server running compiled/transpiled CJS code
CMD ["node", "dist/server.cjs"]
