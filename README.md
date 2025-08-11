# Whisspra Backend

This is the secure Node.js backend for the Whisspra chat platform.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [MongoDB](https://www.mongodb.com/try/download/community) (or a MongoDB Atlas account)

## Setup Instructions

1.  **Clone the repository** (if applicable) and navigate into the `whisspra-backend` directory.

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Create an environment file:**
    -   Copy the example environment file:
        ```bash
        cp .env.example .env
        ```
    -   Open the `.env` file and fill in the required values:
        -   `PORT`: The port the server will run on (e.g., 5000).
        -   `MONGO_URI`: Your MongoDB connection string.
        -   `JWT_SECRET`: A long, random string to secure your authentication tokens.
        -   `NODE_ENV`: Set to `development` or `production`.

## Running the Server

-   **Development Mode (with auto-reloading):**
    This command uses `nodemon` to automatically restart the server when files change.
    ```bash
    npm run dev
    ```

-   **Production Mode:**
    ```bash
    npm start
    ```

The server will start on the port specified in your `.env` file. You should see log messages in your console indicating