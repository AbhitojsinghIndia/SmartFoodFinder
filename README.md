# SmartFoodFinder

SmartFoodFinder is a web application designed to help users manage kitchen ingredients, organise shopping lists, and discover recipes based on available ingredients.

## Features

- **My Kitchen:** Add, edit, search, and delete kitchen ingredients.
- **Low-stock tracking:** Identify ingredients below their configured quantity threshold.
- **Recipe Finder:** Search recipes and explore recipe suggestions based on kitchen inventory.
- **Shopping List:** Add, edit, search, and remove shopping items.
- **Finish Shopping:** Confirm purchases and optionally add purchased ingredients to My Kitchen.
- **Data persistence:** Store application data in MySQL.

## Technology Stack

- Java 21
- Spring Boot
- Maven
- MySQL
- HTML
- CSS
- JavaScript

## Prerequisites

Install the following before running the application:

- JDK 21
- Apache Maven, or use the Maven Wrapper included in the project
- MySQL Server
- MySQL Workbench (optional, for database management)

## Database Setup

1. Start MySQL Server.
2. Create the `food_ingredients` database.
3. Review `database/schema.sql` and run it against a fresh database.
4. Ensure the recipe dataset is available. The schema creates the recipe table but does not populate it with recipe records.

**Note:** The database schema is being prepared and must be verified against the application's actual database requirements before use.

## Configuration

Configure the database connection using environment variables and your local Spring Boot configuration.

The application expects these settings:

- `DB_PASSWORD`: MySQL password
- `spring.datasource.url`: MySQL JDBC connection URL
- `spring.datasource.username`: MySQL username

Do not commit real passwords, API keys, or other secrets to GitHub.

## Run the Application

1. Open the project folder in VS Code.
2. Configure the MySQL connection.
3. Open a terminal in the directory containing `pom.xml`.
4. Set the database password in PowerShell:

   ```powershell
   $env:DB_PASSWORD = "YOUR_MYSQL_PASSWORD"
   ```

5. Start Spring Boot:

   ```powershell
   mvn spring-boot:run
   ```

   Alternatively, use the Maven Wrapper included in the project:

   ```powershell
   .\mvnw.cmd spring-boot:run
   ```

6. Open the application in your browser:

   `http://localhost:8080/`

Keep the terminal running while using the application.

## Project Structure

```text
smartfoodfinder/
├── database/
│   └── schema.sql
├── src/
│   ├── main/
│   │   ├── java/
│   │   └── resources/
│   │       ├── static/
│   │       ├── templates/
│   │       └── application.properties
│   └── test/
├── .gitignore
├── README.md
└── pom.xml
```

## Current Status

The main application features have been tested locally. Database setup for a fresh installation and public deployment still require verification.

## Future Improvements

- Public online deployment
- Additional automated tests
- Improved mobile experience
- More recipe data and recipe discovery features