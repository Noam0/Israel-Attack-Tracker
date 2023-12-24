import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";

import Chart from 'chart.js/auto'

const db = new pg.Client({
user: "postgres",
host: "localhost",
database: "Rockets On Israel",
password: "n1o2a3m4001",
port: 5432,
});
db.connect();

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));




app.get("/", async (req, res) => {
  try {
    // Getting new data from the API alerts
    const response = await axios.get("https://www.oref.org.il/WarningMessages/History/AlertsHistory.json");
    const responseData = response.data;
   
    // Putting data in the database
    for (const alert of response.data) {
      const { alertDate, title, data, category } = alert;
      const query = `
        INSERT INTO alerts (alertdate, title, location, category)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (alertdate, title, location, category) DO NOTHING;`;

        const params = [alertDate, title, data, category];
      // Execute the query
      await db.query(query, params);
      
    }

    const currentDate = new Date();
    const todaysDate = currentDate.toISOString().split('T')[0]; // Get date in YYYY-MM-DD format

    // Get the fresh data from the database and render it to the view

    //the last alert on israel
    const freshData = await db.query("SELECT * FROM alerts ORDER BY alertdate DESC");


    //the last 7 days:
    const xValues = getLastSevenDays();

    
    const yValuesQuery = await Promise.all(
      xValues.map(async (date) => {
        // Using ::date casting directly in the WHERE clause
        const result = await db.query("SELECT COUNT(*) FROM alerts WHERE alertdate::text LIKE $1", [`%${date}%`]);
        return result.rows[0].count;
      })
    );



    //getting the number of alerts today:
    const todaysAlertCountResult = await db.query("SELECT COUNT(*) FROM alerts WHERE alertdate::date = $1", [todaysDate]);
    const todaysAlertCount = todaysAlertCountResult.rows[0].count || 0;
    
      

    res.render("index.ejs", {
       theLastAlertLocation: JSON.stringify(freshData.rows[0].location),
       theLastAlertDate: JSON.stringify(freshData.rows[0].alertdate),
        todaysDate,
        todaysAlertCount,
        xValues: xValues,
        yValues: yValuesQuery,
      
      });
      
  } catch (error) {
    // Handle errors
    console.error("Error making the GET request:", error.message);
    console.error("Error inserting data into the database:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});


//FUNCTIONS :

function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}-${day}`;
}

// Function to get the array of the last seven days
function getLastSevenDays() {
  const today = new Date();
  const lastSevenDays = [];

  for (let i = 6; i >= 0; i--) {
    const currentDate = new Date(today);
    currentDate.setDate(today.getDate() - i);
    lastSevenDays.push(formatDate(currentDate));
  }

  return lastSevenDays;
}

// Example usage
