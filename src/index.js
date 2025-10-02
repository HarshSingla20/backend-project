import dotenv from "dotenv";

import connectDB from "./db/db.js";
dotenv.config({ path: "../.env" });


const PORT = process.env.PORT || 8000;
connectDB()
.then(() => {
    app.listen(PORT || 5000, () => {
        console.log(`Server is running on http://localhost:${PORT}`)
    })
})
.catch((error) => {
    console.log("MongoDB Connection FAILED !!!!", error);
})
