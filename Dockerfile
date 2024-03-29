# Use the official Node.js image as the base image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package.json pnpm-lock.yaml ./

# Install dependencies using pnpm
RUN npm install -g pnpm && pnpm install

# Copy the rest of the application code to the working directory
COPY . .

# Set the BOT_TOKEN environment variable
ENV BOT_TOKEN=

# Specify the command to run your application
CMD [ "pnpm", "start" ]