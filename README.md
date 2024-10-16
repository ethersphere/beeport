This is a project developed with [Next.js](https://nextjs.org/), a React framework that enables the creation of web applications with server-side rendering (SSR) and static site generation.

## Prerequisites / Requisitos Previos

Make sure you have the following components installed before starting:

- [Node.js](https://nodejs.org/) (version 16.8 or higher)
- [npm](https://www.npmjs.com/) (comes with Node.js) or [Yarn](https://yarnpkg.com/)

## Installation / Instalación

Follow these steps to install and run the project locally:

1. **Install dependencies:**

   If you use npm:

   ```bash
   npm install
   ```

   If you prefer to use Yarn:

   ```bash
   yarn install
   ```

2. **Run the development server:**

   With npm:

   ```bash
   npm run dev
   ```

   With Yarn:

   ```bash
   yarn dev
   ```

3. **Open the application in your browser:**

   Once the server is running, open your browser and go to [http://localhost:3000](http://localhost:3000) to see the application in action.

## Project Structure / Estructura del Proyecto

Here is a basic description of the project structure:

- **`/pages`**: Contains all the routes of the application. Each file in this directory corresponds to a different route.
- **`/components`**: Contains reusable components.
- **`/public`**: Contains static files like images, fonts, etc.
- **`/styles`**: Contains the project's CSS or SASS files.
- **`/api`**: (Optional) Custom API routes can be defined here.

## Available Scripts / Scripts Disponibles

- **`npm run dev`**: Runs the application in development mode.
- **`npm run build`**: Builds the application for production.
- **`npm start`**: Starts the server in production mode.

## Deployment / Despliegue

To deploy the project to a production server, you must first build the application:

```bash
npm run build
```

Then, you can start the server in production mode:

```bash
npm start
```

Or, if you prefer to use a deployment service like [Vercel](https://vercel.com/), simply connect your repository and follow the service instructions.


---

This README should help you get started with your Next.js project and provide a clear guide for installation and execution. Good luck with your project!

---
